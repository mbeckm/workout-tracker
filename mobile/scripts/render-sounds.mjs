#!/usr/bin/env node
// Renders the device sounds (SPEC §9) as WAVs for the TrimDevice module: 44.1 kHz mono 16-bit,
// peak −3 dBFS, each under 1 s. Pure Node, seeded noise, so a re-render is byte-identical.
//
//   node scripts/render-sounds.mjs
//
// The receipt's stepper chatter ships as one `print-tick`; the module plays it 18× 100 ms apart
// in step with the feed (SPEC §8), so `print` stays one short file.

import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const PEAK = 10 ** (-3 / 20);
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules', 'trim-device', 'ios', 'sounds');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ biquad bandpass (constant 0 dB peak gain), the same shape as Web Audio's `bandpass`. */
function bandpass(input, freq, q) {
  const w0 = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  const out = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

function makeVoice(seconds, seed) {
  return { buffer: new Float64Array(Math.ceil(seconds * RATE)), random: mulberry32(seed) };
}

/** The prototype's `hit`: a decaying noise burst through a bandpass. */
function hit(voice, at, freq, q, gain, length) {
  const n = Math.floor(RATE * length);
  const noise = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    noise[i] = (voice.random() * 2 - 1) * Math.pow(1 - i / n, 5);
  }
  // Let the filter ring out past the burst, as the Web Audio graph does.
  const tail = new Float64Array(n + Math.floor(RATE * 0.02));
  tail.set(noise);
  const filtered = bandpass(tail, freq, q);
  const start = Math.floor(at * RATE);
  for (let i = 0; i < filtered.length && start + i < voice.buffer.length; i++) {
    voice.buffer[start + i] += filtered[i] * gain;
  }
}

/** The prototype's `thump`: a sine whose pitch and gain fall exponentially. */
function thump(voice, at, from, to, gain, duration) {
  const start = Math.floor(at * RATE);
  const n = Math.floor((duration + 0.02) * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < voice.buffer.length; i++) {
    const t = Math.min(i / RATE, duration);
    const progress = t / duration;
    const freq = from * Math.pow(to / from, progress);
    const level = gain * Math.pow(0.001 / gain, progress);
    phase += (2 * Math.PI * freq) / RATE;
    voice.buffer[start + i] += Math.sin(phase) * level;
  }
}

function finished(voice) {
  const { buffer } = voice;
  // 5 ms fade at the end so a cut tail never clicks.
  const fade = Math.floor(RATE * 0.005);
  for (let i = 0; i < fade; i++) {
    buffer[buffer.length - 1 - i] *= i / fade;
  }
  let peak = 0;
  for (const sample of buffer) {
    peak = Math.max(peak, Math.abs(sample));
  }
  const scale = peak > 0 ? PEAK / peak : 0;
  return buffer.map((sample) => sample * scale);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, i) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), i * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const SOUNDS = {
  // The prototype's clickSound(): a sharp latch clack, then 65 ms later a deeper seat thunk.
  cartridge() {
    const voice = makeVoice(0.3, 1);
    hit(voice, 0, 3200, 1.6, 1.0, 0.03);
    thump(voice, 0, 220, 90, 0.35, 0.06);
    hit(voice, 0.065, 900, 0.9, 0.7, 0.06);
    thump(voice, 0.065, 120, 48, 0.8, 0.16);
    return voice;
  },
  // One stepper tick of the receipt's feed: a tiny dry tick with a hint of body.
  'print-tick'() {
    const voice = makeVoice(0.04, 2);
    hit(voice, 0, 2600, 2.2, 1.0, 0.008);
    thump(voice, 0, 700, 300, 0.25, 0.012);
    return voice;
  },
  // A soft low thud: a rubber stamp landing on paper.
  stamp() {
    const voice = makeVoice(0.26, 3);
    hit(voice, 0, 420, 0.8, 0.45, 0.04);
    thump(voice, 0, 110, 45, 0.9, 0.2);
    return voice;
  },
  // A very quiet key click. Full scale here; the module plays it at low volume.
  key() {
    const voice = makeVoice(0.03, 4);
    hit(voice, 0, 4200, 2.0, 1.0, 0.006);
    return voice;
  },
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, render] of Object.entries(SOUNDS)) {
  const samples = finished(render());
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(3)} s`);
}

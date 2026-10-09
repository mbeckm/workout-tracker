#!/usr/bin/env node
// Renders the device sounds (SPEC §9) as WAVs for the TrimDevice module: 44.1 kHz mono 16-bit,
// peak −3 dBFS, each under 1 s except the moments' (first open, the tour's `spin`). Pure Node, seeded noise, so a re-render is byte-identical.
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

/** Noise through a bandpass whose centre glides from `from` to `to`, under `envelope(progress)`. */
function sweep(voice, at, duration, from, to, q, gain, envelope) {
  const n = Math.floor(duration * RATE);
  const start = Math.floor(at * RATE);
  const block = 128;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let b = 0; b < n; b += block) {
    const progress = b / n;
    const freq = from * Math.pow(to / from, progress);
    const w0 = (2 * Math.PI * freq) / RATE;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    for (let i = b; i < Math.min(b + block, n) && start + i < voice.buffer.length; i++) {
      const x = voice.random() * 2 - 1;
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      voice.buffer[start + i] += y * gain * envelope(i / n);
    }
  }
}

/** A sine gliding from `from` to `to` Hz, under `envelope(progress)`. */
function glide(voice, at, duration, from, to, gain, envelope) {
  const n = Math.floor(duration * RATE);
  const start = Math.floor(at * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < voice.buffer.length; i++) {
    const progress = i / n;
    phase += (2 * Math.PI * from * Math.pow(to / from, progress)) / RATE;
    voice.buffer[start + i] += Math.sin(phase) * gain * envelope(progress);
  }
}

/** A struck metal partial: a sine at `freq` decaying over `decay` seconds. */
function ring(voice, at, freq, gain, decay) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(decay * 4 * RATE);
  for (let i = 0; i < n && start + i < voice.buffer.length; i++) {
    const t = i / RATE;
    voice.buffer[start + i] += Math.sin(2 * Math.PI * freq * t) * gain * Math.exp(-t / decay);
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
  // First open (the machine is born): the body approaches out of the dark, a long airy swell
  // that lands in a low thump.
  arrive() {
    const voice = makeVoice(1.7, 5);
    sweep(voice, 0, 1.6, 120, 1600, 1.1, 0.8, (p) => Math.pow(Math.sin((Math.PI * p) / 2), 3));
    glide(voice, 0, 1.6, 45, 70, 0.35, (p) => p * p);
    thump(voice, 1.56, 110, 42, 0.9, 0.14);
    return voice;
  },
  // The machine charging before the Start key slams in: rising air over a rising hum, faster ticks.
  charge() {
    const voice = makeVoice(1.25, 6);
    sweep(voice, 0, 1.22, 200, 3200, 1.4, 0.7, (p) => p * p);
    glide(voice, 0, 1.22, 60, 240, 0.45, (p) => 0.15 + 0.85 * p);
    for (let t = 0, step = 0.14; t < 1.15; t += step, step = Math.max(0.045, step * 0.86)) {
      hit(voice, t, 2600 + t * 1400, 2.4, 0.15 + 0.35 * (t / 1.15), 0.006);
    }
    return voice;
  },
  // The Start key slams home: a heavy low thud, a sharp metal hit and a short ring.
  bang() {
    const voice = makeVoice(0.9, 7);
    thump(voice, 0, 150, 38, 1.0, 0.45);
    hit(voice, 0, 2400, 1.2, 0.8, 0.05);
    hit(voice, 0.004, 620, 0.7, 0.9, 0.12);
    thump(voice, 0.01, 62, 30, 0.6, 0.7);
    ring(voice, 0.004, 1170, 0.06, 0.18);
    ring(voice, 0.004, 1730, 0.045, 0.14);
    ring(voice, 0.004, 2390, 0.03, 0.1);
    return voice;
  },
  // The display boots: two tiny electronic blips.
  boot() {
    const voice = makeVoice(0.22, 8);
    glide(voice, 0, 0.045, 1320, 1320, 0.5, (p) => (p < 0.1 ? p * 10 : 1 - p));
    glide(voice, 0.09, 0.06, 1980, 1980, 0.5, (p) => (p < 0.1 ? p * 10 : 1 - p));
    return voice;
  },
  // The big key pressed: a heavy mechanical clunk.
  press() {
    const voice = makeVoice(0.2, 20);
    hit(voice, 0, 1400, 1.4, 0.8, 0.02);
    thump(voice, 0, 170, 70, 0.9, 0.09);
    hit(voice, 0.005, 520, 0.9, 0.4, 0.04);
    return voice;
  },
  // The rocker tilts: a short tick with a little body.
  rocker() {
    const voice = makeVoice(0.08, 21);
    hit(voice, 0, 2200, 2.0, 1.0, 0.01);
    thump(voice, 0, 320, 180, 0.3, 0.03);
    return voice;
  },
  // One wheel detent: a tiny dry click.
  notch() {
    const voice = makeVoice(0.035, 22);
    hit(voice, 0, 3600, 3.0, 1.0, 0.004);
    hit(voice, 0.002, 1500, 2.0, 0.4, 0.006);
    return voice;
  },
  // A finish swatch picked: a metal tile set down.
  swatch() {
    const voice = makeVoice(0.22, 23);
    hit(voice, 0, 2800, 1.8, 1.0, 0.015);
    thump(voice, 0, 240, 120, 0.5, 0.05);
    ring(voice, 0.002, 1900, 0.05, 0.06);
    return voice;
  },
  // A tap on the display (a day row, the drum): a soft electronic blip, not a key's click.
  blip() {
    const voice = makeVoice(0.05, 24);
    glide(voice, 0, 0.035, 2400, 2600, 0.5, (p) => (p < 0.15 ? p / 0.15 : 1 - p));
    return voice;
  },
  // A plan loaded and the days have ticked in: the machine is ready. Three rising display tones,
  // a mechanical latch under the last, and a short metal shimmer.
  ready() {
    const voice = makeVoice(0.9, 25);
    const tone = (at, freq, length) => {
      const env = (p) => (p < 0.08 ? p / 0.08 : Math.pow(1 - p, 1.5));
      glide(voice, at, length, freq, freq, 0.42, env);
      glide(voice, at, length, freq * 2, freq * 2, 0.12, env);
    };
    tone(0, 988, 0.07);
    tone(0.09, 1319, 0.07);
    tone(0.18, 1976, 0.32);
    hit(voice, 0.18, 2600, 1.6, 0.6, 0.02);
    thump(voice, 0.18, 180, 70, 0.6, 0.1);
    ring(voice, 0.2, 2960, 0.04, 0.16);
    ring(voice, 0.2, 3950, 0.025, 0.12);
    return voice;
  },
  // Rest reaches 0:00: a digital watch alarm, beep-beep … beep-beep (in step with `restGo`).
  alarm() {
    const voice = makeVoice(0.74, 26);
    const env = (p) => (p < 0.05 ? p / 0.05 : p > 0.85 ? (1 - p) / 0.15 : 1);
    for (const at of [0, 0.14, 0.5, 0.64]) {
      glide(voice, at, 0.08, 2730, 2730, 0.6, env);
      glide(voice, at, 0.08, 8190, 8190, 0.12, env);
    }
    return voice;
  },
};

/** CSS `cubic-bezier()`: progress → eased progress (bisection on x; plenty for audio blocks). */
function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// The tour's launch, keep in step with TOUR_POSE, TOUR_POSE_CURVES and DEVICE.TOUR_LAUNCH in
// src/motion.ts: `spin` is drawn from the same turn curve, so every whoosh lands on a half turn.
const LAUNCH_SECONDS = 4.8;
const LAUNCH_TURNS = [
  [0, 0],
  [0.094, 0],
  [0.26, 720],
  [0.54, 2160],
  [0.69, 2520],
  [0.77, 2520],
  [0.9375, 2520],
  [0.969, 2520],
  [1, 2520],
];
const LAUNCH_CURVES = [
  [0.3, 0, 0.6, 1],
  [0.25, 0.6, 0.6, 1],
  [0, 0, 1, 1],
  [0.15, 0.6, 0.3, 1],
  [0.42, 0, 0.58, 1],
  [0.55, 0, 0.9, 0.4],
  [0, 0, 0.58, 1],
  [0.42, 0, 0.58, 1],
].map((c) => bezier(...c));

/** The launch's turn in degrees at `seconds`. */
function launchTurn(seconds) {
  const t = Math.min(Math.max(seconds / LAUNCH_SECONDS, 0), 1);
  let i = 0;
  while (i < LAUNCH_TURNS.length - 2 && t > LAUNCH_TURNS[i + 1][0]) i++;
  const [a, from] = LAUNCH_TURNS[i];
  const [b, to] = LAUNCH_TURNS[i + 1];
  return from + (to - from) * LAUNCH_CURVES[i]((t - a) / (b - a));
}

SOUNDS.spin = () => {
  // The tour's launch: a flick as it's thrown, a whoosh on every half turn (higher and denser as
  // the spin speeds up, gone in the hang), air as it drops, then the landing's thud and bounce.
  const voice = makeVoice(4.95, 27);
  const block = 64;
  const q = 1.1;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let hum = 0;
  for (let b = 0; b < voice.buffer.length; b += block) {
    const sec = b / RATE;
    const turn = launchTurn(sec);
    const speed = (launchTurn(sec + 0.01) - launchTurn(sec - 0.01)) / 0.02; // degrees per second
    const level = Math.min(1, speed / 1100);
    const face = Math.sin((turn * Math.PI) / 180) ** 2;
    const gain = Math.pow(level, 1.3) * (0.18 + 0.82 * face);
    const freq = Math.min(2600, 260 + speed * 1.25);
    const w0 = (2 * Math.PI * freq) / RATE;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    for (let i = b; i < Math.min(b + block, voice.buffer.length); i++) {
      const x = voice.random() * 2 - 1;
      const y = (alpha / a0) * x - (alpha / a0) * x2 - ((-2 * Math.cos(w0)) / a0) * y1 - ((1 - alpha) / a0) * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      hum += (2 * Math.PI * (38 + speed * 0.05)) / RATE;
      voice.buffer[i] += y * gain * 0.9 + Math.sin(hum) * level * 0.12;
    }
  }
  // The throw: a quick rising flick off the crouch.
  sweep(voice, 0.4, 0.14, 380, 2600, 1.3, 0.6, (p) => Math.sin(Math.PI * p));
  // The drop: falling air, rising as it nears the ground.
  sweep(voice, 3.7, 0.8, 500, 1500, 0.9, 0.22, (p) => p * p);
  // The landing and the bounce.
  thump(voice, 4.5, 130, 44, 1.0, 0.22);
  hit(voice, 4.5, 520, 0.8, 0.55, 0.05);
  thump(voice, 4.65, 95, 52, 0.35, 0.09);
  return voice;
};

// The tour's ring of lit dots ripples out from the device: a soft sonar pulse that opens up.
SOUNDS.pulse = () => {
  const voice = makeVoice(1.4, 28);
  const env = (p) => (p < 0.02 ? p / 0.02 : Math.pow(1 - p, 2.2));
  glide(voice, 0, 1.3, 330, 495, 0.5, env);
  glide(voice, 0, 1.3, 660, 990, 0.18, env);
  glide(voice, 0.01, 1.0, 1320, 1980, 0.06, env);
  sweep(voice, 0, 1.2, 500, 3000, 0.8, 0.12, (p) => Math.sin(Math.PI * Math.min(1, p * 1.6)) * (1 - p));
  return voice;
};

// The machine changes its skin: a tight closed-hat tick and a short blip on one note (D7). Short
// and high, its own sound apart from `swatch` (the paywall's and the choice cards' tile).
SOUNDS.reskin = () => {
  const voice = makeVoice(0.09, 29);
  hit(voice, 0, 9000, 1.2, 0.9, 0.025);
  hit(voice, 0, 6200, 1.6, 0.35, 0.015);
  const env = (p) => (p < 0.06 ? p / 0.06 : Math.pow(1 - p, 3));
  glide(voice, 0.003, 0.055, 2349, 2349, 0.55, env);
  glide(voice, 0.003, 0.04, 4698, 4698, 0.12, env);
  return voice;
};

// The parts snapping on, each a whole step higher than the last (D74: the build climbs).
for (let step = 1; step <= 7; step++) {
  const lift = Math.pow(2, ((step - 1) * 2) / 12);
  SOUNDS[`snap-${step}`] = () => {
    const voice = makeVoice(0.1, 10 + step);
    hit(voice, 0, 1800 * lift, 2.2, 1.0, 0.012);
    thump(voice, 0, 520 * lift, 260 * lift, 0.35, 0.03);
    hit(voice, 0.008, 700 * lift, 0.9, 0.4, 0.02);
    return voice;
  };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, render] of Object.entries(SOUNDS)) {
  const samples = finished(render());
  writeFileSync(join(OUT_DIR, `${name}.wav`), wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(3)} s`);
}

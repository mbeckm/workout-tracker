import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import catalogNames from '../catalog-names.json' with { type: 'json' };

/**
 * Import plan (Trim decision 88): pasted text and/or screenshots of a workout plan in, the plan's
 * structure out. Nothing is stored or logged here; the app falls back to reading on the phone when
 * this fails. Rate limiting is a Vercel Firewall rule on this path.
 *
 * POST { text?: string, images?: string[] }  (images: base64 JPEG, no data: prefix)
 * 200  { name, days: [{ title, lifts: [{ asWritten, name, qualifier, sets, reps, seconds }] }] }
 *      (`asWritten` is the source's words, `name` Claude's catalog pick; the app decides confidence)
 */

const MODEL = 'claude-haiku-5-5';
const MAX_TEXT = 20_000;
const MAX_IMAGES = 6;
/** Base64 length of one downscaled JPEG; the app sends ≤1568 px at ~0.8 quality. */
const MAX_IMAGE_B64 = 1_500_000;

const Lift = z.object({
  asWritten: z
    .string()
    .describe('The exercise exactly as the source names it, every word kept (e.g. "Weighted chin-ups"), without numbering, markdown, the part in parentheses or sets/reps.'),
  name: z.string().describe("The exercise. Trim's catalog name when it is clearly the same exercise, otherwise the source's words."),
  qualifier: z.string().nullable().describe('Equipment or variant the source gives in parentheses, e.g. "Barbell". Null if none.'),
  sets: z.number().int().nullable().describe('Working sets (not warm-ups). Null if the source gives none.'),
  reps: z.number().int().nullable().describe('Reps per set; for a range use the top ("6-8" is 8). Null for AMRAP/failure or none given.'),
  seconds: z.number().int().nullable().describe('For holds or timed work, seconds per set. Null otherwise.'),
});

const Plan = z.object({
  name: z.string().nullable().describe("The plan's own name if the source gives one, else null. Never invent one."),
  days: z.array(
    z.object({
      title: z.string().nullable().describe('The training day\'s name as given ("Upper A", "Push"). Null if unnamed. Leave out rest days.'),
      lifts: z.array(Lift),
    }),
  ),
});

const SYSTEM = `You read workout plans for Trim, a gym logging app, and return their structure.

The input is text someone copied (a ChatGPT answer, a note, a coach's message) and/or screenshots of another workout app (Hevy, Strong, Alpha Progression and similar). Several screenshots are pages of one plan, in order.

Rules:
- Return every training day in order, with its exercises in order. Skip rest days, warm-up routines, cardio notes and general advice.
- Screenshots of set tables: count the working sets (rows numbered 1, 2, 3...; skip warm-up rows marked W) and take the reps column.
- Never invent exercises, sets or reps that aren't in the input. Use null when something isn't given.
- Ignore app interface text (buttons, timers, tab bars, the clock).
- Exercise names: asWritten is always the source's own words, unchanged. In name, when an exercise is clearly the same as one in Trim's catalog below (including shorthand like RDL or OHP), use the catalog name exactly. When you're unsure, keep the source's words. The app compares the two and asks the user whenever the catalog name adds or drops anything (equipment, "weighted", "paused"…).

Trim's catalog:
${(catalogNames as string[]).join('\n')}`;

const client = new Anthropic();

function bad(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: { text?: unknown; images?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad(400, 'invalid_json');
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const images = Array.isArray(body.images) ? body.images.filter((item): item is string => typeof item === 'string') : [];
  if (!text && images.length === 0) return bad(400, 'empty');
  if (text.length > MAX_TEXT) return bad(413, 'text_too_long');
  if (images.length > MAX_IMAGES || images.some((image) => image.length > MAX_IMAGE_B64)) return bad(413, 'images_too_large');

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (data): Anthropic.ImageBlockParam => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }),
    ),
    { type: 'text', text: text ? `The plan:\n\n${text}` : 'Read the plan in these screenshots.' },
  ];

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(Plan) },
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return bad(422, 'unreadable');
    }
    // Token counts only (never contents), so cost per import can be checked.
    return Response.json(response.parsed_output, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Tokens-In': String(response.usage.input_tokens),
        'X-Tokens-Out': String(response.usage.output_tokens),
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return bad(429, 'busy');
    if (error instanceof Anthropic.APIError) return bad(502, 'upstream');
    return bad(500, 'failed');
  }
}

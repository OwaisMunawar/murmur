import { type ChatTurn } from '../engine/TextGenerator';
import { type FieldName } from './schema';

/** Roughly 1,800 tokens of transcript: the 350M model's context is 4k and needs room to answer. */
export const MAX_TRANSCRIPT_CHARS = 7_000;

const SYSTEM = `You turn a voice note transcript into JSON. Reply with one JSON object and nothing else.
Use exactly these keys, in this order:
{"title": "...", "tags": ["..."], "action_items": ["..."], "mood": "...", "summary": "..."}
title: 3 to 8 words naming the topic.
tags: 1 to 4 short lowercase topic words from this transcript.
action_items: tasks the speaker said they need to do, as short imperative phrases. [] if none.
mood: one of "positive", "neutral", "negative", "mixed".
summary: 2 or 3 sentences about what was said in this transcript.`;

export const EXAMPLE_INPUT =
  'So the bike is making that clicking noise again. I need to take it to the shop on Saturday and ask about new brake pads. Annoying, but at least the weather is nice.';
// Summary goes last: small models tend to close the object after the longest
// field, and everything before it then survives.
export const EXAMPLE_OUTPUT =
  '{"title":"Bike clicking noise","tags":["bike","repairs"],"action_items":["Take the bike to the shop on Saturday","Ask about new brake pads"],"mood":"mixed","summary":"The bike is clicking again and needs a check at the shop on Saturday, including new brake pads. Annoying, though the weather helps."}';

/** Forces the reply to open as the JSON object, so the model cannot start with prose. */
export const ENRICHMENT_PREFIX = '{"title":"';

export function repairPrefix(missing: readonly FieldName[]): string {
  return `{"${missing[0] ?? 'title'}":`;
}

/**
 * Keeps the start and end of very long transcripts: openings carry the topic
 * and endings carry the conclusions and to-dos, the middle is the most
 * expendable part.
 */
export function fitTranscript(transcript: string, maxChars: number = MAX_TRANSCRIPT_CHARS): string {
  const clean = transcript.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head - 5;
  return `${clean.slice(0, head).trimEnd()} ... ${clean.slice(clean.length - tail).trimStart()}`;
}

/** One worked example: on sub-billion-parameter models it does more for format adherence than any instruction. */
export function buildEnrichmentMessages(transcript: string): ChatTurn[] {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Transcript:\n${EXAMPLE_INPUT}` },
    { role: 'assistant', content: EXAMPLE_OUTPUT },
    { role: 'user', content: `Transcript:\n${fitTranscript(transcript)}` },
  ];
}

/**
 * Asks only for the fields that failed. A small model asked to redo the whole
 * object tends to repeat its mistake; a narrower request usually lands.
 */
export function buildRepairMessages(
  transcript: string,
  previous: string,
  missing: readonly FieldName[],
): ChatTurn[] {
  const keys = missing.map((k) => `"${k}"`).join(', ');
  return [
    ...buildEnrichmentMessages(transcript),
    { role: 'assistant', content: previous.slice(0, 1_500) },
    {
      role: 'user',
      content: `That reply is missing or has invalid ${keys}. Reply with a JSON object containing only ${keys}, about the transcript above.`,
    },
  ];
}

import { EXAMPLE_OUTPUT } from './prompts';
import { type Fields } from './schema';

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []);

/**
 * Small models sometimes copy the worked example into their answer ("brake
 * pads" turning up in a note about groceries). A field is treated as leaked
 * when it uses words that exist only in the example, never in the transcript.
 */
export function dropExampleLeaks(fields: Partial<Fields>, transcript: string): Partial<Fields> {
  const heard = words(transcript);
  const exampleOnly = new Set([...words(EXAMPLE_OUTPUT)].filter((w) => !heard.has(w)));
  const leaks = (text: string) => [...words(text)].filter((w) => exampleOnly.has(w)).length;

  const out: Partial<Fields> = { ...fields };
  if (out.title !== undefined && leaks(out.title) >= 1) delete out.title;
  if (out.summary !== undefined && leaks(out.summary) >= 2) delete out.summary;
  if (out.tags) {
    const kept = out.tags.filter((tag) => !exampleOnly.has(tag));
    if (kept.length > 0) out.tags = kept;
    else delete out.tags;
  }
  if (out.action_items) out.action_items = out.action_items.filter((item) => leaks(item) === 0);
  return out;
}

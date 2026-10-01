import { jsonrepair } from 'jsonrepair';

export type JsonExtraction =
  { ok: true; value: Record<string, unknown> } | { ok: false; reason: string };

/**
 * Pulls the first JSON object out of model output. Small models wrap JSON in
 * prose or code fences, stop mid-object at the token limit, or use single
 * quotes and trailing commas; `jsonrepair` handles the syntax, this handles
 * finding the object.
 */
export function extractJsonObject(raw: string): JsonExtraction {
  const text = stripNoise(raw);
  const start = text.indexOf('{');
  if (start === -1) return { ok: false, reason: 'no JSON object in output' };

  const end = matchingBrace(text, start);
  // An unclosed object (generation hit the token limit) is still worth repairing.
  const candidate = end === -1 ? text.slice(start) : text.slice(start, end + 1);
  try {
    // Valid JSON skips the repairer, which can trip over legal escapes.
    const value: unknown = parseStrict(candidate) ?? JSON.parse(jsonrepair(candidate));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, reason: 'output is not a JSON object' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unparseable JSON' };
  }
}

/**
 * Last-resort, key-by-key recovery for output too broken for any JSON
 * parser, such as `"title":"x"""tags":["a"]` (missing commas between
 * members), which 350M-parameter models produce now and then.
 */
export function salvageFields(raw: string, keys: readonly string[]): Record<string, unknown> {
  const text = stripNoise(raw);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const array = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`));
    if (array) {
      out[key] = [...array[1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => unescape(m[1]!));
      continue;
    }
    const quoted = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    if (quoted) {
      out[key] = unescape(quoted[1]!);
      continue;
    }
    const bare = text.match(new RegExp(`"${key}"\\s*:\\s*([A-Za-z]+)`));
    if (bare) out[key] = bare[1];
  }
  return out;
}

function stripNoise(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
}

function unescape(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function parseStrict(candidate: string): unknown {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return undefined;
  }
}

function matchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
    } else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

import { z } from 'zod';

import { MOODS, type Enrichment } from '@/features/notes/model';
import { normalizeTags } from '@/features/notes/lib/tags';

const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min)
        .max(max)
        // Degenerate replies (a lone comma, a run of quotes) have the right type but no words.
        .regex(/\p{L}{2,}/u, 'must contain words'),
    );

/**
 * One schema per field. Small models drift in predictable ways (a
 * comma-separated string instead of an array, "Neutral" instead of
 * "neutral", a trailing full stop on the title), so each schema accepts those
 * shapes and normalises them. Validating field by field means one bad field
 * costs only that field, not the whole reply.
 */
export const fieldSchemas = {
  title: text(3, 120).transform((t) => t.replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 80)),
  summary: text(12, 600),
  tags: z
    .union([z.array(z.string()), z.string().transform((s) => s.split(','))])
    .transform((tags) => normalizeTags(tags, 5))
    .pipe(z.array(z.string()).min(1)),
  action_items: z
    .union([z.array(z.string()), z.string().transform((s) => (s.trim() ? [s] : []))])
    .transform((items) =>
      items
        .map((i) => i.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((i) => i.length > 2)
        .slice(0, 8),
    ),
  mood: z
    .string()
    .transform((m) => m.toLowerCase().trim())
    .pipe(z.enum(MOODS)),
} as const;

export type FieldName = keyof typeof fieldSchemas;
export type Fields = { [K in FieldName]: z.output<(typeof fieldSchemas)[K]> };

export const FIELD_NAMES = Object.keys(fieldSchemas) as FieldName[];

export type FieldCheck = {
  valid: Partial<Fields>;
  /** Fields that were absent or failed validation, in schema order. */
  invalid: FieldName[];
  issues: string;
};

export function checkFields(value: Record<string, unknown>): FieldCheck {
  const valid: Partial<Fields> = {};
  const invalid: FieldName[] = [];
  const issues: string[] = [];
  for (const name of FIELD_NAMES) {
    if (value[name] === undefined) {
      invalid.push(name);
      issues.push(`- ${name}: missing`);
      continue;
    }
    const parsed = fieldSchemas[name].safeParse(value[name]);
    if (parsed.success) {
      (valid as Record<FieldName, unknown>)[name] = parsed.data;
    } else {
      invalid.push(name);
      issues.push(`- ${name}: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
    }
  }
  return { valid, invalid, issues: issues.join('\n') };
}

export function toEnrichment(fields: Fields): Enrichment {
  return {
    title: fields.title,
    summary: fields.summary,
    tags: fields.tags,
    actionItems: fields.action_items,
    mood: fields.mood,
  };
}

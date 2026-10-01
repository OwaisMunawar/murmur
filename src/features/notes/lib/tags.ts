const MAX_TAG_LENGTH = 24;

/** "Project Atlas!" -> "project-atlas". Tags are compared and stored in this form. */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/, '');
  return tag.length > 0 ? tag : null;
}

export function normalizeTags(raw: readonly string[], limit = 5): string[] {
  const seen = new Set<string>();
  for (const value of raw) {
    const tag = normalizeTag(value);
    if (tag) seen.add(tag);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/** Splits user input like "work, ideas #home" into tags. */
export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[,\s]+/), 10);
}

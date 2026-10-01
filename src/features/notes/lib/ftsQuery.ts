/**
 * Turns free text into a safe FTS5 MATCH expression. User input is never
 * passed through raw: FTS5 syntax (quotes, NEAR, column filters, `-`) would
 * either throw or silently change the meaning of the search.
 *
 * Each word becomes a quoted prefix term, so "grocer" finds "groceries", and
 * all terms must match.
 */
/**
 * `all` (search box): every word must match. `any` (questions): words that
 * carry meaning, any of which may match, so "what do I need to buy" still
 * finds the note that says "buy oat milk".
 */
export function buildFtsQuery(input: string, match: 'all' | 'any' = 'all'): string | null {
  const terms = match === 'all' ? words(input) : questionTerms(input);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(match === 'all' ? ' AND ' : ' OR ');
}

/** The words of a question that carry meaning, for keyword matching. */
export function questionTerms(input: string): string[] {
  return words(input).filter((term) => term.length > 2 && !QUESTION_WORDS.has(term));
}

function words(input: string): string[] {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0)
    .slice(0, 8);
}

const QUESTION_WORDS = new Set(
  'what when where which who whom whose why how did does do was were are the and for you your yours my mine our about with from that this have has had need needs want wants tell any all can could should would will'.split(
    ' ',
  ),
);

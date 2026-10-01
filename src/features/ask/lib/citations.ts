export type AnswerPart = { type: 'text'; text: string } | { type: 'cite'; source: number };

export type ParsedAnswer = {
  parts: AnswerPart[];
  /** Valid source numbers in order of first citation. */
  cited: number[];
};

const MARKER = /\[(\s*\d+\s*(?:[,;]\s*\d+\s*)*)\]/g;

/**
 * Splits an answer into text and citation chips. Handles "[1]", "[1, 3]" and
 * "[2][3]". A citation pointing past the sources (small models do invent
 * "[5]" when given four) is dropped instead of rendered as a dead link,
 * except with a single source, where any citation can only mean that one.
 */
export function parseCitations(answer: string, sourceCount: number): ParsedAnswer {
  const parts: AnswerPart[] = [];
  const citedSources: number[] = [];
  let last = 0;

  for (const match of answer.matchAll(MARKER)) {
    const index = match.index;
    pushText(parts, answer.slice(last, index));
    for (const raw of match[1]!.split(/[,;]/)) {
      const cited = Number.parseInt(raw.trim(), 10);
      const source = sourceCount === 1 ? 1 : cited;
      if (source < 1 || source > sourceCount) continue;
      parts.push({ type: 'cite', source });
      if (!citedSources.includes(source)) citedSources.push(source);
    }
    last = index + match[0].length;
  }
  pushText(parts, answer.slice(last));
  return { parts: tidy(parts), cited: citedSources };
}

function pushText(parts: AnswerPart[], text: string) {
  if (text.length > 0) parts.push({ type: 'text', text });
}

/**
 * Merges text left adjacent by dropped citations, and removes the space a
 * model leaves before a citation so the chip sits against its claim.
 */
function tidy(parts: AnswerPart[]): AnswerPart[] {
  const merged: AnswerPart[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (part.type === 'text' && previous?.type === 'text') previous.text += part.text;
    else merged.push({ ...part });
  }
  return merged
    .map((part, i) => {
      if (part.type !== 'text') return part;
      let text = part.text.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ');
      if (merged[i + 1]?.type === 'cite') text = text.replace(/\s+$/, '');
      return { ...part, text };
    })
    .filter((part) => part.type === 'cite' || part.text.length > 0);
}

/** Plain-text answer for accessibility labels and copying. */
export function answerText(parts: readonly AnswerPart[]): string {
  return parts
    .map((p) => (p.type === 'text' ? p.text : ` [${p.source}]`))
    .join('')
    .trim();
}

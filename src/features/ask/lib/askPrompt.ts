import { type ChatTurn } from '@/features/enrichment/engine/TextGenerator';

import { type ChunkHit } from './ranking';

const SYSTEM = `You answer questions about the user's own voice notes.
Use only facts written in the numbered sources. End each sentence with the number of the source it came from, like [2].
If the sources do not answer the question, say you could not find it in your notes.
Answer in one or two short sentences. Speak to the user as "you".`;

// A worked example teaches a small model the citation format far more
// reliably than the instruction alone.
// The example avoids days, dates and numbers on purpose: a small model
// copies them into unrelated answers ("Tuesday" from an example about the gym).
const EXAMPLE_QUESTION = `Sources:
[1] "Spare keys"
I put the spare house keys in the blue bowl by the front door.
[2] "Shopping"
Buy running shoes and a water bottle.

Question: Where are the spare keys?`;
const EXAMPLE_ANSWER = 'You put them in the blue bowl by the front door [1].';

export function formatSourceDate(timestamp: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(timestamp);
}

/**
 * Sources carry their note title but no date: a 350M model given "(Thu, 1 Oct)"
 * next to "moved to Friday" answers "Thursday" surprisingly often.
 */
export function buildAskMessages(question: string, sources: readonly ChunkHit[]): ChatTurn[] {
  const numbered = sources
    .map(
      (source, index) => `[${index + 1}] "${source.noteTitle || 'Untitled note'}"\n${source.text}`,
    )
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: EXAMPLE_QUESTION },
    { role: 'assistant', content: EXAMPLE_ANSWER },
    { role: 'user', content: `Sources:\n${numbered}\n\nQuestion: ${question.trim()}` },
  ];
}

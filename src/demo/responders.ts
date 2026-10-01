import { type ChatTurn } from '@/features/enrichment/engine/TextGenerator';
import { heuristicEnrichment } from '@/features/enrichment/lib/heuristics';

/**
 * Scripted replies for the fake language model. They read the same prompts
 * the real model gets, so demo mode exercises prompt building, JSON parsing,
 * zod validation and citation parsing end to end.
 */
export function demoRespond(messages: readonly ChatTurn[]): string {
  const system = messages[0]?.content ?? '';
  const last = messages[messages.length - 1]?.content ?? '';
  if (system.includes('into JSON')) return enrichmentReply(last);
  if (system.includes('numbered sources')) return answerReply(last);
  return '';
}

function enrichmentReply(userTurn: string): string {
  const transcript = userTurn.replace(/^Transcript:\n/, '');
  const e = heuristicEnrichment(transcript);
  return JSON.stringify({
    title: e.title,
    summary: e.summary,
    tags: e.tags,
    action_items: e.actionItems,
    mood: e.mood,
  });
}

const STOP = new Set(
  'the a an and or to of in on at for is are was my i me do did does what when where which who how about'.split(
    ' ',
  ),
);

const words = (text: string) =>
  new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w)),
  );

/**
 * Answers with the source sentence that overlaps the question most, cited by
 * its source number, plus a second source when it also matches.
 */
function answerReply(userTurn: string): string {
  const [sourcesBlock = '', question = ''] = userTurn
    .replace(/^Sources:\n/, '')
    .split('\n\nQuestion: ');
  const asked = words(question);
  const candidates: { source: number; sentence: string; score: number }[] = [];

  for (const block of sourcesBlock.split(/\n\n(?=\[\d+\])/)) {
    const header = block.match(/^\[(\d+)\]([^\n]*)\n([\s\S]*)$/);
    if (!header) continue;
    const source = Number(header[1]);
    // A title match counts for every sentence of that note, at half weight.
    const titleScore = [...words(header[2]!)].filter((w) => asked.has(w)).length / 2;
    // Fragments such as "Lisbon planning." match well and answer nothing.
    const sentences = header[3]!.split(/(?<=[.!?])\s+/).filter((s) => s.split(/\s+/).length >= 5);
    for (const sentence of sentences) {
      const score = [...words(sentence)].filter((w) => asked.has(w)).length + titleScore;
      candidates.push({ source, sentence: sentence.trim(), score });
    }
  }

  const ranked = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.source - b.source);
  const best = ranked[0];
  if (!best) return 'I could not find that in your notes.';
  // A second source only when it is as strong a match, so answers stay on topic.
  const second = ranked.find(
    (c) => c.source !== best.source && c.score >= best.score && c.score >= 2,
  );
  const first = `${toSecondPerson(best.sentence)} [${best.source}]`;
  return second ? `${first} ${toSecondPerson(second.sentence)} [${second.source}]` : first;
}

function toSecondPerson(sentence: string): string {
  return sentence
    .replace(/\bI am\b/g, 'you are')
    .replace(/\bI'm\b/g, "you're")
    .replace(/\bI\b/g, 'you')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bme\b/g, 'you')
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/[.!?]?$/, '.');
}

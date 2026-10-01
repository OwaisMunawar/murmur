import { type Enrichment, type Mood } from '@/features/notes/model';
import { normalizeTags } from '@/features/notes/lib/tags';
import { splitSentences } from '@/features/transcription/lib/transcript';

/**
 * Fallback enrichment when the language model is missing or its output cannot
 * be repaired. Deliberately simple and predictable: the UI labels these notes
 * as "auto-titled" so nobody mistakes them for a model summary.
 */

const STOPWORDS = new Set(
  `a about above after again all also am an and any are as at be because been before being below between both but by
  can could did do does doing done down during each else even ever every few for from further get gets getting go
  going gonna got had has have having he her here hers him his how i if in into is it its itself just know let like
  maybe me might more most much must my need needs no nor not now of off on once one only or other our out over own
  really right said same say says she should so some something still such sure than that the their them then there
  these they thing things think this those though through to today too um uh under until up us very want was we
  well were what when where which while who why will with would yeah yes you your okay ok actually kind sort lot
  honestly basically literally quick quickly tomorrow tonight first second third fourth fifth sixth seventh eighth
  ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth twentieth thirtieth`.split(
    /\s+/,
  ),
);

const ACTION_CUE =
  /\b(need to|needs to|have to|has to|got to|must|should|remember to|don't forget to|do not forget to|make sure to|going to|gonna|todo|to do|i'll|i will|let's)\b/i;

const POSITIVE =
  /\b(great|good|happy|excited|love|glad|nice|awesome|fantastic|looking forward|relieved|proud|fun|enjoy)\w*/gi;
const NEGATIVE =
  /\b(bad|sad|angry|annoyed|worried|stress|tired|frustrat|upset|hate|awful|anxious|terrible|disappoint)\w*/gi;

export function heuristicEnrichment(transcript: string): Enrichment {
  const sentences = splitSentences(transcript.replace(/\s+/g, ' ').trim());
  const first = sentences[0] ?? '';
  return {
    title: heuristicTitle(first),
    summary: sentences.slice(0, 2).join(' ').slice(0, 280) || 'Empty recording.',
    tags: topKeywords(transcript, 3),
    actionItems: sentences
      .filter((s) => ACTION_CUE.test(s))
      .map(toActionItem)
      .slice(0, 5),
    mood: lexiconMood(transcript),
  };
}

export function heuristicTitle(sentence: string): string {
  const words = sentence
    .replace(/^((so|okay|ok|um|uh|right|well|alright)[,\s]+)+/i, '')
    .replace(/[.!?,;:]+$/, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'Voice note';
  const title = words.slice(0, 7).join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1) + (words.length > 7 ? '...' : '');
}

export function topKeywords(text: string, count: number): string[] {
  const frequency = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) ?? []) {
    if (STOPWORDS.has(word)) continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  // Ties go to longer words, which tend to be the topic ("dentist" over "back").
  const ranked = [...frequency.entries()].sort(
    (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]),
  );
  const tags = normalizeTags(
    ranked.map(([word]) => word),
    count,
  );
  return tags.length > 0 ? tags : ['note'];
}

function toActionItem(sentence: string): string {
  const stripped = sentence
    .replace(
      /^.*?\b(need to|needs to|have to|has to|got to|remember to|don't forget to|do not forget to|make sure to|going to|gonna|i'll|i will|let's|should|must)\s+/i,
      '',
    )
    .replace(/[.!?]+$/, '')
    .trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function lexiconMood(text: string): Mood {
  const positive = text.match(POSITIVE)?.length ?? 0;
  const negative = text.match(NEGATIVE)?.length ?? 0;
  if (positive > 0 && negative > 0) return 'mixed';
  if (positive > 0) return 'positive';
  if (negative > 0) return 'negative';
  return 'neutral';
}

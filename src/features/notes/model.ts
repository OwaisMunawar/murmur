export const NOTE_STATUSES = [
  'recorded',
  'transcribing',
  'enriching',
  'indexing',
  'ready',
  'failed',
] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const MOODS = ['positive', 'neutral', 'negative', 'mixed'] as const;
export type Mood = (typeof MOODS)[number];

/** How the title and summary were produced. Shown so users can tell a guess from a model output. */
export type EnrichmentSource = 'model' | 'repaired' | 'heuristic';

export type Segment = {
  position: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type ActionItem = {
  id: string;
  position: number;
  text: string;
  done: boolean;
};

export type NoteSummary = {
  id: string;
  createdAt: number;
  durationMs: number;
  status: NoteStatus;
  title: string;
  summary: string;
  mood: Mood | null;
  tags: string[];
  openActionCount: number;
};

export type Note = NoteSummary & {
  updatedAt: number;
  audioFile: string | null;
  statusDetail: string | null;
  language: string | null;
  transcript: string;
  enrichmentSource: EnrichmentSource | null;
  segments: Segment[];
  actionItems: ActionItem[];
};

export type Enrichment = {
  title: string;
  summary: string;
  tags: string[];
  actionItems: string[];
  mood: Mood;
};

export function isProcessing(status: NoteStatus): boolean {
  return (
    status === 'recorded' ||
    status === 'transcribing' ||
    status === 'enriching' ||
    status === 'indexing'
  );
}

import { useCallback, useRef } from 'react';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { useStore } from '@/core/hooks/useStore';
import { keepUnchanged } from '@/core/lib/structuralSharing';
import { rankNotes } from '@/features/ask/lib/ranking';

import { type NoteSummary } from '../model';
import { type ProcessingState } from '../pipeline/noteProcessor';

export type NotesFilter = {
  text: string;
  tag: string | null;
  /** Rank by meaning (embeddings) instead of matching words (FTS5). */
  semantic: boolean;
};

function useChanges() {
  const { changes } = useServices();
  return useCallback((onChange: () => void) => changes.on(() => onChange()), [changes]);
}

export function useNotesList(filter: NotesFilter) {
  const services = useServices();
  const subscribe = useChanges();
  const text = filter.text.trim();
  const previous = useRef<NoteSummary[] | undefined>(undefined);
  const share = (notes: NoteSummary[]) =>
    (previous.current = keepUnchanged(previous.current, notes));

  return useQuery(
    JSON.stringify({ ...filter, text }),
    async () => {
      if (text && filter.semantic && services.models.isInstalled('embedding')) {
        const vector = await services.engines.embedder.embed(text);
        const hits = await services.chunks.searchSimilar(vector, 40);
        const ids = rankNotes(hits, services.engines.embedder.relevanceFloor);
        return {
          notes: share(await services.notes.list({ ids, tag: filter.tag ?? undefined })),
          at: Date.now(),
        };
      }
      // `at` anchors "Today" and "Yesterday" to when the list was read.
      return {
        notes: share(
          await services.notes.list({ text: text || undefined, tag: filter.tag ?? undefined }),
        ),
        at: Date.now(),
      };
    },
    subscribe,
  );
}

export function useNote(id: string) {
  const { notes } = useServices();
  const subscribe = useChanges();
  return useQuery(`note:${id}`, () => notes.get(id), subscribe);
}

export function useTags() {
  const { notes } = useServices();
  const subscribe = useChanges();
  return useQuery('tags', () => notes.listTags(), subscribe);
}

export function useProcessing(id: string): ProcessingState | undefined {
  const { processor } = useServices();
  return useStore(processor.progress)[id];
}

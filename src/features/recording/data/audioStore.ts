import { Directory, File, Paths } from 'expo-file-system';

import { AppError } from '@/core/errors/AppError';

import { decodeWav, encodeWav, type DecodedAudio } from '../lib/wav';

/**
 * Recordings are addressed by a path relative to the documents directory.
 * iOS moves the app container on reinstall and some updates, so absolute
 * paths stored in the database would go stale.
 */
export interface AudioStore {
  save(noteId: string, samples: Float32Array, sampleRate: number): Promise<string>;
  read(relativePath: string): Promise<DecodedAudio>;
  uriFor(relativePath: string): string;
  remove(relativePath: string): void;
}

const FOLDER = 'recordings';

export function createFileAudioStore(): AudioStore {
  const folder = new Directory(Paths.document, FOLDER);

  return {
    async save(noteId, samples, sampleRate) {
      if (!folder.exists) folder.create({ intermediates: true });
      const relative = `${FOLDER}/${noteId}.wav`;
      const file = new File(Paths.document, relative);
      file.write(encodeWav(samples, sampleRate));
      return relative;
    },
    async read(relativePath) {
      try {
        const bytes = await new File(Paths.document, relativePath).bytes();
        return decodeWav(bytes);
      } catch (cause) {
        throw new AppError('AUDIO_DECODE_FAILED', `Could not read ${relativePath}`, { cause });
      }
    },
    uriFor(relativePath) {
      return new File(Paths.document, relativePath).uri;
    },
    remove(relativePath) {
      const file = new File(Paths.document, relativePath);
      if (file.exists) file.delete();
    },
  };
}

/** In-memory store for demo mode and tests: same contract, no disk. */
export function createMemoryAudioStore(): AudioStore & { size(): number } {
  const files = new Map<string, Uint8Array>();
  return {
    async save(noteId, samples, sampleRate) {
      const relative = `${FOLDER}/${noteId}.wav`;
      files.set(relative, encodeWav(samples, sampleRate));
      return relative;
    },
    async read(relativePath) {
      const bytes = files.get(relativePath);
      if (!bytes) throw new AppError('AUDIO_DECODE_FAILED', `No audio at ${relativePath}`);
      return decodeWav(bytes);
    },
    uriFor: (relativePath) => `memory://${relativePath}`,
    remove: (relativePath) => {
      files.delete(relativePath);
    },
    size: () => files.size,
  };
}

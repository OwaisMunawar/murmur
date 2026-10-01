import { Asset } from 'expo-asset';

import { fileAt } from '@/core/platform/files';

import { decodeWav, type DecodedAudio } from '../lib/wav';

/**
 * Bundled sample recordings (synthesised, fictional speech, 12 to 15 s each).
 * The simulator's microphone cannot be scripted, so these let the real
 * pipeline, including on-device Whisper, run end to end from known input.
 * Each call takes the next clip.
 */
const CLIPS = [
  require('../../../../assets/audio/sample-note-1.wav'),
  require('../../../../assets/audio/sample-note-2.wav'),
  require('../../../../assets/audio/sample-note-3.wav'),
] as const;

let next = 0;

export async function loadSampleClip(): Promise<DecodedAudio> {
  const asset = Asset.fromModule(CLIPS[next++ % CLIPS.length]);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Sample clip is not available');
  return decodeWav(await fileAt(asset.localUri).bytes());
}

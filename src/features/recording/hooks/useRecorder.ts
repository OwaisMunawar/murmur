import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { AppError, toAppError } from '@/core/errors/AppError';

import { durationMs, levelFromRms, resampleLinear, rms, toMono } from '../lib/pcm';
import { PcmBuffer } from '../lib/pcmBuffer';
import {
  initialSession,
  MAX_RECORDING_MS,
  pushLevel,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from '../lib/session';

export const CAPTURE_SAMPLE_RATE = 16_000;

export type CapturedAudio = {
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
};

export type Recorder = {
  state: SessionState;
  /** Display levels for the live waveform, updated without React renders. */
  levels: SharedValue<number[]>;
  start(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  /** Stops capture and returns everything recorded so far. */
  finish(): CapturedAudio;
  discard(): void;
  /**
   * Plays existing PCM through the capture path in real time (or `speed`
   * times faster): same buffers, levels, timer and length guard as the
   * microphone. Used for the bundled sample clip, since the simulator's
   * microphone cannot be scripted. Resolves with the captured audio, or null
   * if the session was discarded.
   */
  replay(
    samples: Float32Array,
    sampleRate: number,
    options?: { speed?: number },
  ): Promise<CapturedAudio | null>;
};

const REPLAY_CHUNK_MS = 100;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Captures 16 kHz mono PCM from the microphone through expo-audio's native
 * stream. Raw samples (rather than an encoded m4a) are what Whisper needs, and
 * capturing them directly avoids a decode step that Android has no built-in
 * API for.
 *
 * The session lives in a ref and is mirrored into state for rendering:
 * buffer callbacks must read the latest status synchronously, and the length
 * guard has to stop capture from inside the callback that crossed the limit.
 */
export function useRecorder({
  maxMs = MAX_RECORDING_MS,
  onLimitReached,
}: { maxMs?: number; onLimitReached?: (audio: CapturedAudio) => void } = {}): Recorder {
  const [state, setState] = useState<SessionState>(initialSession);
  const session = useRef<SessionState>(initialSession);
  const buffer = useRef<PcmBuffer | null>(null);
  const onLimit = useRef(onLimitReached);
  const levels = useSharedValue<number[]>([]);

  useEffect(() => {
    onLimit.current = onLimitReached;
  });

  const apply = useCallback(
    (action: SessionAction) => {
      session.current = sessionReducer(session.current, action, maxMs);
      setState(session.current);
      return session.current;
    },
    [maxMs],
  );

  const pcm = () => (buffer.current ??= new PcmBuffer());

  const collect = (): CapturedAudio => {
    const samples = pcm().toArray();
    return {
      samples,
      sampleRate: CAPTURE_SAMPLE_RATE,
      durationMs: durationMs(samples.length, CAPTURE_SAMPLE_RATE),
    };
  };

  const onBuffer = (chunk: AudioStreamBuffer) => {
    if (session.current.status !== 'recording') return;
    const mono = toMono(new Float32Array(chunk.data), chunk.channels);
    const samples = resampleLinear(mono, chunk.sampleRate, CAPTURE_SAMPLE_RATE);
    pcm().append(samples);
    levels.set(pushLevel(levels.get(), levelFromRms(rms(samples))));
    const next = apply({ type: 'captured', ms: (samples.length / CAPTURE_SAMPLE_RATE) * 1000 });
    if (next.stoppedByLimit) {
      stopStream();
      onLimit.current?.(collect());
    }
  };

  const { stream } = useAudioStream({
    sampleRate: CAPTURE_SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer,
  });

  // The native stream is released together with the screen, and stopping a
  // released shared object throws; by then there is nothing left to stop.
  function stopStream() {
    try {
      if (stream.isStreaming) stream.stop();
    } catch {
      // Already released.
    }
  }

  useEffect(
    () => () => {
      try {
        stream.stop();
      } catch {
        // Already released.
      }
    },
    [stream],
  );

  const open = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new AppError('MIC_PERMISSION_DENIED', 'Microphone access is turned off for Murmur.');
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    try {
      await stream.start();
    } catch (error) {
      throw toAppError(error, 'RECORDING_FAILED');
    }
  };

  return {
    state,
    levels,
    async start() {
      pcm().clear();
      levels.set([]);
      apply({ type: 'reset' });
      await open();
      apply({ type: 'start' });
    },
    pause() {
      stopStream();
      apply({ type: 'pause' });
    },
    async resume() {
      await open();
      apply({ type: 'resume' });
    },
    finish() {
      stopStream();
      apply({ type: 'stop' });
      return collect();
    },
    discard() {
      stopStream();
      pcm().clear();
      levels.set([]);
      apply({ type: 'reset' });
    },
    async replay(samples, sampleRate, { speed = 1 } = {}) {
      pcm().clear();
      levels.set([]);
      apply({ type: 'reset' });
      apply({ type: 'start' });
      const step = Math.round((sampleRate * REPLAY_CHUNK_MS) / 1000);
      for (let at = 0; at < samples.length;) {
        await wait(REPLAY_CHUNK_MS / speed);
        const status = session.current.status;
        if (status === 'idle' || status === 'stopped')
          return status === 'stopped' ? collect() : null;
        if (status === 'paused') continue;
        const slice = samples.slice(at, at + step);
        onBuffer({ data: slice.buffer, sampleRate, channels: 1, timestamp: at / sampleRate });
        at += step;
      }
      return this.finish();
    },
  };
}

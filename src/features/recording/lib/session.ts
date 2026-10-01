/**
 * Recording session state machine. Kept pure so the max-length guard and
 * pause accounting are tested without a microphone.
 */

export const MAX_RECORDING_MS = 10 * 60 * 1000;
export const WARN_BEFORE_MAX_MS = 30 * 1000;
export const LEVEL_HISTORY = 72;

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export type SessionState = {
  status: RecordingStatus;
  /** Audio time captured so far, excluding pauses. */
  elapsedMs: number;
  /** Set when the guard ended the session rather than the user. */
  stoppedByLimit: boolean;
};

export type SessionAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'captured'; ms: number }
  | { type: 'stop' }
  | { type: 'reset' };

export const initialSession: SessionState = {
  status: 'idle',
  elapsedMs: 0,
  stoppedByLimit: false,
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
  maxMs: number = MAX_RECORDING_MS,
): SessionState {
  switch (action.type) {
    case 'start':
      return state.status === 'idle' ? { ...initialSession, status: 'recording' } : state;
    case 'pause':
      return state.status === 'recording' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'recording' } : state;
    case 'captured': {
      // Buffers can still arrive for a moment after pause; they are dropped.
      if (state.status !== 'recording') return state;
      const elapsedMs = Math.min(maxMs, state.elapsedMs + Math.max(0, action.ms));
      const hitLimit = elapsedMs >= maxMs;
      return {
        ...state,
        elapsedMs,
        status: hitLimit ? 'stopped' : 'recording',
        stoppedByLimit: hitLimit,
      };
    }
    case 'stop':
      return state.status === 'recording' || state.status === 'paused'
        ? { ...state, status: 'stopped' }
        : state;
    case 'reset':
      return initialSession;
  }
}

export function remainingMs(state: SessionState, maxMs: number = MAX_RECORDING_MS): number {
  return Math.max(0, maxMs - state.elapsedMs);
}

export function isNearLimit(state: SessionState, maxMs: number = MAX_RECORDING_MS): boolean {
  return state.status !== 'idle' && remainingMs(state, maxMs) <= WARN_BEFORE_MAX_MS;
}

/**
 * Appends a level to the waveform history. Levels live in a Reanimated shared
 * value rather than in this reducer so the waveform redraws on the UI thread
 * without re-rendering the screen for every audio buffer.
 */
export function pushLevel(
  levels: readonly number[],
  level: number,
  max: number = LEVEL_HISTORY,
): number[] {
  const next = levels.length >= max ? levels.slice(levels.length - max + 1) : levels.slice();
  next.push(Math.min(1, Math.max(0, level)));
  return next;
}

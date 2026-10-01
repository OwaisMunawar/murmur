import {
  initialSession,
  isNearLimit,
  pushLevel,
  remainingMs,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from '../session';

const run = (actions: SessionAction[], maxMs = 10_000): SessionState =>
  actions.reduce((state, action) => sessionReducer(state, action, maxMs), initialSession);

describe('sessionReducer', () => {
  it('accumulates captured time only while recording', () => {
    const state = run([
      { type: 'start' },
      { type: 'captured', ms: 1_000 },
      { type: 'pause' },
      { type: 'captured', ms: 5_000 },
      { type: 'resume' },
      { type: 'captured', ms: 500 },
    ]);
    expect(state).toMatchObject({ status: 'recording', elapsedMs: 1_500 });
  });

  it('stops at the max length and flags it', () => {
    const state = run([
      { type: 'start' },
      { type: 'captured', ms: 9_000 },
      { type: 'captured', ms: 2_000 },
    ]);
    expect(state).toEqual({ status: 'stopped', elapsedMs: 10_000, stoppedByLimit: true });
  });

  it('ignores transitions that do not apply', () => {
    expect(run([{ type: 'pause' }])).toBe(initialSession);
    expect(run([{ type: 'resume' }])).toBe(initialSession);
    expect(run([{ type: 'stop' }])).toBe(initialSession);
    const recording = run([{ type: 'start' }]);
    expect(sessionReducer(recording, { type: 'start' })).toBe(recording);
    expect(sessionReducer(recording, { type: 'captured', ms: -50 }).elapsedMs).toBe(0);
  });

  it('can stop from pause and reset to idle', () => {
    const stopped = run([{ type: 'start' }, { type: 'pause' }, { type: 'stop' }]);
    expect(stopped.status).toBe('stopped');
    expect(stopped.stoppedByLimit).toBe(false);
    expect(sessionReducer(stopped, { type: 'reset' })).toBe(initialSession);
  });

  it('reports remaining time and the warning window', () => {
    const state = run([{ type: 'start' }, { type: 'captured', ms: 9_000 }], 40_000);
    expect(remainingMs(state, 40_000)).toBe(31_000);
    expect(isNearLimit(state, 40_000)).toBe(false);
    const later = sessionReducer(state, { type: 'captured', ms: 2_000 }, 40_000);
    expect(isNearLimit(later, 40_000)).toBe(true);
    expect(isNearLimit(initialSession, 1)).toBe(false);
  });
});

describe('pushLevel', () => {
  it('keeps a bounded, clamped history', () => {
    expect(pushLevel([0.1, 0.2], 2, 2)).toEqual([0.2, 1]);
    expect(pushLevel([], -1)).toEqual([0]);
  });
});

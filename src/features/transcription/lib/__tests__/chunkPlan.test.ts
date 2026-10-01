import { planChunks } from '../chunkPlan';

const RATE = 1_000; // 1 sample per ms keeps the arithmetic readable

function speech(ms: number, amplitude = 0.3): Float32Array {
  return Float32Array.from({ length: ms }, (_, i) => (i % 2 === 0 ? amplitude : -amplitude));
}

function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

describe('planChunks', () => {
  it('keeps short audio in one chunk', () => {
    expect(planChunks(speech(5_000), { sampleRate: RATE })).toEqual([
      { start: 0, end: 5_000, silent: false },
    ]);
  });

  it('cuts long audio at the quietest point after the target length', () => {
    // 15 s speech, 300 ms pause, 15 s speech.
    const audio = concat(speech(15_000), new Float32Array(300), speech(15_000));
    const chunks = planChunks(audio, { sampleRate: RATE, targetMs: 12_000, maxMs: 25_000 });
    expect(chunks).toHaveLength(2);
    const cut = chunks[0]!.end;
    expect(cut).toBeGreaterThanOrEqual(15_000);
    expect(cut).toBeLessThanOrEqual(15_300);
    expect(chunks[1]!.start).toBe(cut);
    expect(chunks.at(-1)!.end).toBe(audio.length);
  });

  it('never exceeds the max chunk length in continuous speech', () => {
    const chunks = planChunks(speech(80_000), {
      sampleRate: RATE,
      targetMs: 10_000,
      maxMs: 20_000,
    });
    for (const c of chunks) expect(c.end - c.start).toBeLessThanOrEqual(20_000);
    expect(chunks.reduce((n, c) => n + (c.end - c.start), 0)).toBe(80_000);
  });

  it('flags silent chunks so they are not sent to the model', () => {
    const audio = concat(speech(14_000), new Float32Array(30_000));
    const chunks = planChunks(audio, { sampleRate: RATE, targetMs: 12_000, maxMs: 25_000 });
    expect(chunks.some((c) => c.silent)).toBe(true);
    expect(chunks[0]!.silent).toBe(false);
  });

  it('returns no chunks for empty audio', () => {
    expect(planChunks(new Float32Array(0), { sampleRate: RATE })).toEqual([]);
  });
});

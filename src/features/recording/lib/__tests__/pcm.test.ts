import {
  durationMs,
  levelFromDb,
  levelFromRms,
  resampleLinear,
  rms,
  toMono,
  waveformPeaks,
} from '../pcm';
import { PcmBuffer } from '../pcmBuffer';

describe('pcm helpers', () => {
  it('averages interleaved channels', () => {
    expect(Array.from(toMono(new Float32Array([1, 0, 0.5, 0.5]), 2))).toEqual([0.5, 0.5]);
    const mono = new Float32Array([1, 2]);
    expect(toMono(mono, 1)).toBe(mono);
  });

  it('resamples by the rate ratio with linear interpolation', () => {
    const input = new Float32Array([0, 1, 0, -1, 0, 1]);
    const down = resampleLinear(input, 48_000, 16_000);
    expect(down).toHaveLength(2);
    expect(Array.from(down)).toEqual([0, -1]);
    const up = resampleLinear(new Float32Array([0, 1]), 8_000, 16_000);
    expect(Array.from(up)).toEqual([0, 0.5, 1, 1]);
    expect(resampleLinear(input, 16_000, 16_000)).toBe(input);
  });

  it('computes RMS over a window and handles empty ranges', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(rms(new Float32Array([0.5, 0.5]), 0, 1)).toBe(0.5);
    expect(rms(new Float32Array([1]), 3, 2)).toBe(0);
  });

  it('maps loudness to a dB display scale', () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(1)).toBe(1);
    // -40 dBFS (quiet speech) stays visible but low; -12 dBFS sits well below the top.
    expect(levelFromRms(0.01)).toBeGreaterThan(0.05);
    expect(levelFromRms(0.01)).toBeLessThan(0.15);
    expect(levelFromRms(0.25)).toBeGreaterThan(0.5);
    expect(levelFromRms(0.25)).toBeLessThan(0.75);
    expect(levelFromDb(-160)).toBe(0);
    expect(levelFromDb(0)).toBe(1);
  });

  it('builds peak buckets for a waveform overview', () => {
    const samples = new Float32Array(100).fill(0);
    samples.fill(1, 50);
    const peaks = waveformPeaks(samples, 4);
    expect(peaks).toEqual([0, 0, 1, 1]);
    expect(waveformPeaks(new Float32Array(2), 4)).toEqual([0, 0, 0, 0]);
    expect(waveformPeaks(samples, 0)).toEqual([]);
  });

  it('derives duration from sample count', () => {
    expect(durationMs(24_000, 16_000)).toBe(1_500);
    expect(durationMs(10, 0)).toBe(0);
  });
});

describe('PcmBuffer', () => {
  it('grows past its initial capacity and returns an exact copy', () => {
    const buffer = new PcmBuffer(2);
    buffer.append(new Float32Array([1, 2]));
    buffer.append(new Float32Array([3, 4, 5]));
    expect(buffer.length).toBe(5);
    const copy = buffer.toArray();
    expect(Array.from(copy)).toEqual([1, 2, 3, 4, 5]);
    buffer.clear();
    expect(buffer.length).toBe(0);
    expect(copy).toHaveLength(5);
  });
});

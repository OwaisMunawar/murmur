import { decodeWav, encodeWav } from '../wav';

function chunk(id: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + body.length + (body.length % 2));
  const view = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i);
  view.setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

function riff(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 4);
  const out = new Uint8Array(8 + total);
  const view = new DataView(out.buffer);
  'RIFF'.split('').forEach((c, i) => (out[i] = c.charCodeAt(0)));
  view.setUint32(4, total, true);
  'WAVE'.split('').forEach((c, i) => (out[8 + i] = c.charCodeAt(0)));
  let offset = 12;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function fmt(audioFormat: number, channels: number, sampleRate: number, bits: number): Uint8Array {
  const body = new Uint8Array(16);
  const view = new DataView(body.buffer);
  view.setUint16(0, audioFormat, true);
  view.setUint16(2, channels, true);
  view.setUint32(4, sampleRate, true);
  view.setUint32(8, (sampleRate * channels * bits) / 8, true);
  view.setUint16(12, (channels * bits) / 8, true);
  view.setUint16(14, bits, true);
  return body;
}

describe('encodeWav / decodeWav', () => {
  it('round-trips mono samples within int16 precision', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
    const decoded = decodeWav(encodeWav(samples, 16_000));
    expect(decoded.sampleRate).toBe(16_000);
    expect(decoded.samples).toHaveLength(samples.length);
    decoded.samples.forEach((value, i) => expect(value).toBeCloseTo(samples[i]!, 3));
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const decoded = decodeWav(encodeWav(new Float32Array([2, -3]), 8_000));
    expect(decoded.samples[0]).toBeCloseTo(1, 3);
    expect(decoded.samples[1]).toBeCloseTo(-1, 3);
  });

  it('writes a standard 44-byte header', () => {
    const bytes = encodeWav(new Float32Array(10), 16_000);
    expect(bytes.byteLength).toBe(44 + 20);
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe('data');
  });

  it('skips unknown chunks and pads odd chunk sizes', () => {
    const data = new Uint8Array(4);
    new DataView(data.buffer).setInt16(0, 0x4000, true);
    const bytes = riff(
      chunk('fmt ', fmt(1, 1, 22_050, 16)),
      chunk('LIST', new Uint8Array(3)),
      chunk('data', data),
    );
    const decoded = decodeWav(bytes);
    expect(decoded.sampleRate).toBe(22_050);
    expect(decoded.samples[0]).toBeCloseTo(0.5, 3);
  });

  it('decodes 32-bit float stereo by averaging channels', () => {
    const data = new Uint8Array(8);
    const view = new DataView(data.buffer);
    view.setFloat32(0, 1, true);
    view.setFloat32(4, 0, true);
    const decoded = decodeWav(riff(chunk('fmt ', fmt(3, 2, 48_000, 32)), chunk('data', data)));
    expect(Array.from(decoded.samples)).toEqual([0.5]);
  });

  it('accepts WAVE_FORMAT_EXTENSIBLE 16-bit data', () => {
    const data = new Uint8Array(2);
    new DataView(data.buffer).setInt16(0, -0x8000, true);
    expect(
      decodeWav(riff(chunk('fmt ', fmt(0xfffe, 1, 16_000, 16)), chunk('data', data))).samples[0],
    ).toBe(-1);
  });

  it.each([
    ['not riff', new Uint8Array(20), 'Not a RIFF/WAVE file'],
    ['no data', riff(chunk('fmt ', fmt(1, 1, 16_000, 16))), 'no data chunk'],
    ['data before fmt', riff(chunk('data', new Uint8Array(2))), 'before fmt'],
    [
      'unsupported',
      riff(chunk('fmt ', fmt(1, 1, 16_000, 8)), chunk('data', new Uint8Array(2))),
      'Unsupported',
    ],
  ])('rejects %s', (_, bytes, message) => {
    expect(() => decodeWav(bytes)).toThrow(message);
  });
});

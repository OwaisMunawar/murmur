import { localPaths } from '../ModelDownloader';

describe('localPaths', () => {
  it('collects every local file path in a nested config, once', () => {
    expect(
      localPaths({
        modelPath: '/data/whisper.pte',
        tokenizerPath: 'file:///data/tokenizer.json',
        supportedLanguages: ['en', 'de'],
        vadModel: { modelPath: '/data/vad.pte', defaultOptions: { speechThreshold: 0.6 } },
        again: ['/data/whisper.pte'],
      }),
    ).toEqual(['/data/whisper.pte', 'file:///data/tokenizer.json', '/data/vad.pte']);
  });

  it('ignores remote URLs and non-strings', () => {
    expect(localPaths({ a: 'https://huggingface.co/x.pte', b: 3, c: null })).toEqual([]);
  });
});

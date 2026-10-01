import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * The Privacy screen says one module can reach the network. This test keeps
 * that true: unlike the matching ESLint rule, it cannot be silenced with a
 * disable comment.
 */

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const DOWNLOADER = 'src/features/models/engine/executorchModelDownloader.ts';

const NETWORK_APIS: [string, RegExp][] = [
  ['fetch()', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['axios', /from ['"]axios['"]/],
  [
    'expo-file-system downloads',
    /\b(downloadFileAsync|createDownloadTask|createUploadTask)\b|\.upload\(/,
  ],
  ['react-native-blob-util', /from ['"]react-native-blob-util['"]/],
  [
    'ExecuTorch download()',
    /import\s*{[^}]*\b(download|useResourceDownload)\b[^}]*}\s*from ['"]react-native-executorch['"]/,
  ],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === '__tests__' || name === 'test-utils' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('network boundary', () => {
  const files = sourceFiles(SRC).map((path) => ({
    path: relative(ROOT, path),
    text: readFileSync(path, 'utf8'),
  }));

  it('scans the app source', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(NETWORK_APIS)('uses %s only in the model downloader', (_, pattern) => {
    const offenders = files
      .filter((f) => f.path !== DOWNLOADER && pattern.test(f.text))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it('switches off ExecuTorch download telemetry', () => {
    const downloader = files.find((f) => f.path === DOWNLOADER);
    expect(downloader?.text).toMatch(/setTelemetryEnabled\(false\)/);
  });

  it('ships no SDKs that phone home', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const phoneHome = Object.keys(pkg.dependencies).filter((name) =>
      /^(expo-updates|expo-notifications|@sentry\/|@react-native-firebase\/|firebase|@segment\/|posthog|mixpanel|@amplitude\/|@bugsnag\/|expo-insights)/.test(
        name,
      ),
    );
    expect(phoneHome).toEqual([]);
  });
});

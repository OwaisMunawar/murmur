// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

// The only module allowed to reach the network. Everything else in the app is
// offline by construction, and this list is what the Privacy screen promises.
const MODEL_DOWNLOADER = 'src/features/models/engine/executorchModelDownloader.ts';

const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: `Murmur makes no network calls outside ${MODEL_DOWNLOADER}. See docs/ARCHITECTURE.md (ADR-006).`,
}));

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-executorch',
              importNames: ['download', 'useResourceDownload'],
              message: `Model downloads go through ${MODEL_DOWNLOADER} only.`,
            },
          ],
        },
      ],
    },
  },
  {
    files: [MODEL_DOWNLOADER],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Domain code stays framework-free so it can be tested in plain Node.
    files: ['src/**/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-native', 'react-native-*', 'expo-*', '@shopify/*'] },
          ],
        },
      ],
    },
  },
]);

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  // Worklets ships native-only entry points; this resolver picks the JS ones.
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Screen tests seed a real SQLite database; the first one in a worker also
  // pays for transforming the app, which can exceed the 5 s default on CI.
  testTimeout: 20_000,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@shopify/react-native-skia|@legendapp/.*|@op-engineering/.*|react-native-executorch))',
  ],
  // Domain logic, repositories and pipelines carry the 90% gate. Screens are
  // covered by component tests and Maestro flows instead of line counts.
  collectCoverageFrom: [
    'src/**/lib/**/*.ts',
    'src/core/db/**/*.ts',
    'src/core/errors/**/*.ts',
    'src/features/**/data/**/*.ts',
    'src/features/**/pipeline/**/*.ts',
    'src/features/**/engine/fake*.ts',
    // Thin adapters over native modules, exercised on the simulator instead.
    '!src/core/db/opSqliteDriver.ts',
    '!src/features/recording/data/audioStore.ts',
    '!src/features/recording/data/sampleClip.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: { lines: 90, statements: 90, functions: 90, branches: 80 },
  },
  coverageReporters: ['text-summary', 'lcov'],
};

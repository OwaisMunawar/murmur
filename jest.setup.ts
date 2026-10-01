/* eslint-disable @typescript-eslint/no-require-imports */
// Component tests render real screens over an in-memory SQLite database and
// fake engines. Only native views and device APIs are replaced here.
import 'react-native-gesture-handler/jestSetup';
import 'react-native-reanimated/mock';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native');
  const builder = () => {
    const self = {
      addRRect: () => self,
      addRect: () => self,
      detach: () => ({}),
      build: () => ({}),
    };
    return self;
  };
  const Noop = () => null;
  return {
    Canvas: View,
    Path: Noop,
    Rect: Noop,
    Group: ({ children }: { children?: unknown }) => children ?? null,
    LinearGradient: Noop,
    vec: (x: number, y: number) => ({ x, y }),
    Skia: {
      PathBuilder: { Make: builder },
      RRectXY: (rect: unknown) => rect,
      XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    },
  };
});

jest.mock('expo-audio', () => {
  const stream = { start: jest.fn(async () => undefined), stop: jest.fn() };
  const player = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => undefined) };
  return {
    useAudioStream: () => ({ stream, isStreaming: false }),
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({
      currentTime: 0,
      duration: 0,
      playing: false,
      isLoaded: true,
      didJustFinish: false,
    }),
    setAudioModeAsync: jest.fn(async () => undefined),
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
    __player: player,
  };
});

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return {
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
    __router: router,
  };
});

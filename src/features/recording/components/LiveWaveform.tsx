import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/core/theme';

import { barRects } from '../lib/bars';

const BAR_WIDTH = 4;
const GAP = 3;
const IDLE_LEVELS: number[] = Array.from({ length: 80 }, () => 0);

/**
 * Scrolling bar waveform for the live recording. Levels arrive in a shared
 * value and the path is rebuilt in a worklet, so drawing never waits on the
 * JS thread.
 */
export function LiveWaveform({
  levels,
  height = 140,
  active,
}: {
  levels: SharedValue<number[]>;
  height?: number;
  active: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const path = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    // Before anything is captured, a row of minimum-height bars marks where
    // the waveform will appear.
    const captured = levels.get();
    const shown = captured.length > 0 ? captured : IDLE_LEVELS;
    const rects = barRects(shown, {
      width,
      height,
      barWidth: BAR_WIDTH,
      gap: GAP,
      minHeight: BAR_WIDTH,
      align: 'end',
    });
    for (const r of rects) {
      builder.addRRect(
        Skia.RRectXY(Skia.XYWHRect(r.x, r.y, r.width, r.height), BAR_WIDTH / 2, BAR_WIDTH / 2),
      );
    }
    return builder.detach();
  });

  return (
    <View
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {width > 0 && (
        <Canvas style={{ width, height }}>
          <Path path={path}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(width, 0)}
              colors={
                active
                  ? [colors.accent, colors.waveform]
                  : [colors.waveformIdle, colors.waveformIdle]
              }
            />
          </Path>
        </Canvas>
      )}
    </View>
  );
}

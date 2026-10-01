import { Canvas, Group, LinearGradient, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { formatDuration } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { IconButton, Text } from '@/core/ui';
import { barCapacity, barRects } from '@/features/recording/lib/bars';
import { waveformPeaks } from '@/features/recording/lib/pcm';

const HEIGHT = 56;
const BAR_WIDTH = 3;
const GAP = 2;

export type PlaybackScrubberProps = {
  samples: Float32Array | null;
  positionMs: number;
  durationMs: number;
  playing: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
};

/**
 * Static waveform with a played/unplayed split and a drag-to-seek handle.
 * While dragging, the split follows the finger on the UI thread; the player
 * is only told to seek when the finger lifts.
 */
export function PlaybackScrubber({
  samples,
  positionMs,
  durationMs,
  playing,
  onTogglePlay,
  onSeek,
}: PlaybackScrubberProps) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const dragging = useSharedValue(false);

  const peaks = useMemo(
    () => (samples && width > 0 ? waveformPeaks(samples, barCapacity(width, BAR_WIDTH, GAP)) : []),
    [samples, width],
  );

  const path = useMemo(() => {
    const builder = Skia.PathBuilder.Make();
    for (const r of barRects(peaks, {
      width,
      height: HEIGHT,
      barWidth: BAR_WIDTH,
      gap: GAP,
      minHeight: 3,
    })) {
      builder.addRRect(Skia.RRectXY(Skia.XYWHRect(r.x, r.y, r.width, r.height), 1.5, 1.5));
    }
    return builder.detach();
  }, [peaks, width]);

  useEffect(() => {
    if (dragging.get() || durationMs <= 0) return;
    // Status ticks every 100 ms; easing between ticks keeps the split gliding.
    progress.set(withTiming(Math.min(1, positionMs / durationMs), { duration: playing ? 110 : 0 }));
  }, [positionMs, durationMs, playing, progress, dragging]);

  const playedClip = useDerivedValue(() => Skia.XYWHRect(0, 0, progress.get() * width, HEIGHT));
  const handleX = useDerivedValue(() => progress.get() * width - 1);

  const seekTo = (fraction: number) => onSeek(Math.round(fraction * durationMs));

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin((event) => {
      dragging.set(true);
      progress.set(Math.min(1, Math.max(0, event.x / width)));
    })
    .onUpdate((event) => {
      progress.set(Math.min(1, Math.max(0, event.x / width)));
    })
    .onFinalize(() => {
      dragging.set(false);
      scheduleOnRN(seekTo, progress.get());
    });

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? 'Pause' : 'Play'}
          testID="playback-toggle"
          size={44}
          filled
          tone="accent"
          onPress={onTogglePlay}
          disabled={!samples}
        />
        <GestureDetector gesture={pan}>
          <View
            style={{ flex: 1, height: HEIGHT }}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Playback position"
            accessibilityValue={{
              text: `${formatDuration(positionMs)} of ${formatDuration(durationMs)}`,
            }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              const step = 5_000 * (event.nativeEvent.actionName === 'increment' ? 1 : -1);
              onSeek(Math.min(durationMs, Math.max(0, positionMs + step)));
            }}>
            {width > 0 && (
              <Canvas style={{ width, height: HEIGHT }}>
                <Path path={path} color={colors.waveformIdle} />
                <Group clip={playedClip}>
                  <Path path={path}>
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(width, 0)}
                      colors={[colors.accent, colors.record]}
                    />
                  </Path>
                </Group>
                <Rect
                  x={handleX}
                  y={0}
                  width={2}
                  height={HEIGHT}
                  color={colors.text}
                  opacity={0.6}
                />
              </Canvas>
            )}
          </View>
        </GestureDetector>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingLeft: 44 + spacing.md,
        }}>
        <Text variant="caption" color="textMuted" tabular testID="playback-position">
          {formatDuration(positionMs)}
        </Text>
        <Text variant="caption" color="textFaint" tabular>
          {formatDuration(durationMs)}
        </Text>
      </View>
    </View>
  );
}

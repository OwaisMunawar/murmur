import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '@/composition/ServicesProvider';
import { isAppError } from '@/core/errors/AppError';
import { createId } from '@/core/lib/id';
import { formatDuration } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Button, Chip, IconButton, Text } from '@/core/ui';
import { useModels } from '@/features/models/hooks/useModels';

import { LiveWaveform } from '../components/LiveWaveform';
import { RecordButton } from '../components/RecordButton';
import { loadSampleClip } from '../data/sampleClip';
import { useRecorder, type CapturedAudio } from '../hooks/useRecorder';
import { isNearLimit, MAX_RECORDING_MS, remainingMs } from '../lib/session';

/** Recordings shorter than this are almost always accidental taps. */
const MIN_RECORDING_MS = 800;

/** `sampleSpeed` replays the sample clip faster than real time; tests use it to stay quick. */
export function RecordScreen({ sampleSpeed = 1 }: { sampleSpeed?: number } = {}) {
  const router = useRouter();
  const services = useServices();
  const { capabilities } = useModels();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  // At the length limit the recorder stops itself; keep what was captured.
  const recorder = useRecorder({ onLimitReached: (captured) => void save(captured) });
  const { state } = recorder;

  const recording = state.status === 'recording';
  const paused = state.status === 'paused';
  const active = recording || paused;

  async function save(captured: CapturedAudio) {
    if (captured.durationMs < MIN_RECORDING_MS) {
      recorder.discard();
      return;
    }
    setSaving(true);
    const createdAt = Date.now();
    const id = createId(createdAt);
    const audioFile = await services.audio.save(id, captured.samples, captured.sampleRate);
    await services.notes.create({
      id,
      createdAt,
      durationMs: captured.durationMs,
      audioFile,
      language: null,
    });
    services.changes.emit({ id });
    void services.processor.enqueue(id);
    router.replace(`/note/${id}`);
  }

  async function toggle() {
    if (active) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await save(recorder.finish());
      return;
    }
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await recorder.start();
    } catch (error) {
      Alert.alert(
        isAppError(error, 'MIC_PERMISSION_DENIED')
          ? 'Microphone is off'
          : 'Could not start recording',
        isAppError(error, 'MIC_PERMISSION_DENIED')
          ? 'Allow microphone access for Murmur in Settings to record notes.'
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  }

  async function feedSampleClip() {
    const clip = await loadSampleClip();
    const captured = await recorder.replay(clip.samples, clip.sampleRate, { speed: sampleSpeed });
    if (captured) await save(captured);
  }

  const nearLimit = isNearLimit(state);
  const status = saving ? 'Saving' : recording ? 'Listening' : paused ? 'Paused' : 'Tap to record';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <IconButton
          icon="close"
          label="Close"
          testID="record-close"
          onPress={() => {
            recorder.discard();
            router.back();
          }}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="headline">New note</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text
            variant="overline"
            color={recording ? 'record' : 'textFaint'}
            testID="record-status">
            {status}
          </Text>
          <Text
            style={{
              fontSize: 56,
              lineHeight: 64,
              fontWeight: '300',
              letterSpacing: -1,
              color: colors.text,
            }}
            tabular
            accessibilityLabel={`Recorded ${formatDuration(state.elapsedMs)}`}
            testID="record-timer">
            {formatDuration(state.elapsedMs)}
          </Text>
          {nearLimit ? (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Text variant="caption" color="warning">
                {Math.ceil(remainingMs(state) / 1000)} s left of {formatDuration(MAX_RECORDING_MS)}
              </Text>
            </Animated.View>
          ) : (
            <Text variant="caption" color="textFaint">
              Up to {MAX_RECORDING_MS / 60_000} minutes
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          <LiveWaveform levels={recorder.levels} active={recording || saving} />
        </View>

        {!capabilities.canTranscribe && (
          <Text
            variant="caption"
            color="textMuted"
            align="center"
            style={{ paddingHorizontal: spacing.xxl }}>
            The speech model is not downloaded yet. Your recording is saved now and transcribed once
            it is.
          </Text>
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          paddingHorizontal: spacing.xl,
        }}>
        <View style={{ width: 56, alignItems: 'center' }}>
          {active && (
            <IconButton
              icon={paused ? 'play' : 'pause'}
              label={paused ? 'Resume' : 'Pause'}
              testID="record-pause"
              size={52}
              filled
              onPress={() => (paused ? void recorder.resume() : recorder.pause())}
            />
          )}
        </View>
        <RecordButton recording={active} disabled={saving} onPress={() => void toggle()} />
        <View style={{ width: 56, alignItems: 'center' }}>
          {active && (
            <IconButton
              icon="trash"
              label="Discard"
              testID="record-discard"
              size={52}
              filled
              tone="danger"
              onPress={recorder.discard}
            />
          )}
        </View>
      </View>

      {(__DEV__ || services.isDemo) && !active && !saving && (
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Chip
            icon="waveform"
            label="Use sample clip"
            testID="use-sample-clip"
            onPress={() => void feedSampleClip()}
          />
        </View>
      )}
      {saving && (
        <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
          <Button label="Saving" loading onPress={() => undefined} compact variant="secondary" />
        </View>
      )}
    </View>
  );
}

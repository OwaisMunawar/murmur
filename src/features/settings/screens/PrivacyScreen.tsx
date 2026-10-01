import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Card, Icon, Screen, SectionTitle, Text, type IconName } from '@/core/ui';

const STAYS_ON_DEVICE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'mic',
    title: 'Recordings',
    body: 'Saved as WAV files in the app’s private documents folder.',
  },
  {
    icon: 'doc',
    title: 'Transcripts, summaries, tags and to-dos',
    body: 'Stored in a local SQLite database.',
  },
  {
    icon: 'search',
    title: 'Search and Ask',
    body: 'Embeddings and answers are computed on this phone. Questions are never sent anywhere.',
  },
  {
    icon: 'chip',
    title: 'AI models',
    body: 'Whisper, LFM2.5 and MiniLM run on the CPU of this device with ExecuTorch.',
  },
];

const NETWORK: { title: string; body: string }[] = [
  {
    title: 'Model downloads from huggingface.co',
    body: 'Only when you tap Download. Requests carry the file URL and standard HTTP headers, nothing about you or your notes.',
  },
  {
    title: 'One HEAD request per model to huggingface.co',
    body: 'ExecuTorch’s fetcher pings the model’s config.json so Hugging Face can count downloads. It is part of the library and sent alongside the download.',
  },
];

const NEVER = [
  'No accounts, sign-in or cloud sync',
  'No analytics, crash reporting or ads',
  'ExecuTorch’s anonymous download telemetry is switched off',
  'No audio, text or question ever leaves the device',
];

export function PrivacyScreen() {
  const { colors, spacing } = useTheme();
  return (
    <Screen scroll edges={['bottom']} testID="privacy-screen">
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'center',
          paddingTop: spacing.sm,
        }}>
        <Icon name="shield" size={22} color={colors.success} />
        <Text variant="title" style={{ flex: 1 }}>
          Nothing leaves this phone
        </Text>
      </View>
      <Text color="textMuted">
        Murmur has exactly one piece of code that can reach the network: the model downloader. A
        lint rule and a unit test fail the build if a network call appears anywhere else.
      </Text>

      <SectionTitle>Stays on this device</SectionTitle>
      <Card style={{ gap: spacing.lg }}>
        {STAYS_ON_DEVICE.map((item) => (
          <View key={item.title} style={{ flexDirection: 'row', gap: spacing.md }}>
            <Icon name={item.icon} size={18} color={colors.accent} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="callout">{item.title}</Text>
              <Text variant="caption" color="textMuted">
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Touches the network</SectionTitle>
      <Card style={{ gap: spacing.lg }}>
        {NETWORK.map((item) => (
          <View key={item.title} style={{ flexDirection: 'row', gap: spacing.md }}>
            <Icon name="download" size={18} color={colors.warning} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="callout">{item.title}</Text>
              <Text variant="caption" color="textMuted">
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Never</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        {NEVER.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name="offline" size={16} color={colors.textMuted} />
            <Text variant="callout" style={{ flex: 1 }}>
              {line}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

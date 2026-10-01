import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { formatBytes } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Card, Chip, ListRow, Screen, SectionTitle, SwitchRow, Text } from '@/core/ui';
import { MODEL_CATALOG } from '@/features/models/catalog';
import { useModels } from '@/features/models/hooks/useModels';

import { type PerfEntry } from '../data/settingsRepository';

const LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: 'Device' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ur', label: 'اردو' },
  { code: 'ar', label: 'العربية' },
];

export function SettingsScreen() {
  const services = useServices();
  const router = useRouter();
  const { spacing } = useTheme();
  const { byId } = useModels();
  const [wifiOnly, setWifiOnly] = useState(true);
  const [language, setLanguage] = useState<string | null>(null);
  const perf = useQuery('perf', () => services.settings.get('perfLog'));
  const count = useQuery('count', () => services.notes.count());

  useEffect(() => {
    void services.settings.get('wifiOnly').then(setWifiOnly);
    void services.settings.get('language').then(setLanguage);
  }, [services]);

  const pickLanguage = useCallback(
    (code: string | null) => {
      setLanguage(code);
      void services.settings.set('language', code);
    },
    [services],
  );

  const installed = MODEL_CATALOG.filter((m) => byId[m.id]?.status === 'installed');
  const onDisk = installed.reduce((sum, m) => {
    const state = byId[m.id];
    return sum + (state?.status === 'installed' ? state.bytes : 0);
  }, 0);

  return (
    <Screen scroll testID="settings-screen">
      <Text variant="display" accessibilityRole="header">
        Settings
      </Text>

      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          icon="chip"
          title="Models"
          detail={`${installed.length} of ${MODEL_CATALOG.length} installed · ${formatBytes(onDisk)}`}
          onPress={() => router.push('/models')}
          testID="settings-models"
        />
        <ListRow
          icon="shield"
          title="Privacy"
          detail="What touches the network (only model downloads)"
          onPress={() => router.push('/privacy')}
          testID="settings-privacy"
        />
      </Card>

      <SectionTitle>Transcription language</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {LANGUAGES.map((option) => (
          <Chip
            key={option.code ?? 'device'}
            label={option.label}
            selected={language === option.code}
            onPress={() => pickLanguage(option.code)}
          />
        ))}
      </View>
      <Text variant="caption" color="textFaint">
        Whisper on ExecuTorch cannot detect the language by itself, so Murmur uses your device
        language unless you pick one.
      </Text>

      <SectionTitle>Downloads</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <SwitchRow
          title="Wi-Fi only"
          value={wifiOnly}
          onChange={(value) => {
            setWifiOnly(value);
            void services.settings.set('wifiOnly', value);
          }}
        />
      </Card>

      <SectionTitle>Measured on this device</SectionTitle>
      <Card style={{ gap: spacing.sm }} testID="perf-log">
        {(perf.data ?? []).length === 0 ? (
          <Text variant="caption" color="textMuted">
            Numbers appear here after the first transcription and answer.
          </Text>
        ) : (
          latestPerKind(perf.data ?? []).map((entry) => (
            <View key={entry.kind} style={{ gap: spacing.xxs }}>
              <Text variant="callout">{perfLabel(entry)}</Text>
              <Text variant="caption" color="textMuted">
                {entry.model} · {entry.detail}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Text variant="caption" color="textFaint" align="center">
        Murmur {Constants.expoConfig?.version ?? ''} · {count.data ?? 0} notes
        {services.isDemo ? ' · demo mode' : ''}
      </Text>
    </Screen>
  );
}

function latestPerKind(entries: readonly PerfEntry[]): PerfEntry[] {
  const seen = new Map<string, PerfEntry>();
  for (const entry of entries) if (!seen.has(entry.kind)) seen.set(entry.kind, entry);
  return [...seen.values()];
}

function perfLabel(entry: PerfEntry): string {
  switch (entry.kind) {
    case 'transcription':
      return `Transcription: ${entry.value.toFixed(2)}x real time`;
    case 'enrichment':
      return `Summary: ${entry.value.toFixed(1)} tokens/s`;
    case 'answer':
      return `Answer: ${entry.value.toFixed(1)} tokens/s`;
    case 'embedding':
      return `Embedding: ${entry.value.toFixed(0)} ms per chunk`;
  }
}

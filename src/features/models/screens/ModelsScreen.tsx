import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { formatBytes } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Card, Icon, Screen, SwitchRow, Text } from '@/core/ui';

import { MODEL_CATALOG } from '../catalog';
import { ModelCard } from '../components/ModelCard';
import { useModels } from '../hooks/useModels';

export function ModelsScreen() {
  const services = useServices();
  const { colors, spacing } = useTheme();
  const { byId, capabilities } = useModels();
  const [wifiOnly, setWifiOnly] = useState(true);

  useEffect(() => {
    void services.settings.get('wifiOnly').then(setWifiOnly);
  }, [services]);

  const toggleWifi = useCallback(
    (value: boolean) => {
      setWifiOnly(value);
      void services.settings.set('wifiOnly', value);
    },
    [services],
  );

  const onDisk = Object.values(byId).reduce(
    (sum, s) => sum + (s.status === 'installed' ? s.bytes : 0),
    0,
  );
  const installed = Object.values(byId).filter((s) => s.status === 'installed').length;

  return (
    <Screen scroll edges={['bottom']} testID="models-screen">
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'center',
          paddingTop: spacing.sm,
        }}>
        <Icon name="chip" size={18} color={colors.accent} />
        <Text variant="callout" style={{ flex: 1 }}>
          {installed} of {MODEL_CATALOG.length} installed · {formatBytes(onDisk)} on disk
        </Text>
      </View>
      <Text color="textMuted">
        Models run entirely on this phone. Recording works without any of them; each one switches on
        more of Murmur.
        {capabilities.missing.length === 0 ? ' Everything is ready.' : ''}
      </Text>

      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <SwitchRow
          testID="wifi-only"
          title="Download on Wi-Fi only"
          detail="Models are large. Cellular downloads stay off unless you allow them."
          value={wifiOnly}
          onChange={toggleWifi}
        />
      </Card>

      {MODEL_CATALOG.map((spec) => (
        <ModelCard
          key={spec.id}
          spec={spec}
          state={byId[spec.id] ?? { status: 'missing' }}
          onDownload={() => void services.models.download(spec.id).catch(() => undefined)}
          onCancel={() => services.models.cancel(spec.id)}
          onRemove={() => void services.models.remove(spec.id)}
        />
      ))}

      <Text variant="caption" color="textFaint">
        Files come from huggingface.co (Software Mansion’s ExecuTorch exports). Download is the only
        time Murmur uses the network.
      </Text>
    </Screen>
  );
}

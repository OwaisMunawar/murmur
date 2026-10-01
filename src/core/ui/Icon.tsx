import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { type ColorValue } from 'react-native';

/**
 * Semantic icon names. Screens ask for "trash", not for an SF Symbol or a
 * Material glyph, so each platform gets its native icon from one table.
 */
const glyphs = {
  mic: { ios: 'mic.fill', android: 'mic' },
  stop: { ios: 'stop.fill', android: 'stop' },
  pause: { ios: 'pause.fill', android: 'pause' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  search: { ios: 'magnifyingglass', android: 'search' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  trash: { ios: 'trash', android: 'delete' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  check: { ios: 'checkmark', android: 'check' },
  checkboxOn: { ios: 'checkmark.circle.fill', android: 'check_box' },
  checkboxOff: { ios: 'circle', android: 'check_box_outline_blank' },
  download: { ios: 'arrow.down.circle', android: 'download' },
  lock: { ios: 'lock.fill', android: 'lock' },
  settings: { ios: 'gearshape', android: 'settings' },
  close: { ios: 'xmark', android: 'close' },
  tag: { ios: 'tag', android: 'sell' },
  quote: { ios: 'quote.opening', android: 'format_quote' },
  wifi: { ios: 'wifi', android: 'wifi' },
  waveform: { ios: 'waveform', android: 'graphic_eq' },
  plus: { ios: 'plus', android: 'add' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  offline: { ios: 'icloud.slash', android: 'cloud_off' },
  chip: { ios: 'cpu', android: 'memory' },
  doc: { ios: 'doc.text', android: 'description' },
  shield: { ios: 'checkmark.shield', android: 'shield' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof glyphs;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
}) {
  return (
    <SymbolView
      name={glyphs[name]}
      size={size}
      tintColor={color}
      weight="medium"
      style={{ width: size, height: size }}
    />
  );
}

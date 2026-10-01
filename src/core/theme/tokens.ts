/**
 * Design tokens. Components read semantic roles (`surface`, `textMuted`)
 * rather than raw palette values, so light and dark only differ here.
 */

const palette = {
  paper: '#F6F4EF',
  paperRaised: '#FFFFFF',
  paperSunken: '#ECE9E1',
  ink: '#1B1A22',
  inkSoft: '#5D5A68',
  inkFaint: '#8F8B9A',
  night: '#14121F',
  nightRaised: '#1E1B2C',
  nightSunken: '#0E0C17',
  moon: '#F1EFEA',
  moonSoft: '#B7B3C2',
  moonFaint: '#7D798A',
  ember: '#E5533D',
  emberSoft: '#F8D9D2',
  emberDeep: '#5A2119',
  violet: '#6C5CE7',
  violetSoft: '#E6E2FB',
  violetDeep: '#2E2766',
  moss: '#2F9E6E',
  mossSoft: '#D7EFE3',
  mossDeep: '#163F2E',
  amber: '#C98A16',
  amberSoft: '#F6E8C8',
  amberDeep: '#4A3510',
} as const;

export type ColorRoles = {
  background: string;
  surface: string;
  surfaceSunken: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  record: string;
  recordSoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  onAccent: string;
  waveform: string;
  waveformIdle: string;
  scrim: string;
};

const light: ColorRoles = {
  background: palette.paper,
  surface: palette.paperRaised,
  surfaceSunken: palette.paperSunken,
  border: 'rgba(27, 26, 34, 0.09)',
  text: palette.ink,
  textMuted: palette.inkSoft,
  textFaint: palette.inkFaint,
  record: palette.ember,
  recordSoft: palette.emberSoft,
  accent: palette.violet,
  accentSoft: palette.violetSoft,
  success: palette.moss,
  successSoft: palette.mossSoft,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.ember,
  onAccent: '#FFFFFF',
  waveform: palette.ember,
  waveformIdle: 'rgba(27, 26, 34, 0.18)',
  scrim: 'rgba(20, 18, 31, 0.4)',
};

const dark: ColorRoles = {
  background: palette.night,
  surface: palette.nightRaised,
  surfaceSunken: palette.nightSunken,
  border: 'rgba(241, 239, 234, 0.08)',
  text: palette.moon,
  textMuted: palette.moonSoft,
  textFaint: palette.moonFaint,
  record: '#FF6A52',
  recordSoft: palette.emberDeep,
  accent: '#9C90FF',
  accentSoft: palette.violetDeep,
  success: '#4CC08D',
  successSoft: palette.mossDeep,
  warning: '#E7B04A',
  warningSoft: palette.amberDeep,
  danger: '#FF6A52',
  onAccent: '#FFFFFF',
  waveform: '#FF6A52',
  waveformIdle: 'rgba(241, 239, 234, 0.2)',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400', letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0.1 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.9 },
  mono: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorRoles;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
};

export const themes: Record<Theme['scheme'], Theme> = {
  light: { scheme: 'light', colors: light, spacing, radii, typography, motion },
  dark: { scheme: 'dark', colors: dark, spacing, radii, typography, motion },
};

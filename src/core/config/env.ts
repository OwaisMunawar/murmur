/**
 * Demo mode swaps every AI engine for a deterministic fake and seeds fictional
 * notes. Inlined at build time by Expo, so it cannot be toggled at runtime.
 */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

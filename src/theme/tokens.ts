/**
 * Design tokens, ported from spyder-web/src/styles/tokens.css so the two
 * clients stay visually identical. Keep the values in sync by hand: there is
 * no shared package across the two repos.
 */

export interface Palette {
  bg: string;
  bg2: string;
  side: string;
  fill: string;
  fill2: string;

  label: string;
  label2: string;
  sep: string;

  blue: string;
  link: string;
  blueTint: string;

  green: string;
  greenTint: string;
  toggle: string;

  orange: string;
  orangeTint: string;

  red: string;
  redTint: string;

  bubbleIn: string;
  sms: string;
}

export const lightPalette: Palette = {
  bg: '#F5F5F7',
  bg2: '#FFFFFF',
  side: 'rgba(236, 236, 240, 0.78)',
  fill: '#E8E8ED',
  fill2: '#F2F2F5',

  label: '#1D1D1F',
  label2: '#6E6E73',
  sep: 'rgba(60, 60, 67, 0.14)',

  blue: '#0A6CF0',
  link: '#0066CC',
  blueTint: 'rgba(10, 108, 240, 0.10)',

  green: '#1D7A35',
  greenTint: 'rgba(52, 199, 89, 0.16)',
  toggle: '#248A3D',

  orange: '#B25000',
  orangeTint: 'rgba(255, 149, 0, 0.16)',

  red: '#D70015',
  redTint: 'rgba(255, 59, 48, 0.12)',

  bubbleIn: '#E9E9EB',
  sms: '#1A7F37',
};

export const darkPalette: Palette = {
  bg: '#141416',
  bg2: '#1C1C1E',
  side: 'rgba(36, 36, 38, 0.82)',
  fill: '#2C2C2E',
  fill2: '#242426',

  label: '#F5F5F7',
  label2: '#A1A1A6',
  sep: 'rgba(84, 84, 88, 0.55)',

  blue: '#0A6CF0',
  link: '#409CFF',
  blueTint: 'rgba(10, 132, 255, 0.20)',

  green: '#30D158',
  greenTint: 'rgba(48, 209, 88, 0.16)',
  toggle: '#30D158',

  orange: '#FF9F0A',
  orangeTint: 'rgba(255, 159, 10, 0.16)',

  red: '#FF453A',
  redTint: 'rgba(255, 69, 58, 0.16)',

  bubbleIn: '#2C2C2E',
  sms: '#1A7F37',
};

/** The web type ramp, as React Native text styles. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.75, lineHeight: 38 },
  title: { fontSize: 28, fontWeight: '600', lineHeight: 34 },
  section: { fontSize: 20, fontWeight: '700', lineHeight: 25 },
  headline: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodySm: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

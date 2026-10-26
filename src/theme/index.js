// Design tokens shared by every screen. Keep colours here so the whole app
// can be re-skinned from one place.
import { Platform } from 'react-native';

export const colors = {
  brand: '#5B4CF5',
  brandDark: '#4335D9',
  brandSoft: '#EEEBFF',
  brandText: '#3A2DC4',
  accent: '#0EA5E9',

  bg: '#F4F5FA',
  card: '#FFFFFF',
  cardAlt: '#F8F9FC',
  border: '#E6E8F0',
  borderStrong: '#D4D8E4',

  text: '#121826',
  textSoft: '#3B4256',
  muted: '#6B7280',
  faint: '#9AA1B2',
  white: '#FFFFFF',

  success: '#12A150',
  successSoft: '#E4F6EB',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#D98A00',
  warningSoft: '#FFF4DC',
  info: '#0B84C6',
  infoSoft: '#E3F3FC',

  // Entry/chat bubbles — customer-sent rows keep the web's yellow cue.
  bubbleIn: '#FFF6D8',
  bubbleInBorder: '#F2E2A6',
  bubbleOut: '#FFFFFF',
  highlight: '#FFE58A',

  overlay: 'rgba(15, 18, 34, 0.45)',
};

export const gradients = {
  brand: ['#5B4CF5', '#8B5CF6'],
  hero: ['#4F3FE8', '#7C4DF0'],
  success: ['#12A150', '#22C55E'],
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const font = {
  xs: 11,
  sm: 12.5,
  base: 14,
  md: 15.5,
  lg: 17,
  xl: 20,
  xxl: 26,
  hero: 30,
};

export const weight = { regular: '400', medium: '500', semi: '600', bold: '700', heavy: '800' };

export const shadow = Platform.select({
  ios: {
    shadowColor: '#1B1F3B',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 2 },
});

export const shadowStrong = Platform.select({
  ios: {
    shadowColor: '#1B1F3B',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  default: { elevation: 8 },
});

// Deterministic avatar colours so a customer keeps the same tint everywhere.
const AVATAR = ['#5B4CF5', '#0EA5E9', '#12A150', '#E5484D', '#D98A00', '#8B5CF6', '#0F9D8F', '#DB2777'];
export function avatarColor(seed) {
  const s = String(seed || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

export const amountColor = (n) => {
  const v = parseFloat(n);
  if (!v) return colors.textSoft;
  return v < 0 ? colors.danger : colors.success;
};

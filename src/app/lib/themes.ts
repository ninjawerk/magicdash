import type { DashboardLayout } from '@sdk';

export type Theme = DashboardLayout['theme'];

export interface ThemePreset extends Theme {
  id: string;
  name: string;
  description: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy with a soft blue accent. The default.',
    background: 'radial-gradient(1200px 800px at 15% 10%, #16213a 0%, #0b0f17 55%, #070a10 100%)',
    accent: '#7c9cff',
    tileBackground: 'rgba(255,255,255,0.05)',
    tileRadius: 22,
    fg: '#e7ebf3',
    surface: '#121826',
    dark: true,
    cool: '#7cc4ff',
    warm: '#ff9f68',
    showTitles: true,
  },
  {
    id: 'amoled',
    name: 'Pure black',
    description: 'True black for OLED screens, crisp edges.',
    background: '#000000',
    accent: '#4da3ff',
    tileBackground: '#0c0c0e',
    tileRadius: 16,
    fg: '#f2f2f2',
    surface: '#141416',
    dark: true,
    cool: '#4da3ff',
    warm: '#ff8a5b',
    showTitles: true,
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Cool arctic greys and frost blue.',
    background: 'linear-gradient(160deg, #2e3440 0%, #242933 100%)',
    accent: '#88c0d0',
    tileBackground: 'rgba(236,239,244,0.06)',
    tileRadius: 18,
    fg: '#eceff4',
    surface: '#3b4252',
    dark: true,
    cool: '#88c0d0',
    warm: '#d08770',
    showTitles: true,
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Purple-tinted dark with a violet accent.',
    background: 'radial-gradient(1000px 700px at 80% 0%, #3a2d5c 0%, #282a36 50%, #1e1f29 100%)',
    accent: '#bd93f9',
    tileBackground: 'rgba(248,248,242,0.06)',
    tileRadius: 22,
    fg: '#f8f8f2',
    surface: '#343746',
    dark: true,
    cool: '#8be9fd',
    warm: '#ffb86c',
    showTitles: true,
  },
  {
    id: 'solarized',
    name: 'Solarized',
    description: 'Warm teal-black with an amber accent.',
    background: 'linear-gradient(180deg, #073642 0%, #002b36 100%)',
    accent: '#b58900',
    tileBackground: 'rgba(238,232,213,0.06)',
    tileRadius: 20,
    fg: '#eee8d5',
    surface: '#0b3a47',
    dark: true,
    cool: '#2aa198',
    warm: '#cb4b16',
    showTitles: true,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Mossy greens, easy on the eyes at night.',
    background: 'radial-gradient(1100px 800px at 10% 90%, #1b2f22 0%, #0f1a14 55%, #0a120d 100%)',
    accent: '#7bd88f',
    tileBackground: 'rgba(200,240,210,0.06)',
    tileRadius: 24,
    fg: '#e6f2ea',
    surface: '#16241c',
    dark: true,
    cool: '#8be0c8',
    warm: '#e9c46a',
    showTitles: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep sea blues with a turquoise accent.',
    background: 'radial-gradient(1200px 900px at 50% 100%, #0a3d62 0%, #08243d 50%, #05121f 100%)',
    accent: '#4ecdc4',
    tileBackground: 'rgba(120,200,255,0.07)',
    tileRadius: 26,
    fg: '#e3f6ff',
    surface: '#0f2a44',
    dark: true,
    cool: '#4ecdc4',
    warm: '#ffb677',
    showTitles: true,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'A bold gradient with translucent dark tiles.',
    background: 'linear-gradient(160deg, #3a1c71 0%, #d76d77 55%, #ffaf7b 100%)',
    accent: '#ffd166',
    tileBackground: 'rgba(20,10,30,0.42)',
    tileRadius: 24,
    fg: '#fff7f0',
    surface: '#3d2151',
    dark: true,
    cool: '#9ad0ff',
    warm: '#ffd166',
    showTitles: true,
  },
  {
    id: 'rose',
    name: 'Rosé',
    description: 'Plum dark with a pink accent.',
    background: 'radial-gradient(1000px 800px at 90% 10%, #3b1a2e 0%, #1a1016 55%, #120a0f 100%)',
    accent: '#ff7ab6',
    tileBackground: 'rgba(255,220,235,0.06)',
    tileRadius: 26,
    fg: '#fbeff5',
    surface: '#2a1620',
    dark: true,
    cool: '#a8c5ff',
    warm: '#ff7ab6',
    showTitles: true,
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Light, warm off-white for bright rooms.',
    background: 'linear-gradient(180deg, #f6f2ea 0%, #ebe5d9 100%)',
    accent: '#f59e0b',
    tileBackground: 'rgba(255,255,255,0.72)',
    tileRadius: 20,
    fg: '#1f2933',
    surface: '#ffffff',
    dark: false,
    cool: '#2563eb',
    warm: '#dc6803',
    showTitles: true,
  },
  {
    id: 'daylight',
    name: 'Daylight',
    description: 'Cool light grey with a blue accent.',
    background: 'radial-gradient(1200px 800px at 10% 0%, #ffffff 0%, #e9eef6 60%, #dfe6f0 100%)',
    accent: '#3b82f6',
    tileBackground: 'rgba(255,255,255,0.8)',
    tileRadius: 22,
    fg: '#111827',
    surface: '#ffffff',
    dark: false,
    cool: '#2563eb',
    warm: '#ea580c',
    showTitles: true,
  },
];

export const DEFAULT_THEME: Theme = stripPreset(THEME_PRESETS[0]);

export function stripPreset(p: ThemePreset): Theme {
  const { id, name, description, ...theme } = p;
  void name;
  void description;
  return { ...theme, preset: id };
}

/** Fill in tokens missing from older layouts. */
export function normalizeTheme(t: Partial<Theme> | undefined): Theme {
  return { ...DEFAULT_THEME, ...(t ?? {}) };
}

/** Apply a theme to the document (CSS variables + colour scheme). */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--tile-bg', t.tileBackground);
  root.style.setProperty('--tile-radius', `${t.tileRadius}px`);
  root.style.setProperty('--fg', t.fg);
  root.style.setProperty('--surface', t.surface);
  // Tailwind's `white` utilities resolve to this variable, so every text-white/… and bg-white/… follows the theme.
  root.style.setProperty('--color-white', t.fg);
  root.style.setProperty('--cool', t.cool);
  root.style.setProperty('--warm', t.warm);
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  document.body.style.background = t.background;
  document.body.style.color = t.fg;
}

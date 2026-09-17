import type { BackgroundEffect, DashboardLayout, TileBorderStyle, TileShadow, TitleStyle } from '@sdk';

export type Theme = DashboardLayout['theme'];

export interface ThemePreset extends Theme {
  id: string;
  name: string;
  description: string;
  /** Preset gallery grouping. */
  group: 'dark' | 'light' | 'bold' | 'minimal';
}

// ---------------------------------------------------------------------------
// Fonts

export interface FontPreset {
  id: string;
  name: string;
  /** CSS font-family stack. */
  family: string;
  /** Google Fonts `family=` value; omit for system fonts. */
  google?: string;
  category: 'sans' | 'serif' | 'display' | 'rounded' | 'mono' | 'system';
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'inter', name: 'Inter', family: "'Inter', ui-sans-serif, system-ui, sans-serif", google: 'Inter:wght@300;400;500;600;700;800', category: 'sans' },
  { id: 'system', name: 'System', family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', category: 'system' },
  { id: 'manrope', name: 'Manrope', family: "'Manrope', sans-serif", google: 'Manrope:wght@300;400;500;600;700;800', category: 'sans' },
  { id: 'dm-sans', name: 'DM Sans', family: "'DM Sans', sans-serif", google: 'DM+Sans:wght@300;400;500;600;700', category: 'sans' },
  { id: 'ibm-plex', name: 'IBM Plex Sans', family: "'IBM Plex Sans', sans-serif", google: 'IBM+Plex+Sans:wght@300;400;500;600;700', category: 'sans' },
  { id: 'space-grotesk', name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@300;400;500;600;700', category: 'sans' },
  { id: 'outfit', name: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit:wght@300;400;500;600;700;800', category: 'sans' },
  { id: 'sora', name: 'Sora', family: "'Sora', sans-serif", google: 'Sora:wght@300;400;500;600;700;800', category: 'sans' },
  { id: 'poppins', name: 'Poppins', family: "'Poppins', sans-serif", google: 'Poppins:wght@300;400;500;600;700;800', category: 'sans' },
  { id: 'nunito', name: 'Nunito', family: "'Nunito', sans-serif", google: 'Nunito:wght@300;400;500;600;700;800', category: 'rounded' },
  { id: 'quicksand', name: 'Quicksand', family: "'Quicksand', sans-serif", google: 'Quicksand:wght@300;400;500;600;700', category: 'rounded' },
  { id: 'comfortaa', name: 'Comfortaa', family: "'Comfortaa', sans-serif", google: 'Comfortaa:wght@300;400;500;600;700', category: 'rounded' },
  { id: 'varela-round', name: 'Varela Round', family: "'Varela Round', sans-serif", google: 'Varela+Round', category: 'rounded' },
  { id: 'playfair', name: 'Playfair Display', family: "'Playfair Display', serif", google: 'Playfair+Display:wght@400;500;600;700;800', category: 'serif' },
  { id: 'lora', name: 'Lora', family: "'Lora', serif", google: 'Lora:wght@400;500;600;700', category: 'serif' },
  { id: 'fraunces', name: 'Fraunces', family: "'Fraunces', serif", google: 'Fraunces:wght@300;400;500;600;700;800', category: 'serif' },
  { id: 'merriweather', name: 'Merriweather', family: "'Merriweather', serif", google: 'Merriweather:wght@300;400;700', category: 'serif' },
  { id: 'roboto-slab', name: 'Roboto Slab', family: "'Roboto Slab', serif", google: 'Roboto+Slab:wght@300;400;500;600;700', category: 'serif' },
  { id: 'oswald', name: 'Oswald', family: "'Oswald', sans-serif", google: 'Oswald:wght@300;400;500;600;700', category: 'display' },
  { id: 'bebas', name: 'Bebas Neue', family: "'Bebas Neue', sans-serif", google: 'Bebas+Neue', category: 'display' },
  { id: 'josefin', name: 'Josefin Sans', family: "'Josefin Sans', sans-serif", google: 'Josefin+Sans:wght@300;400;500;600;700', category: 'display' },
  { id: 'orbitron', name: 'Orbitron', family: "'Orbitron', sans-serif", google: 'Orbitron:wght@400;500;600;700;800', category: 'display' },
  { id: 'righteous', name: 'Righteous', family: "'Righteous', sans-serif", google: 'Righteous', category: 'display' },
  { id: 'press-start', name: 'Press Start 2P', family: "'Press Start 2P', monospace", google: 'Press+Start+2P', category: 'display' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono', ui-monospace, monospace", google: 'JetBrains+Mono:wght@400;500;700', category: 'mono' },
  { id: 'fira-code', name: 'Fira Code', family: "'Fira Code', ui-monospace, monospace", google: 'Fira+Code:wght@400;500;700', category: 'mono' },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', ui-monospace, monospace", google: 'IBM+Plex+Mono:wght@400;500;700', category: 'mono' },
  { id: 'space-mono', name: 'Space Mono', family: "'Space Mono', ui-monospace, monospace", google: 'Space+Mono:wght@400;700', category: 'mono' },
  { id: 'share-tech-mono', name: 'Share Tech Mono', family: "'Share Tech Mono', ui-monospace, monospace", google: 'Share+Tech+Mono', category: 'mono' },
  { id: 'dm-mono', name: 'DM Mono', family: "'DM Mono', ui-monospace, monospace", google: 'DM+Mono:wght@400;500', category: 'mono' },
  { id: 'system-mono', name: 'System mono', family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', category: 'system' },
];

/** Resolve a font id or free-text family to a CSS stack and (optionally) a Google Fonts family parameter. */
export function resolveFont(value: string | undefined, fallback: string): { family: string; google?: string } {
  const v = (value ?? '').trim();
  if (!v) return resolveFont(fallback, 'system');
  const p = FONT_PRESETS.find((f) => f.id === v || f.name.toLowerCase() === v.toLowerCase());
  if (p) return { family: p.family, google: p.google };
  // Free text: treat as a family name; try Google Fonts by that name (harmless 404 if it doesn't exist).
  const isStack = v.includes(',') || v.startsWith('var(');
  return { family: isStack ? v : `'${v.replace(/'/g, '')}', sans-serif`, google: isStack ? undefined : `${v.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800` };
}

const loadedFonts = new Set<string>();
/** Inject a Google Fonts stylesheet once (no-op offline: the fallback stack is used). */
export function ensureGoogleFont(google: string | undefined) {
  if (!google || loadedFonts.has(google)) return;
  loadedFonts.add(google);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
  link.dataset.mdFont = google;
  document.head.appendChild(link);
}

// ---------------------------------------------------------------------------
// Backgrounds

export interface GradientPreset {
  id: string;
  name: string;
  css: string;
  /** Suggested text colour for contrast. */
  dark: boolean;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'midnight', name: 'Midnight', css: 'radial-gradient(1200px 800px at 15% 10%, #16213a 0%, #0b0f17 55%, #070a10 100%)', dark: true },
  { id: 'deep-space', name: 'Deep space', css: 'radial-gradient(900px 700px at 70% 20%, #1d1b4b 0%, #0b0a1f 55%, #030308 100%)', dark: true },
  { id: 'aurora-mesh', name: 'Aurora mesh', css: 'radial-gradient(at 20% 20%, #1b3a5c 0px, transparent 50%), radial-gradient(at 80% 0%, #2c1f5c 0px, transparent 50%), radial-gradient(at 0% 80%, #0f3f3a 0px, transparent 50%), radial-gradient(at 80% 90%, #3b1a45 0px, transparent 50%), #0a0f1c', dark: true },
  { id: 'ember', name: 'Ember', css: 'radial-gradient(1000px 700px at 80% 100%, #5a1f1f 0%, #2a0f14 50%, #120608 100%)', dark: true },
  { id: 'twilight', name: 'Twilight', css: 'linear-gradient(180deg, #0f1c3f 0%, #2b2d6b 45%, #7a3e7a 80%, #d47a6a 100%)', dark: true },
  { id: 'northern', name: 'Northern lights', css: 'linear-gradient(200deg, #04121b 0%, #0b3b3a 35%, #1a6b5a 60%, #0b1f3a 100%)', dark: true },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(160deg, #3a1c71 0%, #d76d77 55%, #ffaf7b 100%)', dark: true },
  { id: 'lagoon', name: 'Lagoon', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', dark: true },
  { id: 'peach', name: 'Peach', css: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', dark: false },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(135deg, #e0f7f1 0%, #c8ecd9 60%, #f6fff9 100%)', dark: false },
  { id: 'lavender', name: 'Lavender', css: 'linear-gradient(160deg, #ece9ff 0%, #d9d4ff 55%, #f7f5ff 100%)', dark: false },
  { id: 'paper', name: 'Paper', css: 'linear-gradient(180deg, #f6f2ea 0%, #ebe5d9 100%)', dark: false },
  { id: 'candy', name: 'Candy', css: 'radial-gradient(at 0% 0%, #ff9a9e 0px, transparent 55%), radial-gradient(at 100% 0%, #fad0c4 0px, transparent 55%), radial-gradient(at 100% 100%, #a18cd1 0px, transparent 55%), radial-gradient(at 0% 100%, #fbc2eb 0px, transparent 55%), #f5d5e6', dark: false },
  { id: 'graphite', name: 'Graphite', css: 'linear-gradient(180deg, #2b2b2e 0%, #161618 100%)', dark: true },
  { id: 'forest', name: 'Forest', css: 'radial-gradient(1100px 800px at 10% 90%, #1b2f22 0%, #0f1a14 55%, #0a120d 100%)', dark: true },
  { id: 'ocean', name: 'Ocean', css: 'radial-gradient(1200px 900px at 50% 100%, #0a3d62 0%, #08243d 50%, #05121f 100%)', dark: true },
  { id: 'cyber', name: 'Cyber', css: 'linear-gradient(135deg, #0b0014 0%, #1a0533 50%, #001a2c 100%)', dark: true },
  { id: 'gold', name: 'Gold hour', css: 'linear-gradient(160deg, #2b1d0e 0%, #6b3f14 50%, #c7822a 100%)', dark: true },
  { id: 'black', name: 'Pure black', css: '#000000', dark: true },
  { id: 'white', name: 'Pure white', css: '#ffffff', dark: false },
];

export const EFFECTS: { id: BackgroundEffect; name: string; hint: string; cost: 'free' | 'light' | 'medium' }[] = [
  { id: 'none', name: 'None', hint: 'Plain background.', cost: 'free' },
  { id: 'vignette', name: 'Vignette', hint: 'Darkened edges, draws the eye to the middle.', cost: 'free' },
  { id: 'grain', name: 'Film grain', hint: 'Subtle static noise for a printed look.', cost: 'free' },
  { id: 'dots', name: 'Dot grid', hint: 'Faint dot pattern, like graph paper.', cost: 'free' },
  { id: 'grid', name: 'Blueprint grid', hint: 'Fine lines in the accent colour.', cost: 'free' },
  { id: 'scanlines', name: 'Scanlines', hint: 'Retro CRT stripes.', cost: 'free' },
  { id: 'stars', name: 'Starfield', hint: 'Slowly twinkling stars.', cost: 'light' },
  { id: 'rays', name: 'Light rays', hint: 'Soft beams from the top corner.', cost: 'light' },
  { id: 'bokeh', name: 'Bokeh', hint: 'Drifting soft circles in the accent tones.', cost: 'medium' },
  { id: 'aurora', name: 'Aurora', hint: 'Slow-moving colour blobs. Prettiest, heaviest on a Pi.', cost: 'medium' },
];

export const BORDER_STYLES: { id: TileBorderStyle; name: string; hint: string }[] = [
  { id: 'hairline', name: 'Hairline', hint: 'A faint 1px line (default).' },
  { id: 'none', name: 'None', hint: 'No border at all.' },
  { id: 'solid', name: 'Solid', hint: 'A plain line in the border colour.' },
  { id: 'dashed', name: 'Dashed', hint: 'Sketchy dashed outline.' },
  { id: 'double', name: 'Double', hint: 'Two thin lines, classic frame.' },
  { id: 'inset', name: 'Inset highlight', hint: 'Light inner edge, like frosted glass.' },
  { id: 'glow', name: 'Glow', hint: 'Soft accent halo around each tile.' },
  { id: 'neon', name: 'Neon', hint: 'Bright accent outline with a glow.' },
  { id: 'gradient', name: 'Gradient', hint: 'Accent to cool tone around the edge.' },
  { id: 'accent-top', name: 'Accent top', hint: 'A coloured bar along the top.' },
  { id: 'accent-left', name: 'Accent left', hint: 'A coloured bar down the left.' },
  { id: 'custom', name: 'Custom CSS', hint: 'Write the border yourself.' },
];

export const SHADOWS: { id: TileShadow; name: string }[] = [
  { id: 'soft', name: 'Soft' },
  { id: 'none', name: 'None' },
  { id: 'lifted', name: 'Lifted' },
  { id: 'hard', name: 'Hard offset' },
  { id: 'glow', name: 'Accent glow' },
];

export const TITLE_STYLES: { id: TitleStyle; name: string }[] = [
  { id: 'caps', name: 'Small caps' },
  { id: 'normal', name: 'Normal' },
  { id: 'bold', name: 'Bold' },
  { id: 'pill', name: 'Pill badge' },
  { id: 'underline', name: 'Underlined' },
];

// ---------------------------------------------------------------------------
// Presets

const base = {
  showTitles: true,
  tileBorderStyle: 'hairline' as TileBorderStyle,
  tileBorderWidth: 1,
  tileBorderOpacity: 100,
  tileShadow: 'soft' as TileShadow,
  tileBlur: 10,
  tilePadding: 16,
  fontFamily: 'inter',
  fontMono: 'jetbrains-mono',
  fontScale: 1,
  fontWeight: 400 as const,
  letterSpacing: 0,
  titleStyle: 'caps' as TitleStyle,
  titleAlign: 'left' as const,
  titleColor: 'muted' as const,
  iconStroke: 2,
  iconTint: 'auto' as const,
  iconFill: false,
  iconScale: 1,
  backgroundEffect: 'none' as BackgroundEffect,
  backgroundOverlay: 0,
  backgroundBlur: 0,
  backgroundFit: 'cover' as const,
};

export const THEME_PRESETS: ThemePreset[] = [
  { ...base, id: 'midnight', group: 'dark', name: 'Midnight', description: 'Deep navy with a soft blue accent. The default.', background: GRADIENT_PRESETS[0].css, accent: '#7c9cff', tileBackground: 'rgba(255,255,255,0.05)', tileRadius: 22, fg: '#e7ebf3', surface: '#121826', dark: true, cool: '#7cc4ff', warm: '#ff9f68' },
  { ...base, id: 'amoled', group: 'dark', name: 'Pure black', description: 'True black for OLED screens, crisp edges.', background: '#000000', accent: '#4da3ff', tileBackground: '#0c0c0e', tileRadius: 16, fg: '#f2f2f2', surface: '#141416', dark: true, cool: '#4da3ff', warm: '#ff8a5b', tileBlur: 0 },
  { ...base, id: 'nord', group: 'dark', name: 'Nord', description: 'Cool arctic greys and frost blue.', background: 'linear-gradient(160deg, #2e3440 0%, #242933 100%)', accent: '#88c0d0', tileBackground: 'rgba(236,239,244,0.06)', tileRadius: 18, fg: '#eceff4', surface: '#3b4252', dark: true, cool: '#88c0d0', warm: '#d08770' },
  { ...base, id: 'dracula', group: 'dark', name: 'Dracula', description: 'Purple-tinted dark with a violet accent.', background: 'radial-gradient(1000px 700px at 80% 0%, #3a2d5c 0%, #282a36 50%, #1e1f29 100%)', accent: '#bd93f9', tileBackground: 'rgba(248,248,242,0.06)', tileRadius: 22, fg: '#f8f8f2', surface: '#343746', dark: true, cool: '#8be9fd', warm: '#ffb86c' },
  { ...base, id: 'solarized', group: 'dark', name: 'Solarized', description: 'Warm teal-black with an amber accent.', background: 'linear-gradient(180deg, #073642 0%, #002b36 100%)', accent: '#b58900', tileBackground: 'rgba(238,232,213,0.06)', tileRadius: 20, fg: '#eee8d5', surface: '#0b3a47', dark: true, cool: '#2aa198', warm: '#cb4b16' },
  { ...base, id: 'forest', group: 'dark', name: 'Forest', description: 'Mossy greens, easy on the eyes at night.', background: GRADIENT_PRESETS.find((g) => g.id === 'forest')!.css, accent: '#7bd88f', tileBackground: 'rgba(200,240,210,0.06)', tileRadius: 24, fg: '#e6f2ea', surface: '#16241c', dark: true, cool: '#8be0c8', warm: '#e9c46a', fontFamily: 'nunito' },
  { ...base, id: 'ocean', group: 'dark', name: 'Ocean', description: 'Deep sea blues with a turquoise accent.', background: GRADIENT_PRESETS.find((g) => g.id === 'ocean')!.css, accent: '#4ecdc4', tileBackground: 'rgba(120,200,255,0.07)', tileRadius: 26, fg: '#e3f6ff', surface: '#0f2a44', dark: true, cool: '#4ecdc4', warm: '#ffb677' },
  { ...base, id: 'rose', group: 'dark', name: 'Rosé', description: 'Plum dark with a pink accent.', background: 'radial-gradient(1000px 800px at 90% 10%, #3b1a2e 0%, #1a1016 55%, #120a0f 100%)', accent: '#ff7ab6', tileBackground: 'rgba(255,220,235,0.06)', tileRadius: 26, fg: '#fbeff5', surface: '#2a1620', dark: true, cool: '#a8c5ff', warm: '#ff7ab6', fontFamily: 'manrope' },
  { ...base, id: 'aurora', group: 'dark', name: 'Aurora', description: 'Drifting northern lights behind frosted tiles.', background: GRADIENT_PRESETS.find((g) => g.id === 'northern')!.css, backgroundEffect: 'aurora', accent: '#7ff0c8', tileBackground: 'rgba(255,255,255,0.06)', tileRadius: 26, fg: '#eafff6', surface: '#0d2a2a', dark: true, cool: '#7fd6ff', warm: '#ffc27a', tileBorderStyle: 'inset', tileBlur: 18, fontFamily: 'manrope' },
  { ...base, id: 'nightsky', group: 'dark', name: 'Night sky', description: 'A quiet starfield with soft glowing tiles.', background: GRADIENT_PRESETS.find((g) => g.id === 'deep-space')!.css, backgroundEffect: 'stars', accent: '#c8b6ff', tileBackground: 'rgba(120,110,200,0.08)', tileRadius: 28, fg: '#ecebff', surface: '#171533', dark: true, cool: '#9cc9ff', warm: '#ffd6a5', tileBorderStyle: 'glow', tileShadow: 'none', fontFamily: 'sora' },
  { ...base, id: 'glass', group: 'dark', name: 'Glass', description: 'Colourful mesh with heavy frosted glass.', background: GRADIENT_PRESETS.find((g) => g.id === 'aurora-mesh')!.css, accent: '#8ec5ff', tileBackground: 'rgba(255,255,255,0.09)', tileRadius: 30, fg: '#f4f8ff', surface: '#1a2238', dark: true, cool: '#8ec5ff', warm: '#ffb08a', tileBorderStyle: 'inset', tileBlur: 24, tileShadow: 'lifted', fontFamily: 'dm-sans' },
  { ...base, id: 'neon', group: 'bold', name: 'Neon', description: 'Black with glowing magenta outlines.', background: '#050508', backgroundEffect: 'grid', accent: '#ff3cac', tileBackground: 'rgba(255,60,172,0.04)', tileRadius: 12, fg: '#fdf4ff', surface: '#15101c', dark: true, cool: '#22d3ee', warm: '#ff3cac', tileBorderStyle: 'neon', tileBlur: 0, tileShadow: 'none', fontFamily: 'space-grotesk', fontDisplay: 'orbitron', titleColor: 'accent', iconTint: 'accent' },
  { ...base, id: 'cyberpunk', group: 'bold', name: 'Cyberpunk', description: 'Yellow on violet with accent bars.', background: GRADIENT_PRESETS.find((g) => g.id === 'cyber')!.css, backgroundEffect: 'scanlines', accent: '#f9f871', tileBackground: 'rgba(249,248,113,0.05)', tileRadius: 4, fg: '#fbfbe8', surface: '#1c0f2e', dark: true, cool: '#00e5ff', warm: '#ff2e88', tileBorderStyle: 'accent-left', tileBorderWidth: 3, tileBlur: 0, fontFamily: 'space-grotesk', fontMono: 'share-tech-mono', titleStyle: 'bold', letterSpacing: 0.02 },
  { ...base, id: 'terminal', group: 'bold', name: 'Terminal', description: 'Green phosphor on black, monospace everywhere.', background: '#020603', backgroundEffect: 'scanlines', accent: '#39ff14', tileBackground: 'rgba(57,255,20,0.03)', tileRadius: 2, fg: '#bfffb0', surface: '#0a140a', dark: true, cool: '#39ff14', warm: '#ffd60a', tileBorderStyle: 'solid', tileBorderWidth: 1, tileBorderColor: '#39ff14', tileBorderOpacity: 45, tileBlur: 0, tileShadow: 'none', fontFamily: 'share-tech-mono', fontMono: 'share-tech-mono', fontDisplay: 'share-tech-mono', titleStyle: 'normal', titleColor: 'accent', iconTint: 'accent', iconStroke: 1.5 },
  { ...base, id: 'brutalist', group: 'bold', name: 'Brutalist', description: 'Hard black borders, offset shadows, zero radius.', background: '#f2efe6', accent: '#ff3b00', tileBackground: '#fffdf7', tileRadius: 0, fg: '#111111', surface: '#ffffff', dark: false, cool: '#0057ff', warm: '#ff3b00', tileBorderStyle: 'solid', tileBorderWidth: 3, tileBorderColor: '#111111', tileBlur: 0, tileShadow: 'hard', fontFamily: 'space-grotesk', fontDisplay: 'bebas', titleStyle: 'bold', titleColor: 'fg', iconStroke: 2.5 },
  { ...base, id: 'newspaper', group: 'light', name: 'Newspaper', description: 'Ink on paper with serif headlines.', background: '#f7f3ea', backgroundEffect: 'grain', accent: '#8b1a1a', tileBackground: '#fffdf8', tileRadius: 2, fg: '#1a1a1a', surface: '#ffffff', dark: false, cool: '#1f4e79', warm: '#b3541e', tileBorderStyle: 'double', tileBorderWidth: 3, tileBorderColor: '#1a1a1a', tileBorderOpacity: 70, tileBlur: 0, tileShadow: 'none', fontFamily: 'lora', fontDisplay: 'playfair', titleStyle: 'underline', titleColor: 'fg' },
  { ...base, id: 'retro', group: 'bold', name: 'Retro', description: 'Seventies browns and oranges with a warm grain.', background: GRADIENT_PRESETS.find((g) => g.id === 'gold')!.css, backgroundEffect: 'grain', accent: '#ffb347', tileBackground: 'rgba(60,30,10,0.45)', tileRadius: 14, fg: '#fff1dc', surface: '#3a2414', dark: true, cool: '#7fc8a9', warm: '#ff7f50', tileBorderStyle: 'accent-top', tileBorderWidth: 4, fontFamily: 'righteous', fontMono: 'space-mono', titleStyle: 'normal' },
  { ...base, id: 'sunset', group: 'bold', name: 'Sunset', description: 'A bold gradient with translucent dark tiles.', background: GRADIENT_PRESETS.find((g) => g.id === 'sunset')!.css, backgroundEffect: 'rays', accent: '#ffd166', tileBackground: 'rgba(20,10,30,0.42)', tileRadius: 24, fg: '#fff7f0', surface: '#3d2151', dark: true, cool: '#9ad0ff', warm: '#ffd166', fontFamily: 'poppins' },
  { ...base, id: 'paper', group: 'light', name: 'Paper', description: 'Light, warm off-white for bright rooms.', background: GRADIENT_PRESETS.find((g) => g.id === 'paper')!.css, accent: '#f59e0b', tileBackground: 'rgba(255,255,255,0.72)', tileRadius: 20, fg: '#1f2933', surface: '#ffffff', dark: false, cool: '#2563eb', warm: '#dc6803' },
  { ...base, id: 'daylight', group: 'light', name: 'Daylight', description: 'Cool light grey with a blue accent.', background: 'radial-gradient(1200px 800px at 10% 0%, #ffffff 0%, #e9eef6 60%, #dfe6f0 100%)', accent: '#3b82f6', tileBackground: 'rgba(255,255,255,0.8)', tileRadius: 22, fg: '#111827', surface: '#ffffff', dark: false, cool: '#2563eb', warm: '#ea580c' },
  { ...base, id: 'pastel', group: 'light', name: 'Pastel', description: 'Candy mesh, rounded corners, friendly type.', background: GRADIENT_PRESETS.find((g) => g.id === 'candy')!.css, accent: '#7c5cff', tileBackground: 'rgba(255,255,255,0.62)', tileRadius: 32, fg: '#2b2340', surface: '#ffffff', dark: false, cool: '#5b8def', warm: '#ff8a65', tileBorderStyle: 'none', tileShadow: 'lifted', tileBlur: 14, fontFamily: 'nunito', fontWeight: 500, titleStyle: 'pill' },
  { ...base, id: 'mint', group: 'light', name: 'Mint', description: 'Fresh greens with a clean, minimal frame.', background: GRADIENT_PRESETS.find((g) => g.id === 'mint')!.css, accent: '#0f9d76', tileBackground: 'rgba(255,255,255,0.7)', tileRadius: 18, fg: '#123529', surface: '#ffffff', dark: false, cool: '#0f9d76', warm: '#e0873a', tileBorderStyle: 'solid', tileBorderColor: '#0f9d76', tileBorderOpacity: 25, fontFamily: 'dm-sans' },
  { ...base, id: 'mono', group: 'minimal', name: 'Monochrome', description: 'Greys only, no colour, no fuss.', background: GRADIENT_PRESETS.find((g) => g.id === 'graphite')!.css, accent: '#e5e5e5', tileBackground: 'rgba(255,255,255,0.04)', tileRadius: 8, fg: '#e5e5e5', surface: '#1f1f22', dark: true, cool: '#bdbdbd', warm: '#ffffff', tileBorderStyle: 'solid', tileBorderOpacity: 15, tileShadow: 'none', tileBlur: 0, fontFamily: 'ibm-plex', fontMono: 'ibm-plex-mono', titleStyle: 'normal' },
  { ...base, id: 'blueprint', group: 'minimal', name: 'Blueprint', description: 'Drafting-table blue with dashed frames.', background: '#0b2a4a', backgroundEffect: 'grid', accent: '#cfe6ff', tileBackground: 'rgba(207,230,255,0.04)', tileRadius: 6, fg: '#e6f1ff', surface: '#123a63', dark: true, cool: '#9ed0ff', warm: '#ffd47a', tileBorderStyle: 'dashed', tileBorderWidth: 1, tileBorderColor: '#cfe6ff', tileBorderOpacity: 50, tileBlur: 0, tileShadow: 'none', fontFamily: 'ibm-plex', fontMono: 'ibm-plex-mono', titleStyle: 'normal' },
  { ...base, id: 'zen', group: 'minimal', name: 'Zen', description: 'Borderless, shadowless, nothing but content.', background: '#0e0e10', accent: '#d4c5a9', tileBackground: 'transparent', tileRadius: 0, fg: '#e8e2d6', surface: '#1a1a1d', dark: true, cool: '#a9c4d4', warm: '#d4b08a', tileBorderStyle: 'none', tileShadow: 'none', tileBlur: 0, showTitles: false, fontFamily: 'fraunces', fontWeight: 300, letterSpacing: 0.01 },
  { ...base, id: 'lavender', group: 'light', name: 'Lavender', description: 'Soft violet with a gentle glow.', background: GRADIENT_PRESETS.find((g) => g.id === 'lavender')!.css, accent: '#6d5dfc', tileBackground: 'rgba(255,255,255,0.66)', tileRadius: 24, fg: '#241f3d', surface: '#ffffff', dark: false, cool: '#6d5dfc', warm: '#f2794b', tileBorderStyle: 'glow', tileShadow: 'none', fontFamily: 'quicksand', fontWeight: 500 },
];

export const DEFAULT_THEME: Theme = stripPreset(THEME_PRESETS[0]);

export function stripPreset(p: ThemePreset): Theme {
  const { id, name, description, group, ...theme } = p;
  void name;
  void description;
  void group;
  return { ...theme, preset: id };
}

/** Fill in tokens missing from older layouts. A theme without a preset id stays "custom". */
export function normalizeTheme(t: Partial<Theme> | undefined): Theme {
  return { ...DEFAULT_THEME, preset: undefined, ...(t ?? {}) };
}

// ---------------------------------------------------------------------------
// Apply

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A colour with an opacity applied; falls back to color-mix for non-hex input. */
export function withAlpha(color: string, pct: number): string {
  const rgb = hexToRgb(color);
  if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(100, pct)) / 100})`;
  return `color-mix(in srgb, ${color} ${Math.max(0, Math.min(100, pct))}%, transparent)`;
}

/** The CSS `border` value for a theme's tile border style. */
export function tileBorderCss(t: Theme): string {
  const w = Math.max(0, t.tileBorderWidth ?? 1);
  const color = t.tileBorderColor?.trim() ? withAlpha(t.tileBorderColor, t.tileBorderOpacity ?? 100) : `color-mix(in srgb, var(--fg) ${Math.round(8 * ((t.tileBorderOpacity ?? 100) / 100))}%, transparent)`;
  const accent = withAlpha(t.accent, t.tileBorderOpacity ?? 100);
  switch (t.tileBorderStyle ?? 'hairline') {
    case 'none':
    case 'accent-top':
    case 'accent-left':
    case 'gradient':
      return '0 solid transparent';
    case 'hairline':
      return `1px solid ${t.tileBorderColor?.trim() ? color : 'color-mix(in srgb, var(--fg) 8%, transparent)'}`;
    case 'solid':
      return `${w}px solid ${color}`;
    case 'dashed':
      return `${w}px dashed ${color}`;
    case 'double':
      return `${Math.max(3, w)}px double ${color}`;
    case 'inset':
      return `1px solid color-mix(in srgb, var(--fg) 14%, transparent)`;
    case 'glow':
      return `1px solid ${withAlpha(t.accent, 35)}`;
    case 'neon':
      return `${w}px solid ${accent}`;
    case 'custom':
      return t.tileBorderCss?.trim() || '1px solid transparent';
  }
}

function tileShadowCss(t: Theme): string {
  const style = t.tileBorderStyle ?? 'hairline';
  const glow = style === 'neon' ? `0 0 18px ${withAlpha(t.accent, 55)}, inset 0 0 12px ${withAlpha(t.accent, 18)}` : style === 'glow' ? `0 0 34px -6px ${withAlpha(t.accent, 45)}` : '';
  const inset = style === 'inset' ? `inset 0 1px 0 color-mix(in srgb, var(--fg) 18%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--fg) 4%, transparent)` : '';
  let shadow = '';
  switch (t.tileShadow ?? 'soft') {
    case 'none':
      shadow = '';
      break;
    case 'soft':
      shadow = '0 10px 30px -18px rgba(0,0,0,0.5)';
      break;
    case 'lifted':
      shadow = '0 18px 50px -20px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.25)';
      break;
    case 'hard':
      shadow = `6px 6px 0 0 ${t.tileBorderColor?.trim() || (t.dark ? '#000000' : '#111111')}`;
      break;
    case 'glow':
      shadow = `0 0 40px -8px ${withAlpha(t.accent, 40)}`;
      break;
  }
  return [glow, inset, shadow].filter(Boolean).join(', ') || 'none';
}

function todayToken(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The wallpaper URL with `{date}` expanded, or undefined. */
export function wallpaperUrl(t: Theme): string | undefined {
  const raw = t.backgroundImage?.trim();
  if (!raw) return undefined;
  return raw.replace(/\{date\}/g, todayToken());
}

/** Apply a theme to the document (CSS variables + colour scheme + fonts). */
export function applyTheme(t: Theme) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set('--accent', t.accent);
  set('--tile-bg', t.tileBackground);
  set('--tile-radius', `${t.tileRadius}px`);
  set('--fg', t.fg);
  set('--surface', t.surface);
  // Tailwind's `white` utilities resolve to this variable, so every text-white/… and bg-white/… follows the theme.
  set('--color-white', t.fg);
  set('--cool', t.cool);
  set('--warm', t.warm);
  root.style.colorScheme = t.dark ? 'dark' : 'light';

  // Tiles
  set('--tile-border', tileBorderCss(t));
  set('--tile-shadow', tileShadowCss(t));
  set('--tile-blur', `${Math.max(0, t.tileBlur ?? 10)}px`);
  set('--tile-pad', `${Math.max(0, t.tilePadding ?? 16)}px`);
  set('--tile-accent-bar', `${Math.max(1, t.tileBorderWidth ?? 3)}px`);
  set('--tile-border-color', t.tileBorderColor?.trim() ? withAlpha(t.tileBorderColor, t.tileBorderOpacity ?? 100) : withAlpha(t.accent, t.tileBorderOpacity ?? 100));
  root.dataset.tileBorder = t.tileBorderStyle ?? 'hairline';

  // Text
  const sans = resolveFont(t.fontFamily, 'inter');
  const mono = resolveFont(t.fontMono, 'jetbrains-mono');
  const display = t.fontDisplay?.trim() ? resolveFont(t.fontDisplay, 'inter') : sans;
  ensureGoogleFont(sans.google);
  ensureGoogleFont(mono.google);
  ensureGoogleFont(display.google);
  set('--font-sans', sans.family);
  set('--font-mono', mono.family);
  set('--font-display', display.family);
  const scale = Math.min(1.5, Math.max(0.7, t.fontScale ?? 1));
  root.style.fontSize = scale === 1 ? '' : `${16 * scale}px`;
  set('--font-weight', String(t.fontWeight ?? 400));
  set('--letter-spacing', `${t.letterSpacing ?? 0}em`);
  root.dataset.titleStyle = t.titleStyle ?? 'caps';
  root.dataset.titleAlign = t.titleAlign ?? 'left';
  root.dataset.titleColor = t.titleColor ?? 'muted';

  // Icons
  set('--icon-stroke', String(Math.min(3, Math.max(1, t.iconStroke ?? 2))));
  const iconScale = Math.min(1.4, Math.max(0.8, t.iconScale ?? 1));
  set('--icon-scale', String(iconScale));
  root.dataset.iconScaled = iconScale === 1 ? '0' : '1';
  root.dataset.iconTint = t.iconTint ?? 'auto';
  root.dataset.iconFill = t.iconFill ? '1' : '0';

  // Background: base colour/gradient on the body; the wallpaper and effect are drawn by <BackgroundLayer/>.
  document.body.style.background = t.background;
  document.body.style.color = t.fg;
  root.dataset.effect = t.backgroundEffect ?? 'none';
  root.dataset.dark = t.dark ? '1' : '0';
}

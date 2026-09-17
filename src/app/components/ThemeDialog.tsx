import { useEffect, useMemo, useRef, useState } from 'react';
import { Bus, CalendarDays, Check, CloudRain, ImagePlus, Lightbulb, Loader2, Sun, Thermometer, Trash2, Upload } from 'lucide-react';
import type { ConfigField, DashboardContext, DashboardLayout } from '@sdk';
import { useStore } from '../lib/store';
import { hostApi } from '../lib/api';
import { Modal } from './Modal';
import { SchemaForm } from './SchemaForm';
import { LocationPicker } from './LocationPicker';
import { ConfirmButton } from './ConfirmButton';
import { BORDER_STYLES, EFFECTS, FONT_PRESETS, GRADIENT_PRESETS, SHADOWS, THEME_PRESETS, TITLE_STYLES, applyTheme, ensureGoogleFont, normalizeTheme, resolveFont, stripPreset, tileBorderCss, withAlpha, type Theme, type ThemePreset } from '../lib/themes';

type Tab = 'presets' | 'colors' | 'background' | 'tiles' | 'text' | 'icons' | 'grid' | 'dashboard';
const TABS: { id: Tab; name: string }[] = [
  { id: 'presets', name: 'Presets' },
  { id: 'colors', name: 'Colours' },
  { id: 'background', name: 'Background' },
  { id: 'tiles', name: 'Tiles & borders' },
  { id: 'text', name: 'Text' },
  { id: 'icons', name: 'Icons' },
  { id: 'grid', name: 'Grid' },
  { id: 'dashboard', name: 'Dashboard' },
];

const COLOR_FIELDS: ConfigField[] = [
  { key: 'accent', label: 'Accent color', type: 'color' },
  { key: 'fg', label: 'Text color', type: 'color' },
  { key: 'cool', label: 'Cool tone', type: 'color', help: 'Used for cold temperatures, water, "off" states.' },
  { key: 'warm', label: 'Warm tone', type: 'color', help: 'Used for heat, sun, "on" states.' },
  { key: 'tileBackground', label: 'Tile background', type: 'string', help: 'Any CSS colour or gradient, e.g. rgba(255,255,255,0.05) or linear-gradient(...). "transparent" for no tile frame.' },
  { key: 'surface', label: 'Dialog & toolbar background', type: 'color' },
  { key: 'dark', label: 'Dark theme (affects form controls and scrims)', type: 'boolean' },
];

const BACKGROUND_FIELDS: ConfigField[] = [
  { key: 'background', label: 'Base colour or gradient', type: 'textarea', rows: 2, help: 'Any CSS background. The gradient gallery and builder above write into this.' },
  { key: 'backgroundFit', label: 'Wallpaper fit', type: 'select', options: [{ value: 'cover', label: 'Fill the screen' }, { value: 'contain', label: 'Fit inside' }, { value: 'tile', label: 'Tile / repeat' }], default: 'cover' },
  { key: 'backgroundOverlay', label: 'Wallpaper scrim', type: 'number', min: 0, max: 95, step: 5, unit: '%', default: 0, help: 'Darkens (or lightens, on light themes) the wallpaper so tiles stay readable.' },
  { key: 'backgroundBlur', label: 'Wallpaper blur', type: 'number', min: 0, max: 40, unit: 'px', default: 0 },
];

const TILE_FIELDS: ConfigField[] = [
  { key: 'tileRadius', label: 'Corner radius', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'tileBorderWidth', label: 'Border width', type: 'number', min: 0, max: 8, unit: 'px', default: 1, showWhen: { key: 'tileBorderStyle', oneOf: ['solid', 'dashed', 'double', 'neon', 'accent-top', 'accent-left', 'gradient'] } },
  { key: 'tileBorderColor', label: 'Border colour', type: 'color', help: 'Leave empty to derive it from the text colour (or the accent for bars and neon).', showWhen: { key: 'tileBorderStyle', oneOf: ['hairline', 'solid', 'dashed', 'double', 'neon', 'accent-top', 'accent-left'] } },
  { key: 'tileBorderOpacity', label: 'Border opacity', type: 'number', min: 0, max: 100, step: 5, unit: '%', default: 100, showWhen: { key: 'tileBorderStyle', oneOf: ['hairline', 'solid', 'dashed', 'double', 'neon', 'accent-top', 'accent-left'] } },
  { key: 'tileBorderCss', label: 'Custom border CSS', type: 'string', placeholder: '2px dashed var(--accent)', help: 'The CSS `border` shorthand. Theme tokens work: var(--accent), var(--cool), var(--warm), var(--fg).', showWhen: { key: 'tileBorderStyle', equals: 'custom' } },
  { key: 'tileBlur', label: 'Frosted glass blur', type: 'number', min: 0, max: 40, unit: 'px', default: 10, help: 'Blur behind translucent tiles. 0 is the cheapest on a Raspberry Pi.' },
  { key: 'tilePadding', label: 'Inner padding', type: 'number', min: 0, max: 40, unit: 'px', default: 16, help: 'Plugins that honour --tile-pad use this.' },
  { key: 'showTitles', label: 'Show tile titles', type: 'boolean' },
];

const TEXT_FIELDS: ConfigField[] = [
  { key: 'fontScale', label: 'Text size', type: 'number', min: 0.7, max: 1.5, step: 0.05, default: 1, help: '1 = normal. Scales every tile\'s text and spacing.' },
  { key: 'fontWeight', label: 'Body weight', type: 'select', options: [{ value: '300', label: 'Light' }, { value: '400', label: 'Regular' }, { value: '500', label: 'Medium' }, { value: '600', label: 'Semi-bold' }], default: '400' },
  { key: 'letterSpacing', label: 'Letter spacing', type: 'number', min: -0.05, max: 0.2, step: 0.01, unit: 'em', default: 0 },
  { key: 'titleStyle', label: 'Tile title style', type: 'select', options: TITLE_STYLES.map((t) => ({ value: t.id, label: t.name })), default: 'caps' },
  { key: 'titleAlign', label: 'Tile title alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }], default: 'left' },
  { key: 'titleColor', label: 'Tile title colour', type: 'select', options: [{ value: 'muted', label: 'Muted' }, { value: 'accent', label: 'Accent' }, { value: 'fg', label: 'Text colour' }], default: 'muted' },
];

const ICON_FIELDS: ConfigField[] = [
  { key: 'iconStroke', label: 'Line weight', type: 'number', min: 1, max: 3, step: 0.25, default: 2, help: 'Thinner lines look elegant, thicker ones read better from across the room.' },
  { key: 'iconScale', label: 'Icon size', type: 'number', min: 0.8, max: 1.4, step: 0.05, default: 1 },
  { key: 'iconTint', label: 'Tint', type: 'select', options: [{ value: 'auto', label: 'As each plugin colours them' }, { value: 'accent', label: 'Accent' }, { value: 'fg', label: 'Text colour' }, { value: 'cool', label: 'Cool tone' }, { value: 'warm', label: 'Warm tone' }], default: 'auto' },
  { key: 'iconFill', label: 'Duotone fill', type: 'boolean', default: false, help: 'Fills icons with a translucent wash of their own colour.' },
];

const GRID_FIELDS: ConfigField[] = [
  { key: 'cols', label: 'Columns', type: 'number', min: 4, max: 48 },
  { key: 'rows', label: 'Rows', type: 'number', min: 2, max: 32, help: 'The grid always fills the screen; more rows = finer control.' },
  { key: 'gap', label: 'Gap between tiles', type: 'number', min: 0, max: 60, unit: 'px' },
  { key: 'padding', label: 'Screen padding', type: 'number', min: 0, max: 120, unit: 'px' },
];

export const LOCALE_FIELDS: ConfigField[] = [
  {
    key: 'locale',
    label: 'Language',
    type: 'select',
    options: [
      { value: '', label: 'Browser default' },
      { value: 'en', label: 'English' },
      { value: 'de', label: 'Deutsch' },
      { value: 'nl', label: 'Nederlands' },
      { value: 'fr', label: 'Français' },
      { value: 'es', label: 'Español' },
    ],
    help: 'Dates, numbers and plugin text. Plugins that ship translations follow it.',
  },
];

// Keys that don't detach a preset when edited (they're layout preferences, not looks).
const NEUTRAL_KEYS = new Set(['showTitles']);
const numericKeys = new Set(['fontWeight']);

export function ThemeDialog({ onClose }: { onClose: () => void }) {
  const { layout, updateLayout, apiFor } = useStore();
  const original = useMemo(() => normalizeTheme(layout?.theme), [layout?.theme]);
  const [theme, setTheme] = useState<Record<string, unknown>>({ ...original });
  const [grid, setGrid] = useState<Record<string, unknown>>({ ...(layout?.grid ?? {}) });
  const [loc, setLoc] = useState<Record<string, unknown>>({ locale: layout?.locale ?? '' });
  const [ctx, setCtx] = useState<DashboardContext>({ ...(layout?.context ?? {}) });
  const [tab, setTab] = useState<Tab>('presets');
  const api = apiFor('$host');

  const asTheme = (v: Record<string, unknown>): Theme => {
    const t = { ...v } as Record<string, unknown>;
    for (const k of numericKeys) if (typeof t[k] === 'string') t[k] = Number(t[k]);
    return normalizeTheme(t as Partial<Theme>);
  };

  // Live preview while the dialog is open; revert on cancel.
  useEffect(() => {
    applyTheme(asTheme(theme));
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = () => {
    applyTheme(original);
    onClose();
  };
  const pick = (p: ThemePreset) => setTheme({ ...stripPreset(p), showTitles: theme.showTitles ?? p.showTitles });
  const change = (next: Record<string, unknown>) => {
    const onlyNeutral = Object.keys(next).every((k) => NEUTRAL_KEYS.has(k) || next[k] === theme[k]);
    setTheme(onlyNeutral ? next : { ...next, preset: undefined });
  };
  const patch = (p: Record<string, unknown>) => change({ ...theme, ...p });
  const save = () => {
    updateLayout((l) => ({
      ...l,
      theme: { ...l.theme, ...asTheme(theme) },
      grid: { ...l.grid, ...(grid as unknown as DashboardLayout['grid']) },
      locale: (loc.locale as string) || undefined,
      context: { ...ctx, name: ctx.name?.trim() || undefined },
    }));
    onClose();
  };
  const t = asTheme(theme);

  return (
    <Modal
      title="Appearance"
      subtitle="Pick a preset, then bend anything: colours, wallpapers, borders, fonts and icons. Changes preview live."
      onClose={cancel}
      width={860}
      footer={
        <>
          {theme.preset ? <span className="mr-auto text-xs text-white/40">Preset: {THEME_PRESETS.find((p) => p.id === theme.preset)?.name}</span> : <span className="mr-auto text-xs text-white/40">Custom theme</span>}
          <button className="btn btn-default" onClick={cancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="-mx-1 mb-4 flex flex-wrap gap-1 border-b border-white/10 px-1 pb-3">
        {TABS.map((x) => (
          <button key={x.id} type="button" onClick={() => setTab(x.id)} className={`rounded-lg px-3 py-1.5 text-sm transition ${tab === x.id ? 'bg-[var(--accent)]/20 text-[var(--accent)] font-medium' : 'text-white/60 hover:bg-white/8 hover:text-white'}`}>
            {x.name}
          </button>
        ))}
      </div>

      {tab === 'presets' && (
        <div className="space-y-5">
          {(['dark', 'light', 'bold', 'minimal'] as const).map((g) => (
            <section key={g}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">{{ dark: 'Dark', light: 'Light', bold: 'Bold', minimal: 'Minimal' }[g]}</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {THEME_PRESETS.filter((p) => p.group === g).map((p) => (
                  <PresetCard key={p.id} preset={p} active={theme.preset === p.id} onPick={() => pick(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'colors' && (
        <div className="space-y-4">
          <Swatches theme={t} onPick={patch} />
          <SchemaForm fields={COLOR_FIELDS} value={theme} onChange={change} api={api} />
        </div>
      )}

      {tab === 'background' && (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Gradients</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-7">
              {GRADIENT_PRESETS.map((g) => (
                <button key={g.id} type="button" title={g.name} onClick={() => patch({ background: g.css })} className={`aspect-[4/3] rounded-lg border transition ${theme.background === g.css ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : 'border-white/10 hover:border-white/40'}`} style={{ background: g.css }}>
                  <span className="sr-only">{g.name}</span>
                </button>
              ))}
            </div>
          </section>
          <GradientBuilder onApply={(css) => patch({ background: css })} accent={t.accent} cool={t.cool} warm={t.warm} />
          <Wallpapers value={String(theme.backgroundImage ?? '')} onChange={(backgroundImage) => patch({ backgroundImage })} />
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Effect layer</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {EFFECTS.map((e) => (
                <button key={e.id} type="button" onClick={() => patch({ backgroundEffect: e.id })} className={`rounded-lg border px-3 py-2 text-left transition ${(theme.backgroundEffect ?? 'none') === e.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/10 hover:border-white/30'}`}>
                  <div className="flex items-center justify-between text-sm font-medium">
                    {e.name}
                    {e.cost !== 'free' && <span className={`rounded px-1 text-[9px] uppercase ${e.cost === 'medium' ? 'bg-[var(--warm)]/20 text-[var(--warm)]' : 'bg-white/10 text-white/50'}`}>{e.cost === 'medium' ? 'heavy' : 'light'}</span>}
                  </div>
                  <div className="text-[11px] leading-snug text-white/50">{e.hint}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-white/40">"Heavy" effects animate large blurred shapes; on a Raspberry Pi 3 they can cost a few frames per second. Everything else is free.</p>
          </section>
          <SchemaForm fields={BACKGROUND_FIELDS} value={theme} onChange={change} api={api} />
        </div>
      )}

      {tab === 'tiles' && (
        <div className="space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Border style</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {BORDER_STYLES.map((b) => (
                <BorderCard key={b.id} id={b.id} name={b.name} hint={b.hint} theme={t} active={(theme.tileBorderStyle ?? 'hairline') === b.id} onPick={() => patch({ tileBorderStyle: b.id })} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Shadow</h3>
            <div className="flex flex-wrap gap-2">
              {SHADOWS.map((s) => (
                <button key={s.id} type="button" onClick={() => patch({ tileShadow: s.id })} className={`rounded-lg border px-3 py-1.5 text-sm transition ${(theme.tileShadow ?? 'soft') === s.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/10 hover:border-white/30'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </section>
          <SchemaForm fields={TILE_FIELDS} value={theme} onChange={change} api={api} />
        </div>
      )}

      {tab === 'text' && (
        <div className="space-y-6">
          <FontPicker label="Main font" value={String(theme.fontFamily ?? 'inter')} onChange={(fontFamily) => patch({ fontFamily })} categories={['sans', 'rounded', 'serif', 'display', 'system']} sample="The quick brown fox 12:45" />
          <FontPicker label="Display font (clock, big numbers)" value={String(theme.fontDisplay ?? '')} onChange={(fontDisplay) => patch({ fontDisplay })} categories={['display', 'serif', 'sans', 'rounded', 'mono']} sample="09:41 · 21°" allowInherit />
          <FontPicker label="Monospace font" value={String(theme.fontMono ?? 'jetbrains-mono')} onChange={(fontMono) => patch({ fontMono })} categories={['mono', 'system']} sample="sensor.living_room 23.5" />
          <SchemaForm fields={TEXT_FIELDS} value={{ ...theme, fontWeight: String(theme.fontWeight ?? 400) }} onChange={change} api={api} />
        </div>
      )}

      {tab === 'icons' && (
        <div className="space-y-4">
          <IconPreview />
          <SchemaForm fields={ICON_FIELDS} value={theme} onChange={change} api={api} />
        </div>
      )}

      {tab === 'grid' && <SchemaForm fields={GRID_FIELDS} value={grid} onChange={setGrid} api={api} />}

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-xs text-white/45">Shared with every tile: plugins use these unless a tile sets its own (weather, Rahu Kaala, greetings…).</p>
            <div className="space-y-4">
              <div>
                <label className="label">Location</label>
                <LocationPicker value={ctx.location} onChange={(location) => setCtx({ ...ctx, location })} />
              </div>
              <div>
                <label className="label">Your name</label>
                <input className="input" placeholder="e.g. Deshan" value={ctx.name ?? ''} onChange={(e) => setCtx({ ...ctx, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Units</label>
                <select className="input" value={ctx.units ?? 'metric'} onChange={(e) => setCtx({ ...ctx, units: e.target.value as DashboardContext['units'] })}>
                  <option value="metric">Metric (°C, km/h)</option>
                  <option value="imperial">Imperial (°F, mph)</option>
                </select>
              </div>
            </div>
          </section>
          <section>
            <SchemaForm fields={LOCALE_FIELDS} value={loc} onChange={setLoc} api={api} />
          </section>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function PresetCard({ preset, active, onPick }: { preset: ThemePreset; active: boolean; onPick: () => void }) {
  const font = resolveFont(preset.fontFamily, 'inter').family;
  const border = tileBorderCss(preset);
  const radius = Math.min(10, preset.tileRadius / 2);
  return (
    <button type="button" onClick={onPick} className={`group relative overflow-hidden rounded-xl border text-left transition ${active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : 'border-white/10 hover:border-white/30'}`} style={{ background: preset.background, color: preset.fg, fontFamily: font }}>
      <div className="flex gap-1.5 p-3 pb-2">
        <div className="h-9 flex-1" style={{ background: preset.tileBackground, border, borderRadius: radius, borderWidth: Math.min(2, preset.tileBorderWidth ?? 1) }}>
          <div className="m-2 h-1.5 w-1/2 rounded-full" style={{ background: preset.accent }} />
        </div>
        <div className="h-9 w-9" style={{ background: preset.tileBackground, border, borderRadius: radius, borderWidth: Math.min(2, preset.tileBorderWidth ?? 1) }} />
      </div>
      <div className="px-3 pb-2.5">
        <div className="text-sm font-semibold leading-tight">{preset.name}</div>
        <div className="text-[11px] leading-snug opacity-60">{preset.description}</div>
      </div>
      {active && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: preset.accent, color: '#0b0f17' }}>
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

const PALETTES: { name: string; accent: string; cool: string; warm: string }[] = [
  { name: 'Blue', accent: '#7c9cff', cool: '#7cc4ff', warm: '#ff9f68' },
  { name: 'Teal', accent: '#4ecdc4', cool: '#4ecdc4', warm: '#ffb677' },
  { name: 'Green', accent: '#7bd88f', cool: '#8be0c8', warm: '#e9c46a' },
  { name: 'Amber', accent: '#ffb347', cool: '#7fc8a9', warm: '#ff7f50' },
  { name: 'Coral', accent: '#ff6b6b', cool: '#74b9ff', warm: '#ff6b6b' },
  { name: 'Pink', accent: '#ff7ab6', cool: '#a8c5ff', warm: '#ff7ab6' },
  { name: 'Violet', accent: '#bd93f9', cool: '#8be9fd', warm: '#ffb86c' },
  { name: 'Lime', accent: '#c5f135', cool: '#6ee7f7', warm: '#ffb020' },
  { name: 'Ice', accent: '#cfe6ff', cool: '#9ed0ff', warm: '#ffd47a' },
  { name: 'Gold', accent: '#d4af37', cool: '#9cc9ff', warm: '#d4af37' },
];

function Swatches({ theme, onPick }: { theme: Theme; onPick: (p: Record<string, unknown>) => void }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">Accent palettes</h3>
      <div className="flex flex-wrap gap-2">
        {PALETTES.map((p) => (
          <button key={p.name} type="button" title={p.name} onClick={() => onPick({ accent: p.accent, cool: p.cool, warm: p.warm })} className={`flex items-center gap-1 rounded-full border p-1 pr-3 text-xs transition ${theme.accent === p.accent ? 'border-[var(--accent)]' : 'border-white/10 hover:border-white/30'}`}>
            <span className="h-5 w-5 rounded-full" style={{ background: p.accent }} />
            <span className="h-3 w-3 rounded-full" style={{ background: p.cool }} />
            <span className="h-3 w-3 rounded-full" style={{ background: p.warm }} />
            <span className="ml-1 text-white/70">{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GradientBuilder({ onApply, accent, cool, warm }: { onApply: (css: string) => void; accent: string; cool: string; warm: string }) {
  const [kind, setKind] = useState<'linear' | 'radial' | 'conic' | 'mesh'>('linear');
  const [angle, setAngle] = useState(160);
  const [colors, setColors] = useState<string[]>(['#16213a', '#0b0f17']);
  const css = useMemo(() => {
    const stops = colors.map((c, i) => `${c} ${Math.round((i / Math.max(1, colors.length - 1)) * 100)}%`).join(', ');
    switch (kind) {
      case 'linear':
        return `linear-gradient(${angle}deg, ${stops})`;
      case 'radial':
        return `radial-gradient(1200px 900px at ${50 + Math.round(Math.cos((angle * Math.PI) / 180) * 40)}% ${50 + Math.round(Math.sin((angle * Math.PI) / 180) * 40)}%, ${stops})`;
      case 'conic':
        return `conic-gradient(from ${angle}deg at 50% 50%, ${colors.concat(colors[0]).join(', ')})`;
      case 'mesh': {
        const spots = [
          [20, 20],
          [80, 0],
          [0, 80],
          [80, 90],
        ];
        const layers = colors.slice(0, 4).map((c, i) => `radial-gradient(at ${spots[i][0]}% ${spots[i][1]}%, ${c} 0px, transparent 55%)`);
        return `${layers.join(', ')}, ${colors[colors.length - 1]}`;
      }
    }
  }, [kind, angle, colors]);
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">Gradient builder</h3>
        <div className="flex gap-1 text-xs">
          <button type="button" className="btn btn-ghost px-2 py-1" onClick={() => setColors(['#0b0f17', accent])}>
            Use accent
          </button>
          <button type="button" className="btn btn-ghost px-2 py-1" onClick={() => setColors([cool, '#0b0f17', warm])}>
            Cool → warm
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-16 w-28 shrink-0 rounded-lg border border-white/10" style={{ background: css }} />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
              <option value="conic">Conic</option>
              <option value="mesh">Mesh (blobs)</option>
            </select>
            {kind !== 'mesh' && (
              <label className="flex items-center gap-2 text-xs text-white/60">
                Angle
                <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
                <span className="w-9 tabular">{angle}°</span>
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <input type="color" value={c} onChange={(e) => setColors(colors.map((x, j) => (j === i ? e.target.value : x)))} className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent" />
                {colors.length > 2 && (
                  <button type="button" className="btn btn-ghost p-1" onClick={() => setColors(colors.filter((_, j) => j !== i))} aria-label="Remove colour">
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            ))}
            {colors.length < 4 && (
              <button type="button" className="btn btn-default px-2 py-1 text-xs" onClick={() => setColors([...colors, accent])}>
                + colour
              </button>
            )}
            <button type="button" className="btn btn-primary ml-auto px-3 py-1 text-xs" onClick={() => onApply(css)}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type Wallpaper = { file: string; url: string; bytes: number };
const PHOTO_SOURCES: { name: string; url: string; hint: string }[] = [
  { name: 'Photo of the day', url: 'https://picsum.photos/seed/{date}/1920/1080', hint: 'A new random photo every day (picsum.photos).' },
  { name: 'Random each load', url: 'https://picsum.photos/1920/1080', hint: 'Changes whenever the page loads.' },
  { name: 'NASA APOD-style space', url: 'https://picsum.photos/seed/space-{date}/1920/1080?grayscale&blur=1', hint: 'Muted greyscale photo, changes daily.' },
];

function Wallpapers({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [list, setList] = useState<Wallpaper[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => hostApi.listWallpapers().then(setList).catch(() => setList([]));
  useEffect(() => {
    refresh();
  }, []);
  const upload = async (f: File) => {
    setBusy(true);
    setErr(null);
    try {
      const w = await hostApi.uploadWallpaper(f);
      onChange(w.url);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (w: Wallpaper) => {
    await hostApi.deleteWallpaper(w.file);
    if (value === w.url) onChange('');
    refresh();
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">Wallpaper</h3>
        <div className="flex items-center gap-2">
          {value && (
            <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => onChange('')}>
              Remove wallpaper
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" className="btn btn-default px-3 py-1 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload image
          </button>
        </div>
      </div>
      {err && <p className="mb-2 text-xs text-red-300">{err}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {list.map((w) => (
          <div key={w.file} className={`group relative aspect-[4/3] overflow-hidden rounded-lg border ${value === w.url ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40' : 'border-white/10'}`}>
            <button type="button" className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${w.url}")` }} onClick={() => onChange(w.url)} title={w.file} />
            <ConfirmButton className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white/80 opacity-0 transition group-hover:opacity-100" armedClassName="absolute right-1 top-1 rounded bg-red-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-white" confirmLabel="Delete?" onConfirm={() => remove(w)} title="Delete">
              <Trash2 size={12} />
            </ConfirmButton>
          </div>
        ))}
        {PHOTO_SOURCES.map((s) => (
          <button key={s.name} type="button" title={s.hint} onClick={() => onChange(s.url)} className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center text-[11px] leading-tight transition ${value === s.url ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-dashed border-white/15 text-white/60 hover:border-white/40'}`}>
            <ImagePlus size={16} />
            {s.name}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <label className="label">Or a URL</label>
        <input className="input" placeholder="https://… (use {date} for a daily-changing image)" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </section>
  );
}

function FontPicker({ label, value, onChange, categories, sample, allowInherit }: { label: string; value: string; onChange: (v: string) => void; categories: string[]; sample: string; allowInherit?: boolean }) {
  const presets = FONT_PRESETS.filter((f) => categories.includes(f.category)).sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  const isPreset = presets.some((p) => p.id === value);
  const [custom, setCustom] = useState(!isPreset && value !== '' ? value : '');
  const previewFor = (id: string) => resolveFont(id, 'inter').family;
  // Preload the visible fonts for the previews.
  useEffect(() => {
    presets.forEach((p) => ensureGoogleFont(p.google));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">{label}</h3>
      <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-white/10 p-1.5 sm:grid-cols-3">
        {allowInherit && (
          <button type="button" onClick={() => onChange('')} className={`rounded-md border px-2.5 py-2 text-left transition ${value === '' ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-transparent hover:bg-white/5'}`}>
            <div className="text-xs text-white/50">Same as main font</div>
            <div className="truncate text-sm">{sample}</div>
          </button>
        )}
        {presets.map((p) => (
          <button key={p.id} type="button" onClick={() => onChange(p.id)} className={`rounded-md border px-2.5 py-2 text-left transition ${value === p.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-transparent hover:bg-white/5'}`}>
            <div className="text-xs text-white/50">
              {p.name} <span className="opacity-60">· {p.category}</span>
            </div>
            <div className="truncate text-base leading-tight" style={{ fontFamily: previewFor(p.id) }}>
              {sample}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className="input" placeholder="Any Google Font name, e.g. Caveat" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => custom.trim() && onChange(custom.trim())} onKeyDown={(e) => e.key === 'Enter' && custom.trim() && onChange(custom.trim())} />
        {!isPreset && value && <span className="shrink-0 text-xs text-white/50">using “{value}”</span>}
      </div>
    </section>
  );
}


function IconPreview() {
  return (
    <div className="tile flex items-center justify-around rounded-xl p-4" style={{ background: 'var(--tile-bg)' }}>
      <Sun />
      <CloudRain />
      <Thermometer />
      <Lightbulb />
      <CalendarDays />
      <Bus />
    </div>
  );
}

function BorderCard({ id, name, hint, theme, active, onPick }: { id: string; name: string; hint: string; theme: Theme; active: boolean; onPick: () => void }) {
  const preview = tileBorderCss({ ...theme, tileBorderStyle: id as Theme['tileBorderStyle'], tileBorderCss: theme.tileBorderCss || '2px dashed var(--accent)' });
  const accentBar = theme.tileBorderColor?.trim() ? withAlpha(theme.tileBorderColor, theme.tileBorderOpacity ?? 100) : theme.accent;
  const extra: React.CSSProperties =
    id === 'accent-top' ? { borderTop: `3px solid ${accentBar}` } : id === 'accent-left' ? { borderLeft: `3px solid ${accentBar}` } : id === 'gradient' ? { border: '2px solid transparent', backgroundImage: `linear-gradient(var(--surface), var(--surface)), linear-gradient(135deg, ${theme.accent}, ${theme.cool}, ${theme.warm})`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' } : id === 'neon' ? { boxShadow: `0 0 12px ${withAlpha(theme.accent, 55)}` } : id === 'glow' ? { boxShadow: `0 0 18px -4px ${withAlpha(theme.accent, 55)}` } : {};
  return (
    <button type="button" onClick={onPick} className={`rounded-lg border p-2 text-left transition ${active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/10 hover:border-white/30'}`}>
      <div className="mb-1.5 h-10 rounded-md" style={{ border: preview, background: 'var(--tile-bg)', borderRadius: Math.min(10, theme.tileRadius / 2), ...extra }} />
      <div className="text-sm font-medium">{name}</div>
      <div className="text-[11px] leading-snug text-white/50">{hint}</div>
    </button>
  );
}

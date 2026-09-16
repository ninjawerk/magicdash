import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import type { ConfigField, SelectOption } from '@sdk';
import { SECRET_MASK } from '@sdk';
import { loadOptions, type CustomFieldProps, type PluginApi } from '@sdk/client';

export function SchemaForm({
  fields,
  value,
  onChange,
  api,
  customFields,
}: {
  fields: ConfigField[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  api: PluginApi;
  customFields?: Record<string, ComponentType<CustomFieldProps>>;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  const visible = fields.filter((f) => {
    if (!f.showWhen) return true;
    const v = value[f.showWhen.key];
    if (f.showWhen.oneOf) return f.showWhen.oneOf.includes(v);
    return v === f.showWhen.equals;
  });
  if (visible.length === 0) return <p className="text-sm text-white/40">Nothing to configure.</p>;
  return (
    <div className="space-y-5">
      {visible.map((f) => (
        <Field key={f.key} field={f} value={value[f.key]} set={(v) => set(f.key, v)} config={value} api={api} customFields={customFields} />
      ))}
    </div>
  );
}

function Field({
  field: f,
  value,
  set,
  config,
  api,
  customFields,
}: {
  field: ConfigField;
  value: unknown;
  set: (v: unknown) => void;
  config: Record<string, unknown>;
  api: PluginApi;
  customFields?: Record<string, ComponentType<CustomFieldProps>>;
}) {
  const help = f.help && <p className="text-xs text-white/40 mt-1.5">{f.help}</p>;
  switch (f.type) {
    case 'string': {
      const isSecret = !!f.secret;
      const masked = isSecret && value === SECRET_MASK;
      return (
        <div>
          <label className="label">{f.label}</label>
          <input
            className="input"
            type={isSecret ? 'password' : 'text'}
            placeholder={masked ? '•••••••• (saved — type to replace)' : f.placeholder}
            value={masked ? '' : ((value as string) ?? '')}
            onChange={(e) => set(e.target.value)}
            onFocus={(e) => masked && (e.target.placeholder = 'Type a new value or leave empty to keep')}
            onBlur={(e) => {
              if (isSecret && e.target.value === '' && masked) set(SECRET_MASK);
            }}
          />
          {help}
        </div>
      );
    }
    case 'textarea':
      return (
        <div>
          <label className="label">{f.label}</label>
          <textarea className="input font-mono text-xs" rows={f.rows ?? 4} placeholder={f.placeholder} value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />
          {help}
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="label">{f.label}</label>
          <div className="flex items-center gap-2">
            <input
              className="input"
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              value={value === undefined || value === null ? '' : (value as number)}
              onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
            />
            {f.unit && <span className="text-sm text-white/50 whitespace-nowrap">{f.unit}</span>}
          </div>
          {help}
        </div>
      );
    case 'boolean':
      return (
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => set(!value)}
            className={`mt-0.5 relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-[var(--accent)]' : 'bg-white/15'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
          <span>
            <span className="text-sm font-medium">{f.label}</span>
            {help}
          </span>
        </label>
      );
    case 'date':
    case 'datetime':
    case 'time': {
      const inputType = f.type === 'datetime' ? 'datetime-local' : f.type;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const nowValue =
        f.type === 'date'
          ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
          : f.type === 'time'
            ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
            : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      return (
        <div>
          <label className="label">{f.label}</label>
          <div className="flex items-center gap-2">
            <input
              className="input"
              type={inputType}
              value={(value as string) ?? ''}
              min={'min' in f ? f.min : undefined}
              max={'max' in f ? f.max : undefined}
              onChange={(e) => set(e.target.value || undefined)}
            />
            <button type="button" className="btn btn-default whitespace-nowrap" onClick={() => set(nowValue)}>
              Now
            </button>
            {value ? (
              <button type="button" className="btn btn-ghost px-2" onClick={() => set(undefined)} title="Clear">
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
          {help}
        </div>
      );
    }
    case 'color':
      return (
        <div>
          <label className="label">{f.label}</label>
          <div className="flex items-center gap-2">
            <input type="color" className="h-9 w-12 rounded-md bg-transparent border border-white/10" value={(value as string) ?? '#ffffff'} onChange={(e) => set(e.target.value)} />
            <input className="input font-mono" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)} />
          </div>
          {help}
        </div>
      );
    case 'select':
    case 'multiselect':
      return (
        <div>
          <label className="label">{f.label}</label>
          <SelectField field={f} value={value} set={set} api={api} />
          {help}
        </div>
      );
    case 'list': {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <label className="label">{f.label}</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  placeholder={f.placeholder}
                  value={it}
                  onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button type="button" className="btn btn-ghost px-2" onClick={() => set(items.filter((_, j) => j !== i))} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-default" onClick={() => set([...items, ''])}>
              <Plus size={14} /> Add {f.itemLabel ?? 'item'}
            </button>
          </div>
          {help}
        </div>
      );
    }
    case 'custom': {
      const Editor = customFields?.[f.key];
      return (
        <div>
          <label className="label">{f.label}</label>
          {Editor ? <Editor value={value} onChange={set} config={config} api={api} /> : <p className="text-xs text-red-300">No editor registered for "{f.key}".</p>}
          {help}
        </div>
      );
    }
    case 'action':
      return <ActionField field={f} api={api} />;
  }
}

function useOptions(f: Extract<ConfigField, { type: 'select' | 'multiselect' }>, api: PluginApi) {
  const [options, setOptions] = useState<SelectOption[]>(f.options ?? []);
  const [loading, setLoading] = useState(!!f.optionsFrom);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!f.optionsFrom) return;
    let cancelled = false;
    setLoading(true);
    loadOptions(api, f.optionsFrom)
      .then((o) => !cancelled && setOptions(o))
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [f.optionsFrom, api]);
  return { options, loading, error };
}

function SelectField({
  field: f,
  value,
  set,
  api,
}: {
  field: Extract<ConfigField, { type: 'select' | 'multiselect' }>;
  value: unknown;
  set: (v: unknown) => void;
  api: PluginApi;
}) {
  const { options, loading, error } = useOptions(f, api);
  const [filter, setFilter] = useState('');
  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
      : options;
    const groups = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const g = o.group ?? '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(o);
    }
    return [...groups.entries()];
  }, [options, filter]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Loader2 className="animate-spin" size={14} /> Loading options…
      </div>
    );
  }
  if (error) return <p className="text-xs text-red-300">Couldn't load options: {error}. Check the plugin settings.</p>;

  if (f.type === 'select') {
    return (
      <select className="input" value={(value as string) ?? ''} onChange={(e) => set(e.target.value)}>
        <option value="">— choose —</option>
        {grouped.map(([g, opts]) =>
          g ? (
            <optgroup key={g} label={g}>
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
    );
  }

  const selectedList = Array.isArray(value) ? (value as string[]) : [];
  const selected = new Set(selectedList);
  const toggle = (v: string) => {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    set([...next]);
  };
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      {selectedList.length > 0 && (
        <div className="border-b border-white/10 p-2">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/40">Selected · {selectedList.length}</span>
            <button type="button" className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/80" onClick={() => set([])}>
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedList.map((v) => (
              <span
                key={v}
                title={v}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 pl-2.5 pr-1 py-0.5 text-xs"
              >
                <span className="truncate">{labelOf(v)}</span>
                <button type="button" className="rounded-full p-0.5 hover:bg-white/15" onClick={() => toggle(v)} aria-label={`Remove ${labelOf(v)}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {options.length > 8 && (
        <input className="input rounded-none border-0 border-b border-white/10" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <div className="max-h-64 overflow-y-auto p-1">
        {grouped.length === 0 && <p className="p-3 text-sm text-white/40">No options.</p>}
        {grouped.map(([g, opts]) => (
          <div key={g}>
            {g && <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/40">{g}</div>}
            {opts.map((o) => (
              <label key={o.value} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer">
                <input type="checkbox" className="accent-[var(--accent)]" checked={selected.has(o.value)} onChange={() => toggle(o.value)} />
                <span className="min-w-0">
                  <span className="block text-sm truncate">{o.label}</span>
                  {o.description && <span className="block text-xs text-white/40 truncate">{o.description}</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionField({ field: f, api }: { field: Extract<ConfigField, { type: 'action' }>; api: PluginApi }) {
  const [state, setState] = useState<{ busy?: boolean; msg?: string; err?: string }>({});
  const run = async () => {
    setState({ busy: true });
    try {
      const res = await api.post<{ message?: string; redirect?: string }>(f.action);
      if (res?.redirect) {
        window.location.href = res.redirect;
        return;
      }
      setState({ msg: res?.message ?? 'Done' });
    } catch (e) {
      setState({ err: (e as Error).message });
    }
  };
  return (
    <div>
      <label className="label">{f.label}</label>
      <button type="button" className={`btn btn-${f.variant ?? 'default'}`} disabled={state.busy} onClick={run}>
        {state.busy && <Loader2 className="animate-spin" size={14} />}
        {f.buttonLabel}
      </button>
      {state.msg && <p className="text-xs text-emerald-300 mt-1.5">{state.msg}</p>}
      {state.err && <p className="text-xs text-red-300 mt-1.5">{state.err}</p>}
      {f.help && <p className="text-xs text-white/40 mt-1.5">{f.help}</p>}
    </div>
  );
}

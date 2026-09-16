import { useEffect, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import type { GeoLocation } from '@sdk';

/** City search backed by GET /api/geocode. Used for the dashboard location and reusable by plugins' custom fields. */
export function LocationPicker({ value, onChange, placeholder }: { value?: GeoLocation; onChange: (v: GeoLocation | undefined) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((r: GeoLocation[]) => setResults(Array.isArray(r) ? r : []))
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm">
          <MapPin size={14} className="text-[var(--accent)]" />
          <span className="flex-1 truncate">
            {value.name}
            {value.admin ? `, ${value.admin}` : ''}
            {value.country ? `, ${value.country}` : ''}
          </span>
          <span className="font-mono text-xs text-white/40">
            {value.lat.toFixed(2)}, {value.lon.toFixed(2)}
          </span>
          <button type="button" className="btn btn-ghost p-1" onClick={() => onChange(undefined)} title="Clear">
            <X size={12} />
          </button>
        </div>
      )}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input className="input pl-9" placeholder={placeholder ?? 'Search city… or “51.5, -0.12”'} value={q} onChange={(e) => setQ(e.target.value)} />
        {busy && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40" />}
      </div>
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-white/10"
              onClick={() => {
                onChange(r);
                setQ('');
                setResults([]);
              }}
            >
              <MapPin size={14} className="shrink-0 text-white/40" />
              <span className="flex-1 truncate">
                {r.name}
                {r.admin ? `, ${r.admin}` : ''}
                {r.country ? `, ${r.country}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

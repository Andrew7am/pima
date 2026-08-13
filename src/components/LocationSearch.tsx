import { useEffect, useRef, useState } from 'react';

/**
 * Address search for the location picker.
 *
 * An owner registering a house is usually not standing in it — «استخدم موقعي
 * الحالي» drops the pin on their sitting room, which is worse than no pin at
 * all because it looks answered. Search is how they place it from anywhere.
 *
 * Nominatim, because the maps are already OpenStreetMap tiles and it needs no
 * key. Its usage policy caps this at one request a second, which is why the
 * debounce below is 700ms and not 200 — and why an in-flight request is
 * abandoned rather than raced.
 */

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

interface Props {
  onPick: (p: Place) => void;
  /** Shown under the field once a place has been chosen. */
  chosen?: string;
}

export default function LocationSearch({ onPick, chosen }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) { setResults([]); setFailed(false); return; }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setBusy(true); setFailed(false);
      try {
        // countrycodes=eg — every house on Pima is in Egypt, and without it
        // «المعادي» returns places on three continents.
        const url = `${ENDPOINT}?format=jsonv2&limit=6&countrycodes=eg&accept-language=ar&q=${encodeURIComponent(term)}`;
        const r = await fetch(url, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const rows = (await r.json()) as { display_name: string; lat: string; lon: string }[];
        setResults(rows.map((x) => ({ label: x.display_name, lat: +x.lat, lng: +x.lon })));
        setOpen(true);
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // The map and the pin still work. Say so rather than implying the
        // whole step is broken.
        setFailed(true); setResults([]);
      } finally {
        setBusy(false);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold text-[#6A6A55] mb-1.5" htmlFor="loc-search">
        ابحث عن الموقع
      </label>
      <div className="relative">
        <input
          id="loc-search"
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          placeholder="مثال: شارع النصر، المعادي، القاهرة"
          autoComplete="off"
          className="w-full bg-white border border-[#D6D6C2] text-sm px-3 py-3 pr-10 rounded-xl focus:outline-none focus:border-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/20"
        />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 right-3 text-[#8A8A70]">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {busy && <p className="text-[11px] text-[#8A8A70] mt-1.5">بيدوّر…</p>}

      {failed && (
        <p className="text-[11px] text-[#8A6D28] mt-1.5">
          البحث مش شغّال دلوقتي — حدّد المكان على الخريطة تحت.
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-[1000] inset-x-0 mt-1 bg-white border border-[#D6D6C2] rounded-xl overflow-hidden shadow-lg max-h-56 overflow-y-auto">
          {results.map((p, i) => (
            <li key={`${p.lat},${p.lng},${i}`}>
              <button
                type="button"
                onClick={() => { onPick(p); setQ(''); setResults([]); setOpen(false); }}
                className="w-full text-right px-3 py-2.5 min-h-11 text-[12px] text-[#2D2D24] hover:bg-[#F7F4EB] border-b border-[#EFEADD] last:border-0 cursor-pointer"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !busy && !failed && q.trim().length >= 3 && results.length === 0 && (
        <p className="text-[11px] text-[#8A8A70] mt-1.5">
          مفيش نتيجة — جرّب اسم أوسع، أو حدّد المكان على الخريطة تحت.
        </p>
      )}

      {chosen && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#F7F4EB] border border-[#E7E2D5] px-3 py-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            className="shrink-0 mt-0.5 text-[#C5A059]">
            <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-[#8A8A70]">الموقع المحدد</div>
            <div className="text-[11.5px] text-[#2D2D24] leading-snug">{chosen}</div>
          </div>
        </div>
      )}
    </div>
  );
}

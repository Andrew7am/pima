import React, { useRef, useState } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Image as ImageIcon,
  Layers, SlidersHorizontal, Smartphone, Tablet, RotateCcw, Move,
} from 'lucide-react';
import { PromoBanner, BannerLayout, BannerElement, BannerFit } from '../../types';
import BannerCanvas, { BANNER_BOX, DEFAULT_LAYOUT, elementLabel } from './BannerCanvas';

// Visual banner designer: the admin drags elements directly on a live preview
// of the app's real banner box. The box height is fixed per placement (it
// mirrors what the mobile app ships) — only the CONTENT inside it is designed,
// so no existing banner can be resized or distorted by editing.

const FITS: { value: BannerFit; label: string }[] = [
  { value: 'cover', label: 'تغطية (Cover)' },
  { value: 'contain', label: 'احتواء (Contain)' },
  { value: 'fill', label: 'تمديد (Fill)' },
  { value: 'center', label: 'قص من المنتصف' },
  { value: 'top', label: 'قص من أعلى' },
  { value: 'bottom', label: 'قص من أسفل' },
  { value: 'left', label: 'قص من اليسار' },
  { value: 'right', label: 'قص من اليمين' },
];

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Preview widths — the box HEIGHT never changes, only the viewport width, which
// is exactly how the app behaves across devices.
const DEVICES = [
  { key: 'small', label: 'موبايل صغير', width: 320, Icon: Smartphone },
  { key: 'current', label: 'موبايل', width: 375, Icon: Smartphone },
  { key: 'large', label: 'موبايل كبير', width: 430, Icon: Smartphone },
  { key: 'tablet', label: 'تابلت', width: 640, Icon: Tablet },
] as const;

const SNAP_TOLERANCE = 2.5; // %
const SAFE = 5;             // % safe margin

interface Props {
  banner: PromoBanner;
  layout: BannerLayout | null | undefined;
  onChange: (layout: BannerLayout) => void;
}

export default function BannerEditor({ banner, layout, onChange }: Props) {
  const current = layout ?? DEFAULT_LAYOUT(banner.placement);
  const [selectedId, setSelectedId] = useState<string | null>('title');
  const [device, setDevice] = useState<(typeof DEVICES)[number]['key']>('current');
  const [tab, setTab] = useState<'layers' | 'props' | 'image'>('props');
  const [showGrid, setShowGrid] = useState(true);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const box = BANNER_BOX[banner.placement];
  const deviceWidth = DEVICES.find((d) => d.key === device)!.width;
  const selected = current.elements.find((e) => e.id === selectedId) ?? null;

  const patch = (next: Partial<BannerLayout>) => onChange({ ...current, ...next });
  const patchImage = (next: Partial<BannerLayout['image']>) => patch({ image: { ...current.image, ...next } });
  const patchEl = (id: string, next: Partial<BannerElement>) =>
    patch({ elements: current.elements.map((e) => (e.id === id ? { ...e, ...next } : e)) });

  const move = (id: string, dir: -1 | 1) => {
    const i = current.elements.findIndex((e) => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.elements.length) return;
    const next = current.elements.slice();
    [next[i], next[j]] = [next[j], next[i]];
    patch({ elements: next });
  };

  // ── Drag an element on the canvas ────────────────────────────────────────
  const startDrag = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null;
    if (!el || !canvasRef.current) return;
    const id = el.dataset.el!;
    const item = current.elements.find((x) => x.id === id);
    if (!item || item.locked) return;
    setSelectedId(id);
    setDragging(true);

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = item.x;
    const originY = item.y;

    const onMove = (ev: PointerEvent) => {
      // RTL: x is measured from the RIGHT edge, so dragging right lowers x.
      const dx = ((startX - ev.clientX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      let nx = Math.max(0, Math.min(95, originX + dx));
      let ny = Math.max(0, Math.min(95, originY + dy));

      // Snap to the safe margins and the centre lines, and show the guide.
      const targetsX = [SAFE, 50 - (item.width ?? 0) / 2, 100 - SAFE - (item.width ?? 0)];
      const targetsY = [SAFE, 50, 100 - SAFE];
      let vHit = false;
      let hHit = false;
      for (const t of targetsX) if (Math.abs(nx - t) < SNAP_TOLERANCE) { nx = t; vHit = true; }
      for (const t of targetsY) if (Math.abs(ny - t) < SNAP_TOLERANCE) { ny = t; hHit = true; }
      setGuides({ v: vHit, h: hHit });

      patchEl(id, { x: +nx.toFixed(2), y: +ny.toFixed(2) });
    };
    const onUp = () => {
      setDragging(false);
      setGuides({ v: false, h: false });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const Num = ({ label, value, min, max, step = 1, onInput, suffix }: {
    label: string; value: number; min: number; max: number; step?: number; onInput: (v: number) => void; suffix?: string;
  }) => (
    <label className="block">
      <span className="text-[9px] font-bold text-[#8A8A70] flex items-center justify-between">
        {label}<span className="font-black text-[#4A4A3A]">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onInput(Number(e.target.value))}
        className="w-full accent-[#5A5A40] cursor-pointer" />
    </label>
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {DEVICES.map((d) => {
            const Icon = d.Icon;
            return (
              <button key={d.key} type="button" onClick={() => setDevice(d.key)} title={d.label}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9.5px] font-bold border transition-all cursor-pointer ${
                  device === d.key ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2] hover:bg-[#FAF8F5]'
                }`}>
                <Icon className="w-3 h-3" />{d.width}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-[#8A8A70]">{box.label} · العرض × {box.height}px ثابت</span>
          <button type="button" onClick={() => setShowGrid((v) => !v)}
            className={`px-2 py-1.5 rounded-lg text-[9.5px] font-bold border cursor-pointer ${showGrid ? 'bg-[#EBEBE0] text-[#4A4A3A] border-[#D6D6C2]' : 'bg-white text-[#8A8A70] border-[#D6D6C2]'}`}>
            الشبكة
          </button>
          <button type="button" onClick={() => onChange(DEFAULT_LAYOUT(banner.placement))} title="إعادة الضبط"
            className="p-1.5 rounded-lg border border-[#D6D6C2] text-[#8A8A70] hover:bg-[#FAF8F5] cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas — real box height, device-width viewport */}
      <div className="bg-[#F1EEE6] rounded-2xl p-4 flex justify-center overflow-x-auto">
        <div style={{ width: deviceWidth }} className="shrink-0">
          <div
            ref={canvasRef}
            onPointerDown={startDrag}
            className="relative rounded-3xl overflow-hidden shadow-md bg-slate-900"
            style={{ height: box.height }}
          >
            <BannerCanvas banner={banner} layout={current} selectedId={selectedId} onSelect={setSelectedId} interactive />

            {/* Safe area + grid + snapping guides */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute border border-dashed border-white/35" style={{ inset: `${SAFE}%` }} />
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/15" />
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
              </div>
            )}
            {guides.v && <div className="absolute top-0 bottom-0 right-1/2 w-0.5 bg-[#C5A059] pointer-events-none" />}
            {guides.h && <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#C5A059] pointer-events-none" />}
            {dragging && (
              <div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-black px-2 py-0.5 rounded-full pointer-events-none">
                {selected ? `${elementLabel(selected.type)} · ${selected.x}% / ${selected.y}%` : ''}
              </div>
            )}
          </div>
          <p className="text-[9px] text-[#8A8A70] font-bold text-center mt-1.5 flex items-center justify-center gap-1">
            <Move className="w-3 h-3" /> اسحب أي عنصر داخل المعاينة لتغيير مكانه
          </p>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1.5">
        {([['props', 'خصائص العنصر', SlidersHorizontal], ['layers', 'الطبقات', Layers], ['image', 'الصورة', ImageIcon]] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
              tab === key ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2] hover:bg-[#FAF8F5]'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── Layers ── */}
      {tab === 'layers' && (
        <div className="bg-white rounded-2xl border border-[#D6D6C2] divide-y divide-[#D6D6C2]/60 overflow-hidden">
          {current.elements.slice().reverse().map((el) => {
            const idx = current.elements.findIndex((x) => x.id === el.id);
            return (
              <div key={el.id} className={`flex items-center gap-2 px-3 py-2 ${selectedId === el.id ? 'bg-[#FAF8F5]' : ''}`}>
                <button type="button" onClick={() => patchEl(el.id, { visible: !el.visible })} title={el.visible ? 'إخفاء' : 'إظهار'}
                  className="p-1 rounded text-[#5A5A40] hover:bg-[#EBEBE0] cursor-pointer">
                  {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#B8B8A0]" />}
                </button>
                <button type="button" onClick={() => patchEl(el.id, { locked: !el.locked })} title={el.locked ? 'فك القفل' : 'قفل'}
                  className="p-1 rounded text-[#5A5A40] hover:bg-[#EBEBE0] cursor-pointer">
                  {el.locked ? <Lock className="w-3.5 h-3.5 text-rose-600" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => { setSelectedId(el.id); setTab('props'); }}
                  className="flex-1 text-right text-[11px] font-bold text-[#4A4A3A] cursor-pointer truncate">
                  {elementLabel(el.type)}
                </button>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" disabled={idx === current.elements.length - 1} onClick={() => move(el.id, 1)} title="للأمام"
                    className="p-0.5 rounded border border-[#E7E5DB] text-[#5A5A40] hover:bg-[#FAF8F5] disabled:opacity-30 cursor-pointer">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button type="button" disabled={idx === 0} onClick={() => move(el.id, -1)} title="للخلف"
                    className="p-0.5 rounded border border-[#E7E5DB] text-[#5A5A40] hover:bg-[#FAF8F5] disabled:opacity-30 cursor-pointer">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Selected element ── */}
      {tab === 'props' && (
        <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-2.5">
          {!selected ? (
            <p className="text-[10px] text-[#8A8A70] font-bold text-center py-3">اختر عنصراً من المعاينة أو من الطبقات لتحريره</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[#0A2342]">{elementLabel(selected.type)}</span>
                <span className="text-[9px] font-bold text-[#8A8A70]">{selected.locked ? 'مقفول 🔒' : ''}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Num label="الموضع الأفقي" value={selected.x} min={0} max={95} onInput={(v) => patchEl(selected.id, { x: v })} suffix="%" />
                <Num label="الموضع الرأسي" value={selected.y} min={0} max={95} onInput={(v) => patchEl(selected.id, { y: v })} suffix="%" />
                {selected.width != null && (
                  <Num label="العرض" value={selected.width} min={10} max={94} onInput={(v) => patchEl(selected.id, { width: v })} suffix="%" />
                )}
                {selected.fontSize != null && (
                  <Num label="حجم الخط" value={selected.fontSize} min={7} max={40} onInput={(v) => patchEl(selected.id, { fontSize: v })} suffix="px" />
                )}
                <Num label="الشفافية" value={Math.round((selected.opacity ?? 1) * 100)} min={10} max={100} onInput={(v) => patchEl(selected.id, { opacity: v / 100 })} suffix="%" />
                <Num label="الدوران" value={selected.rotation ?? 0} min={-45} max={45} onInput={(v) => patchEl(selected.id, { rotation: v })} suffix="°" />
                {selected.radius != null && (
                  <Num label="استدارة الحواف" value={selected.radius} min={0} max={30} onInput={(v) => patchEl(selected.id, { radius: v })} suffix="px" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[#E7E5DB]">
                {selected.color != null && (
                  <label className="flex items-center gap-1 text-[9.5px] font-bold text-[#8A8A70]">
                    اللون
                    <input type="color" value={selected.color} onChange={(e) => patchEl(selected.id, { color: e.target.value })}
                      className="w-7 h-6 rounded border border-[#D6D6C2] cursor-pointer" />
                  </label>
                )}
                {selected.bg != null && (
                  <label className="flex items-center gap-1 text-[9.5px] font-bold text-[#8A8A70]">
                    الخلفية
                    <input type="color" value={selected.bg} onChange={(e) => patchEl(selected.id, { bg: e.target.value })}
                      className="w-7 h-6 rounded border border-[#D6D6C2] cursor-pointer" />
                  </label>
                )}
                <div className="flex items-center gap-1">
                  {(['start', 'center', 'end'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => patchEl(selected.id, { align: a })}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer ${
                        (selected.align ?? 'start') === a ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'
                      }`}>
                      {a === 'start' ? 'يمين' : a === 'center' ? 'وسط' : 'يسار'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Image ── */}
      {tab === 'image' && (
        <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-2.5">
          <p className="text-[9px] text-[#8A8A70] font-bold leading-relaxed">
            الصورة بتتقصّ داخل إطار البانر بمقاسه الثابت — مش بتتمدّ ولا بتتشوّه مهما كان مقاسها الأصلي.
          </p>
          <label className="block">
            <span className="text-[9px] font-bold text-[#8A8A70] block mb-1">طريقة الاحتواء</span>
            <select value={current.image.fit} onChange={(e) => patchImage({ fit: e.target.value as BannerFit })}
              className="w-full bg-[#FAF8F5] border border-[#E7E5DB] rounded-xl text-[11px] px-3 py-2 text-right cursor-pointer">
              {FITS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <div>
            <span className="text-[9px] font-bold text-[#8A8A70] block mb-1">التكبير</span>
            <div className="flex gap-1 flex-wrap">
              {ZOOMS.map((z) => (
                <button key={z} type="button" onClick={() => patchImage({ scale: z })}
                  className={`px-2 py-1 rounded-lg text-[9.5px] font-bold border cursor-pointer ${
                    current.image.scale === z ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2]'
                  }`}>{z * 100}%</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Num label="إزاحة أفقية" value={current.image.x} min={-50} max={50} onInput={(v) => patchImage({ x: v })} suffix="%" />
            <Num label="إزاحة رأسية" value={current.image.y} min={-50} max={50} onInput={(v) => patchImage({ y: v })} suffix="%" />
            <Num label="وضوح الصورة" value={Math.round(current.image.opacity * 100)} min={10} max={100} onInput={(v) => patchImage({ opacity: v / 100 })} suffix="%" />
            <Num label="التعتيم فوق الصورة" value={Math.round(current.overlay.opacity * 100)} min={0} max={90}
              onInput={(v) => patch({ overlay: { ...current.overlay, enabled: v > 0, opacity: v / 100 } })} suffix="%" />
          </div>
        </div>
      )}
    </div>
  );
}

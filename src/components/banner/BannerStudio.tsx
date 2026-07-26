import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowRight, Undo2, Redo2, Play, Check, Image as ImageIcon, Type, Palette,
  AlignCenter, Layers, Copy, Trash2, ChevronUp, ChevronDown, Lock, Unlock, Eye, EyeOff,
  Pencil, X, AlertTriangle, Smartphone, Tablet, RotateCcw, Move, Sparkles,
} from 'lucide-react';
import { PromoBanner, BannerLayout, BannerElement, BannerFit } from '../../types';
import BannerCanvas, { BANNER_BOX, DEFAULT_LAYOUT, elementLabel } from './BannerCanvas';
import { BANNER_TEMPLATES } from './bannerTemplates';
import PhotoPickerButtons from '../PhotoPickerButtons';
import { extractPalette, Palette as ImagePalette } from '../../lib/imagePalette';
import { suggestHeadlines } from '../../lib/headlineSuggestions';

// Pima Banner Studio — a mobile-first, direct-manipulation editor.
//
// The banner IS the interface: you tap an element to select it, drag it to move
// it, drag its handle to resize it, and every control lives in a bottom sheet
// that is one thumb-reach away. There are no coordinate fields and no long
// forms. The canvas is rendered at a real device width and scaled to fit, so
// what is on screen is exactly what the app ships — and the box height stays
// locked to the shipped banner size, which can never be edited.

const SAFE = 5;             // % safe margin
const SNAP = 2.5;           // % snapping tolerance
const DEVICES = [
  { key: 'android', label: 'Android', width: 412, Icon: Smartphone },
  { key: 'iphone', label: 'iPhone', width: 390, Icon: Smartphone },
  { key: 'tablet', label: 'Tablet', width: 768, Icon: Tablet },
] as const;

const SWATCHES = ['#FFFFFF', '#0A2342', '#5A5A40', '#C5A059', '#E5E7EB', '#111111', '#D94A4A', '#2E7D5B'];
// Backgrounds sit under the photo, so a banner works even with no image at all.
const BACKGROUNDS = [
  'linear-gradient(135deg,#0A2342,#123E75)',
  'linear-gradient(135deg,#5A5A40,#8A8A70)',
  'linear-gradient(135deg,#7A5C1E,#C5A059)',
  'linear-gradient(135deg,#111111,#5A5A40)',
  'linear-gradient(135deg,#1B5E9E,#2E7D5B)',
  '#0A2342', '#5A5A40', '#111111',
];
const FONTS = [
  { label: 'القاهرة', value: 'Cairo, sans-serif' },
  { label: 'النظام', value: 'system-ui, sans-serif' },
  { label: 'كلاسيكي', value: 'Georgia, serif' },
];
const FITS: { value: BannerFit; label: string }[] = [
  { value: 'cover', label: 'تغطية' }, { value: 'contain', label: 'احتواء' },
  { value: 'fill', label: 'تمديد' }, { value: 'top', label: 'أعلى' },
  { value: 'bottom', label: 'أسفل' }, { value: 'left', label: 'يسار' }, { value: 'right', label: 'يمين' },
];

type Sheet = 'image' | 'text' | 'style' | 'align' | 'layers' | 'templates' | null;
interface Snapshot { layout: BannerLayout; banner: PromoBanner }

interface Props {
  banner: PromoBanner;
  onSave: (banner: PromoBanner) => void;
  onClose: () => void;
}

export default function BannerStudio({ banner: initial, onSave, onClose }: Props) {
  const [banner, setBanner] = useState<PromoBanner>(initial);
  const [layout, setLayout] = useState<BannerLayout>(initial.layout ?? DEFAULT_LAYOUT(initial.placement));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]['key']>('android');
  const [previewing, setPreviewing] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [guides, setGuides] = useState({ v: false, h: false });
  const [box, setBox] = useState<{ w: number; h: number; scale: number }>({ w: 343, h: 176, scale: 1 });
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [palette, setPalette] = useState<ImagePalette | null>(null);

  // Colours suggested from the artwork itself, refreshed whenever it changes.
  useEffect(() => {
    let cancelled = false;
    if (!banner.imageUrl) { setPalette(null); return; }
    extractPalette(banner.imageUrl).then((p) => { if (!cancelled) setPalette(p); });
    return () => { cancelled = true; };
  }, [banner.imageUrl]);

  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [, forceRender] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const selected = layout.elements.find((e) => e.id === selectedId) ?? null;
  const deviceWidth = DEVICES.find((d) => d.key === device)!.width;
  const boxHeight = BANNER_BOX[banner.placement].height;

  // ── History ──────────────────────────────────────────────────────────────
  const commit = useCallback(() => {
    past.current.push({ layout, banner });
    if (past.current.length > 40) past.current.shift();
    future.current = [];
    forceRender((n) => n + 1);
  }, [layout, banner]);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ layout, banner });
    setLayout(prev.layout); setBanner(prev.banner);
    forceRender((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ layout, banner });
    setLayout(next.layout); setBanner(next.banner);
    forceRender((n) => n + 1);
  };

  const patchEl = (id: string, next: Partial<BannerElement>) =>
    setLayout((l) => ({ ...l, elements: l.elements.map((e) => (e.id === id ? { ...e, ...next } : e)) }));

  // ── Fit the real device-width banner into the available stage ────────────
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const w = deviceWidth - 32;                 // the app's page padding
      const avail = stage.clientWidth - 24;
      setBox({ w, h: boxHeight, scale: Math.min(1, avail / w) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [deviceWidth, boxHeight]);

  // Track the selected element's on-screen rect so the handles and the floating
  // toolbar follow it exactly, without duplicating any layout maths.
  useLayoutEffect(() => {
    if (!selectedId || !canvasRef.current) { setRect(null); return; }
    const node = canvasRef.current.querySelector(`[data-el="${selectedId}"]`) as HTMLElement | null;
    const host = canvasRef.current.getBoundingClientRect();
    if (!node) { setRect(null); return; }
    const r = node.getBoundingClientRect();
    setRect({ top: r.top - host.top, left: r.left - host.left, width: r.width, height: r.height });
  }, [selectedId, layout, banner, box]);

  // ── Drag to move ─────────────────────────────────────────────────────────
  const startDrag = (e: React.PointerEvent) => {
    const target = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null;
    // Dragging the artwork itself repositions the image inside the frame —
    // the focus point — instead of doing nothing. The frame never moves.
    if (!target && canvasRef.current) {
      setSelectedId(null);
      commit();
      const host = canvasRef.current.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      const ox = layout.image.x, oy = layout.image.y;
      const move = (ev: PointerEvent) => {
        const dx = ((ev.clientX - sx) / host.width) * 100;
        const dy = ((ev.clientY - sy) / host.height) * 100;
        setLayout((l) => ({
          ...l,
          image: {
            ...l.image,
            x: +Math.max(-50, Math.min(50, ox + dx)).toFixed(1),
            y: +Math.max(-50, Math.min(50, oy + dy)).toFixed(1),
          },
        }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    if (!target || !canvasRef.current) { setSelectedId(null); return; }
    const id = target.dataset.el!;
    const item = layout.elements.find((x) => x.id === id);
    if (!item) return;
    setSelectedId(id);
    if (item.locked) return;

    commit();
    const host = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, ox = item.x, oy = item.y;

    const move = (ev: PointerEvent) => {
      const dx = ((sx - ev.clientX) / host.width) * 100;   // RTL: x grows leftwards
      const dy = ((ev.clientY - sy) / host.height) * 100;
      let nx = Math.max(0, Math.min(95, ox + dx));
      let ny = Math.max(0, Math.min(95, oy + dy));
      let v = false, h = false;
      for (const t of [SAFE, 100 - SAFE - (item.width ?? 0), 50 - (item.width ?? 0) / 2]) {
        if (Math.abs(nx - t) < SNAP) { nx = t; v = true; }
      }
      for (const t of [SAFE, 50, 100 - SAFE]) if (Math.abs(ny - t) < SNAP) { ny = t; h = true; }
      setGuides({ v, h });
      patchEl(id, { x: +nx.toFixed(2), y: +ny.toFixed(2) });
    };
    const up = () => {
      setGuides({ v: false, h: false });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── Drag the handle to resize (no numeric input, per the brief) ──────────
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selected || !canvasRef.current) return;
    commit();
    const host = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX;
    const startFont = selected.fontSize ?? 16;
    const startWidth = selected.width;

    const move = (ev: PointerEvent) => {
      const dx = ((sx - ev.clientX) / host.width) * 100; // drag left = bigger
      if (startWidth != null) {
        patchEl(selected.id, { width: Math.max(10, Math.min(94, +(startWidth + dx).toFixed(1))) });
      }
      if (selected.fontSize != null) {
        patchEl(selected.id, { fontSize: Math.max(7, Math.min(48, Math.round(startFont + dx * 0.6))) });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Out-of-safe-area warning.
  const unsafe = layout.elements.filter((e) => e.visible && (e.x < SAFE - 0.5 || e.y < SAFE - 0.5 || e.y > 100 - SAFE));

  const textField = (el: BannerElement): keyof PromoBanner | null =>
    el.type === 'title' ? 'title' : el.type === 'subtitle' ? 'subtitle'
      : el.type === 'badge' ? 'badge' : el.type === 'button' ? 'ctaText' : null;

  const Chip = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={`px-3 py-2 rounded-2xl text-[11px] font-black border transition-all active:scale-95 cursor-pointer shrink-0 ${
        active ? 'bg-[#0A2342] text-white border-[#0A2342] shadow-sm' : 'bg-white text-[#5A5A40] border-[#E2DFD4]'
      }`}>{children}</button>
  );

  const Round = ({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) => (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      className={`w-9 h-9 rounded-full bg-white/95 backdrop-blur shadow-lg flex items-center justify-center active:scale-90 transition-transform cursor-pointer ${
        danger ? 'text-rose-600' : 'text-[#2E2E24]'
      }`}>{children}</button>
  );

  // ── Fullscreen preview ───────────────────────────────────────────────────
  if (previewing) {
    const w = DEVICES.find((d) => d.key === device)!.width;
    return (
      <div dir="rtl" className="fixed inset-0 z-[60] bg-[#0A2342] flex flex-col animate-in fade-in duration-200">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setPreviewing(false)} className="text-white/80 text-xs font-bold flex items-center gap-1 cursor-pointer">
            <X className="w-4 h-4" /> إغلاق المعاينة
          </button>
          <div className="flex gap-1">
            {DEVICES.map((d) => (
              <button key={d.key} onClick={() => setDevice(d.key)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                  device === d.key ? 'bg-white text-[#0A2342]' : 'bg-white/10 text-white/80'
                }`}>{d.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div style={{ width: Math.min(w, window.innerWidth - 32) }}
            className="bg-[#FAF8F5] rounded-[2rem] p-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="rounded-3xl overflow-hidden shadow-md bg-slate-900" style={{ height: boxHeight }}>
              <BannerCanvas banner={banner} layout={layout} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-[#FAF8F5] flex flex-col animate-in fade-in duration-200">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 bg-white/90 backdrop-blur border-b border-[#EFEBE0]">
        <button onClick={onClose} aria-label="رجوع" className="p-2 rounded-full hover:bg-[#F3F0E8] active:scale-90 transition-transform cursor-pointer">
          <ArrowRight className="w-4.5 h-4.5 text-[#2E2E24]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[13px] font-black text-[#2E2E24] leading-tight truncate">استوديو البانر</h1>
          <p className="text-[9px] font-bold text-[#A8A48F]">
            {BANNER_BOX[banner.placement].label} · المقاس ثابت
          </p>
        </div>
        <button onClick={undo} disabled={past.current.length === 0} aria-label="تراجع"
          className="p-2 rounded-full hover:bg-[#F3F0E8] disabled:opacity-25 active:scale-90 transition-transform cursor-pointer">
          <Undo2 className="w-4 h-4 text-[#2E2E24]" />
        </button>
        <button onClick={redo} disabled={future.current.length === 0} aria-label="إعادة"
          className="p-2 rounded-full hover:bg-[#F3F0E8] disabled:opacity-25 active:scale-90 transition-transform cursor-pointer">
          <Redo2 className="w-4 h-4 text-[#2E2E24]" />
        </button>
        <button onClick={() => setPreviewing(true)} aria-label="معاينة"
          className="p-2 rounded-full hover:bg-[#F3F0E8] active:scale-90 transition-transform cursor-pointer">
          <Play className="w-4 h-4 text-[#2E2E24]" />
        </button>
        <button onClick={() => onSave({ ...banner, layout })}
          className="flex items-center gap-1.5 bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[11px] font-black px-3.5 py-2 rounded-2xl shadow-sm active:scale-95 transition-transform cursor-pointer">
          <Check className="w-3.5 h-3.5" /> حفظ
        </button>
      </div>

      {/* ── Stage ── */}
      <div ref={stageRef} className="flex-1 flex flex-col items-center justify-center px-3 overflow-hidden">
        {unsafe.length > 0 && (
          <div className="mb-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-[9.5px] font-black px-3 py-1.5 rounded-full animate-in fade-in">
            <AlertTriangle className="w-3 h-3" /> {elementLabel(unsafe[0].type)} خارج المساحة الآمنة
          </div>
        )}

        <div style={{ width: box.w * box.scale, height: box.h * box.scale }} className="relative">
          <div
            style={{ width: box.w, height: box.h, transform: `scale(${box.scale})`, transformOrigin: 'top right' }}
            className="absolute top-0 right-0"
          >
            <div ref={canvasRef} onPointerDown={startDrag}
              className="relative w-full h-full rounded-[1.75rem] overflow-hidden bg-slate-900 shadow-[0_18px_40px_-12px_rgba(10,35,66,0.45)] touch-none">
              <BannerCanvas banner={banner} layout={layout} selectedId={selectedId} onSelect={setSelectedId} interactive />

              {/* safe area + snap guides */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute border border-dashed border-white/25 rounded-xl" style={{ inset: `${SAFE}%` }} />
                {guides.v && <div className="absolute top-0 bottom-0 right-1/2 w-0.5 bg-[#C5A059]" />}
                {guides.h && <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#C5A059]" />}
              </div>

              {/* selection frame + resize handle */}
              {rect && selected && (
                <>
                  <div className="absolute border-2 border-[#C5A059] rounded-md pointer-events-none"
                    style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />
                  {!selected.locked && (
                    <div onPointerDown={startResize}
                      className="absolute w-6 h-6 -mr-3 -mb-3 rounded-full bg-white border-2 border-[#C5A059] shadow cursor-nwse-resize touch-none"
                      style={{ top: rect.top + rect.height, left: rect.left - 12 }} />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Floating toolbar for the selected element ── */}
          {rect && selected && (
            <div className="absolute z-10 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150"
              style={{
                top: Math.max(4, rect.top * box.scale - 48),
                right: Math.max(4, Math.min(rect.left * box.scale, box.w * box.scale - 220)),
              }}>
              {textField(selected) && (
                <Round title="تعديل النص" onClick={() => setEditingText(true)}><Pencil className="w-4 h-4" /></Round>
              )}
              <Round title="نسخ" onClick={() => {
                commit();
                const copy: BannerElement = { ...selected, id: `${selected.type}_${Date.now()}`, x: Math.min(90, selected.x + 4), y: Math.min(90, selected.y + 6) };
                setLayout((l) => ({ ...l, elements: [...l.elements, copy] }));
                setSelectedId(copy.id);
              }}><Copy className="w-4 h-4" /></Round>
              <Round title="للأمام" onClick={() => {
                commit();
                setLayout((l) => {
                  const i = l.elements.findIndex((x) => x.id === selected.id);
                  if (i >= l.elements.length - 1) return l;
                  const els = l.elements.slice();
                  [els[i], els[i + 1]] = [els[i + 1], els[i]];
                  return { ...l, elements: els };
                });
              }}><ChevronUp className="w-4 h-4" /></Round>
              <Round title="للخلف" onClick={() => {
                commit();
                setLayout((l) => {
                  const i = l.elements.findIndex((x) => x.id === selected.id);
                  if (i <= 0) return l;
                  const els = l.elements.slice();
                  [els[i], els[i - 1]] = [els[i - 1], els[i]];
                  return { ...l, elements: els };
                });
              }}><ChevronDown className="w-4 h-4" /></Round>
              <Round title={selected.locked ? 'فك القفل' : 'قفل'} onClick={() => { commit(); patchEl(selected.id, { locked: !selected.locked }); }}>
                {selected.locked ? <Lock className="w-4 h-4 text-rose-600" /> : <Unlock className="w-4 h-4" />}
              </Round>
              <Round title="إخفاء" onClick={() => { commit(); patchEl(selected.id, { visible: false }); setSelectedId(null); }}>
                <EyeOff className="w-4 h-4" />
              </Round>
              <Round danger title="حذف" onClick={() => {
                commit();
                setLayout((l) => ({ ...l, elements: l.elements.filter((x) => x.id !== selected.id) }));
                setSelectedId(null);
              }}><Trash2 className="w-4 h-4" /></Round>
            </div>
          )}
        </div>

        <p className="mt-2 text-[9px] font-bold text-[#A8A48F] flex items-center gap-1">
          <Move className="w-3 h-3" /> المس أي عنصر لتحديده · اسحبه لتحريكه · اسحب المقبض لتكبيره
        </p>
      </div>

      {/* ── Inline text editing ── */}
      {editingText && selected && textField(selected) && (
        <div className="fixed inset-0 z-[55] flex items-end" onClick={() => setEditingText(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full bg-white rounded-t-3xl p-4 space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#E2DFD4] rounded-full mx-auto" />
            <span className="text-[11px] font-black text-[#2E2E24]">{elementLabel(selected.type)}</span>
            <textarea
              autoFocus rows={2}
              value={(banner[textField(selected)!] as string) ?? ''}
              onChange={(e) => setBanner((b) => ({ ...b, [textField(selected)!]: e.target.value }))}
              className="w-full bg-[#FAF8F5] border border-[#E2DFD4] rounded-2xl px-3 py-2.5 text-[13px] font-bold text-[#2E2E24] outline-none focus:border-[#5A5A40]"
            />
            {/* Rewrites of what's already written — never a new claim. */}
            {(() => {
              const field = textField(selected)!;
              const value = (banner[field] as string) ?? '';
              const ideas = suggestHeadlines(value);
              if (ideas.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  <span className="text-[9.5px] font-black text-[#A8A48F]">صياغات مقترحة</span>
                  <div className="flex flex-col gap-1.5">
                    {ideas.map((s) => (
                      <button key={s} type="button" onClick={() => setBanner((b) => ({ ...b, [field]: s }))}
                        className="text-right text-[11px] font-bold text-[#2E2E24] bg-[#FAF8F5] border border-[#E2DFD4] rounded-xl px-3 py-2 active:scale-[0.98] transition-transform cursor-pointer">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <button onClick={() => setEditingText(false)}
              className="w-full bg-[#5A5A40] text-white text-[12px] font-black py-2.5 rounded-2xl active:scale-95 transition-transform cursor-pointer">تم</button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet ── */}
      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150" />
          <div className="relative w-full max-h-[62dvh] overflow-y-auto bg-white rounded-t-3xl p-4 pb-6 space-y-3 animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#E2DFD4] rounded-full mx-auto" />

            {/* Image */}
            {sheet === 'image' && (
              <>
                <span className="text-[12px] font-black text-[#2E2E24]">الصورة</span>
                <p className="text-[9.5px] font-bold text-[#A8A48F]">
                  الصورة بتتقصّ جوّه الإطار — عمرها ما هتتمدّ أو تتشوّه. اسحب الصورة في المعاينة لتحديد الجزء الظاهر.
                </p>
                <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E2DFD4] rounded-2xl p-2">
                  {banner.imageUrl && (
                    <img src={banner.imageUrl} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9.5px] font-black text-[#5A5A40] block mb-1">تغيير الصورة</span>
                    <PhotoPickerButtons idPrefix="studio-image" folder="banners"
                      onSelect={(url) => { commit(); setBanner((b) => ({ ...b, imageUrl: url })); }} />
                  </div>
                </div>
                {palette && palette.colors.length > 0 && (
                  <div className="bg-[#FAF8F5] border border-[#E2DFD4] rounded-2xl p-2.5 space-y-1.5">
                    <span className="text-[9.5px] font-black text-[#5A5A40] block">ألوان مستخرجة من الصورة</span>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {palette.colors.map((c) => (
                        <button key={c} type="button" title={c}
                          onClick={() => { commit(); setLayout((l) => ({ ...l, background: c })); }}
                          className="w-8 h-8 rounded-xl border-2 border-[#E2DFD4] active:scale-90 transition-transform cursor-pointer"
                          style={{ background: c }} aria-label={`لون ${c}`} />
                      ))}
                    </div>
                    <button type="button"
                      onClick={() => {
                        commit();
                        setLayout((l) => ({
                          ...l,
                          elements: l.elements.map((e) =>
                            e.type === 'button' ? { ...e, bg: palette.suggestedAccent, color: palette.suggestedText }
                              : (e.fontSize != null ? { ...e, color: palette.suggestedText } : e)),
                        }));
                      }}
                      className="w-full bg-[#0A2342] text-white text-[10px] font-black py-2 rounded-xl active:scale-95 transition-transform cursor-pointer">
                      طبّق ألوان متناسقة مع الصورة
                    </button>
                  </div>
                )}
                <span className="text-[9.5px] font-black text-[#5A5A40] block">لون الخلفية (يظهر لو مفيش صورة أو كانت شفافة)</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {BACKGROUNDS.map((bg) => (
                    <button key={bg} type="button" onClick={() => { commit(); setLayout((l) => ({ ...l, background: bg })); }}
                      aria-label="خلفية"
                      className={`w-11 h-9 rounded-xl border-2 shrink-0 active:scale-90 transition-transform cursor-pointer ${
                        layout.background === bg ? 'border-[#0A2342]' : 'border-[#E2DFD4]'
                      }`}
                      style={{ background: bg }} />
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {FITS.map((f) => (
                    <Chip key={f.value} active={layout.image.fit === f.value}
                      onClick={() => { commit(); setLayout((l) => ({ ...l, image: { ...l.image, fit: f.value } })); }}>{f.label}</Chip>
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {[0.75, 1, 1.25, 1.5, 2].map((z) => (
                    <Chip key={z} active={layout.image.scale === z}
                      onClick={() => { commit(); setLayout((l) => ({ ...l, image: { ...l.image, scale: z } })); }}>{z * 100}%</Chip>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="text-[9.5px] font-black text-[#5A5A40]">وضوح الصورة
                    <input type="range" min={20} max={100} value={Math.round(layout.image.opacity * 100)}
                      onChange={(e) => setLayout((l) => ({ ...l, image: { ...l.image, opacity: +e.target.value / 100 } }))}
                      className="w-full accent-[#5A5A40]" />
                  </label>
                  <label className="text-[9.5px] font-black text-[#5A5A40]">التعتيم فوقها
                    <input type="range" min={0} max={85} value={Math.round(layout.overlay.opacity * 100)}
                      onChange={(e) => setLayout((l) => ({ ...l, overlay: { enabled: +e.target.value > 0, opacity: +e.target.value / 100 } }))}
                      className="w-full accent-[#5A5A40]" />
                  </label>
                </div>
              </>
            )}

            {/* Text */}
            {sheet === 'text' && (
              selected && selected.fontSize != null ? (
                <>
                  <span className="text-[12px] font-black text-[#2E2E24]">نص — {elementLabel(selected.type)}</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {FONTS.map((f) => (
                      <Chip key={f.value} active={(selected.fontFamily ?? FONTS[0].value) === f.value}
                        onClick={() => { commit(); patchEl(selected.id, { fontFamily: f.value }); }}>{f.label}</Chip>
                    ))}
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[400, 700, 900].map((w) => (
                      <Chip key={w} active={(selected.fontWeight ?? 900) === w}
                        onClick={() => { commit(); patchEl(selected.id, { fontWeight: w }); }}>
                        {w === 400 ? 'عادي' : w === 700 ? 'عريض' : 'ثقيل'}
                      </Chip>
                    ))}
                    <Chip active={!!selected.shadow} onClick={() => { commit(); patchEl(selected.id, { shadow: !selected.shadow }); }}>ظل النص</Chip>
                  </div>
                  <span className="text-[9.5px] font-black text-[#5A5A40] block">اللون</span>
                  <div className="flex gap-2 flex-wrap items-center">
                    {SWATCHES.map((c) => (
                      <button key={c} onClick={() => { commit(); patchEl(selected.id, { color: c }); }}
                        className={`w-8 h-8 rounded-full border-2 active:scale-90 transition-transform cursor-pointer ${selected.color === c ? 'border-[#0A2342]' : 'border-[#E2DFD4]'}`}
                        style={{ background: c }} aria-label={c} />
                    ))}
                    <label className="w-8 h-8 rounded-full border-2 border-dashed border-[#C9C5B4] flex items-center justify-center cursor-pointer overflow-hidden"
                      title="لون مخصّص">
                      <input type="color" value={selected.color ?? '#FFFFFF'} aria-label="لون مخصّص"
                        onChange={(e) => patchEl(selected.id, { color: e.target.value })}
                        className="w-10 h-10 cursor-pointer opacity-0 absolute" />
                      <span className="text-[13px]">🎨</span>
                    </label>
                  </div>
                  <span className="text-[9.5px] font-black text-[#5A5A40] block pt-1">تباعد الحروف</span>
                  <div className="flex gap-1.5">
                    {[0, 0.5, 1, 2].map((ls) => (
                      <Chip key={ls} active={(selected.letterSpacing ?? 0) === ls}
                        onClick={() => { commit(); patchEl(selected.id, { letterSpacing: ls }); }}>
                        {ls === 0 ? 'عادي' : `${ls}px`}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : <p className="text-[10.5px] font-bold text-[#A8A48F] py-4 text-center">اختر نصاً من البانر الأول</p>
            )}

            {/* Style */}
            {sheet === 'style' && (
              selected ? (
                <>
                  <span className="text-[12px] font-black text-[#2E2E24]">تنسيق — {elementLabel(selected.type)}</span>
                  {selected.bg != null && (
                    <>
                      <span className="text-[9.5px] font-black text-[#5A5A40] block">لون الخلفية</span>
                      <div className="flex gap-2 flex-wrap">
                        {SWATCHES.map((c) => (
                          <button key={c} onClick={() => { commit(); patchEl(selected.id, { bg: c }); }}
                            className={`w-8 h-8 rounded-full border-2 active:scale-90 transition-transform cursor-pointer ${selected.bg === c ? 'border-[#0A2342]' : 'border-[#E2DFD4]'}`}
                            style={{ background: c }} aria-label={c} />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 pt-1">
                    {[0, 8, 14, 22, 30].map((r) => (
                      <Chip key={r} active={(selected.radius ?? 0) === r} onClick={() => { commit(); patchEl(selected.id, { radius: r }); }}>
                        {r === 0 ? 'حواف حادة' : `${r}px`}
                      </Chip>
                    ))}
                  </div>
                  <label className="text-[9.5px] font-black text-[#5A5A40] block">الشفافية
                    <input type="range" min={20} max={100} value={Math.round((selected.opacity ?? 1) * 100)}
                      onChange={(e) => patchEl(selected.id, { opacity: +e.target.value / 100 })} className="w-full accent-[#5A5A40]" />
                  </label>
                  <span className="text-[9.5px] font-black text-[#5A5A40] block">الدوران</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[-15, -8, 0, 8, 15].map((r) => (
                      <Chip key={r} active={(selected.rotation ?? 0) === r} onClick={() => { commit(); patchEl(selected.id, { rotation: r }); }}>
                        {r === 0 ? 'مستقيم' : `${r}°`}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : <p className="text-[10.5px] font-bold text-[#A8A48F] py-4 text-center">اختر عنصراً من البانر الأول</p>
            )}

            {/* Align */}
            {sheet === 'align' && (
              selected ? (
                <>
                  <span className="text-[12px] font-black text-[#2E2E24]">محاذاة سريعة</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['يمين', () => patchEl(selected.id, { x: SAFE })],
                      ['منتصف أفقي', () => patchEl(selected.id, { x: 50 - (selected.width ?? 20) / 2 })],
                      ['يسار', () => patchEl(selected.id, { x: 100 - SAFE - (selected.width ?? 20) })],
                      ['أعلى', () => patchEl(selected.id, { y: SAFE })],
                      ['منتصف عمودي', () => patchEl(selected.id, { y: 45 })],
                      ['أسفل', () => patchEl(selected.id, { y: 100 - SAFE - 12 })],
                    ] as const).map(([label, fn]) => (
                      <button key={label} onClick={() => { commit(); fn(); }}
                        className="py-3 rounded-2xl bg-[#FAF8F5] border border-[#E2DFD4] text-[10.5px] font-black text-[#2E2E24] active:scale-95 transition-transform cursor-pointer">
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9.5px] font-black text-[#5A5A40] block pt-1">اتجاه النص</span>
                  <div className="flex gap-1.5">
                    {(['start', 'center', 'end'] as const).map((a) => (
                      <Chip key={a} active={(selected.align ?? 'start') === a} onClick={() => { commit(); patchEl(selected.id, { align: a }); }}>
                        {a === 'start' ? 'يمين' : a === 'center' ? 'وسط' : 'يسار'}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : <p className="text-[10.5px] font-bold text-[#A8A48F] py-4 text-center">اختر عنصراً من البانر الأول</p>
            )}

            {/* Templates */}
            {sheet === 'templates' && (
              <>
                <span className="text-[12px] font-black text-[#2E2E24]">قوالب جاهزة</span>
                <p className="text-[9.5px] font-bold text-[#A8A48F]">اختر تصميماً كبداية — كل حاجة تفضل قابلة للتعديل بعدها.</p>
                <div className="grid grid-cols-2 gap-2">
                  {BANNER_TEMPLATES.map((tpl) => (
                    <button key={tpl.id} type="button"
                      onClick={() => { commit(); setLayout(tpl.build(banner.placement)); setSelectedId(null); setSheet(null); }}
                      className="text-right rounded-2xl border border-[#E2DFD4] overflow-hidden active:scale-95 transition-transform cursor-pointer">
                      <div className="h-14 flex items-center justify-center" style={{ background: tpl.swatch }}>
                        <span className="text-white text-[10px] font-black drop-shadow">{tpl.name}</span>
                      </div>
                      <div className="p-2 bg-white">
                        <span className="text-[9px] font-bold text-[#A8A48F] block">{tpl.hint}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Layers */}
            {sheet === 'layers' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-black text-[#2E2E24]">الطبقات</span>
                  <button onClick={() => { commit(); setLayout(DEFAULT_LAYOUT(banner.placement)); setSelectedId(null); }}
                    className="text-[9.5px] font-black text-[#A8A48F] flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> إعادة الضبط
                  </button>
                </div>
                {/* Add the data-driven elements, which aren't in the default layout */}
                <div className="flex gap-1.5 flex-wrap">
                  {(['availability', 'testimonial'] as const)
                    .filter((t) => !layout.elements.some((e) => e.type === t))
                    .map((t) => (
                      <Chip key={t} onClick={() => {
                        commit();
                        setLayout((l) => ({
                          ...l,
                          elements: [...l.elements, {
                            id: `${t}_${Date.now()}`, type: t, visible: true, locked: false,
                            x: 6, y: t === 'availability' ? 12 : 46,
                            width: t === 'testimonial' ? 62 : undefined,
                            fontSize: t === 'availability' ? 10 : 9.5,
                            color: t === 'availability' ? '#FFFFFF' : '#2E2E24',
                            opacity: 1,
                          }],
                        }));
                      }}>+ {elementLabel(t)}</Chip>
                    ))}
                </div>
                <p className="text-[9px] font-bold text-[#A8A48F]">
                  «الأماكن المتاحة» و«رأي ضيف» بيقروا من قاعدة البيانات — لازم البانر يكون مربوط ببيت، ولو مفيش بيانات مش هيظهروا للزائر.
                </p>
                <div className="space-y-1.5">
                  {layout.elements.slice().reverse().map((el) => (
                    <div key={el.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border transition-colors ${
                        selectedId === el.id ? 'bg-[#FAF8F5] border-[#C5A059]' : 'bg-white border-[#EFEBE0]'
                      }`}>
                      <button onClick={() => { commit(); patchEl(el.id, { visible: !el.visible }); }} aria-label="إظهار/إخفاء"
                        className="p-1 rounded-lg active:scale-90 transition-transform cursor-pointer">
                        {el.visible ? <Eye className="w-4 h-4 text-[#5A5A40]" /> : <EyeOff className="w-4 h-4 text-[#C9C5B4]" />}
                      </button>
                      <button onClick={() => { commit(); patchEl(el.id, { locked: !el.locked }); }} aria-label="قفل"
                        className="p-1 rounded-lg active:scale-90 transition-transform cursor-pointer">
                        {el.locked ? <Lock className="w-4 h-4 text-rose-600" /> : <Unlock className="w-4 h-4 text-[#5A5A40]" />}
                      </button>
                      <button onClick={() => { setSelectedId(el.id); setSheet(null); }}
                        className="flex-1 text-right text-[11.5px] font-black text-[#2E2E24] truncate cursor-pointer">
                        {elementLabel(el.type)}
                      </button>
                      <button onClick={() => { commit(); setLayout((l) => ({ ...l, elements: l.elements.filter((x) => x.id !== el.id) })); }}
                        aria-label="حذف" className="p-1 rounded-lg text-rose-600 active:scale-90 transition-transform cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom tab bar ── */}
      <div className="shrink-0 bg-white/95 backdrop-blur border-t border-[#EFEBE0] flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        {([
          ['templates', 'قوالب', Sparkles], ['image', 'الصورة', ImageIcon], ['text', 'النص', Type],
          ['style', 'التنسيق', Palette], ['align', 'المحاذاة', AlignCenter], ['layers', 'الطبقات', Layers],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSheet(sheet === key ? null : key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors cursor-pointer ${
              sheet === key ? 'text-[#5A5A40]' : 'text-[#A8A48F]'
            }`}>
            <span className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${sheet === key ? 'bg-[#5A5A40]/12' : ''}`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[9px] font-black">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

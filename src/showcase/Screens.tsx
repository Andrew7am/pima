/* ═══════════════════════════════════════════════════════════════════════════
   REAL PIMA UI PREVIEW — development only, part of the showcase.

   Four mini screens built from NOTHING but the shared components and the
   --ds-* roles. No screen here imports from the production app and no
   production screen imports from here.

   They exist to answer a question the component gallery cannot: the parts look
   right individually, but does a real Pima screen assembled only from them
   look like Pima? A gallery can hide the fact that a system has no opinion
   about density, hierarchy or rhythm.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react';
import {
  CalendarDays, Users, MapPin, Check, Clock, X, Image as ImageIcon,
  Phone, MessageCircle, Trophy, Timer, Star,
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';

/* ── 1 · GUEST BOOKING ──────────────────────────────────────────────────── */

export function GuestBookingScreen() {
  return (
    <div className="space-y-3">
      <Card className="!p-0 overflow-hidden">
        {/* Image placeholder — a real cover would sit here */}
        <div className="h-40 flex items-center justify-center"
          style={{ background: 'var(--ds-raised)', color: 'var(--ds-text-faint)' }}>
          <ImageIcon className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--ds-text)' }}>
                بيت كينج مريوط
              </h3>
              <div className="flex items-center gap-1 text-[12px] mt-0.5" style={{ color: 'var(--ds-text-2)' }}>
                <MapPin className="w-4 h-4" aria-hidden="true" />
                مريوط — الإسكندرية
              </div>
            </div>
            <Badge tone="success" icon={<Check className="w-3.5 h-3.5" />}>مؤكد</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 border-y" style={{ borderColor: 'var(--ds-border)' }}>
            <div>
              <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>الوصول والمغادرة</div>
              <div className="text-[14px] font-bold flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--ds-text)' }}>
                <CalendarDays className="w-4 h-4" aria-hidden="true" />٢٤ – ٢٧ يناير
              </div>
            </div>
            <div>
              <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>عدد الأفراد</div>
              <div className="text-[14px] font-bold flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--ds-text)' }}>
                <Users className="w-4 h-4" aria-hidden="true" />٤٢ فرد
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>الإجمالي · ٣ ليالٍ</div>
              <div className="text-[20px] font-extrabold tabular-nums" style={{ color: 'var(--ds-text)' }}>
                ٥٨٬٠٤٥ <span className="text-[14px] font-bold">ج.م</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--ds-text-2)' }}>
                العربون المدفوع ٨٬٧٠٦ ج.م
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button fullWidth>أكمل الحجز</Button>
            <Button variant="secondary">إلغاء</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── 2 · OWNER BOOKING ──────────────────────────────────────────────────── */

export function OwnerBookingScreen() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-mono" dir="ltr" style={{ color: 'var(--ds-text-2)' }}>#A4F2C1</div>
          <h3 className="text-[16px] font-bold mt-0.5" style={{ color: 'var(--ds-text)' }}>
            كنيسة الشهيد أبانوب
          </h3>
          <div className="text-[12px] mt-0.5" style={{ color: 'var(--ds-text-2)' }}>
            الأستاذ مينا صبحي · ٠١٠٣٣٣٣٢٢٢٢
          </div>
        </div>
        <Badge tone="warning" icon={<Clock className="w-3.5 h-3.5" />}>بانتظار الدفع</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y" style={{ borderColor: 'var(--ds-border)' }}>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>الوصول</div>
          <div className="text-[14px] font-bold mt-0.5" style={{ color: 'var(--ds-text)' }}>٢٤ يناير</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>المغادرة</div>
          <div className="text-[14px] font-bold mt-0.5" style={{ color: 'var(--ds-text)' }}>٢٧ يناير</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>الأفراد</div>
          <div className="text-[14px] font-bold mt-0.5 tabular-nums" style={{ color: 'var(--ds-text)' }}>٤٢</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>قيمة الحجز</div>
          <div className="text-[20px] font-extrabold tabular-nums" style={{ color: 'var(--ds-text)' }}>
            ٥٨٬٠٤٥ <span className="text-[14px] font-bold">ج.م</span>
          </div>
        </div>
        <div className="text-end">
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>صافيك</div>
          <div className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--ds-text)' }}>٥٥٬١٤٣</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button icon={<Check className="w-4 h-4" />}>تأكيد الحجز</Button>
        <Button variant="secondary" icon={<Phone className="w-4 h-4" />}>اتصال</Button>
        <Button variant="secondary" icon={<MessageCircle className="w-4 h-4" />}>رسالة</Button>
        <Button variant="ghost">رفض</Button>
      </div>
    </Card>
  );
}

/* ── 3 · ADMIN DASHBOARD ────────────────────────────────────────────────── */

function Kpi({ label, value, unit, trend }: { label: string; value: string; unit?: string; trend?: string }) {
  return (
    <Card compact>
      <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>{label}</div>
      <div className="text-[20px] font-extrabold tabular-nums mt-0.5" style={{ color: 'var(--ds-text)' }}>
        {value}{unit && <span className="text-[12px] font-bold ms-1">{unit}</span>}
      </div>
      {trend && <div className="text-[11px] mt-0.5" style={{ color: 'var(--ds-success-ink)' }}>{trend}</div>}
    </Card>
  );
}

export function AdminDashboardScreen() {
  const rows = [
    { ref: '#A4F2C1', guest: 'كنيسة الشهيد أبانوب', house: 'كينج مريوط', amount: '٥٨٬٠٤٥', tone: 'success' as const, status: 'مؤكد' },
    { ref: '#B7K9M2', guest: 'كنيسة العذراء', house: 'بيت الملاك', amount: '٣١٬٢٠٠', tone: 'warning' as const, status: 'بانتظار' },
    { ref: '#C2X4L8', guest: 'خدمة إعدادي', house: 'وادي النطرون', amount: '١٩٬٤٥٠', tone: 'danger' as const, status: 'ملغي' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="الحجوزات" value="١٤٨" trend="+١٢٪ هذا الشهر" />
        <Kpi label="المستخدمون" value="٩٦٢" trend="+٨٪" />
        <Kpi label="البيوت" value="٢٤" />
        <Kpi label="الإيرادات" value="٤١٢٬٩٠٠" unit="ج.م" trend="+١٩٪" />
      </div>

      <Card compact>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--ds-text)' }}>أحدث الحجوزات</h3>
          <Button variant="ghost" compact>عرض الكل</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['المرجع', 'الجهة', 'البيت', 'المبلغ', 'الحالة'].map(h => (
                  <th key={h} className="text-start ps-2 pe-2 py-1.5 text-[11px] font-bold whitespace-nowrap"
                    style={{ color: 'var(--ds-text-2)', background: 'var(--ds-raised)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.ref} style={{ borderTop: '1px solid var(--ds-border)' }}>
                  {/* 36px admin row density, vs 44px on touch screens */}
                  <td className="ps-2 pe-2 h-9 font-mono text-[11px] font-bold whitespace-nowrap" dir="ltr"
                    style={{ color: 'var(--ds-text)' }}>{r.ref}</td>
                  <td className="ps-2 pe-2 h-9 truncate" style={{ color: 'var(--ds-text)' }}>{r.guest}</td>
                  <td className="ps-2 pe-2 h-9 whitespace-nowrap" style={{ color: 'var(--ds-text-2)' }}>{r.house}</td>
                  <td className="ps-2 pe-2 h-9 tabular-nums font-bold whitespace-nowrap" style={{ color: 'var(--ds-text)' }}>{r.amount}</td>
                  <td className="ps-2 pe-2 h-9"><Badge tone={r.tone}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── 4 · ENTERTAINMENT / GAME ───────────────────────────────────────────── */

export function GameScreen() {
  const [picked, setPicked] = useState<number | null>(null);
  const CORRECT = 1;
  const answers = ['القديس أنطونيوس', 'القديس مقاريوس', 'القديس بولا', 'القديس بيشوي'];

  return (
    <div className="space-y-3">
      <Card>
        {/* Header: title, timer, progress */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>سؤال ٧ من ١٠</div>
            <h3 className="text-[16px] font-bold" style={{ color: 'var(--ds-text)' }}>مين ده؟</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[14px] font-extrabold tabular-nums"
            style={{ color: 'var(--ds-accent)' }}>
            <Timer className="w-4 h-4" aria-hidden="true" />١٢
          </div>
        </div>

        {/* Progress — the one place indigo appears, as a supporting accent */}
        <div className="h-1.5 rounded-full overflow-hidden my-3" style={{ background: 'var(--ds-raised)' }}>
          <div className="h-full rounded-full" style={{ width: '70%', background: 'var(--color-play-indigo)' }} />
        </div>

        <p className="text-[14px] leading-relaxed" style={{ color: 'var(--ds-text)' }}>
          أبو الرهبان، عاش في البرية سبعين سنة، وتُنسب إليه أقدم قلاية في وادي النطرون.
        </p>

        <div className="grid gap-2 mt-3">
          {answers.map((a, i) => {
            const isPicked = picked === i;
            const isCorrect = i === CORRECT;
            const revealed = picked !== null;
            let bg = 'var(--ds-surface)';
            let border = 'var(--ds-border)';
            let fg = 'var(--ds-text)';
            if (revealed && isCorrect) { bg = 'color-mix(in srgb, var(--ds-success) 14%, transparent)'; border = 'var(--ds-success)'; fg = 'var(--ds-success-ink)'; }
            else if (revealed && isPicked) { bg = 'color-mix(in srgb, var(--ds-danger) 14%, transparent)'; border = 'var(--ds-danger)'; fg = 'var(--ds-danger-ink)'; }

            return (
              <button
                key={a}
                type="button"
                onClick={() => setPicked(i)}
                className="min-h-11 ps-3 pe-3 rounded-[12px] border text-[14px] font-bold text-start
                           cursor-pointer flex items-center justify-between gap-2
                           focus-visible:outline-none focus-visible:ring-2"
                style={{ background: bg, borderColor: border, color: fg }}
              >
                <span>{a}</span>
                {revealed && isCorrect && <Check className="w-4 h-4 shrink-0" aria-label="إجابة صحيحة" />}
                {revealed && isPicked && !isCorrect && <X className="w-4 h-4 shrink-0" aria-label="إجابة خاطئة" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--ds-border)' }}>
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ds-text-2)' }}>
            <Star className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} aria-hidden="true" />
            <span className="tabular-nums font-bold" style={{ color: 'var(--ds-text)' }}>٤٢٠</span> نقطة
          </div>
          {picked !== null && <Button compact onClick={() => setPicked(null)}>السؤال التالي</Button>}
        </div>
      </Card>

      {/* Winner / achievement — gold carries this, not indigo */}
      <Card className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-2"
          style={{ background: 'color-mix(in srgb, var(--ds-accent) 18%, transparent)' }}>
          <Trophy className="w-7 h-7" style={{ color: 'var(--ds-accent)' }} aria-hidden="true" />
        </div>
        <h3 className="text-[20px] font-extrabold" style={{ color: 'var(--ds-accent)' }}>مبروك! المركز الأول</h3>
        <p className="text-[12px] mt-1" style={{ color: 'var(--ds-text-2)' }}>
          ٩ إجابات صحيحة من ١٠ · ٤٢٠ نقطة · أسرع من ٨٧٪ من اللاعبين
        </p>
        <div className="flex gap-2 justify-center mt-3">
          <Button>العب تاني</Button>
          <Button variant="secondary">لوحة الصدارة</Button>
        </div>
      </Card>
    </div>
  );
}

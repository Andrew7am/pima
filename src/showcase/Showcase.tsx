/* ═══════════════════════════════════════════════════════════════════════════
   PIMA DESIGN SYSTEM — SHOWCASE (development only)

   NOT PART OF THE APPLICATION. Nothing here is imported by a screen, it is not
   on any route, and it is not an input to the production build — `vite build`
   has one entry (index.html), so this never ships.

   TO DELETE, once the visual direction is approved:
       rm -rf src/showcase showcase.html

   Everything below renders the REAL components from src/components/ui. This
   page styles nothing itself beyond layout: if a button looks wrong here, it
   is wrong in the component, which is the whole point of reviewing it this way
   rather than from a mockup.

   The theme switcher swaps one class on a wrapper. The components do not know
   it happened — that is Phase 3's binding doing the work, and this page is the
   proof of it.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react';
import {
  Search, SlidersHorizontal, CalendarX, CalendarDays, Users, MapPin,
  Check, Clock, X, Gamepad2, Sun, Moon,
} from 'lucide-react';
import { Button, Card, Input, Badge, EmptyState, Skeleton, SkeletonGroup } from '../components/ui';

const THEMES = [
  { id: 'guest', cls: '', label: 'الضيف', hint: 'كريمي + زيتي' },
  { id: 'owner-light', cls: 'owner-theme', label: 'المالك — نهاري', hint: 'كحلي + ذهبي' },
  { id: 'owner-dark', cls: 'owner-theme owner-dark', label: 'المالك — ليلي', hint: 'الوضع الليلي' },
  { id: 'admin', cls: 'admin-theme', label: 'الإدارة', hint: 'نفس اللغة، كثافة أعلى' },
  { id: 'play', cls: 'play-theme', label: 'الترفيه', hint: 'Slate + إنديجو + ذهبي' },
] as const;

/* ── Small helpers, local to this page ──────────────────────────────────── */

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[20px] font-extrabold" style={{ color: 'var(--ds-text)' }}>{title}</h2>
        {note && <p className="text-[12px] mt-0.5" style={{ color: 'var(--ds-text-2)' }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--ds-border)' }}>
      <div className="h-12" style={{ background: `var(${token})` }} />
      <div className="p-2" style={{ background: 'var(--ds-surface)' }}>
        <div className="text-[12px] font-bold" style={{ color: 'var(--ds-text)' }}>{label}</div>
        <div className="text-[11px] font-mono" dir="ltr" style={{ color: 'var(--ds-text-2)' }}>{token}</div>
      </div>
    </div>
  );
}

/** A status pill on a filled surface — proves the on-* pair, not just the ink. */
function FilledChip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center h-[22px] ps-2 pe-2 rounded-full text-[11px] font-bold"
      style={{ background: `var(${bg})`, color: `var(${fg})` }}>
      {children}
    </span>
  );
}

/* ── Realistic Pima compositions ────────────────────────────────────────────
   Search and filter are NOT new shared components — they are Input and Button
   arranged, which is deliberate: the spec asked for no components beyond the
   six, and these two are compositions, not primitives. */

function SearchField() {
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ insetInlineStart: '12px', color: 'var(--ds-text-2)' }} aria-hidden="true" />
      <Input
        aria-label="ابحث عن بيت أو مدينة"
        placeholder="ابحث عن بيت أو مدينة…"
        className="!ps-9 rounded-full"
      />
    </div>
  );
}

function FilterRow() {
  const [active, setActive] = useState('all');
  const chips = [
    { id: 'all', label: 'الكل' },
    { id: 'available', label: 'متاح' },
    { id: 'sea', label: 'على البحر' },
    { id: 'halls', label: 'فيه قاعات' },
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {chips.map(c => (
        <Button key={c.id} variant={active === c.id ? 'primary' : 'secondary'}
          className="rounded-full !text-[12px]" onClick={() => setActive(c.id)}>
          {c.label}
        </Button>
      ))}
      <Button variant="ghost" icon={<SlidersHorizontal className="w-4 h-4" />} className="rounded-full !text-[12px]">
        فلاتر
      </Button>
    </div>
  );
}

function BookingCard() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold truncate" style={{ color: 'var(--ds-text)' }}>
            بيت كينج مريوط — الإسكندرية
          </div>
          <div className="flex items-center gap-3 mt-1 text-[12px] flex-wrap" style={{ color: 'var(--ds-text-2)' }}>
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-4 h-4" />٢٤ – ٢٧ يناير</span>
            <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />٤٢ فرد</span>
            <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />مريوط</span>
          </div>
          <div className="text-[11px] font-mono mt-1.5" dir="ltr" style={{ color: 'var(--ds-text-2)', opacity: 0.8 }}>
            #A4F2C1
          </div>
        </div>
        <Badge tone="success" icon={<Check className="w-3.5 h-3.5" />}>مؤكد</Badge>
      </div>

      <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'var(--ds-border)' }}>
        <div>
          <div className="text-[11px]" style={{ color: 'var(--ds-text-2)' }}>الإجمالي</div>
          <div className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--ds-text)' }}>
            ٥٨٬٠٤٥ <span className="text-[12px] font-bold">ج.م</span>
          </div>
        </div>
        <Button compact>تفاصيل الحجز</Button>
      </div>
    </Card>
  );
}

function LoadingBooking() {
  return (
    <Card>
      <SkeletonGroup className="space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-28 rounded-[12px]" />
        </div>
      </SkeletonGroup>
    </Card>
  );
}

/* ── The page ───────────────────────────────────────────────────────────── */

export default function Showcase() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]['id']>('guest');
  const active = THEMES.find(t => t.id === theme)!;

  return (
    <div dir="rtl" className="min-h-screen">
      {/* Switcher sits OUTSIDE the themed wrapper on purpose: it is chrome for
          reviewing, not part of what is being reviewed. */}
      <header className="sticky top-0 z-10 border-b" style={{ background: '#15130F', borderColor: '#33302A' }}>
        <div className="max-w-[880px] mx-auto p-3">
          <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
            <h1 className="text-[16px] font-extrabold text-[#EDE7DA]">معرض نظام تصميم بيما</h1>
            <span className="text-[11px] text-[#A29A85]">للمراجعة فقط — مش جزء من التطبيق</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                className={`min-h-11 ps-3 pe-3 rounded-[12px] text-[12px] font-bold transition-colors cursor-pointer ${
                  theme === t.id ? 'bg-[#C5A059] text-[#1A1A14]' : 'bg-[#26221A] text-[#D8D0BE] hover:bg-[#33302A]'
                }`}
              >
                {t.id === 'owner-dark' ? <Moon className="w-3.5 h-3.5 inline -mt-0.5 me-1" />
                  : t.id === 'owner-light' ? <Sun className="w-3.5 h-3.5 inline -mt-0.5 me-1" /> : null}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Everything below inherits the active theme through ONE class. No
          component receives a theme prop; none of them knows which is on. */}
      <main className={active.cls} style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)' }}>
        <div className="max-w-[880px] mx-auto p-4 space-y-10 pb-24">

          <div className="pt-2">
            <div className="text-[12px]" style={{ color: 'var(--ds-text-2)' }}>السمة المعروضة</div>
            <div className="text-[20px] font-extrabold">{active.label}</div>
            <div className="text-[12px]" style={{ color: 'var(--ds-text-2)' }}>{active.hint}</div>
          </div>

          {/* ── REALISTIC EXAMPLES FIRST ── */}
          <Section title="حجز" note="نفس المكوّنات — الكارت والشارة والزرار">
            <BookingCard />
          </Section>

          <Section title="البحث والفلاتر" note="تركيب من Input و Button — مش مكوّنات جديدة">
            <div className="space-y-3">
              <SearchField />
              <FilterRow />
            </div>
          </Section>

          <Section title="حالات الحجز" note="اللون مش لوحده — كل شارة معاها كلمة">
            <div className="flex gap-2 flex-wrap">
              <Badge tone="success" icon={<Check className="w-3.5 h-3.5" />}>مؤكد</Badge>
              <Badge tone="warning" icon={<Clock className="w-3.5 h-3.5" />}>بانتظار الدفع</Badge>
              <Badge tone="danger" icon={<X className="w-3.5 h-3.5" />}>ملغي</Badge>
              <Badge tone="info">جديد</Badge>
              <Badge tone="neutral">مسودة</Badge>
            </div>
          </Section>

          <Section title="الأزرار" note="٤٤px ارتفاع · ١٦px خط · المضغوط ٤٠px/١٤px للجداول">
            <div className="flex gap-2 flex-wrap items-start">
              <Button>احجز الآن</Button>
              <Button variant="secondary">إلغاء</Button>
              <Button variant="ghost">تخطي</Button>
              <Button loading>جارٍ الحفظ</Button>
              <Button disabled>غير متاح</Button>
            </div>
            <div className="flex gap-2 flex-wrap items-start">
              <Button icon={<Check className="w-4 h-4" />}>تأكيد الحجز</Button>
              <Button variant="secondary" compact>تعديل</Button>
              <Button icon={<Gamepad2 className="w-4 h-4" />}>ابدأ اللعب</Button>
            </div>
            <Button fullWidth>زرار بعرض الشاشة</Button>
          </Section>

          <Section title="حقول الإدخال">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="اسم البيت" placeholder="اكتب الاسم" />
              <Input label="عدد الأفراد" placeholder="٤٢" hint="أقصى عدد ٦٠ فرد" />
              <Input label="البريد الإلكتروني" defaultValue="not-an-email" error="اكتب بريدًا صحيحًا" />
              <Input label="رقم الحجز" defaultValue="#A4F2C1" disabled />
            </div>
          </Section>

          <Section title="لا يوجد بعد" note="بتقول ليه فاضي وإيه الخطوة — مش «لا توجد بيانات»">
            <Card>
              <EmptyState
                icon={<CalendarX className="w-8 h-8" />}
                title="لسه مفيش حجوزات"
                description="أول ما تحجز بيت، هيظهر هنا بكل تفاصيله ومواعيده."
                action={{ label: 'تصفّح البيوت', onClick: () => {} }}
              />
            </Card>
          </Section>

          <Section title="أثناء التحميل" note="بيرسم شكل المحتوى الجاي، فالصفحة متنطّش لما يوصل">
            <div className="space-y-2"><LoadingBooking /><LoadingBooking /></div>
          </Section>

          {/* ── FOUNDATIONS ── */}
          <Section title="الأدوار اللونية" note="نفس الأسماء في كل سمة — القيم هي اللي بتتغيّر">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Swatch token="--ds-bg" label="الخلفية" />
              <Swatch token="--ds-surface" label="السطح" />
              <Swatch token="--ds-raised" label="سطح مرتفع" />
              <Swatch token="--ds-border" label="الحدود" />
              <Swatch token="--ds-text" label="نص أساسي" />
              <Swatch token="--ds-text-2" label="نص ثانوي" />
              <Swatch token="--ds-primary" label="الفعل الأساسي" />
              <Swatch token="--ds-accent" label="مميّز" />
            </div>
          </Section>

          <Section title="ألوان الحالة" note="الفِلّ ونصّه المصاحب — كل زوج مقاس، مش مفترض">
            <div className="flex gap-2 flex-wrap">
              <FilledChip bg="--ds-primary" fg="--ds-on-primary">أساسي</FilledChip>
              <FilledChip bg="--ds-accent" fg="--ds-on-accent">مميّز</FilledChip>
              <FilledChip bg="--ds-success" fg="--ds-on-success">نجاح</FilledChip>
              <FilledChip bg="--ds-warning" fg="--ds-on-warning">تحذير</FilledChip>
              <FilledChip bg="--ds-danger" fg="--ds-on-danger">خطر</FilledChip>
            </div>
          </Section>

          <Section title="سلّم الطباعة" note="١١ · ١٢ · ١٤ · ١٦ · ٢٠ — مفيش مقاسات وسيطة">
            <Card>
              <div className="space-y-2.5">
                {[
                  { px: 11, w: 600, use: 'بيانات وصفية · توقيتات · أرقام مرجعية', s: '٢٤ يناير · #A4F2C1' },
                  { px: 12, w: 500, use: 'أوصاف ونص ثانوي', s: 'إقامة كاملة تشمل الإفطار والغداء والعشاء' },
                  { px: 14, w: 400, use: 'المتن القياسي · عناوين الكروت', s: 'بيت كينج مريوط — الإسكندرية' },
                  { px: 16, w: 700, use: 'الأزرار ومتن بارز', s: 'احجز الآن' },
                  { px: 20, w: 800, use: 'عناوين الأقسام والشاشات', s: 'حجوزاتي' },
                ].map(r => (
                  <div key={r.px} className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-mono text-[11px] w-10 shrink-0" dir="ltr" style={{ color: 'var(--ds-accent)' }}>{r.px}px</span>
                    <span style={{ fontSize: r.px, fontWeight: r.w, color: 'var(--ds-text)' }}>{r.s}</span>
                    <span className="text-[11px] basis-full sm:basis-auto" style={{ color: 'var(--ds-text-2)' }}>{r.use}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          <Section title="المسافات · الحواف · الظلال">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card compact>
                <div className="text-[12px] font-bold mb-2">المسافات</div>
                <div className="flex items-end gap-1.5">
                  {[4, 8, 12, 16, 24, 32].map(s => (
                    <div key={s} className="text-center">
                      <div style={{ width: s, height: s, background: 'var(--ds-primary)', borderRadius: 2 }} />
                      <div className="text-[11px] font-mono mt-1" dir="ltr" style={{ color: 'var(--ds-text-2)' }}>{s}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card compact>
                <div className="text-[12px] font-bold mb-2">الحواف</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[8, 12, 16, 24].map(r => (
                    <div key={r} className="text-center">
                      <div style={{ width: 34, height: 34, borderRadius: r, background: 'var(--ds-raised)', border: '1px solid var(--ds-border)' }} />
                      <div className="text-[11px] font-mono mt-1" dir="ltr" style={{ color: 'var(--ds-text-2)' }}>{r}</div>
                    </div>
                  ))}
                  <div className="text-center">
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--ds-raised)', border: '1px solid var(--ds-border)' }} />
                    <div className="text-[11px] mt-1" style={{ color: 'var(--ds-text-2)' }}>كامل</div>
                  </div>
                </div>
              </Card>

              <Card compact>
                <div className="text-[12px] font-bold mb-2">الظلال</div>
                <div className="flex items-center gap-2">
                  {[['subtle', 'خفيف'], ['medium', 'متوسط'], ['elevated', 'مرتفع']].map(([k, l]) => (
                    <div key={k} className="text-center">
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--ds-surface)', boxShadow: `var(--shadow-${k})` }} />
                      <div className="text-[11px] mt-1.5" style={{ color: 'var(--ds-text-2)' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Section>

          <p className="text-[11px] pt-4" style={{ color: 'var(--ds-text-2)' }}>
            صفحة مؤقتة للمراجعة. للحذف: <code dir="ltr" className="font-mono">rm -rf src/showcase showcase.html</code>
          </p>
        </div>
      </main>
    </div>
  );
}

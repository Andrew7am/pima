import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, Expense } from '../../types';
import {
  Wallet, Info, ArrowUpRight, ArrowDownRight, CreditCard, Receipt, Banknote,
  CheckCircle2, TrendingUp, Search, X, Plus, ChevronDown, Sparkles, Wrench,
  Zap, Droplet, Utensils, History, Landmark, Coins, Trash2, Pencil, Bell,
} from 'lucide-react';

interface OwnerFinancialCenterProps {
  ownerBookings: Booking[];
  confirmedBookings: Booking[];
  confirmedRevenue: number;
  platformCommissionAmount: number;
  netOwnerPayout: number;
  depositReceived: number;
  remainingBalance: number;
  commissionRate: number;
  ownerExpenses: Expense[];
  totalExpenses: number;
  netProfit: number;
  houseId?: string;
  onAddExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onNavigateSupport?: () => void;
}

// ── Small reusable primitives ──────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

function Money({ value, className = '' }: { value: number; className?: string }) {
  const animated = useCountUp(Math.round(value));
  return <span className={className}>{animated.toLocaleString()}</span>;
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null || pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-black ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(pct)}%
    </span>
  );
}

function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="sheet" className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl"
          initial={false} animate={{}} exit={{}}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'tween', duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="relative bg-[var(--color-owner-surface)] w-full max-w-md rounded-t-[28px] p-5 pb-8 max-h-[85vh] overflow-y-auto z-10 text-right"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="w-10 h-1.5 rounded-full bg-[var(--color-owner-border)] mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[var(--color-owner-text)]">{title}</h3>
              <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Bookings → transactions helpers ────────────────────────────────

function bookingGuestName(b: Booking) {
  return b.organizationName || b.userName;
}
function bookingRef(b: Booking) {
  return `#${b.id.replace(/^booking_/, '').slice(-6)}`;
}
function bookingStatusBadge(b: Booking) {
  if (!b.depositPaid) return { label: 'قيد المراجعة', className: 'bg-amber-50 text-amber-800 border-amber-200' };
  if (b.status === 'completed') return { label: 'مكتمل', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  return { label: 'مدفوع', className: 'bg-sky-50 text-sky-800 border-sky-200' };
}

const EXPENSE_CATEGORIES: { key: string; label: string; icon: React.ElementType; match: RegExp }[] = [
  { key: 'kitchen', label: 'مطبخ', icon: Utensils, match: /مطبخ|طعام|أكل/ },
  { key: 'cleaning', label: 'نظافة', icon: Sparkles, match: /نظاف/ },
  { key: 'maintenance', label: 'صيانة', icon: Wrench, match: /صيان/ },
  { key: 'electricity', label: 'كهرباء', icon: Zap, match: /كهرب/ },
  { key: 'water', label: 'مياه', icon: Droplet, match: /مياه|ماء/ },
];
function expenseIcon(description: string): React.ElementType {
  return EXPENSE_CATEGORIES.find((c) => c.match.test(description))?.icon ?? Receipt;
}

const PERIODS = [
  { key: 'all', label: 'الكل' },
  { key: 'year', label: 'هذا العام' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'today', label: 'اليوم' },
] as const;
type PeriodKey = typeof PERIODS[number]['key'];

export default function OwnerFinancialCenter({
  ownerBookings, confirmedBookings, confirmedRevenue, platformCommissionAmount, netOwnerPayout,
  depositReceived, remainingBalance, commissionRate, ownerExpenses, totalExpenses, netProfit,
  houseId, onAddExpense, onDeleteExpense, onNavigateSupport,
}: OwnerFinancialCenterProps) {
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [search, setSearch] = useState('');
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [swipedExpenseId, setSwipedExpenseId] = useState<string | null>(null);
  const [showExpensesPage, setShowExpensesPage] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Real month-over-month trend data (last 6 months, by check-in month) ──
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('ar-EG', { month: 'short' }) };
    });
  }, []);

  const monthlyAgg = useMemo(() => months.map((m) => {
    const list = confirmedBookings.filter((b) => {
      const d = new Date(b.checkIn);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    });
    const revenue = list.reduce((s, b) => s + b.totalPrice, 0);
    const deposit = list.filter((b) => b.depositPaid).reduce((s, b) => s + b.depositAmount, 0);
    const commission = revenue * commissionRate;
    const net = revenue - commission;
    const remaining = revenue - deposit;
    return { ...m, count: list.length, revenue, deposit, commission, net, remaining };
  }), [months, confirmedBookings, commissionRate]);

  // Month-over-month %, but only when the previous month has enough bookings
  // to be a meaningful base — otherwise a single booking swings it to a
  // misleading ±100%+, so we suppress the badge entirely.
  const MIN_TREND_BASE = 3;
  const pct = (key: 'revenue' | 'deposit' | 'commission' | 'net' | 'remaining') => {
    const cur = monthlyAgg[5][key];
    const prev = monthlyAgg[4][key];
    if (prev <= 0 || monthlyAgg[4].count < MIN_TREND_BASE) return null;
    return Math.round(((cur - prev) / prev) * 100);
  };

  // Only one bottom sheet should be visible at a time.
  const closeAllSheets = () => { setOpenBookingId(null); setShowHistorySheet(false); setShowAddExpense(false); };

  const monthlyExpenses = useMemo(() => months.map((m) => {
    const list = ownerExpenses.filter((e) => {
      const d = new Date(e.expenseDate);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    });
    return { count: list.length, total: list.reduce((s, e) => s + e.amount, 0) };
  }), [months, ownerExpenses]);
  const expensesPct = (monthlyExpenses[4].total > 0 && monthlyExpenses[4].count >= 2)
    ? Math.round(((monthlyExpenses[5].total - monthlyExpenses[4].total) / monthlyExpenses[4].total) * 100)
    : null;

  // ── Guests arriving today, cash expected in-hand ──
  const arrivalsToday = confirmedBookings.filter((b) => b.checkIn === todayStr);
  const guestsToday = arrivalsToday.reduce((s, b) => s + b.guestsCount, 0);
  const cashExpectedToday = arrivalsToday.reduce((s, b) => s + Math.max(0, b.totalPrice - b.depositAmount), 0);

  // ── Top booking this month (a real, derivable "insight") ──
  const topBookingThisMonth = useMemo(() => {
    const now = new Date();
    const list = confirmedBookings.filter((b) => {
      const d = new Date(b.checkIn);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return list.length ? list.reduce((a, b) => (b.totalPrice > a.totalPrice ? b : a)) : null;
  }, [confirmedBookings]);

  // ── Section 6 filters applied to the transactions list ──
  const filteredBookings = useMemo(() => {
    const now = new Date();
    let list = confirmedBookings;
    if (period === 'today') list = list.filter((b) => b.checkIn === todayStr);
    else if (period === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      list = list.filter((b) => new Date(b.checkIn) >= weekAgo);
    } else if (period === 'month') {
      list = list.filter((b) => { const d = new Date(b.checkIn); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    } else if (period === 'year') {
      list = list.filter((b) => new Date(b.checkIn).getFullYear() === now.getFullYear());
    }
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => bookingGuestName(b).toLowerCase().includes(q) || bookingRef(b).toLowerCase().includes(q));
    return [...list].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  }, [confirmedBookings, period, search, todayStr]);

  const openBooking = confirmedBookings.find((b) => b.id === openBookingId) || null;

  // ── Donut: honest split of total booking value into commission vs net —
  // no per-category (meals/activities) revenue is tracked in the data model,
  // so this shows the one breakdown that's actually real.
  const netShare = confirmedRevenue > 0 ? netOwnerPayout / confirmedRevenue : 0;
  const r = 40, circumference = 2 * Math.PI * r;

  // What Pima can ACTUALLY transfer to the owner: only the deposits it holds,
  // minus the full platform commission. The rest of the net payout is cash the
  // owner collects directly on arrival — Pima never touches it, so it must not
  // be presented as a transferable balance. See the money-flow timeline below.
  const availableForTransfer = Math.max(0, depositReceived - platformCommissionAmount);

  const submitExpense = () => {
    const amount = parseFloat(expAmount);
    if (!expDesc.trim() || !amount || amount <= 0 || !houseId) return;
    if (editingExpenseId) onDeleteExpense?.(editingExpenseId);
    onAddExpense?.({ id: `exp_${Date.now()}`, houseId, description: expDesc.trim(), amount, expenseDate: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() });
    setExpDesc(''); setExpAmount(''); setEditingExpenseId(null); setShowAddExpense(false);
  };

  const openAddExpense = () => { closeAllSheets(); setEditingExpenseId(null); setExpDesc(''); setExpAmount(''); setShowAddExpense(true); };
  const openEditExpense = (e: Expense) => { closeAllSheets(); setEditingExpenseId(e.id); setExpDesc(e.description); setExpAmount(String(e.amount)); setShowAddExpense(true); };

  // Shared swipeable expense list (edit → swipe right, delete → swipe left).
  const expenseListJsx = ownerExpenses.length === 0 ? (
    <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-6 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">
      لا توجد مصروفات مسجلة بعد.
    </div>
  ) : (
    <div className="space-y-1.5">
      {ownerExpenses.map((e) => {
        const Icon = expenseIcon(e.description);
        const swiped = swipedExpenseId === e.id;
        return (
          <div key={e.id} className="relative rounded-2xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-[10px] font-black text-white bg-[var(--color-owner-primary)] px-2.5 py-1 rounded-lg flex items-center gap-1"><Pencil className="w-3 h-3" /> تعديل</span>
              <span className="text-[10px] font-black text-white bg-rose-500 px-2.5 py-1 rounded-lg flex items-center gap-1">حذف <Trash2 className="w-3 h-3" /></span>
            </div>
            <motion.div
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} dragSnapToOrigin
              onDragEnd={(_e, info) => {
                if (info.offset.x < -60) onDeleteExpense?.(e.id);
                else if (info.offset.x > 60) openEditExpense(e);
              }}
              onClick={() => setSwipedExpenseId(swiped ? null : e.id)}
              className="relative bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-owner-hover)] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[var(--color-owner-primary)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] font-black text-[var(--color-owner-text)] truncate">{e.description}</div>
                  <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold">{e.expenseDate}</div>
                </div>
              </div>
              <span className="text-[11px] font-black text-rose-600 shrink-0">− {e.amount.toLocaleString()} ج.م</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );

  // Add / edit expense bottom sheet — reused by both the overview and the
  // dedicated expenses page.
  const addExpenseSheet = (
    <BottomSheet open={showAddExpense} onClose={() => { setShowAddExpense(false); setEditingExpenseId(null); }} title={editingExpenseId ? 'تعديل المصروف' : 'إضافة مصروف'}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => setExpDesc(c.label)}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full border border-[var(--color-owner-border)] text-[var(--color-owner-text)] bg-[var(--color-owner-bg)]">
              <c.icon className="w-3 h-3" /> {c.label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="وصف المصروف" value={expDesc} onChange={(e) => setExpDesc(e.target.value)}
          className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[11px] px-3 py-2.5 rounded-xl text-[var(--color-owner-text)] outline-none" />
        <input type="number" min={0} placeholder="المبلغ (ج.م)" value={expAmount} onChange={(e) => setExpAmount(e.target.value)}
          className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[11px] px-3 py-2.5 rounded-xl text-[var(--color-owner-text)] outline-none" />
        <button type="button" onClick={submitExpense}
          className="w-full bg-[var(--color-owner-primary)] text-white text-[11px] font-black py-3 rounded-2xl">
          {editingExpenseId ? 'حفظ التعديل' : 'إضافة المصروف'}
        </button>
      </div>
    </BottomSheet>
  );

  // ── Dedicated, isolated Expenses page within the Financial Center ──
  if (showExpensesPage) {
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setShowExpensesPage(false)}
            className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-owner-secondary)] hover:text-[var(--color-owner-text)]">
            <ChevronDown className="w-4 h-4 rotate-90" /> رجوع للمركز المالي
          </button>
          <button type="button" onClick={openAddExpense}
            className="flex items-center gap-1 bg-[var(--color-owner-primary)] text-white text-[10.5px] font-black px-3 py-2 rounded-xl active:scale-[0.98] transition-transform">
            <Plus className="w-3.5 h-3.5" /> إضافة مصروف
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-[var(--color-owner-primary)]" /> المصروفات
          </h2>
          <span className="text-[10px] font-bold text-[var(--color-owner-secondary)]">الإجمالي: {totalExpenses.toLocaleString()} ج.م</span>
        </div>

        {expenseListJsx}

        <div className="flex items-center justify-between bg-[var(--color-owner-primary)]/10 border-2 border-[var(--color-owner-primary)]/25 rounded-2xl p-3.5">
          <span className="text-[11px] font-black text-[var(--color-owner-primary)]">صافي الربح (بعد المصروفات)</span>
          <Money value={netProfit} className="text-sm font-black text-[var(--color-owner-primary)]" />
        </div>

        <p className="text-[9.5px] text-[var(--color-owner-secondary)] font-bold text-center">اسحب المصروف لليمين للتعديل، ولليسار للحذف.</p>

        {addExpenseSheet}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Title */}
      <div>
        <h2 className="text-base font-black text-[var(--color-owner-text)]">المركز المالي</h2>
        <p className="text-[11px] text-[var(--color-owner-secondary)] mt-0.5">نظرة شاملة على حساباتك</p>
      </div>

      {/* ── Section 1: Premium Wallet ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-[26px] p-5 text-white" style={{ background: 'linear-gradient(135deg, #1F2E4E 0%, #16223B 60%, #0F1830 100%)' }}>
        <div className="absolute -left-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute -left-2 top-16 w-20 h-20 rounded-full bg-[#D4AF37]/10" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-1.5 text-white/70 text-[11px] font-bold">
            صافي مستحقاتك
            <Info className="w-3 h-3" />
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#D4AF37]" />
          </div>
        </div>

        <div className="relative mt-1.5 flex items-baseline gap-2">
          <Money value={netOwnerPayout} className="text-[34px] font-black leading-none" />
          <span className="text-sm font-bold text-white/70">ج.م</span>
          <TrendBadge pct={pct('net')} />
        </div>

        <div className="relative grid grid-cols-2 gap-2 mt-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5">
            <div className="text-[9px] text-white/60 font-bold">الرصيد المتاح للتحويل عبر Pima</div>
            <div className="text-sm font-black mt-0.5">{availableForTransfer.toLocaleString()} ج.م</div>
            <div className="text-[8px] text-white/45 font-bold mt-0.5">الباقي يُحصَّل نقدًا عند الوصول</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5">
            <div className="text-[9px] text-white/60 font-bold">إجمالي الحجوزات</div>
            <div className="text-sm font-black mt-0.5">{confirmedRevenue.toLocaleString()} ج.م</div>
          </div>
        </div>

        <div className="relative flex gap-2 mt-3">
          <button type="button" onClick={onNavigateSupport}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#D4AF37] text-[#1F2E4E] text-[11px] font-black py-2.5 rounded-2xl active:scale-[0.98] transition-transform">
            <ArrowUpRight className="w-3.5 h-3.5" /> طلب تحويل الآن
          </button>
          <button type="button" onClick={() => { closeAllSheets(); setShowHistorySheet(true); }}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 border border-white/15 text-white text-[11px] font-black py-2.5 rounded-2xl active:scale-[0.98] transition-transform">
            <History className="w-3.5 h-3.5" /> سجل التحويلات
          </button>
        </div>

        <div className="relative flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/10 text-[11px] font-bold">
          <span>{confirmedRevenue.toLocaleString()}</span>
          <span className="text-white/40">−</span>
          <span className="text-[#D4AF37]">{platformCommissionAmount.toLocaleString()}</span>
          <span className="text-white/40">=</span>
          <span className="text-emerald-400">{netOwnerPayout.toLocaleString()}</span>
        </div>
        <div className="relative flex items-center justify-center gap-4 mt-1 text-[8.5px] text-white/50 font-bold">
          <span>إجمالي الحجوزات</span><span>عمولة Pima</span><span>صافي مستحقاتك</span>
        </div>
      </div>

      {/* ── Section 2: Financial Journey ────────────────────────── */}
      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4">
        <h3 className="text-xs font-black text-[var(--color-owner-text)] mb-4">رحلة الأموال</h3>
        <div className="flex items-start justify-between" dir="ltr">
          {[
            { icon: CreditCard, label: 'دفع العربون عبر Pima', color: '#1F2E4E' },
            { icon: Receipt, label: `احتساب عمولة Pima (${Math.round(commissionRate * 100)}%)`, color: '#D4AF37' },
            { icon: Banknote, label: 'المبلغ المتبقي يُدفع لصاحب البيت عند الوصول', color: '#22C55E' },
            { icon: CheckCircle2, label: 'صافي مستحقات صاحب البيت', color: '#22C55E' },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="flex flex-col items-center gap-2 w-16 text-center"
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${step.color}1A` }}>
                  <step.icon className="w-4.5 h-4.5" style={{ color: step.color }} />
                </div>
                <span className="text-[8.5px] font-bold text-[var(--color-owner-secondary)] leading-tight" dir="rtl">{step.label}</span>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: i * 0.12 + 0.1, duration: 0.35 }}
                  className="flex-1 h-0.5 bg-[var(--color-owner-border)] mt-5 origin-left" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Section 3: Statistics ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { icon: Coins, label: 'إجمالي الحجوزات', value: confirmedRevenue, key: 'revenue' as const, color: '#1F2E4E' },
          { icon: CreditCard, label: 'العربون المحصل عبر Pima', value: depositReceived, key: 'deposit' as const, color: '#1F2E4E' },
          { icon: Banknote, label: 'المتبقي للتحصيل', value: remainingBalance, key: 'remaining' as const, color: '#F59E0B' },
          { icon: Receipt, label: 'عمولة Pima', value: platformCommissionAmount, key: 'commission' as const, color: '#D4AF37' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${s.color}1A` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <TrendBadge pct={pct(s.key)} />
            </div>
            <div className="text-[9.5px] text-[var(--color-owner-secondary)] font-bold">{s.label}</div>
            <Money value={s.value} className="text-base font-black text-[var(--color-owner-text)] block" />
          </div>
        ))}
        <div className="col-span-2 bg-emerald-50 rounded-2xl border border-emerald-200 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-[9.5px] text-emerald-800 font-bold">صافي المستحقات</div>
              <Money value={netOwnerPayout} className="text-base font-black text-emerald-900 block" />
            </div>
          </div>
          <TrendBadge pct={pct('net')} />
        </div>
      </div>

      {/* ── Section 4: Expected Cash Today ──────────────────────── */}
      {arrivalsToday.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-amber-700" />
            </div>
            <p className="text-[11px] font-bold text-amber-900">
              اليوم لديك {guestsToday} {guestsToday === 1 ? 'ضيف' : 'ضيوف'} سيصلون.
            </p>
          </div>
          <div className="bg-white/60 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-800">المبلغ المتوقع تحصيله نقدًا</span>
            <span className="text-sm font-black text-amber-900">{cashExpectedToday.toLocaleString()} ج.م</span>
          </div>
          <button type="button" onClick={() => setPeriod('today')}
            className="w-full text-[10.5px] font-black text-amber-900 bg-amber-100 rounded-xl py-2">عرض التفاصيل</button>
        </div>
      )}

      {/* ── Section 5: Analytics ────────────────────────────────── */}
      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">الإيرادات خلال آخر 6 أشهر</span>
        </div>
        <svg viewBox="0 0 300 90" className="w-full h-24" preserveAspectRatio="none">
          {(() => {
            const max = Math.max(1, ...monthlyAgg.map((m) => m.net));
            const pts = monthlyAgg.map((m, i) => {
              const x = (i / (monthlyAgg.length - 1)) * 290 + 5;
              const y = 80 - (m.net / max) * 70;
              return { x, y };
            });
            const points = pts.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <>
                <motion.polyline points={points} fill="none" stroke="var(--color-owner-primary)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
                {pts.map((p, i) => (
                  <motion.circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-owner-accent)"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * i + 0.4 }} />
                ))}
              </>
            );
          })()}
        </svg>
        <div className="flex justify-between text-[9px] text-[var(--color-owner-secondary)] font-bold px-1">
          {months.map((m) => <span key={`${m.year}-${m.month}`}>{m.label}</span>)}
        </div>
      </div>

      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">توزيع إجمالي الحجوزات</span>
        </div>
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-owner-bg)" strokeWidth="12" />
            <motion.circle cx="50" cy="50" r={r} fill="none" stroke="#D4AF37" strokeWidth="12"
              strokeDasharray={circumference} strokeLinecap="round"
              initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference * netShare }}
              transition={{ duration: 0.9, ease: 'easeOut' }} />
            <motion.circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-owner-primary)" strokeWidth="12"
              strokeDasharray={circumference} strokeLinecap="round"
              initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: -circumference * (1 - netShare) }}
              style={{ transform: `rotate(${netShare * 360}deg)`, transformOrigin: '50px 50px' }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }} />
          </svg>
          <div className="space-y-2 text-[10.5px] font-bold flex-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--color-owner-text)]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-owner-primary)' }} /> صافي مستحقاتك
              </span>
              <span>{Math.round(netShare * 100)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--color-owner-secondary)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" /> عمولة Pima
              </span>
              <span>{Math.round((1 - netShare) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 6: Filters ──────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[10.5px] font-black border transition-colors ${
                period === p.key ? 'bg-[var(--color-owner-primary)] text-white border-[var(--color-owner-primary)]' : 'bg-[var(--color-owner-surface)] text-[var(--color-owner-secondary)] border-[var(--color-owner-border)]'
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--color-owner-secondary)] absolute right-3 top-1/2 -translate-y-1/2" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الحجز أو اسم الضيف"
            className="w-full bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl pr-9 pl-3 py-2.5 text-[11px] text-[var(--color-owner-text)] outline-none focus:border-[var(--color-owner-primary)]" />
        </div>
      </div>

      {/* ── Section 7: Transactions ─────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-black text-[var(--color-owner-text)]">العمليات المالية</h3>
        {filteredBookings.length === 0 ? (
          <div className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-6 text-center text-[11px] text-[var(--color-owner-secondary)] font-bold">
            لا توجد عمليات مطابقة.
          </div>
        ) : filteredBookings.map((b) => {
          const comm = b.totalPrice * commissionRate;
          const net = b.totalPrice - comm;
          const remaining = Math.max(0, b.totalPrice - b.depositAmount);
          const badge = bookingStatusBadge(b);
          return (
            <button key={b.id} type="button" onClick={() => { closeAllSheets(); setOpenBookingId(b.id); }}
              className="w-full text-right bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[11.5px] font-black text-[var(--color-owner-text)]">{bookingGuestName(b)}</div>
                  <div className="text-[9px] text-[var(--color-owner-secondary)] font-bold font-mono">{bookingRef(b)} · {b.checkIn}</div>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { label: 'القيمة', value: b.totalPrice },
                  { label: 'العربون', value: b.depositAmount },
                  { label: 'المتبقي', value: remaining },
                  { label: 'صافيك', value: net },
                ].map((c) => (
                  <div key={c.label} className="bg-[var(--color-owner-bg)] rounded-lg py-1.5">
                    <div className="text-[8px] text-[var(--color-owner-secondary)] font-bold">{c.label}</div>
                    <div className="text-[10px] font-black text-[var(--color-owner-text)]">{c.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Section 8: Expenses — compact entry into the dedicated page ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-[var(--color-owner-text)]">المصروفات</h3>
          <button type="button" onClick={openAddExpense}
            className="flex items-center gap-1 bg-[var(--color-owner-primary)] text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg active:scale-[0.98] transition-transform">
            <Plus className="w-3 h-3" /> إضافة
          </button>
        </div>

        <button type="button" onClick={() => setShowExpensesPage(true)}
          className="w-full flex items-center gap-3 bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3.5 text-right active:scale-[0.99] transition-transform">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-rose-50 text-rose-600"><Receipt className="w-4.5 h-4.5" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-black text-[var(--color-owner-text)]">إدارة المصروفات</div>
            <div className="text-[9.5px] font-bold text-[var(--color-owner-secondary)]">{ownerExpenses.length} مصروف · إجمالي {totalExpenses.toLocaleString()} ج.م</div>
          </div>
          <ChevronDown className="w-4 h-4 text-[var(--color-owner-secondary)] -rotate-90 shrink-0" />
        </button>

        <div className="flex items-center justify-between bg-[var(--color-owner-primary)]/10 border-2 border-[var(--color-owner-primary)]/25 rounded-2xl p-3.5">
          <span className="text-[11px] font-black text-[var(--color-owner-primary)]">صافي الربح (بعد المصروفات)</span>
          <Money value={netProfit} className="text-sm font-black text-[var(--color-owner-primary)]" />
        </div>
      </div>

      {/* ── Section 9: Pima Smart Insights ──────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-black text-[var(--color-owner-text)] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> اقتراحات Pima
        </h3>
        <div className="space-y-1.5">
          {topBookingThisMonth && (
            <div className="flex items-center gap-2.5 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl p-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><ArrowUpRight className="w-4 h-4 text-amber-600" /></div>
              <p className="text-[10.5px] font-bold text-[var(--color-owner-text)]">
                حجز {bookingGuestName(topBookingThisMonth)} حقق أعلى إيراد هذا الشهر ({topBookingThisMonth.totalPrice.toLocaleString()} ج.م).
              </p>
            </div>
          )}
          {expensesPct !== null && expensesPct !== 0 && (
            <div className="flex items-center gap-2.5 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl p-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${expensesPct < 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                {expensesPct < 0 ? <ArrowDownRight className="w-4 h-4 text-emerald-600" /> : <ArrowUpRight className="w-4 h-4 text-rose-600" />}
              </div>
              <p className="text-[10.5px] font-bold text-[var(--color-owner-text)]">
                المصروفات {expensesPct < 0 ? 'أقل' : 'أعلى'} {Math.abs(expensesPct)}٪ من الشهر الماضي.
              </p>
            </div>
          )}
          {cashExpectedToday > 0 && (
            <div className="flex items-center gap-2.5 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl p-3">
              <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center shrink-0"><Banknote className="w-4 h-4 text-sky-600" /></div>
              <p className="text-[10.5px] font-bold text-[var(--color-owner-text)]">
                التحصيل النقدي المتوقع اليوم {cashExpectedToday.toLocaleString()} ج.م.
              </p>
            </div>
          )}
          {pct('net') !== null && (
            <div className="flex items-center gap-2.5 bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] rounded-2xl p-3">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0"><TrendingUp className="w-4 h-4 text-violet-600" /></div>
              <p className="text-[10.5px] font-bold text-[var(--color-owner-text)]">
                صافي مستحقاتك {(pct('net') ?? 0) >= 0 ? 'ارتفع' : 'انخفض'} {Math.abs(pct('net') ?? 0)}٪ عن الشهر الماضي.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Booking bottom sheet ─────────────────────────────────── */}
      <BottomSheet open={!!openBooking} onClose={() => setOpenBookingId(null)} title="ملخص الحجز">
        {openBooking && (() => {
          const comm = openBooking.totalPrice * commissionRate;
          const net = openBooking.totalPrice - comm;
          const remaining = Math.max(0, openBooking.totalPrice - openBooking.depositAmount);
          const steps = [
            { label: 'تم إنشاء الحجز', done: true, date: openBooking.createdAt.split('T')[0] },
            { label: 'تم دفع العربون', done: openBooking.depositPaid, date: null },
            { label: 'وصول الضيف', done: !!openBooking.checkedInAt, date: openBooking.checkedInAt?.split('T')[0] ?? null },
            { label: 'المغادرة وتحصيل المتبقي', done: !!openBooking.checkedOutAt, date: openBooking.checkedOutAt?.split('T')[0] ?? null },
          ];
          return (
            <div className="space-y-4">
              <div className="bg-[var(--color-owner-bg)] rounded-2xl p-3.5 space-y-2 text-[11px] font-bold">
                {[
                  { label: 'قيمة الحجز', value: openBooking.totalPrice },
                  { label: 'العربون', value: openBooking.depositAmount },
                  { label: 'المتبقي', value: remaining },
                  { label: 'عمولة Pima', value: -comm },
                  { label: 'صافي مستحقاتك', value: net, bold: true },
                ].map((row) => (
                  <div key={row.label} className={`flex items-center justify-between ${row.bold ? 'pt-2 border-t border-[var(--color-owner-border)]' : ''}`}>
                    <span className={row.bold ? 'text-[var(--color-owner-text)] font-black' : 'text-[var(--color-owner-secondary)]'}>{row.label}</span>
                    <span className={row.bold ? 'text-emerald-700 font-black text-sm' : 'text-[var(--color-owner-text)]'}>
                      {row.value < 0 ? '− ' : ''}{Math.abs(row.value).toLocaleString()} ج.م
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-[var(--color-owner-text)]">مسار الحجز</h4>
                {steps.map((s, i) => (
                  <div key={s.label} className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${s.done ? 'bg-emerald-500' : 'bg-[var(--color-owner-border)]'}`}>
                        {s.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      {i < steps.length - 1 && <div className={`w-0.5 h-6 ${s.done ? 'bg-emerald-500' : 'bg-[var(--color-owner-border)]'}`} />}
                    </div>
                    <div className="pt-0.5">
                      <div className={`text-[10.5px] font-bold ${s.done ? 'text-[var(--color-owner-text)]' : 'text-[var(--color-owner-secondary)]'}`}>{s.label}</div>
                      {s.date && <div className="text-[9px] text-[var(--color-owner-secondary)]">{s.date}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── Transfer history sheet (honest empty-state — no payout ledger exists yet) ── */}
      <BottomSheet open={showHistorySheet} onClose={() => setShowHistorySheet(false)} title="سجل التحويلات">
        <div className="text-center py-6 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-owner-hover)] flex items-center justify-center mx-auto"><History className="w-5 h-5 text-[var(--color-owner-secondary)]" /></div>
          <p className="text-[11px] font-bold text-[var(--color-owner-secondary)]">لا توجد تحويلات مسجلة بعد.</p>
          <button type="button" onClick={() => { setShowHistorySheet(false); onNavigateSupport?.(); }}
            className="text-[10.5px] font-black text-[var(--color-owner-primary)] underline">تواصل مع الدعم لطلب أول تحويل</button>
        </div>
      </BottomSheet>

      {/* ── Add / edit expense sheet (shared) ────────────────────── */}
      {addExpenseSheet}
    </div>
  );
}

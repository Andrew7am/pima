import React from 'react';
import { Search, MessageCircle, Check, CheckCheck } from 'lucide-react';

// Shared building blocks for the chat module. Everything the conversations list
// and the thread both draw lives here once, so a radius or a shadow is changed
// in a single place rather than drifting between two screens.
//
// The tokens below are the module's whole visual vocabulary. They are values,
// not components, because Tailwind needs literal class strings — a computed
// class name never reaches the compiled stylesheet.
export const CHAT = {
  cream: '#FBF9F4',
  surface: '#FFFFFF',
  border: '#EDE7DA',
  ink: '#2D2D24',
  ink2: '#6B6B57',
  muted: '#8A8A70',
  gold: '#C5A059',
  goldDeep: '#B8944E',
  // One shadow for every raised surface in the module.
  shadow: 'shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]',
  radius: 'rounded-2xl',
} as const;

/** Circular avatar with an optional presence dot. Falls back to the initial. */
export function PimaAvatar({
  name, src, size = 48, online, ring,
}: { name: string; src?: string; size?: number; online?: boolean; ring?: boolean }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className={`block w-full h-full rounded-full overflow-hidden bg-[#EDE7DA] text-[#B8944E] font-black flex items-center justify-center ${
          ring ? 'ring-2 ring-[#C5A059]/45' : ''
        }`}
        style={{ fontSize: size * 0.34 }}
      >
        {src
          ? <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />
          : name.charAt(0)}
      </span>
      {online && <PimaOnlineIndicator />}
    </span>
  );
}

/** Presence dot. Breathes every 4s rather than blinking — see index.css. */
export function PimaOnlineIndicator() {
  return (
    <span
      aria-label="متصل الآن"
      className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white pima-pulse-slow"
    />
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  // Muted on purpose: a status is context, not an alarm.
  approved:  { label: 'مؤكد',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:   { label: 'قيد المراجعة', cls: 'bg-[#FBF3E2] text-[#8A6A22] border-[#EBD9B4]' },
  cancelled: { label: 'ملغي',    cls: 'bg-rose-50/70 text-rose-700/80 border-rose-200/70' },
  rejected:  { label: 'مرفوض',   cls: 'bg-rose-50/70 text-rose-700/80 border-rose-200/70' },
  completed: { label: 'منتهي',   cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function PimaStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[9.5px] font-black ${s.cls}`}>
      {status === 'approved' && <Check className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

/** Read receipt: one tick sent, two delivered, two blue read. */
export function PimaReceipt({ read }: { read?: boolean }) {
  return read
    ? <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-label="تمت القراءة" />
    : <Check className="w-3.5 h-3.5 text-[#B5AF98] shrink-0" aria-label="تم الإرسال" />;
}

/** Shimmer placeholder. Slow and low-contrast — a loading state should not
 *  perform. Width comes from the caller so a skeleton can mimic real content. */
export function PimaSkeleton({ className = '' }: { className?: string }) {
  return <span className={`block rounded-lg bg-[#EFE9DC] pima-shimmer ${className}`} aria-hidden="true" />;
}

/** Conversation-row skeleton — mirrors the real row's geometry so the list does
 *  not jump when the data lands. */
export function PimaLoadingRow() {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <PimaSkeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <PimaSkeleton className="h-3 w-2/5" />
        <PimaSkeleton className="h-2.5 w-3/4" />
      </div>
    </div>
  );
}

export function PimaEmptyState({
  title, body, action,
}: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="bg-white border border-[#EDE7DA] rounded-3xl px-6 py-10 text-center">
      <span className="inline-flex w-14 h-14 rounded-full bg-[#F6F0E2] items-center justify-center mb-3">
        <MessageCircle className="w-6 h-6 text-[#C5A059]" />
      </span>
      <p className="text-[13px] font-black text-[#2D2D24]">{title}</p>
      <p className="text-[10.5px] font-bold text-[#8A8A70] mt-1 leading-relaxed">{body}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white font-black rounded-2xl px-5 py-2.5 text-[11.5px] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] pima-press"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function PimaFilterChip({
  label, active, count, onClick,
}: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      // 40px tall inside a 48px row: comfortably tappable without turning a
      // filter strip into a toolbar.
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 h-10 text-[11px] font-black transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] pima-press ${
        active
          ? 'bg-gradient-to-b from-[#C9A96A] to-[#B8944E] text-white'
          : 'bg-white text-[#4A4A3A] border border-[#EDE7DA]'
      }`}
    >
      {label}
      {count ? (
        <span className={`min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
          active ? 'bg-white/25 text-white' : 'bg-[#F6F0E2] text-[#B8944E]'
        }`}>{count}</span>
      ) : null}
    </button>
  );
}

export function PimaSearchBar({
  value, onChange, placeholder, id,
}: { value: string; onChange: (v: string) => void; placeholder: string; id?: string }) {
  return (
    <div className="relative">
      <Search className="w-4 h-4 text-[#B5AF98] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 bg-white border border-[#EDE7DA] rounded-2xl pr-10 pl-3 text-[12px] text-[#2D2D24] placeholder:text-[#B5AF98] outline-none focus:border-[#C9A96A] transition-colors duration-[250ms]"
      />
    </div>
  );
}

export function PimaSectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-black text-[#8A8A70] px-1">{children}</h3>;
}

export function PimaQuickReplyChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full border border-[#EDE7DA] bg-white px-3.5 h-9 text-[11px] font-bold text-[#4A4A3A] hover:border-[#C9A96A] transition-colors duration-[250ms] pima-press"
    >
      {label}
    </button>
  );
}

export interface TimelineStep { label: string; date?: string; done: boolean }

/** Booking timeline. Reads right-to-left with the connector behind the marks,
 *  so a half-finished booking shows its progress at a glance. */
export function PimaTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative flex items-start justify-between gap-1">
      <span aria-hidden="true" className="absolute top-[9px] inset-x-4 h-px bg-[#EDE7DA]" />
      {steps.map((s) => (
        <li key={s.label} className="relative flex flex-col items-center gap-1 flex-1 min-w-0">
          <span className={`w-[18px] h-[18px] rounded-full border-2 bg-white flex items-center justify-center ${
            s.done ? 'border-[#B8944E]' : 'border-[#E0D9C8]'
          }`}>
            {s.done && <span className="w-2 h-2 rounded-full bg-gradient-to-b from-[#C9A96A] to-[#B8944E]" />}
          </span>
          <span className={`text-[8.5px] font-black text-center leading-tight ${s.done ? 'text-[#2D2D24]' : 'text-[#B5AF98]'}`}>{s.label}</span>
          {s.date && <span className="text-[8px] font-bold text-[#B5AF98] text-center leading-none">{s.date}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Floating date capsule between message groups. */
export function PimaDateCapsule({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="rounded-full bg-white/75 backdrop-blur-md border border-white/80 px-3 py-1 text-[9.5px] font-black text-[#6B6B57] shadow-[0_2px_8px_rgba(45,45,36,0.06)]">
        {label}
      </span>
    </div>
  );
}

/** Three dots, staggered opacity — never a GIF. */
export function PimaTypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="يكتب الآن">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#B5AF98] pima-typing-dot" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}

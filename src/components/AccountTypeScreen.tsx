import type { ReactNode } from 'react';

/**
 * Account-type chooser — the screen a new visitor meets before the signup form.
 *
 * The form already has a three-way role control; this screen exists because
 * that control is a row of chips halfway down a long form, and the choice it
 * carries is the one a house owner cannot afford to get wrong. Choosing wrong
 * lands you in an account with nowhere to add a house.
 *
 * Navigation is a prop, not a route. Every other screen in this app receives
 * its actions from App.tsx the same way (onReleaseUser, onSetHouseDiscount);
 * introducing a router for one screen would be the odd one out.
 */

export type AccountRole = 'individual' | 'servant' | 'owner';

/* Brand values, not approximations — these are the ones Logo.tsx draws with. */
const NAVY = '#0A2342';
const GOLD = '#C5A059';

/* Per-card accent. Gold leads because the individual account is the common
   case; mauve and teal are desaturated so no card outranks another visually. */
const ACCENT: Record<AccountRole, string> = {
  individual: GOLD,
  servant: '#9B8299',
  owner: '#7FA39B',
};

interface Choice {
  role: AccountRole;
  title: string;
  /* Two lines, broken where the reference breaks them — the wrap is part of
     the layout, not an accident of width. */
  description: string;
  icon: ReactNode;
}

/* ── icons ────────────────────────────────────────────────────────────────
   Line art at a common 48-unit box and stroke weight, so the three read as
   one set rather than three borrowed glyphs. */

const IconPerson = (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-full h-full">
    <circle cx="24" cy="16" r="7.5" stroke="currentColor" strokeWidth="2.4" />
    <path d="M10.5 39c0-6.6 6-11.5 13.5-11.5S37.5 32.4 37.5 39"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const IconBible = (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-full h-full">
    <path d="M24 14.5C20.5 11.8 16.6 10.6 11 10.5v25c5.6.1 9.5 1.3 13 4 3.5-2.7 7.4-3.9 13-4v-25c-5.6.1-9.5 1.3-13 3.9Z"
          stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M24 14.5v25" stroke="currentColor" strokeWidth="2.4" />
    <path d="M28.5 20v7M25 23.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconHouse = (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="w-full h-full">
    <path d="M9 22 24 10l15 12v15.5c0 .8-.7 1.5-1.5 1.5h-27c-.8 0-1.5-.7-1.5-1.5V22Z"
          stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M20 39v-8.5c0-2.2 1.8-4 4-4s4 1.8 4 4V39"
          stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
  </svg>
);

const CHOICES: Choice[] = [
  {
    role: 'individual',
    title: 'فرد',
    description: 'للبحث عن البيوت والمؤتمرات\nوالحجز بسهولة وراحة',
    icon: IconPerson,
  },
  {
    role: 'servant',
    title: 'خادم',
    description: 'لإدارة الحجوزات والخدمات\nوالأنشطة بكل تنظيم',
    icon: IconBible,
  },
  {
    role: 'owner',
    title: 'صاحب بيت',
    description: 'لعرض وإدارة بيتك واستقبال\nالحجوزات باحترافية',
    icon: IconHouse,
  },
];

/* ── header ───────────────────────────────────────────────────────────── */

function PimaLogoHeader() {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0" aria-label="بيما">
      <svg width="60" height="52" viewBox="0 0 160 130" fill="none" aria-hidden="true">
        <path d="M25 65 L80 20 L135 65 V110 C135 112.2 133.2 114 131 114 H29 C26.8 114 25 112.2 25 110 V65 Z"
              stroke={NAVY} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <g transform="translate(80, 62) scale(1.05)">
          <path d="M-3.5,-6 L-3.5,-20 C-3.5,-21.5 3.5,-21.5 3.5,-20 L3.5,-6 Z" fill={GOLD} />
          <path d="M-3.5,-6 L-3.5,22 C-3.5,23 3.5,23 3.5,22 L3.5,-6 Z" fill={GOLD} />
          <path d="M-16,-6 L16,-6 C17.5,-6 17.5,1 16,1 L-16,1 C-17.5,1 -17.5,-6 -16,-6 Z" fill={GOLD} />
          <circle cx="0" cy="-3" r="3.2" fill="#FDFBF7" />
        </g>
      </svg>
      <div className="text-[1.35rem] font-black leading-none tracking-wide" style={{ color: NAVY }}>
        PiMa
      </div>
      <div className="text-[0.68rem] font-extrabold" style={{ color: GOLD }}>بيتك معنا</div>
    </div>
  );
}

function WelcomeHeader() {
  return (
    <header className="flex flex-col items-center text-center gap-2">
      <h1 className="text-[1.75rem] leading-tight font-black tracking-tight" style={{ color: NAVY }}>
        مرحبًا بك في <span style={{ color: GOLD }}>بيما</span>
      </h1>
      <p className="text-[0.94rem] font-medium" style={{ color: '#8A8272' }}>
        اختر نوع الحساب الذي يناسبك للمتابعة
      </p>
      {/* the flourish from the reference — a hairline with a small cross at centre */}
      <svg width="150" height="14" viewBox="0 0 150 14" fill="none" aria-hidden="true" className="mt-1">
        <path d="M4 7h56M90 7h56" stroke={GOLD} strokeWidth="1" strokeLinecap="round" opacity=".55" />
        <path d="M75 2.5v9M70.5 7h9" stroke={GOLD} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="66" cy="7" r="1.2" fill={GOLD} />
        <circle cx="84" cy="7" r="1.2" fill={GOLD} />
      </svg>
    </header>
  );
}

/* ── card ─────────────────────────────────────────────────────────────── */

function AccountTypeCard({ choice, onSelect }: { choice: Choice; onSelect: (r: AccountRole) => void }) {
  const accent = ACCENT[choice.role];
  return (
    <button
      type="button"
      onClick={() => onSelect(choice.role)}
      aria-label={`${choice.title} — ${choice.description.replace(/\n/g, ' ')}`}
      /* Translucent, not solid. A card that fully blocks the artwork turns the
         window into something you only see between cards; at 80% with a small
         blur it reads as glass laid over the light, and the navy title still
         measures well clear of AA against the lightest patch behind it. */
      className="group relative w-full min-h-[7.4rem] flex items-center gap-2.5 text-right
                 rounded-[1.55rem] bg-[#FEFDFB]/80 backdrop-blur-[6px]
                 px-3 py-4 overflow-hidden cursor-pointer
                 border border-white/50
                 shadow-[0_4px_22px_-6px_rgba(13,35,67,.16)]
                 transition-transform duration-200 active:scale-[.985]
                 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outlineColor: accent }}
    >
      {/* The coloured corner. Small: it marks the card, it is not a feature of
          it — at the size a full semicircle wants to be, it outweighs the icon
          and the three cards stop reading as one set. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-[5.2rem] h-[1.15rem]
                   rounded-tr-[4rem] rounded-bl-[1.55rem]"
        style={{ backgroundColor: accent, opacity: 0.95 }}
      />

      {/* Gold, on every card. The accent lives in the corner sliver alone —
          tinting the icon too made the mauve and teal cards read as three
          different products rather than three doors into one. */}
      <span
        aria-hidden="true"
        className="shrink-0 grid place-items-center w-[3.9rem] h-[3.9rem] rounded-full"
        style={{ backgroundColor: '#F6EFE1', color: GOLD }}
      >
        <span className="w-[2.15rem] h-[2.15rem]">{choice.icon}</span>
      </span>

      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[1.22rem] font-black leading-none" style={{ color: NAVY }}>
          {choice.title}
        </span>
        {/* pre-line keeps the two-line break the design sets; the column has to
            stay wide enough that it never adds a third of its own */}
        <span className="text-[0.76rem] leading-[1.5] font-medium whitespace-pre-line" style={{ color: '#8A8272' }}>
          {choice.description}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="relative shrink-0 grid place-items-center w-9 h-9 rounded-full transition-colors"
        style={{ backgroundColor: '#F6EFE1', color: GOLD }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9.5 5 16 12l-6.5 7" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function AccountTypeSelector({ onSelect }: { onSelect: (r: AccountRole) => void }) {
  return (
    <div className="flex flex-col gap-3.5" role="group" aria-label="أنواع الحسابات">
      {CHOICES.map((c) => <AccountTypeCard key={c.role} choice={c} onSelect={onSelect} />)}
    </div>
  );
}

/* ── footer ───────────────────────────────────────────────────────────── */

const Leaf = ({ flip = false }: { flip?: boolean }) => (
  <svg width="26" height="16" viewBox="0 0 26 16" fill="none" aria-hidden="true"
       style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M25 3c-9-2-17 1-21 8" stroke={GOLD} strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
    <path d="M18 3.5c-1.5-1.6-4-2-5.6-.8M13 5.6c-1.8-1.2-4.2-1-5.5.6M8.6 9c-1.9-.7-4 0-4.9 1.8"
          stroke={GOLD} strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
  </svg>
);

function ClosingLine() {
  return (
    <div className="flex items-center justify-center gap-2.5 px-2">
      <Leaf />
      <p className="text-[0.8rem] font-bold text-center" style={{ color: '#9A8F79' }}>
        معًا نخدم... ومعًا نبني ذكريات جميلة
      </p>
      <Leaf flip />
    </div>
  );
}

/** Thin-line village: church, houses, trees. Decorative only. */
function BottomIllustration() {
  return (
    <svg viewBox="0 0 390 74" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMax meet"
         className="w-full h-[4.6rem]"
         style={{ color: GOLD, opacity: 0.42 }}>
      <g stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round" fill="none">
        {/* church, centre */}
        <path d="M170 70V38l25-17 25 17v32" />
        <path d="M195 21V12M191 15.5h8" />
        <path d="M188 70V54c0-3.9 3.1-7 7-7s7 3.1 7 7v16" />
        {/* houses right */}
        <path d="M232 70V50l14-11 14 11v20M270 70V55l11-9 11 9v15" />
        <path d="M246 39v-5M281 46v-4" />
        {/* houses left */}
        <path d="M104 70V52l14-11 14 11v18M66 70V56l11-9 11 9v14" />
        {/* trees */}
        <path d="M42 70V57M42 57c-6 0-9-4-9-8s4-8 9-8 9 4 9 8-3 8-9 8Z" />
        <path d="M312 70V58M312 58c-5 0-8-3.5-8-7s3.5-7 8-7 8 3.5 8 7-3 7-8 7Z" />
        <path d="M348 70V60M348 60c-4 0-6.5-3-6.5-6s3-6 6.5-6 6.5 3 6.5 6-2.5 6-6.5 6Z" />
        {/* ground */}
        <path d="M8 70h374" opacity=".5" />
      </g>
    </svg>
  );
}

function PaginationIndicator({ active = 1, count = 3 }: { active?: number; count?: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={i === active
            ? { width: '0.44rem', height: '0.44rem', backgroundColor: GOLD }
            : { width: '0.36rem', height: '0.36rem', backgroundColor: '#D8CFBC' }}
        />
      ))}
    </div>
  );
}

/* ── screen ───────────────────────────────────────────────────────────── */

export default function AccountTypeScreen({ onSelect }: { onSelect: (role: AccountRole) => void }) {
  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] w-full flex justify-center"
      style={{ backgroundColor: '#FBF7F0' }}
    >
      {/* Mobile-shaped even on a desktop window — this is a phone screen, and
          letting the cards run to 1200px would make it a web page. */}
      <div className="relative w-full max-w-[26rem] flex flex-col overflow-hidden">

        {/* Church light, upper start corner. Painted, not photographed: a real
            image here competed with the cards at every opacity we tried. */}
        {/* The church window, from the design. It fills the screen at its own
            framing rather than being cropped to a band: the artwork is already
            a full phone portrait — window in the upper start corner, plain
            cream below — so cropping it only enlarged the window and pushed it
            under the title. No mask for the same reason; the fade is painted
            into the file.

            A plain <img> rather than a CSS background so a missing file costs
            nothing: the cream ground is already the right colour and the
            screen still reads complete. */}
        <img
          src="/auth-bg.png"
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="pointer-events-none select-none absolute -top-[9%] left-0 w-full h-[109%] object-cover object-top"
        />

        {/* ~9.5% each side, matching the design. Narrower than this and the
            cards reach over the vase in the artwork behind them — the one part
            of the background that sits low enough for them to cover. */}
        <div className="relative flex flex-col gap-6 px-[9.5%] pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
          {/* start = right under dir="rtl", which is where the reference puts it */}
          <div className="flex justify-start">
            <PimaLogoHeader />
          </div>
          <WelcomeHeader />
          <AccountTypeSelector onSelect={onSelect} />
        </div>

        {/* mt-auto keeps the village on the floor of a tall screen and lets it
            follow the content on a short one, instead of pinning and colliding.
            The cap stops a 932px screen from opening a hole under the cards
            that a 812px one never shows. */}
        <div className="relative mt-auto max-h-[13rem] flex flex-col gap-2 pt-4">
          <ClosingLine />
          <BottomIllustration />
          <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <PaginationIndicator />
          </div>
        </div>
      </div>
    </div>
  );
}

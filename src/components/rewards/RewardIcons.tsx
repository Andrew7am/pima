import React, { useId } from 'react';

/**
 * Illustrated icons for the rewards and passport screens.
 *
 * Drawn rather than imported: lucide's line icons are correct but generic, and
 * a loyalty page is one of the few screens where the artwork IS the product.
 * These are layered SVGs — gradient body, specular highlight, cast shadow —
 * built from the Pima palette so they sit with the rest of the app instead of
 * looking bought.
 *
 * Every gradient id is namespaced with useId(). Two medals on one screen would
 * otherwise both resolve `url(#gold)` to whichever mounted last, and one of
 * them would silently render in the other's colours.
 */

interface IconProps { size?: number; className?: string; }

const NAVY = '#0A2342';
const NAVY_DEEP = '#071931';

/** Shared: a soft specular band that sweeps across a face, clipped by the caller. */
function Shine({ id }: { id: string }) {
  return (
    <g clipPath={`url(#${id})`}>
      <rect className="pima-icon-shine" x="-16" y="-8" width="10" height="80" fill="rgba(255,255,255,0.55)" transform="rotate(18)" />
    </g>
  );
}

/* ── Tier medals ─────────────────────────────────────────────────────────
   One medallion built four ways. The metal changes, the geometry does not —
   so the journey row reads as one ladder rather than four unrelated icons. */

type Metal = 'bronze' | 'silver' | 'gold' | 'diamond';

const METALS: Record<Metal, { light: string; mid: string; dark: string; rim: string }> = {
  bronze:  { light: '#E8C08B', mid: '#C08A4E', dark: '#8E5F2E', rim: '#7A4F24' },
  silver:  { light: '#F2F4F7', mid: '#C3CBD6', dark: '#8E9AAB', rim: '#78838F' },
  gold:    { light: '#F7E3B0', mid: '#D8B063', dark: '#B8944E', rim: '#96762F' },
  diamond: { light: '#EAF0FF', mid: '#A9BEEA', dark: '#6E86C9', rim: '#5468A8' },
};

export function TierMedal({ metal, size = 48, className = '' }: IconProps & { metal: Metal }) {
  const uid = useId().replace(/:/g, '');
  const m = METALS[metal];
  const face = `face-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`body-${uid}`} x1="18" y1="8" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor={m.light} /><stop offset="0.5" stopColor={m.mid} /><stop offset="1" stopColor={m.dark} />
        </linearGradient>
        <radialGradient id={`inner-${uid}`} cx="0.38" cy="0.3" r="0.8">
          <stop stopColor={m.light} /><stop offset="1" stopColor={m.mid} />
        </radialGradient>
        <clipPath id={face}><circle cx="32" cy="30" r="19" /></clipPath>
      </defs>

      {/* Ribbon tails, behind the disc */}
      <path d="M22 42 L16 60 L25 55 L30 61 L33 44 Z" fill={NAVY} />
      <path d="M42 42 L48 60 L39 55 L34 61 L31 44 Z" fill={NAVY_DEEP} />

      {/* Outer rim with notches */}
      <circle cx="32" cy="30" r="23" fill={m.rim} />
      <circle cx="32" cy="30" r="23" fill={`url(#body-${uid})`} opacity="0.9" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x="31" y="5" width="2" height="4" rx="1" fill={m.rim} opacity="0.55"
          transform={`rotate(${i * 30} 32 30)`} />
      ))}

      {/* Face */}
      <circle cx="32" cy="30" r="19" fill={`url(#inner-${uid})`} />
      <circle cx="32" cy="30" r="19" fill="none" stroke={m.rim} strokeWidth="1.2" opacity="0.5" />

      {/* Mark: a Coptic cross for the first three, a cut gem for diamond */}
      {metal === 'diamond' ? (
        <g className="pima-icon-spin" style={{ transformOrigin: '32px 30px' }}>
          <path d="M32 19 L42 28 L32 42 L22 28 Z" fill="#FFFFFF" opacity="0.92" />
          <path d="M32 19 L42 28 L32 28 Z" fill={m.mid} opacity="0.55" />
          <path d="M22 28 L32 28 L32 42 Z" fill={m.dark} opacity="0.4" />
        </g>
      ) : (
        <g fill={NAVY} opacity="0.88">
          <rect x="30" y="19" width="4" height="22" rx="1.4" />
          <rect x="24" y="26" width="16" height="4" rx="1.4" />
          <circle cx="32" cy="17" r="2.6" fill="none" stroke={NAVY} strokeWidth="2.2" />
        </g>
      )}

      <Shine id={face} />
    </svg>
  );
}

/* ── Gift ─────────────────────────────────────────────────────────────── */

export function GiftBox({ size = 48, className = '' }: IconProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`gbox-${uid}`} x1="12" y1="30" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDF6E6" /><stop offset="1" stopColor="#EFDDB9" />
        </linearGradient>
        <linearGradient id={`glid-${uid}`} x1="10" y1="22" x2="54" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFBF1" /><stop offset="1" stopColor="#F0E1BF" />
        </linearGradient>
        <linearGradient id={`grib-${uid}`} x1="24" y1="14" x2="42" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E3CD9F" /><stop offset="0.5" stopColor="#C5A059" /><stop offset="1" stopColor="#A9853E" />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="57" rx="19" ry="3" fill={NAVY} opacity="0.09" />

      {/* Body */}
      <rect x="13" y="30" width="38" height="26" rx="4" fill={`url(#gbox-${uid})`} stroke="#DCC79B" strokeWidth="1" />
      <rect x="28" y="30" width="8" height="26" fill={`url(#grib-${uid})`} />

      {/* Lid + bow rise together, a hair, on a slow loop */}
      <g className="pima-icon-lift" style={{ transformOrigin: '32px 26px' }}>
        <rect x="9" y="21" width="46" height="11" rx="3.5" fill={`url(#glid-${uid})`} stroke="#DCC79B" strokeWidth="1" />
        <rect x="28" y="21" width="8" height="11" fill={`url(#grib-${uid})`} />
        <path d="M32 21 C 32 13, 20 10, 20 16 C 20 20, 27 21, 32 21 Z" fill={`url(#grib-${uid})`} />
        <path d="M32 21 C 32 13, 44 10, 44 16 C 44 20, 37 21, 32 21 Z" fill={`url(#grib-${uid})`} />
        <circle cx="32" cy="20" r="3.2" fill="#D8B063" stroke="#A9853E" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

/* ── Coins ────────────────────────────────────────────────────────────── */

export function CoinStack({ size = 48, className = '' }: IconProps) {
  const uid = useId().replace(/:/g, '');
  const face = `cface-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`coin-${uid}`} x1="14" y1="14" x2="50" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7E3B0" /><stop offset="0.55" stopColor="#D8B063" /><stop offset="1" stopColor="#B8944E" />
        </linearGradient>
        <clipPath id={face}><circle cx="32" cy="26" r="16" /></clipPath>
      </defs>

      <ellipse cx="32" cy="57" rx="17" ry="3" fill={NAVY} opacity="0.08" />

      {/* Two coins lying behind, so the stack has depth */}
      <ellipse cx="32" cy="47" rx="17" ry="6" fill="#B8944E" />
      <ellipse cx="32" cy="45" rx="17" ry="6" fill="#D8B063" />
      <ellipse cx="32" cy="40" rx="17" ry="6" fill="#B8944E" />
      <ellipse cx="32" cy="38" rx="17" ry="6" fill="#E0BC77" />

      {/* Face-on coin */}
      <circle cx="32" cy="26" r="16" fill={`url(#coin-${uid})`} stroke="#A9853E" strokeWidth="1.2" />
      <circle cx="32" cy="26" r="11.5" fill="none" stroke="#A9853E" strokeWidth="1" opacity="0.55" />
      <g fill={NAVY} opacity="0.8">
        <rect x="30.5" y="18" width="3" height="16" rx="1" />
        <rect x="26" y="23.5" width="12" height="3" rx="1" />
      </g>
      <Shine id={face} />
    </svg>
  );
}

/* ── Passport book ────────────────────────────────────────────────────── */

export function PassportBook({ size = 48, className = '' }: IconProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`cover-${uid}`} x1="14" y1="8" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1B3765" /><stop offset="0.55" stopColor={NAVY} /><stop offset="1" stopColor={NAVY_DEEP} />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="57" rx="17" ry="3" fill={NAVY} opacity="0.12" />

      {/* Page block peeking out on the binding side */}
      <rect x="14" y="9" width="36" height="46" rx="4" fill="#F3EAD6" />
      <rect x="16" y="12" width="34" height="40" rx="3" fill="#FBF6EA" />

      {/* Cover */}
      <rect x="12" y="7" width="36" height="48" rx="4.5" fill={`url(#cover-${uid})`} />
      <rect x="14.5" y="9.5" width="31" height="43" rx="3" fill="none" stroke="#C5A059" strokeWidth="0.9" opacity="0.55" />

      {/* Gold emblem: a house carrying a cross — the Pima mark */}
      <g stroke="#C5A059" strokeWidth="2" fill="none" strokeLinejoin="round">
        <path d="M22 32 L30 25 L38 32 L38 42 L22 42 Z" />
        <path d="M30 18.5 L30 25" strokeLinecap="round" />
        <path d="M27 21 L33 21" strokeLinecap="round" />
      </g>
      <rect x="25" y="46" width="10" height="3.5" rx="1.75" fill="#C5A059" opacity="0.75" />
    </svg>
  );
}

/* ── Immigration stamp ────────────────────────────────────────────────── */

const STAMP_MARKS = ['dome', 'basilica', 'tower', 'chapel'] as const;
export type StampMark = (typeof STAMP_MARKS)[number];

/** Deterministic mark for a house id, so a place always stamps the same way. */
export function markForId(id: string): StampMark {
  const h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return STAMP_MARKS[h % STAMP_MARKS.length];
}

export function PassportStamp({ mark = 'dome', size = 52, muted = false, className = '' }: IconProps & { mark?: StampMark; muted?: boolean }) {
  const ink = muted ? '#C9C2B0' : '#B8944E';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* Double ring, the outer one broken like a real rubber stamp */}
      <circle cx="32" cy="32" r="29" fill="none" stroke={ink} strokeWidth="2.2" strokeDasharray="5 3.5" opacity="0.75" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.9" />

      <g stroke={ink} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {mark === 'dome' && (
          <>
            <path d="M22 42 L22 31 A10 10 0 0 1 42 31 L42 42" />
            <path d="M32 17 L32 21 M29.5 19 L34.5 19" />
            <path d="M19 42 L45 42" />
            <path d="M28 42 L28 35 A4 4 0 0 1 36 35 L36 42" />
          </>
        )}
        {mark === 'basilica' && (
          <>
            <path d="M20 43 L20 28 L32 20 L44 28 L44 43" />
            <path d="M17 43 L47 43" />
            <path d="M32 14 L32 20 M29.5 16.5 L34.5 16.5" />
            <path d="M26 43 L26 34 L38 34 L38 43" />
            <path d="M32 34 L32 43" />
          </>
        )}
        {mark === 'tower' && (
          <>
            <path d="M24 44 L24 26 L32 19 L40 26 L40 44" />
            <path d="M20 44 L44 44" />
            <path d="M32 12 L32 19 M29 15 L35 15" />
            <circle cx="32" cy="30" r="3.5" />
            <path d="M28 44 L28 37 L36 37 L36 44" />
          </>
        )}
        {mark === 'chapel' && (
          <>
            <path d="M21 44 L21 30 L32 22 L43 30 L43 44" />
            <path d="M18 44 L46 44" />
            <path d="M32 15 L32 22 M29 18 L35 18" />
            <path d="M29 44 L29 36 A3 3 0 0 1 35 36 L35 44" />
          </>
        )}
      </g>
    </svg>
  );
}

/* ── Achievement rosette ──────────────────────────────────────────────── */

export function Rosette({ size = 40, locked = false, className = '' }: IconProps & { locked?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const face = `rface-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`ros-${uid}`} x1="18" y1="12" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          {locked
            ? <><stop stopColor="#F0EDE4" /><stop offset="1" stopColor="#D8D2C4" /></>
            : <><stop stopColor="#F7E3B0" /><stop offset="0.55" stopColor="#D8B063" /><stop offset="1" stopColor="#B8944E" /></>}
        </linearGradient>
        <clipPath id={face}><circle cx="32" cy="28" r="17" /></clipPath>
      </defs>

      {/* Scalloped edge — twelve petals around the disc */}
      {Array.from({ length: 12 }).map((_, i) => (
        <circle key={i} cx="32" cy="8.5" r="5.2" fill={locked ? '#E3DED1' : '#E0BC77'}
          transform={`rotate(${i * 30} 32 28)`} />
      ))}

      <circle cx="32" cy="28" r="17" fill={`url(#ros-${uid})`} stroke={locked ? '#CFC8B8' : '#A9853E'} strokeWidth="1.2" />

      {locked ? (
        <g fill="#B3AC9C">
          <rect x="26" y="27" width="12" height="9.5" rx="2" />
          <path d="M28.5 27 V24 a3.5 3.5 0 0 1 7 0 v3" fill="none" stroke="#B3AC9C" strokeWidth="2.2" />
        </g>
      ) : (
        <path d="M32 18.5 L35.2 25 L42.4 26 L37.2 31 L38.4 38.2 L32 34.8 L25.6 38.2 L26.8 31 L21.6 26 L28.8 25 Z"
          fill="#FFFFFF" opacity="0.92" />
      )}

      {!locked && <Shine id={face} />}
    </svg>
  );
}

/* ── Small deed icons for the "ways to earn" rail ─────────────────────── */

export function DeedHouse({ size = 34, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M10 24 L24 13 L38 24 L38 39 L10 39 Z" fill="#F6EBD4" stroke="#B8944E" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 6.5 V13 M20.5 9.5 H27.5" stroke="#B8944E" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="20" y="29" width="8" height="10" rx="1.5" fill="#B8944E" opacity="0.85" />
    </svg>
  );
}

export function DeedStar({ size = 34, className = '' }: IconProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`ds-${uid}`} x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7E3B0" /><stop offset="1" stopColor="#D89A2E" />
        </linearGradient>
      </defs>
      <path d="M24 7 L29.3 18.2 L41.5 19.9 L32.7 28.6 L34.8 41 L24 35.1 L13.2 41 L15.3 28.6 L6.5 19.9 L18.7 18.2 Z"
        fill={`url(#ds-${uid})`} stroke="#B8791E" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function DeedFriends({ size = 34, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="17" r="6" fill="#BFE3CE" stroke="#2E7D5B" strokeWidth="1.8" />
      <path d="M22 38 v-3 a10 10 0 0 1 20 0 v3 Z" fill="#BFE3CE" stroke="#2E7D5B" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="17" cy="19" r="6.5" fill="#E4F3EA" stroke="#2E7D5B" strokeWidth="1.8" />
      <path d="M6 38 v-3.5 a11 11 0 0 1 22 0 V38 Z" fill="#E4F3EA" stroke="#2E7D5B" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function DeedPlay({ size = 34, className = '' }: IconProps) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`dp-${uid}`} x1="8" y1="12" x2="40" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8C79C9" /><stop offset="1" stopColor="#5F4A9E" />
        </linearGradient>
      </defs>
      <rect x="6" y="12" width="36" height="24" rx="4" fill={`url(#dp-${uid})`} />
      <rect x="8.5" y="14.5" width="31" height="19" rx="2.5" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
      <path d="M21 20.5 L30 24 L21 27.5 Z" fill="#FFFFFF" />
      <rect x="17" y="38" width="14" height="3" rx="1.5" fill="#5F4A9E" opacity="0.7" />
    </svg>
  );
}

import AssetLayer from './AssetLayer';

/**
 * The artwork behind the random-match banner, as four independent layers.
 *
 * Each layer renders generated artwork if the file is present under
 * `public/games/` (see bannerAssets.ts) and a vector drawing if it is not, so
 * the eight PNGs can arrive one at a time without the banner ever being
 * half-built. The drawings follow the approved reference: navy field, blue
 * energy left and orange right, a crowned shield with a gold VS in the
 * middle, a boy in a blue hoodie facing in from the left and a girl in a
 * purple hoodie with a ponytail facing in from the right.
 *
 * The vectors are authored in one 320x180 space and drawn full-bleed, which
 * is why they are separate SVGs with prefixed gradient ids — ids are
 * document-global, and two layers sharing `gold` would silently take
 * whichever mounted first.
 *
 * 16:9.
 */

function BackdropArt() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="bgBlue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgOrange" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bgVignette" cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#070C1F" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.75" />
        </radialGradient>
        <pattern id="bgHex" width="18" height="16" patternUnits="userSpaceOnUse">
          <path d="M9 0 L18 5 L18 11 L9 16 L0 11 L0 5 Z" fill="none" stroke="#3B82F6" strokeWidth="0.4" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="320" height="180" fill="#070C1F" />
      <circle cx="90" cy="95" r="105" fill="url(#bgBlue)" />
      <circle cx="232" cy="95" r="105" fill="url(#bgOrange)" />
      <rect width="320" height="180" fill="url(#bgHex)" opacity="0.25" />
      <g fill="#FDBA74" opacity="0.75">
        <circle cx="243" cy="40" r="1.4" /><circle cx="268" cy="72" r="1" />
        <circle cx="255" cy="120" r="1.2" /><circle cx="286" cy="98" r="0.9" />
        <circle cx="231" cy="150" r="1" />
      </g>
      <g fill="#93C5FD" opacity="0.7">
        <circle cx="72" cy="44" r="1.3" /><circle cx="45" cy="80" r="1" />
        <circle cx="60" cy="128" r="1.2" /><circle cx="30" cy="104" r="0.9" />
        <circle cx="88" cy="152" r="1" />
      </g>
      <rect width="320" height="180" fill="url(#bgVignette)" />
    </svg>
  );
}

function BoyArt() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="boyHood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E5BD8" /><stop offset="100%" stopColor="#0F2260" />
        </linearGradient>
      </defs>
      <path d="M36 180 q-4 -52 14 -63 q20 -13 40 0 q18 11 14 63 z" fill="url(#boyHood)" />
      <path d="M48 118 q22 13 44 0 l4 -13 -52 0 z" fill="#12266B" />
      <path d="M70 118 L70 180" stroke="#F5C542" strokeWidth="2.4" fill="none" opacity="0.9" />
      <path d="M40 158 q30 9 60 0" stroke="#F5C542" strokeWidth="2" fill="none" opacity="0.75" />
      <path d="M62 120 L61 133 M80 120 L81 133" stroke="#F3D6A8" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="70" cy="88" r="21" fill="#F0C29B" />
      <path d="M49 84 q-1 -27 21 -27 q22 0 21 27 q-6 -13 -14 -10 q-7 4 -15 0 q-8 -4 -13 10 z" fill="#171A2E" />
      <path d="M88 70 q10 -6 6 -14 q-4 8 -12 8 z" fill="#171A2E" />
      <circle cx="63" cy="90" r="2.9" fill="#22303F" />
      <circle cx="78" cy="90" r="2.9" fill="#22303F" />
      <path d="M62 79 q5 -3 9 -1 M75 78 q5 -2 9 1" stroke="#171A2E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M63 100 q7 6 14 0" stroke="#9A5638" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="99" cy="132" r="12" fill="#F0C29B" />
      <circle cx="88" cy="158" r="11" fill="#F0C29B" />
      <path d="M96 118 q10 22 8 62" stroke="#60A5FA" strokeWidth="3" fill="none" opacity="0.75" strokeLinecap="round" />
    </svg>
  );
}

function GirlArt() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="girlHood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B45C9" /><stop offset="100%" stopColor="#3B1D52" />
        </linearGradient>
      </defs>
      <path d="M268 78 q26 -6 30 20 q4 26 -12 44 q6 -28 -6 -44 q-8 -12 -12 -20 z" fill="#4B2A57" />
      <path d="M230 180 q-4 -52 14 -63 q20 -13 40 0 q18 11 14 63 z" fill="url(#girlHood)" />
      <path d="M242 118 q22 13 44 0 l4 -13 -52 0 z" fill="#3B1D52" />
      <path d="M256 120 L255 133 M274 120 L275 133" stroke="#E9C7F5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="264" cy="88" r="21" fill="#EFBE96" />
      <path d="M243 84 q-1 -27 21 -27 q22 0 21 27 q-7 -14 -17 -11 q-11 3 -12 -2 q-6 3 -13 13 z" fill="#5B3168" />
      <circle cx="285" cy="80" r="5" fill="#3B1D52" />
      <circle cx="257" cy="90" r="2.9" fill="#22303F" />
      <circle cx="272" cy="90" r="2.9" fill="#22303F" />
      <path d="M252 79 q5 -3 9 -1 M268 78 q5 -2 9 1" stroke="#3B1D52" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M257 100 q7 6 14 0" stroke="#9A5638" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="235" cy="132" r="12" fill="#EFBE96" />
      <circle cx="246" cy="158" r="11" fill="#EFBE96" />
      <path d="M238 118 q-10 22 -8 62" stroke="#FB923C" strokeWidth="3" fill="none" opacity="0.75" strokeLinecap="round" />
    </svg>
  );
}

function ShieldArt() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="shBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E2E7A" /><stop offset="100%" stopColor="#0B1440" />
        </linearGradient>
        <linearGradient id="shGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE9A3" /><stop offset="45%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#D08B12" />
        </linearGradient>
        <radialGradient id="shBloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="98" rx="60" ry="66" fill="url(#shBloom)" />
      <path d="M160 46 L206 62 Q206 112 160 142 Q114 112 114 62 Z"
        fill="url(#shBody)" stroke="#F5C542" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M160 46 L160 142 M114 62 L206 62 M126 100 L194 100"
        stroke="#F5C542" strokeWidth="0.8" opacity="0.28" fill="none" />
      <text x="160" y="112" textAnchor="middle" fontSize="52" fontWeight="900"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fill="url(#shGold)" stroke="#2A1B02" strokeWidth="2" paintOrder="stroke">VS</text>
      <path d="M126 52 L126 34 L142 46 L160 22 L178 46 L194 34 L194 52 Z"
        fill="url(#shGold)" stroke="#8A5A0B" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="124" y="50" width="72" height="10" rx="3" fill="url(#shGold)" stroke="#8A5A0B" strokeWidth="1.4" />
      <circle cx="160" cy="20" r="3.4" fill="#FFF3C4" />
      <circle cx="126" cy="32" r="2.6" fill="#FFF3C4" />
      <circle cx="194" cy="32" r="2.6" fill="#FFF3C4" />
      <circle cx="142" cy="55" r="2.2" fill="#7C3AED" />
      <circle cx="160" cy="55" r="2.2" fill="#7C3AED" />
      <circle cx="178" cy="55" r="2.2" fill="#7C3AED" />
    </svg>
  );
}

export default function MatchBannerScene({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AssetLayer asset="background" imgClassName="inset-0 w-full h-full" imgFit="object-cover" fallback={<BackdropArt />} />
      {/* Characters sit on the floor of the banner and take about a third of
          its width each, as the brief asks — and are not cropped at the face. */}
      <AssetLayer asset="boy"    imgClassName="left-0 bottom-0 h-[94%] w-[34%]" imgFit="object-contain object-bottom" fallback={<BoyArt />} />
      <AssetLayer asset="girl"   imgClassName="right-0 bottom-0 h-[94%] w-[34%]" imgFit="object-contain object-bottom" fallback={<GirlArt />} />
      {/* Shield last so the crown reads over both of them. */}
      <AssetLayer asset="shield" imgClassName="left-1/2 -translate-x-1/2 top-[3%] h-[86%] w-[40%]" fallback={<ShieldArt />} />
    </div>
  );
}

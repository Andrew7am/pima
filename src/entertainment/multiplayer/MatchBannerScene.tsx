/**
 * The artwork behind the random-match banner, as separate layers.
 *
 * Follows the approved reference: navy field with blue energy on the left and
 * orange on the right, a crowned shield carrying a gold VS in the centre, a
 * boy in a blue hoodie facing in from the left and a girl in a purple hoodie
 * with a ponytail facing in from the right.
 *
 * Vector, not a render. The composition, colours, lighting sides and poses
 * follow the reference; the Pixar-grade modelling of the faces and fabric
 * does not, and cannot from code. Each layer is its own component so a real
 * asset can replace any one of them without touching the rest.
 *
 * 16:9, drawn at 320x180 units and scaled by the container.
 */

function Backdrop() {
  return (
    <g>
      <rect width="320" height="180" fill="#070C1F" />
      <circle cx="90" cy="95" r="105" fill="url(#mbBlue)" />
      <circle cx="232" cy="95" r="105" fill="url(#mbOrange)" />
      {/* barely-there hex weave */}
      <rect width="320" height="180" fill="url(#mbHex)" opacity="0.25" />
      {/* sparks */}
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
      {/* vignette */}
      <rect width="320" height="180" fill="url(#mbVignette)" />
    </g>
  );
}

function BoyLeft() {
  return (
    <g>
      {/* torso */}
      <path d="M36 180 q-4 -52 14 -63 q20 -13 40 0 q18 11 14 63 z" fill="url(#mbHoodBlue)" />
      {/* hood bunched at the shoulders */}
      <path d="M48 118 q22 13 44 0 l4 -13 -52 0 z" fill="#12266B" />
      {/* gold zip + hem */}
      <path d="M70 118 L70 180" stroke="#F5C542" strokeWidth="2.4" fill="none" opacity="0.9" />
      <path d="M40 158 q30 9 60 0" stroke="#F5C542" strokeWidth="2" fill="none" opacity="0.75" />
      {/* drawstrings */}
      <path d="M62 120 L61 133 M80 120 L81 133" stroke="#F3D6A8" strokeWidth="1.8" strokeLinecap="round" />
      {/* head */}
      <circle cx="70" cy="88" r="21" fill="#F0C29B" />
      {/* dark swept hair */}
      <path d="M49 84 q-1 -27 21 -27 q22 0 21 27 q-6 -13 -14 -10 q-7 4 -15 0 q-8 -4 -13 10 z" fill="#171A2E" />
      <path d="M88 70 q10 -6 6 -14 q-4 8 -12 8 z" fill="#171A2E" />
      {/* face */}
      <circle cx="63" cy="90" r="2.9" fill="#22303F" />
      <circle cx="78" cy="90" r="2.9" fill="#22303F" />
      <path d="M62 79 q5 -3 9 -1 M75 78 q5 -2 9 1" stroke="#171A2E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M63 100 q7 6 14 0" stroke="#9A5638" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* raised fists */}
      <circle cx="99" cy="132" r="12" fill="#F0C29B" />
      <circle cx="88" cy="158" r="11" fill="#F0C29B" />
      {/* blue rim light down the inner edge */}
      <path d="M96 118 q10 22 8 62" stroke="#60A5FA" strokeWidth="3" fill="none" opacity="0.75" strokeLinecap="round" />
    </g>
  );
}

function GirlRight() {
  return (
    <g>
      {/* ponytail, behind the body */}
      <path d="M268 78 q26 -6 30 20 q4 26 -12 44 q6 -28 -6 -44 q-8 -12 -12 -20 z" fill="#4B2A57" />
      {/* torso */}
      <path d="M230 180 q-4 -52 14 -63 q20 -13 40 0 q18 11 14 63 z" fill="url(#mbHoodPurple)" />
      <path d="M242 118 q22 13 44 0 l4 -13 -52 0 z" fill="#3B1D52" />
      <path d="M256 120 L255 133 M274 120 L275 133" stroke="#E9C7F5" strokeWidth="1.8" strokeLinecap="round" />
      {/* head */}
      <circle cx="264" cy="88" r="21" fill="#EFBE96" />
      {/* hair with a centre sweep and the tie */}
      <path d="M243 84 q-1 -27 21 -27 q22 0 21 27 q-7 -14 -17 -11 q-11 3 -12 -2 q-6 3 -13 13 z" fill="#5B3168" />
      <circle cx="285" cy="80" r="5" fill="#3B1D52" />
      {/* face */}
      <circle cx="257" cy="90" r="2.9" fill="#22303F" />
      <circle cx="272" cy="90" r="2.9" fill="#22303F" />
      <path d="M252 79 q5 -3 9 -1 M268 78 q5 -2 9 1" stroke="#3B1D52" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M257 100 q7 6 14 0" stroke="#9A5638" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* raised fists */}
      <circle cx="235" cy="132" r="12" fill="#EFBE96" />
      <circle cx="246" cy="158" r="11" fill="#EFBE96" />
      {/* orange rim light down the inner edge */}
      <path d="M238 118 q-10 22 -8 62" stroke="#FB923C" strokeWidth="3" fill="none" opacity="0.75" strokeLinecap="round" />
    </g>
  );
}

function CrownedShield() {
  return (
    <g>
      {/* bloom behind the emblem */}
      <ellipse cx="160" cy="98" rx="60" ry="66" fill="url(#mbBloom)" />

      {/* shield */}
      <path
        d="M160 46 L206 62 Q206 112 160 142 Q114 112 114 62 Z"
        fill="url(#mbShield)"
        stroke="#F5C542"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* faceting */}
      <path d="M160 46 L160 142 M114 62 L206 62 M126 100 L194 100"
        stroke="#F5C542" strokeWidth="0.8" opacity="0.28" fill="none" />

      {/* VS */}
      <text
        x="160" y="112"
        textAnchor="middle"
        fontSize="52"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fill="url(#mbGold)"
        stroke="#2A1B02"
        strokeWidth="2"
        paintOrder="stroke"
      >
        VS
      </text>

      {/* crown */}
      <g>
        <path
          d="M126 52 L126 34 L142 46 L160 22 L178 46 L194 34 L194 52 Z"
          fill="url(#mbGold)" stroke="#8A5A0B" strokeWidth="1.6" strokeLinejoin="round"
        />
        <rect x="124" y="50" width="72" height="10" rx="3" fill="url(#mbGold)" stroke="#8A5A0B" strokeWidth="1.4" />
        <circle cx="160" cy="20" r="3.4" fill="#FFF3C4" />
        <circle cx="126" cy="32" r="2.6" fill="#FFF3C4" />
        <circle cx="194" cy="32" r="2.6" fill="#FFF3C4" />
        <circle cx="142" cy="55" r="2.2" fill="#7C3AED" />
        <circle cx="160" cy="55" r="2.2" fill="#7C3AED" />
        <circle cx="178" cy="55" r="2.2" fill="#7C3AED" />
      </g>
    </g>
  );
}

export default function MatchBannerScene({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 180" className={className} preserveAspectRatio="xMidYMid slice"
      role="img" aria-label="مباراة بين لاعبين">
      <defs>
        <linearGradient id="mbHoodBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E5BD8" /><stop offset="100%" stopColor="#0F2260" />
        </linearGradient>
        <linearGradient id="mbHoodPurple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B45C9" /><stop offset="100%" stopColor="#3B1D52" />
        </linearGradient>
        <linearGradient id="mbShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E2E7A" /><stop offset="100%" stopColor="#0B1440" />
        </linearGradient>
        <linearGradient id="mbGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE9A3" /><stop offset="45%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#D08B12" />
        </linearGradient>
        <radialGradient id="mbBlue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mbOrange" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mbBloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mbVignette" cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#070C1F" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.75" />
        </radialGradient>
        <pattern id="mbHex" width="18" height="16" patternUnits="userSpaceOnUse">
          <path d="M9 0 L18 5 L18 11 L9 16 L0 11 L0 5 Z" fill="none" stroke="#3B82F6" strokeWidth="0.4" opacity="0.5" />
        </pattern>
      </defs>

      <Backdrop />
      <BoyLeft />
      <GirlRight />
      <CrownedShield />
    </svg>
  );
}

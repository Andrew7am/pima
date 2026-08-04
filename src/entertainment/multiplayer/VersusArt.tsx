/**
 * The face-off drawing on the random-match banner.
 *
 * Drawn rather than sourced: the approved design uses a rendered
 * illustration, and the repo has exactly one image in it (the logo). Inline
 * SVG means no asset to ship, nothing to fetch on a phone connection, and it
 * stays sharp at any size.
 *
 * Two hooded figures leaning into each other, in the blue and red of the
 * design, with the lit seam and bolt between them. If the real artwork turns
 * up later it replaces this component and nothing around it moves — the
 * banner only asks for a box of this shape.
 */
export default function VersusArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} role="img" aria-label="مواجهة بين لاعبين">
      <defs>
        <linearGradient id="vsBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="vsRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </linearGradient>
        <linearGradient id="vsGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="100%" stopColor="#F0A93B" />
        </linearGradient>
        <radialGradient id="vsGlowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vsGlowR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="160" height="110" fill="#0a1733" />
      <circle cx="118" cy="58" r="46" fill="url(#vsGlowB)" />
      <circle cx="42" cy="58" r="46" fill="url(#vsGlowR)" />

      {/* One figure, drawn once facing left, then mirrored across the middle
          for the other side. Writing the second one by hand is how the red
          torso ended up mirrored twice and standing on the blue figure's
          side of the seam. */}
      <defs>
        <g id="vsFighter">
          {/* torso, leaning into the seam */}
          <path d="M116 98 q-3 -32 7 -40 q11 -9 22 0 q9 8 6 40 z" />
          {/* head */}
          <circle cx="132" cy="40" r="13" />
          {/* hood over the head */}
          <path d="M118 42 a14 14 0 0 1 28 0 l3 8 -34 0 z" opacity="0.5" />
          {/* leading arm and fist */}
          <path d="M118 62 q-10 0 -14 7 l7 9 q9 -3 11 -10 z" />
          <circle cx="105" cy="70" r="8.5" />
        </g>
      </defs>

      <use href="#vsFighter" fill="url(#vsBlue)" />
      <use href="#vsFighter" fill="url(#vsRed)" transform="translate(160 0) scale(-1 1)" />

      {/* The seam and the bolt down the middle */}
      <rect x="79" y="0" width="2" height="110" fill="url(#vsGold)" opacity="0.35" />
      <path
        d="M86 8 L72 52 L82 52 L74 102 L92 48 L82 48 Z"
        fill="url(#vsGold)"
        stroke="#0a1733"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

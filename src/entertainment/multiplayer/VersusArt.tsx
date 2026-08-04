/**
 * The face-off drawing on the random-match banner.
 *
 * Follows the approved artwork: the blue side on the left with the hood down
 * and the face showing, the red side on the right with the hood up and the
 * face in shadow, and a lit VS between them.
 *
 * Drawn rather than sourced — the repo holds one image, the logo — so this is
 * inline SVG: nothing to fetch on a phone connection and sharp at any size.
 * The two fighters are no longer one mirrored shape, because they are not
 * mirror images of each other in the reference.
 */
export default function VersusArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} role="img" aria-label="مواجهة بين لاعبين">
      <defs>
        <linearGradient id="vaBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="vaRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </linearGradient>
        <linearGradient id="vaVs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#93C5FD" />
        </linearGradient>
        <radialGradient id="vaGlowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vaGlowR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
        <filter id="vaSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <rect width="160" height="110" fill="#0a1733" />
      <circle cx="40" cy="60" r="48" fill="url(#vaGlowB)" />
      <circle cx="120" cy="60" r="48" fill="url(#vaGlowR)" />

      {/* ── Left: blue, hood down, face showing ───────────────────── */}
      <g>
        {/* torso */}
        <path d="M22 104 q-2 -36 8 -44 q12 -9 24 0 q10 8 8 44 z" fill="url(#vaBlue)" />
        {/* hood bunched behind the neck */}
        <path d="M28 58 q12 8 24 0 l2 -8 -28 0 z" fill="#1E3A8A" />
        {/* head */}
        <circle cx="40" cy="42" r="12" fill="#F0C09A" />
        {/* hair */}
        <path d="M28 40 q1 -14 12 -14 q11 0 12 14 q-5 -7 -12 -6 q-7 1 -12 6 z" fill="#3F2415" />
        {/* eyes */}
        <circle cx="36" cy="43" r="1.6" fill="#22303F" />
        <circle cx="45" cy="43" r="1.6" fill="#22303F" />
        {/* leading fist, thrown toward the seam */}
        <path d="M52 66 q10 -1 14 6 l-8 9 q-9 -2 -10 -9 z" fill="url(#vaBlue)" />
        <circle cx="63" cy="73" r="8" fill="#F0C09A" />
      </g>

      {/* ── Right: red, hood up, face in shadow ───────────────────── */}
      <g>
        <path d="M110 104 q-2 -36 8 -44 q12 -9 24 0 q10 8 8 44 z" fill="url(#vaRed)" />
        {/* the hood itself, pulled over */}
        <path d="M106 50 q4 -26 22 -26 q18 0 22 26 q-10 6 -22 6 q-12 0 -22 -6 z" fill="url(#vaRed)" />
        {/* the shadow inside it */}
        <ellipse cx="128" cy="44" rx="10" ry="10" fill="#2B0808" />
        {/* two lit eyes in the dark */}
        <circle cx="124" cy="44" r="1.7" fill="#FCA5A5" />
        <circle cx="133" cy="44" r="1.7" fill="#FCA5A5" />
        {/* leading fist */}
        <path d="M116 66 q-10 -1 -14 6 l8 9 q9 -2 10 -9 z" fill="url(#vaRed)" />
        <circle cx="99" cy="73" r="8" fill="#C98B6B" />
      </g>

      {/* ── The clash in the middle ───────────────────────────────── */}
      <g>
        <ellipse cx="80" cy="58" rx="20" ry="26" fill="#60A5FA" opacity="0.35" filter="url(#vaSoft)" />
        <path d="M84 22 L70 56 L79 56 L73 92 L92 52 L82 52 Z" fill="#FDE68A" opacity="0.85" />
        <text
          x="80" y="70"
          textAnchor="middle"
          fontSize="34"
          fontWeight="900"
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          fill="url(#vaVs)"
          stroke="#0a1733"
          strokeWidth="2"
          paintOrder="stroke"
        >
          VS
        </text>
      </g>
    </svg>
  );
}

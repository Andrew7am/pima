/**
 * The face-off drawing on the random-match banner.
 *
 * Follows the approved artwork: a blue hoodie with gold trim on the left,
 * hood down, brown hair and a confident face; a maroon hoodie on the right
 * with the hood UP but the face still lit and visible under it; and between
 * them a two-tone bolt with a white-to-cyan VS and a magenta bloom.
 *
 * Drawn rather than sourced — the repo holds one image, the logo — so this is
 * inline SVG: nothing to fetch on a phone connection and sharp at any size.
 * A stylised vector, not the rendered illustration; swap the component out if
 * the real asset arrives and the banner does not move.
 */
export default function VersusArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" className={className} role="img" aria-label="مواجهة بين لاعبين">
      <defs>
        <linearGradient id="vaHoodB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B6FE8" />
          <stop offset="100%" stopColor="#16307A" />
        </linearGradient>
        <linearGradient id="vaHoodR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A11F35" />
          <stop offset="100%" stopColor="#4E0D1B" />
        </linearGradient>
        <linearGradient id="vaVs" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="vaBolt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>
        <radialGradient id="vaGlowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vaGlowR" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E11D48" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vaGlowM" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E879F9" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#E879F9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="160" height="110" fill="#0a1733" />
      <circle cx="38" cy="58" r="50" fill="url(#vaGlowB)" />
      <circle cx="124" cy="58" r="50" fill="url(#vaGlowR)" />

      {/* ── LEFT — blue hoodie, gold trim, hood down, face showing ── */}
      <g>
        {/* body */}
        <path d="M20 106 q-3 -38 9 -47 q14 -10 28 0 q12 9 9 47 z" fill="url(#vaHoodB)" />
        {/* hood bunched at the shoulders */}
        <path d="M27 62 q13 10 27 0 l3 -9 -33 0 z" fill="#16307A" />
        {/* gold zip and cuff trim */}
        <path d="M40 62 L40 106" stroke="#F5C542" strokeWidth="2.2" fill="none" />
        <path d="M23 92 q17 6 34 0" stroke="#F5C542" strokeWidth="1.8" fill="none" />
        {/* head */}
        <circle cx="40" cy="40" r="13" fill="#F2C6A0" />
        {/* brown wavy hair */}
        <path d="M27 38 q0 -16 13 -16 q13 0 13 16 q-4 -8 -8 -6 q-4 3 -9 0 q-5 -3 -9 6 z" fill="#4A2E1A" />
        {/* face */}
        <circle cx="35.5" cy="41" r="1.9" fill="#22303F" />
        <circle cx="45" cy="41" r="1.9" fill="#22303F" />
        <path d="M36 47 q4 3 8 0" stroke="#8A4B32" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* raised fists */}
        <circle cx="57" cy="64" r="7.5" fill="#F2C6A0" />
        <circle cx="52" cy="79" r="7" fill="#F2C6A0" />
      </g>

      {/* ── RIGHT — maroon hoodie, hood UP, face still lit ────────── */}
      <g>
        <path d="M104 106 q-3 -38 9 -47 q14 -10 28 0 q12 9 9 47 z" fill="url(#vaHoodR)" />
        {/* the hood, pulled over the head */}
        <path d="M107 46 q3 -26 20 -26 q17 0 20 26 q0 12 -20 12 q-20 0 -20 -12 z" fill="url(#vaHoodR)" />
        {/* the face inside it — lit, not blacked out */}
        <circle cx="127" cy="42" r="11.5" fill="#E8B894" />
        {/* hair fringe under the hood */}
        <path d="M116 37 q3 -9 11 -9 q8 0 11 9 q-5 -4 -11 -3 q-6 1 -11 3 z" fill="#3E2415" />
        {/* the hood's forward rim, casting only a soft edge */}
        <path d="M107 46 q3 -26 20 -26 q17 0 20 26 q-6 -12 -20 -12 q-14 0 -20 12 z" fill="#4E0D1B" opacity="0.85" />
        <circle cx="122.5" cy="43" r="1.9" fill="#22303F" />
        <circle cx="132" cy="43" r="1.9" fill="#22303F" />
        <path d="M123 49 q4 3 8 0" stroke="#8A4B32" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* drawstrings */}
        <path d="M120 57 L119 66 M135 57 L136 66" stroke="#E8C39A" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="110" cy="64" r="7.5" fill="#E8B894" />
        <circle cx="115" cy="79" r="7" fill="#E8B894" />
      </g>

      {/* ── The clash ─────────────────────────────────────────────── */}
      <g>
        <ellipse cx="80" cy="56" rx="24" ry="30" fill="url(#vaGlowM)" />
        <path d="M85 12 L67 54 L78 54 L71 100 L95 50 L83 50 Z" fill="url(#vaBolt)" opacity="0.9" />
        <text
          x="80" y="70"
          textAnchor="middle"
          fontSize="36"
          fontWeight="900"
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          fill="url(#vaVs)"
          stroke="#0a1733"
          strokeWidth="2.5"
          paintOrder="stroke"
        >
          VS
        </text>
      </g>
    </svg>
  );
}

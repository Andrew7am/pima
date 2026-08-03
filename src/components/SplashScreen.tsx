import React, { useEffect, useRef, useState } from 'react';
import { Home, Utensils, Sparkles, Star, MessageCircle } from 'lucide-react';

/**
 * The six seconds before the app.
 *
 * One story: everything you need begins from Pima. A single point of light
 * draws the house, the house sends a line out to each thing Pima actually
 * does, and every one of them comes back inside it.
 *
 * The logo is not redesigned here. The outline drawn in scene two is the exact
 * path from components/Logo — the same house, the same roof, the same corner
 * radii — traced in gold while it is being written and settling into its own
 * navy once it is whole. A gold stroke on the way in is the ink, not a new
 * mark.
 *
 * Nothing here re-renders. The whole sequence is CSS keyframes and one SMIL
 * <animateMotion>, so React paints this once and the compositor does the rest;
 * the only state change in six seconds is the one that takes it away.
 */

/** Straight from components/Logo, variant="full". Do not edit — it is the logo. */
const HOUSE_PATH = 'M25 65 L80 20 L135 65 V110 C135 112.2 133.2 114 131 114 H29 C26.8 114 25 112.2 25 110 V65 Z';

/** Only what Pima actually does. Order is the order the line visits them. */
const FEATURES = [
  { key: 'houses', label: 'بيوت المؤتمرات', Icon: Home, x: 30, y: 60 },
  { key: 'menu', label: 'قوائم الطعام', Icon: Utensils, x: 70, y: 68 },
  { key: 'fun', label: 'الترفيه والألعاب', Icon: Sparkles, x: 30, y: 76 },
  { key: 'points', label: 'النقاط والمكافآت', Icon: Star, x: 70, y: 84 },
  { key: 'chat', label: 'المحادثات', Icon: MessageCircle, x: 50, y: 92 },
] as const;

// The journey the line takes: out of the house, down through the five, back.
// Same 0–100 space the cards are positioned in, so the two cannot drift apart.
const JOURNEY = 'M50,44 C50,52 36,54 30,60 C24,66 62,64 70,68 C78,72 24,70 30,76 C36,82 62,78 70,84 C78,90 60,88 50,92 C40,96 50,68 50,44';

/**
 * Rewrites the 0–100 path into real pixels.
 *
 * The line used to be a stretched 0–100 viewBox with non-scaling-stroke to
 * stop the hairline stretching with it. That combination is what broke it:
 * Blink resolves the whole stroke — the dash pattern included — after the
 * transform, so a 260-unit dash became 260 CSS px against a path measuring
 * over a thousand, and scene 4 rendered as marching ants that never reached
 * the house. Sized in pixels there is no transform to resolve against.
 */
const scalePath = (d: string, sx: number, sy: number) =>
  d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${(+x * sx).toFixed(2)},${(+y * sy).toFixed(2)}`);

const SCENES = {
  spark: 0.0, draw: 0.8, settle: 1.8, journey: 2.5, gather: 4.2, word: 5.0, leave: 5.8, done: 6.0,
};

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  // Read once. The splash lives for six seconds over a fixed, full-viewport
  // surface; re-measuring on resize would buy a correctness nobody can see.
  const [[vw, vh]] = useState<[number, number]>(() => [
    typeof window === 'undefined' ? 393 : window.innerWidth,
    typeof window === 'undefined' ? 664 : window.innerHeight,
  ]);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Under reduced motion the story is told as a still: the finished logo and
    // its line, held briefly, then gone. Nothing travels, nothing pulses.
    const total = reduced ? 1.4 : SCENES.done;
    const out = window.setTimeout(() => setLeaving(true), (total - 0.35) * 1000);
    const end = window.setTimeout(finish, total * 1000);
    // The splash must never be able to trap someone behind it. If a timer is
    // throttled — a backgrounded tab, a sleeping phone — this still fires.
    const watchdog = window.setTimeout(finish, (total + 2) * 1000);
    return () => { window.clearTimeout(out); window.clearTimeout(end); window.clearTimeout(watchdog); };
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      className={`pima-splash fixed inset-0 z-[100] bg-[#FAF8F5] overflow-hidden ${leaving ? 'pima-splash-out' : ''}`}
      style={{ contain: 'strict' }}
    >
      {/* The light the whole thing starts as. It sits under the logo for the
          first 0.8s as a bare glow, then becomes the pen. */}
      <div className="pima-splash-stage absolute inset-0">

        {/* ── The journey line and the five cards ── */}
        <svg
          className="pima-splash-journey absolute inset-0 w-full h-full"
          viewBox={`0 0 ${vw} ${vh}`}
          fill="none"
        >
          <path
            d={scalePath(JOURNEY, vw / 100, vh / 100)}
            stroke="#C9A15A"
            strokeWidth="1.5"
            strokeLinecap="round"
            // Normalised so the dash values in CSS mean percent-of-path on any
            // screen, rather than a length that has to be guessed per device.
            pathLength={100}
            opacity="0.55"
          />
        </svg>

        {FEATURES.map((f, i) => (
          <div
            key={f.key}
            // No -translate-x-1/2 here. Tailwind 4 writes those to the
            // standalone `translate` property, which COMPOSES with the
            // keyframes' `transform` instead of being replaced by it — the two
            // together shifted each card a full width left, off the screen.
            // The centring lives in the keyframes alone.
            className="pima-splash-card absolute"
            // Only the arrival is staggered; the exit is shared and fixed at
            // 4.2s in CSS, so they all go home together.
            style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${(SCENES.journey + 0.2 + i * 0.26).toFixed(2)}s, ${SCENES.gather}s` }}
          >
            {/* Sized so two of them at 30% and 70% clear each other on a 320px
                phone: the Arabic labels do not wrap, so the card is as wide as
                its longest word and the geometry has to be checked against the
                narrowest screen, not the widest. */}
            <span className="flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/55 backdrop-blur-xl px-2.5 py-1.5 shadow-[0_8px_28px_-10px_rgba(43,43,43,0.22),0_1px_3px_rgba(43,43,43,0.05)]">
              <span className="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#E8D4A8] flex items-center justify-center shrink-0">
                <f.Icon className="w-3 h-3 text-[#C9A15A]" />
              </span>
              <span className="text-[10px] font-bold text-[#2B2B2B] whitespace-nowrap">{f.label}</span>
            </span>
          </div>
        ))}

        {/* ── The logo ── */}
        {/* Sits at 34%, not the middle: the five cards need the lower half,
            and a centred logo put the first of them through it. */}
        <div className="pima-splash-logo absolute left-1/2 top-[34%]">
          <svg width="188" height="153" viewBox="0 0 160 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* The soft light around the pen. No lens flare, no sparkle — a
                  blur of the same gold, nothing else. */}
              <filter id="pima-splash-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* The ink. Drawn in gold, then handed over to the real outline. */}
            <path
              className="pima-splash-ink"
              d={HOUSE_PATH}
              // The house measures 346.7 user units. Normalising it to 1000
              // makes the CSS dash values percent-of-path, so the ink tip and
              // the pen — which travels 0→100% of the same path over the same
              // second — advance together. Against a raw 1000-unit dash the
              // house finished drawing at 1.29s with the pen still at 48%: the
              // stroke ran nearly three times ahead of the light writing it.
              pathLength={1000}
              stroke="#C9A15A"
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#pima-splash-glow)"
            />

            {/* The official outline, in its own navy, arriving as the ink goes. */}
            <path
              className="pima-splash-outline"
              d={HOUSE_PATH}
              pathLength={1000}
              stroke="#0A2342"
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="#FDFBF7"
            />

            {/* Everything inside the house — chimney, cross, window — is the
                logo exactly as it is drawn everywhere else in the app. */}
            <g className="pima-splash-inner">
              <rect x="115" y="27" width="9" height="20" fill="#0A2342" />
              <g transform="translate(80, 60) scale(1.15)">
                <circle cx="0" cy="0" r="5.5" fill="#C5A059" />
                <circle cx="0" cy="0" r="3.5" fill="none" stroke="#0A2342" strokeWidth="0.8" />
                <path d="M-3,-5 L-6,-18 C-6,-20.5 -1,-21.5 0,-21.5 C1,-21.5 6,-20.5 6,-18 L3,-5 Z" fill="#C5A059" />
                <circle cx="0" cy="-18" r="2.2" fill="#0A2342" />
                <path d="M-3,5 L-6,18 C-6,20.5 -1,21.5 0,21.5 C1,21.5 6,20.5 6,18 L3,5 Z" fill="#C5A059" />
                <circle cx="0" cy="18" r="2.2" fill="#0A2342" />
                <path d="M-5,-3 L-18,-6 C-20.5,-6 -21.5,-1 -21.5,0 C-21.5,1 -20.5,6 -18,6 L-5,3 Z" fill="#C5A059" />
                <circle cx="-18" cy="0" r="2.2" fill="#0A2342" />
                <path d="M5,-3 L18,-6 C20.5,-6 21.5,-1 21.5,0 C21.5,1 20.5,6 18,6 L5,3 Z" fill="#C5A059" />
                <circle cx="18" cy="0" r="2.2" fill="#0A2342" />
                <circle cx="-11" cy="0" r="1.2" fill="#0A2342" />
                <circle cx="11" cy="0" r="1.2" fill="#0A2342" />
                <circle cx="0" cy="-11" r="1.2" fill="#0A2342" />
                <circle cx="0" cy="11" r="1.2" fill="#0A2342" />
                <circle cx="-10" cy="-10" r="1.5" fill="#C5A059" />
                <circle cx="10" cy="-10" r="1.5" fill="#C5A059" />
                <circle cx="-10" cy="10" r="1.5" fill="#C5A059" />
                <circle cx="10" cy="10" r="1.5" fill="#C5A059" />
              </g>
              <path d="M71 114 V94 C71 89 75 85 80 85 C85 85 89 89 89 94 V114 Z" fill="#0A2342" stroke="#C5A059" strokeWidth="2.5" />
              <line x1="80" y1="85" x2="80" y2="114" stroke="#FDFBF7" strokeWidth="1.2" />
              <line x1="71" y1="99" x2="89" y2="99" stroke="#FDFBF7" strokeWidth="1.2" />
            </g>

            {/* The pen: one point of light riding the outline it is writing.
                It is carried by CSS offset-path along the same `d`, so it
                cannot drift off the line it is drawing. */}
            <g className="pima-splash-pen">
              <circle r="3.4" fill="#E8D4A8" opacity="0.55" filter="url(#pima-splash-glow)" />
              <circle r="1.5" fill="#FFFFFF" />
            </g>
          </svg>
        </div>

        {/* The point of light before it becomes the pen. Its own element so
            scene one owes nothing to the SVG above it. */}
        <span className="pima-splash-spark absolute left-1/2 top-[34%]" />

        {/* ── The word ── */}
        <div className="pima-splash-word absolute left-1/2 top-[calc(34%+96px)] text-center">
          <div className="text-[30px] font-black tracking-[0.02em] text-[#2B2B2B] leading-none" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Pima
          </div>
          <p className="mt-2.5 text-[11.5px] font-medium leading-relaxed text-[#C9A15A]">
            أكثر من مجرد حجز،
            <br />
            إنها تجربة.
          </p>
        </div>
      </div>
    </div>
  );
}

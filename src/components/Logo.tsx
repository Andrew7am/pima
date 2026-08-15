import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'icon' | 'header';
}

/**
 * The Pima brand mark — ONE source, the canonical artwork in /public.
 *
 * This file used to draw the logo by hand in SVG, and SplashScreen drew a
 * second copy of the same paths. Neither matched the brand mark the app
 * actually ships under, so the site showed three different Pima logos
 * depending on the screen. The artwork is now referenced, never redrawn: to
 * change the logo, replace the file.
 *
 * The file is a SQUARE JPEG with no alpha, and the mark inside it is the
 * circular badge — the corners around it are dark. `rounded-full` clips to
 * that circle, so the badge appears exactly as designed on any background.
 * That is presentation, not alteration: nothing about the mark's proportions,
 * symbol, typography or colour is touched.
 *
 * The variants differ only in size, which is why they all render the same
 * element. `header` is kept because it is part of the public API of this
 * component, even though the compact header asks for `icon`.
 */
const SRC = '/pima-logo.jpg';

export default function Logo({ className = '', size = 120, variant = 'full' }: LogoProps) {
  const compact = variant === 'icon' || variant === 'header';
  return (
    <img
      src={SRC}
      alt="بيما"
      width={size}
      height={size}
      // Explicit box: the intrinsic file is 1254px square, and letting it
      // arrive at full size before CSS applies is a visible reflow on a slow
      // connection. Width and height are also what stop the header from
      // shifting while the image loads.
      style={{ width: size, height: size }}
      className={`rounded-full object-cover select-none shrink-0 ${compact ? '' : 'mx-auto'} ${className}`}
      draggable={false}
    />
  );
}

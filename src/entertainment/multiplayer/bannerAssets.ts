/**
 * Where the match banner looks for real artwork.
 *
 * Each layer of the banner is drawn as vector today. Drop a file at the path
 * below and that layer uses it instead — no code change, no rebuild of the
 * component, and every other layer stays exactly where it is. If a file is
 * absent (or fails to load) the vector keeps rendering, so a half-finished
 * asset set never leaves a hole in the banner.
 *
 * Put the files in `public/games/` and they are served from `/games/…`.
 *
 * The sizes are what the layer is drawn at, not a requirement — anything
 * larger is fine and will simply be scaled down. Transparent PNG for
 * everything except the background.
 */
export interface BannerAsset {
  /** Served path. Drop the file here and it appears. */
  src: string;
  /** What the generator should produce. */
  intended: string;
}

export const BANNER_ASSETS = {
  background: { src: '/games/vs-background.png', intended: '4096x2304, opaque' },
  boy:        { src: '/games/vs-boy.png',        intended: '2048x2048, transparent, half body, facing right' },
  girl:       { src: '/games/vs-girl.png',       intended: '2048x2048, transparent, half body, facing left' },
  shield:     { src: '/games/vs-shield.png',     intended: '4096x4096, transparent, includes the crown and VS' },
  crown:      { src: '/games/vs-crown.png',      intended: '2048x2048, transparent — only used if the shield art has no crown' },
  leagueBadge:{ src: '/games/league-badge.png',  intended: '1024x512, transparent' },
  trophy:     { src: '/games/trophy.png',        intended: '1024x1024, transparent' },
  ctaButton:  { src: '/games/cta-button.png',    intended: '2400x700, transparent, no text' },
} satisfies Record<string, BannerAsset>;

export type BannerAssetKey = keyof typeof BANNER_ASSETS;

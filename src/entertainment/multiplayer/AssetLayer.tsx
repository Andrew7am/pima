import { useState, type ReactNode } from 'react';
import { BANNER_ASSETS, type BannerAssetKey } from './bannerAssets';

/**
 * One layer of the banner: the real artwork if it is there, the drawing if it
 * is not.
 *
 * The check is the load itself rather than a build-time list, because the
 * files arrive from an image generator one at a time and nobody should have
 * to edit code between them. A missing file 404s, onError fires, and the
 * vector shows instead — which is also what happens if a file is corrupt or
 * still uploading.
 *
 * The image and the drawing are placed differently on purpose: a generated
 * PNG of one character needs its own box on the banner, while the vector it
 * replaces is authored in the banner's own coordinates and draws full-bleed.
 *
 * alt="" throughout — every one of these sits behind text that already says
 * what the banner is, so a screen reader should walk past rather than read
 * out eight descriptions of a background.
 */
export default function AssetLayer({
  asset,
  imgClassName,
  imgFit = 'object-contain',
  fallback,
}: {
  asset: BannerAssetKey;
  /** Where the generated image sits on the banner. */
  imgClassName: string;
  imgFit?: string;
  /** Drawn full-bleed, in the banner's own coordinates. */
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const { src } = BANNER_ASSETS[asset];

  if (failed) return <div className="absolute inset-0 pointer-events-none">{fallback}</div>;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
      className={`absolute pointer-events-none ${imgClassName} ${imgFit}`}
    />
  );
}

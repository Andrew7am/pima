import React, { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

// Google AdSense publisher id, e.g. "ca-pub-1234567890123456".
// Set VITE_ADSENSE_CLIENT in your .env once the AdSense account is approved.
// While it is empty, AdSlot renders nothing — so no broken ad boxes ship.
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

// IMPORTANT: AdSense is a WEB product. Google policy forbids running AdSense
// inside a mobile app (Capacitor WebView) — apps must use AdMob instead.
// So ads only ever load on the real website, never in the Android build.
const AD_ENABLED = !!ADSENSE_CLIENT && !Capacitor.isNativePlatform();

let scriptInjected = false;
function ensureAdSenseScript() {
  if (scriptInjected || typeof document === 'undefined') return;
  scriptInjected = true;
  const s = document.createElement('script');
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.async = true;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

interface AdSlotProps {
  slot: string;              // the ad-unit id from your AdSense dashboard
  format?: string;           // "auto" (default), "fluid", etc.
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A single responsive AdSense unit. Reusable placeholder you can drop between
 * house cards or under a listing. No-ops entirely on native and until a
 * publisher id is configured, so it is safe to place now and light up later.
 */
export default function AdSlot({ slot, format = 'auto', className, style }: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!AD_ENABLED) return;
    ensureAdSenseScript();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      /* AdSense not ready yet — it retries on its own once the script loads */
    }
  }, [slot]);

  if (!AD_ENABLED) return null;

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle block ${className || ''}`}
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, ScanLine, CameraOff } from 'lucide-react';

interface QRScannerProps {
  // Called with the decoded text the first time a QR is read. The parent
  // decides what to do (e.g. extract a room code and join).
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}

// In-app camera QR scanner. Uses getUserMedia + jsQR (dynamically imported so
// the decoder only loads when the user actually scans). Works on the website
// over HTTPS and inside the Capacitor Android WebView once the CAMERA runtime
// permission is granted.
export default function QRScanner({ onScan, onClose, title = 'امسح كود الغرفة', hint = 'وجّه الكاميرا نحو رمز QR الخاص بالغرفة' }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedRef = useRef(false);
  // Keep the latest onScan without re-running the camera effect.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let decode: ((data: Uint8ClampedArray, w: number, h: number, opts?: any) => { data: string } | null) | null = null;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || scannedRef.current || cancelled) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const result = decode ? decode(img.data, w, h, { inversionAttempts: 'dontInvert' }) : null;
            if (result && result.data) {
              scannedRef.current = true;
              onScanRef.current(result.data.trim());
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const mod = await import('jsqr');
        // jsQR ships as CommonJS — the callable is on .default under Vite's
        // interop, but fall back to the namespace itself just in case.
        decode = ((mod as { default?: unknown }).default ?? mod) as unknown as typeof decode;
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        if (cancelled) return;
        setStarting(false);
        tick();
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        const name = (e as Error).name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('لم يتم السماح بالوصول للكاميرا. فعّل إذن الكاميرا من إعدادات المتصفح/التطبيق وحاول مجدداً.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('لا توجد كاميرا متاحة على هذا الجهاز.');
        } else if (name === 'NotSupportedError') {
          setError('الكاميرا غير مدعومة هنا. تأكد من فتح الموقع عبر HTTPS، أو أدخل الكود يدوياً.');
        } else {
          setError('تعذّر تشغيل الكاميرا. جرّب إدخال الكود يدوياً.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4" dir="rtl">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 text-white/90 hover:text-white p-2 rounded-full bg-white/10"
        aria-label="إغلاق"
      >
        <X className="w-6 h-6" />
      </button>

      <h3 className="text-white text-sm font-black mb-4 flex items-center gap-2">
        <ScanLine className="w-5 h-5 text-amber-400" /> {title}
      </h3>

      {error ? (
        <div className="max-w-sm w-full bg-[#101a2e] border border-white/10 rounded-3xl p-6 text-center space-y-3">
          <CameraOff className="w-10 h-10 text-rose-400 mx-auto" />
          <p className="text-[12px] text-slate-200 font-bold leading-relaxed">{error}</p>
          <button type="button" onClick={onClose} className="mt-1 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black">
            حسناً
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden border-2 border-amber-400/40 bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-white/90 bg-black/40">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-xs font-bold">جارٍ تشغيل الكاميرا…</span>
            </div>
          )}
          {/* Scan frame + moving line */}
          <div className="absolute inset-8 border-2 border-white/70 rounded-2xl pointer-events-none" />
          {!starting && (
            <div className="absolute inset-x-8 top-8 h-0.5 bg-amber-400 shadow-[0_0_10px_2px_rgba(245,197,66,0.7)] animate-[scan_2s_ease-in-out_infinite] pointer-events-none" />
          )}
        </div>
      )}

      {!error && <p className="text-slate-400 text-[11px] font-bold mt-4 text-center max-w-xs">{hint}</p>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

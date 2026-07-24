import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine, Keyboard, CheckCircle2 } from 'lucide-react';
import { Booking } from '../../types';
import { parseBookingQr } from '../../lib/qr';

interface OwnerScannerProps {
  open: boolean;
  onClose: () => void;
  bookings: Booking[];
  onCheckIn: (booking: Booking) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarcodeDetectorCtor: any = typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined;
const bookingRef = (b: Booking) => b.id.replace(/^booking_/, '').slice(-6);

export default function OwnerScanner({ open, onClose, bookings, onCheckIn }: OwnerScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [done, setDone] = useState<Booking | null>(null);

  const supported = !!BarcodeDetectorCtor;

  const resolveBooking = (bookingId: string): Booking | null =>
    bookings.find((b) => b.id === bookingId) || bookings.find((b) => bookingRef(b) === bookingId) || null;

  const finish = (b: Booking) => {
    stop();
    setDone(b);
    onCheckIn(b);
  };

  const stop = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) { stop(); setError(''); setManual(false); setManualCode(''); setDone(null); return; }
    if (!supported) { setManual(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const c of codes) {
              const id = parseBookingQr(c.rawValue || '');
              if (id) { const b = resolveBooking(id); if (b) { finish(b); return; } }
            }
          } catch { /* frame not ready */ }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch {
        setError('تعذّر فتح الكاميرا. استخدم الإدخال اليدوي.');
        setManual(true);
      }
    })();
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submitManual = () => {
    const code = manualCode.trim().toLowerCase();
    const b = bookings.find((x) => bookingRef(x).toLowerCase() === code || x.id.toLowerCase() === code);
    if (b) finish(b); else setError('لم يتم العثور على حجز بهذا الرقم.');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" dir="rtl">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-black flex items-center gap-1.5"><ScanLine className="w-4 h-4" /> مسح رمز الوصول</span>
        <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-white/15"><X className="w-4 h-4" /></button>
      </div>

      {done ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
          <div className="text-base font-black">تم تسجيل وصول {done.organizationName || done.userName} ✓</div>
          <button type="button" onClick={onClose} className="mt-2 bg-white text-[#101B33] text-xs font-black px-5 py-2.5 rounded-2xl">تمام</button>
        </div>
      ) : manual ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <Keyboard className="w-8 h-8 text-white/70" />
          <p className="text-white/80 text-[12px] font-bold text-center">{supported ? 'أدخل رقم الحجز يدويًا:' : 'المسح غير مدعوم على هذا المتصفح — أدخل رقم الحجز يدويًا:'}</p>
          <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="رقم الحجز (آخر 6 أرقام)"
            className="w-full max-w-xs bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-center outline-none placeholder-white/40" />
          {error && <p className="text-rose-300 text-[11px] font-bold">{error}</p>}
          <button type="button" onClick={submitManual} disabled={!manualCode.trim()} className="bg-emerald-500 disabled:opacity-40 text-white text-xs font-black px-6 py-3 rounded-2xl">تسجيل وصول</button>
          {supported && <button type="button" onClick={() => { setManual(false); setError(''); }} className="text-white/70 text-[11px] font-bold underline">العودة للكاميرا</button>}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <div className="relative w-full max-w-xs aspect-square rounded-[28px] overflow-hidden border-2 border-white/30">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-8 border-2 border-white/80 rounded-2xl" />
          </div>
          <p className="text-white/80 text-[12px] font-bold text-center">وجّه الكاميرا نحو رمز QR الخاص بالضيف</p>
          {error && <p className="text-rose-300 text-[11px] font-bold">{error}</p>}
          <button type="button" onClick={() => setManual(true)} className="flex items-center gap-1 text-white/80 text-[11px] font-bold underline"><Keyboard className="w-3.5 h-3.5" /> إدخال يدوي</button>
        </div>
      )}
    </div>
  );
}

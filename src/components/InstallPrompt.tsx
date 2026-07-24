import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, X, Share } from 'lucide-react';

// The Chrome/Android "beforeinstallprompt" event isn't in the DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pima_install_dismissed';

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);
}

// Floating "install بيما" prompt for web visitors. Native Android (Chrome) fires
// beforeinstallprompt → one-tap install; iOS Safari can't, so we show the manual
// "Share → Add to Home Screen" hint. Hidden inside the Capacitor app, when
// already installed, or once the user dismisses it.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform() || isStandalone()) return;
    try { if (localStorage.getItem(DISMISS_KEY)) return; } catch { /* ignore */ }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS never fires the event — surface the manual hint after a short delay so
    // it doesn't compete with first paint.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) iosTimer = setTimeout(() => { setIosHint(true); setVisible(true); }, 4000);

    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md" dir="rtl">
      <div className="bg-white border border-[#D6D6C2] rounded-2xl shadow-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-[#3A6B4C] text-white flex items-center justify-center text-lg font-black">ب</div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-black text-[#2D2D1F]">أضف بيما لشاشتك الرئيسية</div>
          {iosHint ? (
            <div className="text-[10px] text-[#8A8A70] font-bold flex items-center gap-1 mt-0.5">
              اضغط <Share className="w-3 h-3 inline" /> ثم «إضافة إلى الشاشة الرئيسية»
            </div>
          ) : (
            <div className="text-[10px] text-[#8A8A70] font-bold mt-0.5">افتحها كتطبيق — أسرع وبدون متجر.</div>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 bg-[#3A6B4C] hover:bg-[#2D5A3F] text-white text-[11px] font-black px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            تثبيت
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 text-[#8A8A70] hover:text-[#4A4A3A] p-1" title="إغلاق">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

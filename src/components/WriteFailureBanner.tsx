import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { subscribeToWriteFailures, dismissWriteFailure, type WriteFailure } from '../lib/writeFeedback';

/**
 * The one place a save that did not happen becomes visible.
 *
 * Does not disappear on a timer. Everything else in a booking app can be
 * re-read from the screen; a write that was lost cannot, and a message about
 * it that vanishes after three seconds is barely better than the console
 * line it replaces. It goes when the person closes it.
 *
 * Rendered once, at the app root, above everything — including the owner
 * dashboard's own fixed bottom nav.
 */
export default function WriteFailureBanner() {
  const [failures, setFailures] = useState<WriteFailure[]>([]);

  useEffect(() => subscribeToWriteFailures(setFailures), []);

  if (failures.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] p-3 space-y-2 pointer-events-none"
      dir="rtl"
      role="alert"
      aria-live="assertive"
    >
      {failures.map((f) => (
        <div
          key={f.id}
          className="pointer-events-auto mx-auto max-w-md flex items-start gap-2.5 bg-[#7F1D1D] text-white rounded-2xl shadow-2xl px-3.5 py-3"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0 text-[12px] font-bold leading-relaxed">
            لم يتم حفظ «{f.what}».
            <span className="block font-medium text-white/80 mt-0.5">
              {/* The server's own reason when there is one: being told the
                  house is full is a different instruction from being told to
                  check the connection. */}
              {f.reason || 'التغيير ظاهر على الشاشة بس مانوصلش للسيرفر. راجع اتصالك وأعد المحاولة.'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => dismissWriteFailure(f.id)}
            aria-label="إغلاق"
            className="shrink-0 p-1 rounded-lg hover:bg-white/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

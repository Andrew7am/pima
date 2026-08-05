import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { tapFeedback } from '../lib/haptics';
import { useDialogFocus } from '../lib/useDialogFocus';

interface PimaSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The app's bottom sheet.
 *
 * Extracted because the same contract was being written out per screen and the
 * copies had already started to drift. A sheet here always means: a grab
 * handle, a dimmed backdrop that closes on click, a close button, Escape to
 * dismiss, the page behind locked from scrolling while it is up and restored
 * on every exit path, and a body that scrolls on its own up to 92dvh so a long
 * form never pushes the sheet off the screen.
 */
export default function PimaSheet({ open, onClose, title, subtitle, icon, children }: PimaSheetProps) {
  // Escape now lives in the hook alongside the focus trap — a sheet that traps
  // Tab must not be able to ship without a keyboard way out.
  const panelRef = useDialogFocus<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="relative w-full sm:max-w-md bg-[#FBF9F4] rounded-t-[28px] sm:rounded-[28px] sm:mb-6 max-h-[92dvh] flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.18)] outline-none animate-in slide-in-from-bottom duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
      >
        <span aria-hidden="true" className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[#DED6C4]" />

        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#EDE7DA] text-right">
          <div className="mt-1 min-w-0">
            <h4 className="text-[14px] font-black text-[#0A2342] flex items-center gap-1.5">
              {icon}
              {title}
            </h4>
            {subtitle && <p className="text-[10px] font-medium text-[#8A8A70] mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => { tapFeedback(); onClose(); }}
            aria-label="إغلاق"
            className="mt-1 w-9 h-9 rounded-full border border-[#EDE7DA] bg-white text-[#4A4A3A] flex items-center justify-center shrink-0 hover:bg-[#F1ECE0] transition-colors cursor-pointer pima-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

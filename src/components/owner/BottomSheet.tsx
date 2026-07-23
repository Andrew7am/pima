import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Shared owner bottom sheet: dimmed backdrop + spring-up panel, RTL, themed
// with the owner design tokens. Used across the Financial Center and the
// Rooms manager so the interaction is identical everywhere.
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative bg-[var(--color-owner-surface)] w-full max-w-md rounded-t-[28px] p-5 pb-8 max-h-[85vh] overflow-y-auto z-10 text-right"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="w-10 h-1.5 rounded-full bg-[var(--color-owner-border)] mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-[var(--color-owner-text)]">{title}</h3>
              <button type="button" onClick={onClose} className="p-1.5 rounded-full bg-[var(--color-owner-hover)] text-[var(--color-owner-secondary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

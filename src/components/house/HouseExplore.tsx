import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { tapFeedback } from '../../lib/haptics';
import PimaSheet from '../PimaSheet';

/**
 * «استكشف المكان» — the sections of a place as cards you open, not accordions
 * you unfold.
 *
 * Each card is a door: an icon, a headline, two or three facts, and a gold
 * pill. The body behind it is the section's existing content, untouched —
 * ExploreCard takes it as children and shows it in a sheet, so changing how a
 * section is reached did not mean rewriting what is in it.
 */
export function ExploreSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h3 className="text-[15px] font-black text-[#0A2342] flex items-center justify-center gap-2">
          <span aria-hidden="true" className="w-6 h-px bg-[#C9A24A]/40" />
          استكشف المكان
          <span aria-hidden="true" className="w-6 h-px bg-[#C9A24A]/40" />
        </h3>
        <p className="text-[10px] font-medium text-[#8A8A70]">اكتشف كل ما يقدمه هذا المكان</p>
      </div>

      {/* Seven columns, so a row can split 4/3 rather than in half — the hero
          is meant to weigh more than what sits beside it. */}
      <div className="grid grid-cols-7 gap-3 items-stretch">{children}</div>
    </div>
  );
}

interface ExploreCardProps {
  id: string;
  title: string;
  /** Line under the title on the card, and the sheet's subtitle. */
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Columns out of seven. */
  span: 3 | 4 | 7;
  /** The two or three facts that make the card worth opening. */
  preview?: React.ReactNode;
  /** Faded behind the card, or banded across it — never a boxed thumbnail. */
  image?: string;
  imageMode?: 'side' | 'band';
  cta: string;
  /** Staggers the entrance so the grid assembles rather than appears. */
  delay?: 0 | 1 | 2 | 3;
  children: React.ReactNode;
}

const SPAN: Record<number, string> = { 3: 'col-span-3', 4: 'col-span-4', 7: 'col-span-7' };
const DELAY: Record<number, string> = { 0: '', 1: 'pima-rise-1', 2: 'pima-rise-2', 3: 'pima-rise-3' };

export function ExploreCard({
  id, title, subtitle, icon: Icon, span, preview, image, imageMode = 'side', cta, delay = 0, children,
}: ExploreCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id={`explore-card-${id}`}
        type="button"
        onClick={() => { tapFeedback(); setOpen(true); }}
        className={`${SPAN[span]} ${DELAY[delay]} pima-rise relative flex flex-col justify-between text-right rounded-[30px] border border-[#EDE7DA] bg-white overflow-hidden shadow-[0_8px_24px_rgba(45,45,36,0.06),0_2px_6px_rgba(45,45,36,0.03)] hover:shadow-[0_14px_34px_rgba(201,162,74,0.16),0_3px_10px_rgba(45,45,36,0.05)] hover:border-[#E3CD9F] active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-200 ease-out cursor-pointer`}
      >
        {/* A photograph fades into the card rather than sitting in a box on
            it — no seam between picture and paper. */}
        {image && imageMode === 'side' && (
          <>
            <img src={image} alt="" referrerPolicy="no-referrer" aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/2 object-cover" />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-transparent via-white/85 to-white" />
          </>
        )}

        <div className="relative p-4">
          <span className="w-10 h-10 rounded-full bg-[#F6F0E2] flex items-center justify-center mb-3">
            <Icon className="w-[18px] h-[18px] text-[#C9A24A]" />
          </span>
          <span className={`block font-black text-[#0A2342] leading-tight ${span === 4 ? 'text-[15px]' : 'text-[13.5px]'}`}>{title}</span>
          {subtitle && <span className="block text-[10px] font-medium text-[#8A8A70] mt-1 leading-snug">{subtitle}</span>}
          {preview && <div className={`mt-2.5 ${image && imageMode === 'side' ? 'max-w-[76%]' : ''}`}>{preview}</div>}
        </div>

        {image && imageMode === 'band' && (
          <img src={image} alt="" referrerPolicy="no-referrer" aria-hidden="true" className="relative w-full h-24 object-cover" />
        )}

        <div className="relative p-4 pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EBD9B4] bg-[#FDF9EF] text-[#B8944E] px-3.5 py-1.5 text-[10.5px] font-black">
            <ChevronLeft className="w-3.5 h-3.5" />
            {cta}
          </span>
        </div>
      </button>

      <PimaSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={subtitle}
        icon={<Icon className="w-4 h-4 text-[#C9A24A]" />}
      >
        {children}
      </PimaSheet>
    </>
  );
}

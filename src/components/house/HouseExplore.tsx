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
        <h3 className="text-[16px] font-black text-[#0A2342] flex items-center justify-center gap-2.5">
          <span aria-hidden="true" className="w-8 h-px bg-[#C9A24A]/50" />
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[#C9A24A]" />
          استكشف المكان
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[#C9A24A]" />
          <span aria-hidden="true" className="w-8 h-px bg-[#C9A24A]/50" />
        </h3>
        <p className="text-[10.5px] font-medium text-[#8A8A70]">اكتشف كل ما يقدمه هذا المكان</p>
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
  /** Warm cream panels give the grid its rhythm; white is the default. */
  tone?: 'white' | 'cream';
  /** The two or three facts that make the card worth opening. */
  preview?: React.ReactNode;
  /** Faded into the card on its side, or banded across it — never boxed. */
  image?: string;
  imageMode?: 'side' | 'band';
  /** Absolutely-positioned ornament behind the content — a watermark glyph,
   *  never information. */
  decor?: React.ReactNode;
  cta: string;
  /** Staggers the entrance so the grid assembles rather than appears. */
  delay?: 0 | 1 | 2 | 3;
  children: React.ReactNode;
}

const SPAN: Record<number, string> = { 3: 'col-span-3', 4: 'col-span-4', 7: 'col-span-7' };
const DELAY: Record<number, string> = { 0: '', 1: 'pima-rise-1', 2: 'pima-rise-2', 3: 'pima-rise-3' };

// The two card papers. The fade at a photo's edge must end in the paper's own
// colour, so each tone carries its hex for the gradient stop.
const TONES = {
  white: { bg: 'bg-white', hex: '#FFFFFF', border: 'border-[#EDE7DA]', disc: 'bg-[#F6F0E2]' },
  cream: { bg: 'bg-[#FBF6EC]', hex: '#FBF6EC', border: 'border-[#EBD9B4]/60', disc: 'bg-white' },
} as const;

export function ExploreCard({
  id, title, subtitle, icon: Icon, span, tone = 'white', preview, image, imageMode = 'side', decor, cta, delay = 0, children,
}: ExploreCardProps) {
  const [open, setOpen] = useState(false);
  const t = TONES[tone];

  return (
    <>
      <button
        id={`explore-card-${id}`}
        type="button"
        onClick={() => { tapFeedback(); setOpen(true); }}
        className={`${SPAN[span]} ${DELAY[delay]} ${t.bg} ${t.border} pima-rise relative flex flex-col justify-between text-right rounded-[30px] border overflow-hidden shadow-[0_10px_28px_rgba(45,45,36,0.07),0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_16px_38px_rgba(201,162,74,0.18),0_3px_10px_rgba(45,45,36,0.05)] hover:border-[#E3CD9F] active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-200 ease-out cursor-pointer`}
      >
        {/* The photograph lives on the card's left, fading into the paper at
            its right edge. The gradient is scoped to the image's own box and
            runs PHYSICALLY rightwards (to-r), because Tailwind gradients do
            not flip in RTL — an inset-0 to-l veil here is what once painted
            the photo white and left the card looking broken. */}
        {decor}

        {image && imageMode === 'side' && (
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[58%] overflow-hidden">
            {/* The slow Ken Burns breath the hero already uses — photographs
                on these cards drift rather than sit. */}
            <img src={image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover pima-ken-burns" />
            <span
              className="absolute inset-0"
              style={{ background: `linear-gradient(to right, transparent 30%, ${t.hex} 92%)` }}
            />
          </span>
        )}

        <div className={`relative p-4 ${image && imageMode === 'side' ? 'items-end text-right' : ''}`}>
          <span className={`${t.disc} w-11 h-11 rounded-full border border-[#EBD9B4]/70 shadow-[0_2px_6px_rgba(184,148,78,0.12)] flex items-center justify-center mb-3 ${image && imageMode === 'side' ? 'me-auto' : ''}`}>
            <Icon className="w-5 h-5 text-[#C9A24A]" />
          </span>
          <span className={`block font-black text-[#0A2342] leading-tight ${span >= 4 ? 'text-[17px]' : 'text-[15px]'}`}>{title}</span>
          {subtitle && <span className="block text-[10.5px] font-medium text-[#8A8A70] mt-1 leading-snug">{subtitle}</span>}
          {preview && <div className={`mt-3 ${image && imageMode === 'side' ? 'max-w-[62%] me-auto' : ''}`}>{preview}</div>}
        </div>

        {image && imageMode === 'band' && (
          <span aria-hidden="true" className="relative block w-full h-28 overflow-hidden">
            <img src={image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover pima-ken-burns" />
            {/* Band tops fade into the paper above them for the same reason. */}
            <span className="absolute inset-x-0 top-0 h-8" style={{ background: `linear-gradient(to bottom, ${t.hex}, transparent)` }} />
          </span>
        )}

        <div className="relative p-4 pt-3.5">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#D9BC85] bg-white text-[#B8944E] px-4 py-2 text-[11.5px] font-black shadow-[0_2px_8px_rgba(184,148,78,0.15)]">
            <ChevronLeft className="w-4 h-4" />
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

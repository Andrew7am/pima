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
        <h3 className="text-[16px] font-black text-[var(--ds-brand)] flex items-center justify-center gap-2.5">
          <span aria-hidden="true" className="w-8 h-px bg-[color-mix(in_srgb,var(--ds-accent)_50%,transparent)]" />
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[var(--ds-accent)]" />
          استكشف المكان
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[var(--ds-accent)]" />
          <span aria-hidden="true" className="w-8 h-px bg-[color-mix(in_srgb,var(--ds-accent)_50%,transparent)]" />
        </h3>
        <p className="text-[11px] font-medium text-[var(--ds-text-2)]">اكتشف كل ما يقدمه هذا المكان</p>
      </div>

      {/* Two columns, placed explicitly rather than left to flow: the menu
          holds one column over both rows while About and Rooms stack in the
          other, and facilities runs the full width beneath them. In RTL
          column 1 is the right-hand one. */}
      <div className="grid grid-cols-2 grid-rows-[auto_auto] gap-3 items-stretch">{children}</div>
    </div>
  );
}

interface ExploreCardProps {
  id: string;
  title: string;
  /** Line under the title on the card, and the sheet's subtitle. */
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where in the two-column grid this sits. Explicit, because the menu has to
   *  hold a whole column while two cards stack beside it — flow order alone
   *  cannot express that. */
  place: 'right-top' | 'right-bottom' | 'left-tall' | 'full';
  /** Lays the card out along the row: header, then content, then the CTA at
   *  the far end. Only useful at full width. */
  horizontal?: boolean;
  /** Warm cream panels give the grid its rhythm; white is the default. */
  tone?: 'white' | 'cream';
  /** The two or three facts that make the card worth opening. */
  preview?: React.ReactNode;
  /** Faded into the card on its side, banded across it, or a small portrait
   *  tile standing in for the icon — never boxed. `side` needs a wide card:
   *  in a half-column it takes 60% of the width and leaves the text a gutter. */
  image?: string;
  imageMode?: 'side' | 'band' | 'thumb';
  /** Absolutely-positioned ornament behind the content — a watermark glyph,
   *  never information. */
  decor?: React.ReactNode;
  cta: string;
  /** Staggers the entrance so the grid assembles rather than appears. */
  delay?: 0 | 1 | 2 | 3;
  children: React.ReactNode;
}

// In an RTL grid, column 1 is the right-hand one.
const PLACE: Record<NonNullable<ExploreCardProps['place']>, string> = {
  'right-top': 'col-start-1 row-start-1',
  'right-bottom': 'col-start-1 row-start-2',
  'left-tall': 'col-start-2 row-start-1 row-span-2',
  full: 'col-span-2',
};
const DELAY: Record<number, string> = { 0: '', 1: 'pima-rise-1', 2: 'pima-rise-2', 3: 'pima-rise-3' };

// The two card papers. The fade at a photo's edge must end in the paper's own
// colour, so each tone carries its hex for the gradient stop.
const TONES = {
  white: { bg: 'bg-[var(--ds-surface)]', hex: 'var(--ds-surface)', border: 'border-[var(--ds-border)]', disc: 'bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-surface))]' },
  cream: { bg: 'bg-[var(--ds-raised)]', hex: 'var(--ds-raised)', border: 'border-[color-mix(in_srgb,var(--ds-accent-soft)_60%,transparent)]', disc: 'bg-[var(--ds-surface)]' },
} as const;

export function ExploreCard({
  id, title, subtitle, icon: Icon, place, horizontal = false, tone = 'white', preview, image, imageMode = 'side', decor, cta, delay = 0, children,
}: ExploreCardProps) {
  const [open, setOpen] = useState(false);
  const t = TONES[tone];
  const big = place === 'left-tall' || place === 'full';
  // Only the feature card explains itself on its face. On the satellites the
  // subtitle cost more height than the facts underneath it — «أنواع الغرف
  // المتاحة وسعة كل منها» wrapped to two lines in a half column to say what
  // the title had already said. The sheet still carries it as its subtitle,
  // so nothing is lost; it is just no longer paid for four times.
  const showSubtitle = subtitle && place === 'left-tall';

  return (
    <>
      <button
        id={`explore-card-${id}`}
        type="button"
        onClick={() => { tapFeedback(); setOpen(true); }}
        className={`${PLACE[place]} ${DELAY[delay]} ${t.bg} ${t.border} pima-rise relative flex text-right rounded-[30px] border overflow-hidden shadow-[0_10px_28px_rgba(45,45,36,0.07),0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_16px_38px_rgba(201,162,74,0.18),0_3px_10px_rgba(45,45,36,0.05)] hover:border-[var(--ds-accent-soft)] active:scale-[0.98] transition-[transform,box-shadow,border-color] duration-200 ease-out cursor-pointer ${
          horizontal ? 'flex-col gap-2.5 p-4' : 'flex-col justify-between'
        }`}
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

        {/* Horizontal: a strip, not a panel. The heading holds one end of the
            row and the CTA the other; the content sits on its own line below.
            It shared the row at first and a phone had nothing left to give it —
            `flex-1 min-w-0` shrank it to zero width and the chips vanished. */}
        {horizontal ? (
          <>
            <span className="relative flex items-center gap-3 w-full">
              <span className={`${t.disc} w-11 h-11 rounded-full border border-[color-mix(in_srgb,var(--ds-accent-soft)_70%,transparent)] shadow-[0_2px_6px_rgba(184,148,78,0.12)] flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5 text-[var(--ds-accent)]" />
              </span>
              <span className="flex-1 min-w-0 leading-tight">
                <span className="block text-[14px] font-black text-[var(--ds-brand)]">{title}</span>
                {showSubtitle && <span className="block text-[11px] font-medium text-[var(--ds-text-2)] mt-0.5 leading-snug truncate">{subtitle}</span>}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--ds-accent-soft)] bg-[var(--ds-surface)] text-[var(--ds-accent-deep)] px-3.5 py-2 text-[11px] font-black shadow-[0_2px_8px_rgba(184,148,78,0.15)] shrink-0">
                <ChevronLeft className="w-3.5 h-3.5" />
                {cta}
              </span>
            </span>
            {preview && <div className="relative w-full">{preview}</div>}
          </>
        ) : (
        <div className={`relative p-4 ${image && imageMode === 'side' ? 'items-end text-right' : ''}`}>
          {image && imageMode === 'thumb' ? (
            // The photograph earns the icon's place: on a card this narrow it
            // says more about the house than the glyph does.
            <span className="block w-11 h-12 rounded-2xl overflow-hidden border border-[color-mix(in_srgb,var(--ds-accent-soft)_70%,transparent)] shadow-[0_2px_6px_rgba(184,148,78,0.12)] mb-2.5">
              <img src={image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover pima-ken-burns" />
            </span>
          ) : (
          <span className={`${t.disc} w-11 h-11 rounded-full border border-[color-mix(in_srgb,var(--ds-accent-soft)_70%,transparent)] shadow-[0_2px_6px_rgba(184,148,78,0.12)] flex items-center justify-center mb-3 ${image && imageMode === 'side' ? 'me-auto' : ''}`}>
            <Icon className="w-5 h-5 text-[var(--ds-accent)]" />
          </span>
          )}
          <span className={`block font-black text-[var(--ds-brand)] leading-tight ${big ? 'text-[17px]' : 'text-[15px]'}`}>{title}</span>
          {showSubtitle && <span className="block text-[11px] font-medium text-[var(--ds-text-2)] mt-1 leading-snug">{subtitle}</span>}
          {preview && <div className={`mt-2.5 ${image && imageMode === 'side' ? 'max-w-[62%] me-auto' : ''}`}>{preview}</div>}
        </div>
        )}

        {!horizontal && image && imageMode === 'band' && (
          // The photograph is positioned out of the flow so it cannot set the
          // band's height: in flow its intrinsic size pushed the strip to
          // 109px and `min-h` is a floor, not a ceiling. Now the band is
          // exactly its minimum and grows only into a tall column's slack.
          <span aria-hidden="true" className="relative block w-full flex-1 min-h-20 overflow-hidden">
            <img src={image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover pima-ken-burns" />
            {/* Band tops fade into the paper above them for the same reason. */}
            <span className="absolute inset-x-0 top-0 h-8" style={{ background: `linear-gradient(to bottom, ${t.hex}, transparent)` }} />
          </span>
        )}

        {!horizontal && (
          // The card is itself the button; the pill is the affordance, not a
          // second control, so it does not need a padded block of its own.
          <div className="relative px-4 pb-4 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--ds-accent-soft)] bg-[var(--ds-surface)] text-[var(--ds-accent-deep)] px-3.5 py-1.5 text-[11px] font-black shadow-[0_2px_8px_rgba(184,148,78,0.15)]">
              <ChevronLeft className="w-3.5 h-3.5" />
              {cta}
            </span>
          </div>
        )}
      </button>

      <PimaSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={subtitle}
        icon={<Icon className="w-4 h-4 text-[var(--ds-accent)]" />}
      >
        {children}
      </PimaSheet>
    </>
  );
}

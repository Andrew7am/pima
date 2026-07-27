import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BannerCanvas, { BANNER_BOX, DEFAULT_LAYOUT } from './BannerCanvas';
import type { PromoBanner } from '../../types';

function banner(placement: PromoBanner['placement']): PromoBanner {
  return {
    id: 'b1', placement, isActive: true, sort: 0,
    badge: 'عرض خاص', title: 'بيت البابا كيرلس', subtitle: 'خصم ٣٠٪', ctaText: 'احجز الآن',
    layout: DEFAULT_LAYOUT(placement),
  } as unknown as PromoBanner;
}

/** Every font size the canvas emits, as raw CSS values. */
function fontUnits(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-el] *'))
    .map((el) => el.style.fontSize)
    .filter(Boolean);
}

describe('BannerCanvas type scaling', () => {
  // Regression: sizes were cqw, so a box wider than the 360px design width
  // scaled every font by that factor. At a 1112px desktop width a 16px title
  // rendered at 62px inside a 176px-tall box — text overlapped and spilled out.
  // Anchoring to height keeps the composition intact at any width.
  it('sizes text against the box height, never its width', () => {
    const { container } = render(
      <BannerCanvas banner={banner('carousel')} layout={DEFAULT_LAYOUT('carousel')} />,
    );
    const units = fontUnits(container);

    expect(units.length).toBeGreaterThan(0);
    expect(units.every((u) => u.endsWith('cqh'))).toBe(true);
    expect(units.some((u) => u.includes('cqw'))).toBe(false);
  });

  // cqh only resolves inside a container that measures both axes.
  it('declares a size container so cqh resolves', () => {
    const { container } = render(
      <BannerCanvas banner={banner('carousel')} layout={DEFAULT_LAYOUT('carousel')} />,
    );
    const canvas = container.querySelector<HTMLElement>('[style*="container-type"]');
    expect(canvas?.style.containerType).toBe('size');
  });

  // The two placements are designed at different heights. Sharing one constant
  // would render countdown text at 128/176 = 73% of its designed size.
  it('scales each placement against its own design height', () => {
    const carousel = render(
      <BannerCanvas banner={banner('carousel')} layout={DEFAULT_LAYOUT('carousel')} />,
    );
    const countdown = render(
      <BannerCanvas banner={banner('countdown')} layout={DEFAULT_LAYOUT('countdown')} />,
    );

    const titleOf = (c: HTMLElement) =>
      parseFloat(c.querySelector<HTMLElement>('[data-el="title"] h2')!.style.fontSize);

    // Same 16px design title, but expressed against 176 vs 128 — so the
    // countdown's percentage must be the larger of the two.
    const a = titleOf(carousel.container);
    const b = titleOf(countdown.container);
    expect(b / a).toBeCloseTo(BANNER_BOX.carousel.height / BANNER_BOX.countdown.height, 2);
  });
});

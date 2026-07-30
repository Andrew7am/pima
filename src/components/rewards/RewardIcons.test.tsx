import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TierMedal, Rosette, CoinStack, PassportStamp, markForId } from './RewardIcons';

// The failure these guard against is silent: two SVGs on one screen that both
// define a gradient called "gold" will both resolve url(#gold) to whichever
// mounted last, and one medal renders in the other's metal. Nothing throws.

const idsIn = (root: HTMLElement) =>
  [...root.querySelectorAll('linearGradient[id], radialGradient[id], clipPath[id]')].map((n) => n.id);

describe('reward icon gradients are per-instance', () => {
  it('gives every tier medal on a page its own gradient ids', () => {
    const { container } = render(
      <>
        <TierMedal metal="bronze" />
        <TierMedal metal="silver" />
        <TierMedal metal="gold" />
        <TierMedal metal="diamond" />
      </>,
    );
    const ids = idsIn(container);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ids distinct across different icon types too', () => {
    const { container } = render(
      <>
        <TierMedal metal="gold" />
        <Rosette />
        <Rosette locked />
        <CoinStack />
      </>,
    );
    const ids = idsIn(container);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every url(#…) reference at an element that exists in its own svg', () => {
    const { container } = render(
      <>
        <TierMedal metal="bronze" />
        <TierMedal metal="diamond" />
      </>,
    );
    for (const svg of container.querySelectorAll('svg')) {
      const defined = new Set([...svg.querySelectorAll('[id]')].map((n) => n.id));
      for (const el of svg.querySelectorAll('*')) {
        for (const attr of ['fill', 'stroke', 'clip-path']) {
          const v = el.getAttribute(attr);
          const m = v?.match(/url\(#([^)]+)\)/);
          if (m) expect(defined.has(m[1])).toBe(true);
        }
      }
    }
  });
});

describe('a house always stamps the same way', () => {
  it('is stable for the same id and spreads across the mark set', () => {
    expect(markForId('house-abc')).toBe(markForId('house-abc'));
    const marks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => markForId(`house-${s}`)));
    expect(marks.size).toBeGreaterThan(1); // not everything collapsing to one mark
  });

  it('renders each mark without leaving the stamp empty', () => {
    for (const mark of ['dome', 'basilica', 'tower', 'chapel'] as const) {
      const { container } = render(<PassportStamp mark={mark} />);
      expect(container.querySelectorAll('path').length).toBeGreaterThan(2);
    }
  });
});

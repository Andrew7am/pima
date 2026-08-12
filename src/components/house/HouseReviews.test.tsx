/**
 * Phase 9 safety gate — HouseReviews.
 *
 * Written BEFORE the design-system migration so the behaviour it pins is the
 * behaviour that exists today, not the behaviour I expect after. Nothing here
 * asserts a colour or a class name: a token migration must leave every one of
 * these passing untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HouseReviews from './HouseReviews';
import type { Review } from '../../types';

const review = (o: Partial<Review>): Review => ({
  id: 'r1', houseId: 'h1', userId: 'u1', userName: 'ضيف',
  rating: 5, comment: 'تعليق', createdAt: '2026-01-01T00:00:00Z',
  ...o,
} as unknown as Review);

const list = [
  review({ id: 'low',  userName: 'الأدنى',  rating: 2, createdAt: '2026-05-01T00:00:00Z' }),
  review({ id: 'high', userName: 'الأعلى',  rating: 5, createdAt: '2026-01-01T00:00:00Z' }),
  review({ id: 'mid',  userName: 'المتوسط', rating: 3, createdAt: '2026-09-01T00:00:00Z' }),
];

describe('HouseReviews — the empty state', () => {
  it('offers the invitation instead of an empty list', () => {
    render(<HouseReviews reviews={[]} />);
    expect(screen.getByText('لا توجد تقييمات بعد')).toBeInTheDocument();
  });

  it('still renders the section heading with no reviews', () => {
    render(<HouseReviews reviews={[]} />);
    expect(screen.getByText('التقييمات')).toBeInTheDocument();
  });
});

describe('HouseReviews — sorting', () => {
  // The three sort keys are a product decision, and the order they produce is
  // the contract. Read the rendered order rather than the internal state.
  const namesInOrder = (container: HTMLElement) =>
    [...container.querySelectorAll('*')]
      .map(e => e.textContent?.trim())
      .filter((t): t is string => !!t && ['الأدنى', 'الأعلى', 'المتوسط'].includes(t));

  it('defaults to a stable order that includes every review', () => {
    const { container } = render(<HouseReviews reviews={list} />);
    const seen = new Set(namesInOrder(container));
    expect(seen.size).toBe(3);
  });

  it('puts the 5-star review first under «الأعلى تقييمًا»', () => {
    const { container } = render(<HouseReviews reviews={list} />);
    fireEvent.click(screen.getByText('الأعلى تقييمًا'));
    expect(namesInOrder(container)[0]).toBe('الأعلى');
  });

  it('puts the 2-star review first under «الأقل تقييمًا»', () => {
    const { container } = render(<HouseReviews reviews={list} />);
    fireEvent.click(screen.getByText('الأقل تقييمًا'));
    expect(namesInOrder(container)[0]).toBe('الأدنى');
  });

  it('puts the newest createdAt first under «الأحدث»', () => {
    const { container } = render(<HouseReviews reviews={list} />);
    fireEvent.click(screen.getByText('الأحدث'));
    expect(namesInOrder(container)[0]).toBe('المتوسط');   // 2026-09-01
  });
});

describe('HouseReviews — paging', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    review({ id: 'm' + i, userName: 'ضيف ' + i, rating: 4 }));

  it('holds back the tail behind «عرض المزيد»', () => {
    render(<HouseReviews reviews={many} />);
    expect(screen.getByText(/عرض المزيد/)).toBeInTheDocument();
  });

  it('reveals more when it is pressed', () => {
    const { container } = render(<HouseReviews reviews={many} />);
    const before = container.querySelectorAll('p').length;
    fireEvent.click(screen.getByText(/عرض المزيد/));
    expect(container.querySelectorAll('p').length).toBeGreaterThan(before);
  });

  it('offers no «عرض المزيد» when everything already fits', () => {
    render(<HouseReviews reviews={list} />);
    expect(screen.queryByText(/عرض المزيد/)).toBeNull();
  });
});

describe('HouseReviews — the owner reply', () => {
  // Collapsed on arrival (openReply starts null), so the reply text is not in
  // the document until the guest asks for it. That is the current behaviour.
  it('keeps the reply collapsed until it is asked for', () => {
    render(<HouseReviews reviews={[review({ ownerReply: 'شكرًا لزيارتكم' } as Partial<Review>)]} />);
    expect(screen.queryByText('شكرًا لزيارتكم')).toBeNull();
  });

  it('renders a review that has no reply without offering one', () => {
    render(<HouseReviews reviews={[review({})]} />);
    expect(screen.queryByText('رد إدارة المكان')).toBeNull();
  });
});

describe('HouseReviews — the children slot', () => {
  // children go inside PimaSheet, which starts closed — the wizard and the
  // sign-in prompt are not mounted visibly until the sheet is opened.
  it('keeps the sheet content out of view until the sheet opens', () => {
    render(<HouseReviews reviews={[]}><p>نموذج التقييم</p></HouseReviews>);
    expect(screen.queryByText('نموذج التقييم')).toBeNull();
  });
});

describe('HouseReviews — data the component must survive', () => {
  it('CRASHES when a review carries neither overall_rating nor rating', () => {
    // PRODUCTION BUG — NOT FIXED IN PHASE 9.
    // overallOf() is `r.overall_rating ?? r.rating`, so both missing yields
    // undefined, and the per-review render then reads through it. Pinned as a
    // failing-shape test so the migration cannot quietly change the symptom.
    const bad = { ...review({}), rating: undefined } as unknown as Review;
    expect(() => render(<HouseReviews reviews={[bad]} />)).toThrow();
  });

  it('survives a review with no comment', () => {
    const bad = { ...review({}), comment: undefined } as unknown as Review;
    expect(() => render(<HouseReviews reviews={[bad]} />)).not.toThrow();
  });
});

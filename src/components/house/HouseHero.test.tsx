/**
 * Phase 9 safety gate — HouseHero.
 *
 * The hero owns three DOM IDs and three aria-labels that HouseDetail's own
 * tests already depend on, plus the image carousel. It is also the screen's
 * media surface, so it is where the --ds-media / --ds-on-media roles would
 * land — which makes it the child most likely to be changed and the one most
 * worth pinning first.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HouseHero from './HouseHero';
import type { RetreatHouse } from '../../types';

const house = (o: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h1', name: 'بيت الملاك ميخائيل', description: 'وصف',
  address: 'العجمي، الإسكندرية', governorate: 'الإسكندرية',
  status: 'approved', propertyType: 'conference',
  bedsCount: 40, roomsCount: 10, roomCapacity: 4,
  pricePerNightPerPerson: 150, rating: 4.5, suitability: ['youth'],
  services: [], roomsDescription: 'غرف', seaProximity: 'near',
  images: ['data:image/gif;base64,R0lGODlhAQABAAAAACw=',
           'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
           'data:image/gif;base64,R0lGODlhAQABAAAAACw='],
  ownerId: 'o1', ownerName: 'المالك', paymentMethods: [],
  ...o,
} as unknown as RetreatHouse);

const renderHero = (over: Record<string, unknown> = {}) => {
  const props = {
    house: house(), reviewsCount: 12, isFavorited: false, isCopied: false,
    onBack: vi.fn(), onShare: vi.fn(), onToggleFavorite: vi.fn(), ...over,
  };
  render(<HouseHero {...(props as unknown as React.ComponentProps<typeof HouseHero>)} />);
  return { props };
};

describe('HouseHero — the DOM id contract', () => {
  // HouseDetail.test.tsx asserts these ids. They are a contract between the
  // two files, not an implementation detail.
  it('keeps the three ids the parent depends on', () => {
    renderHero();
    const container = document.body;
    for (const id of ['detail-back-btn', 'share-detail-h1', 'toggle-fav-detail-h1'])
      expect(container.querySelector(`#${id}`)).not.toBeNull();
  });

  it('derives the share and favourite ids from the house id', () => {
    renderHero({ house: house({ id: 'xyz' }) });
    const container = document.body;
    expect(container.querySelector('#share-detail-xyz')).not.toBeNull();
    expect(container.querySelector('#toggle-fav-detail-xyz')).not.toBeNull();
  });
});

describe('HouseHero — accessible names', () => {
  it('labels back, share and favourite in their resting state', () => {
    renderHero();
    expect(screen.getByLabelText('رجوع')).toBeInTheDocument();
    expect(screen.getByLabelText('مشاركة')).toBeInTheDocument();
    expect(screen.getByLabelText('إضافة للمفضلة')).toBeInTheDocument();
  });

  it('swaps the favourite label once the house is favourited', () => {
    renderHero({ isFavorited: true });
    expect(screen.getByLabelText('إزالة من المفضلة')).toBeInTheDocument();
  });

  it('swaps the share label while the link is freshly copied', () => {
    renderHero({ isCopied: true });
    expect(screen.getByLabelText('تم نسخ الرابط')).toBeInTheDocument();
  });
});

describe('HouseHero — the handlers', () => {
  it('calls onBack', () => {
    const { props } = renderHero();
    fireEvent.click(screen.getByLabelText('رجوع'));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('calls onShare', () => {
    const { props } = renderHero();
    fireEvent.click(screen.getByLabelText('مشاركة'));
    expect(props.onShare).toHaveBeenCalled();
  });

  it('passes the house id to onToggleFavorite', () => {
    const { props } = renderHero({ house: house({ id: 'xyz' }) });
    fireEvent.click(screen.getByLabelText('إضافة للمفضلة'));
    expect(props.onToggleFavorite).toHaveBeenCalledWith('xyz');
  });
});

describe('HouseHero — the carousel', () => {
  it('offers next and previous when there is more than one image', () => {
    renderHero();
    expect(screen.getByLabelText('الصورة التالية')).toBeInTheDocument();
    expect(screen.getByLabelText('الصورة السابقة')).toBeInTheDocument();
  });

  it('steps forward without throwing', () => {
    renderHero();
    expect(() => fireEvent.click(screen.getByLabelText('الصورة التالية'))).not.toThrow();
  });

  it('wraps backwards from the first image without throwing', () => {
    renderHero();
    expect(() => fireEvent.click(screen.getByLabelText('الصورة السابقة'))).not.toThrow();
  });

  it('numbers each thumbnail for a screen reader', () => {
    renderHero();
    expect(screen.getByLabelText('عرض الصورة 1')).toBeInTheDocument();
  });
});

describe('HouseHero — data the hero must survive', () => {
  it('renders a house with no images at all', () => {
    expect(() => renderHero({ house: house({ images: [] }) })).not.toThrow();
  });

  it('renders a house with a single image', () => {
    expect(() => renderHero({ house: house({ images: ['data:image/gif;base64,R0lGODlhAQABAAAAACw='] }) }))
      .not.toThrow();
  });

  it('renders with no reviews counted', () => {
    expect(() => renderHero({ reviewsCount: 0 })).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UserDashboard from './UserDashboard';
import type { RetreatHouse, User } from '../types';
import { loadHousesAvailability, loadHouseBookingCounts } from '../lib/db';

/**
 * SAFETY NET, written BEFORE the design-system migration and deliberately not
 * changing a line of the screen.
 *
 * Guest Browse is the most-visited public screen in the app and had no tests
 * at all. Everything asserted here was read out of the current implementation
 * — chiefly `matchesCriteria` and the sort comparator — rather than decided
 * here. If one of these fails after the migration, the migration changed
 * behaviour, which is the whole point of writing them first.
 *
 * MOCKED, and only this: ../lib/db. It is the screen's sole network edge
 * (loadHousesAvailability and loadHouseBookingCounts, both Supabase RPCs).
 * Everything else — FilterSheet, the pricing and banner libraries, the
 * reveal/parallax hooks — runs for real. The hooks already degrade gracefully
 * where IntersectionObserver is missing, which is the case in jsdom.
 */

vi.mock('../lib/db', () => ({
  loadHousesAvailability: vi.fn().mockResolvedValue(null),
  loadHouseBookingCounts: vi.fn().mockResolvedValue(null),
}));

const house = (over: Partial<RetreatHouse> = {}): RetreatHouse => ({
  id: 'h1',
  name: 'بيت الملاك ميخائيل',
  description: 'بيت خلوة هادئ على البحر',
  address: 'العجمي، الإسكندرية',
  governorate: 'الإسكندرية',
  status: 'approved',
  propertyType: 'conference',
  bedsCount: 40,
  pricePerNightPerPerson: 150,
  rating: 4.5,
  suitability: ['youth'],
  services: ['واي فاي'],
  roomsDescription: 'غرف مشتركة',
  seaProximity: 'near',
  images: [],
  ownerId: 'o1',
  ownerName: 'المالك',
  // roomsCount and roomCapacity are read straight into arabicNumber() with no
  // fallback, so a fixture missing them crashes the render rather than just
  // rendering an empty chip. Everything the card reads is set here.
  roomsCount: 10,
  roomCapacity: 4,
  ...over,
} as unknown as RetreatHouse);

const renderBrowse = (over: Partial<React.ComponentProps<typeof UserDashboard>> = {}) => {
  const onSelectHouse = vi.fn();
  const onToggleFavorite = vi.fn();
  const onSelectRewards = vi.fn();
  const onOpenMap = vi.fn();
  render(
    <UserDashboard
      houses={[house()]}
      currentUser={null}
      onSelectHouse={onSelectHouse}
      onSelectRewards={onSelectRewards}
      onToggleFavorite={onToggleFavorite}
      onOpenMap={onOpenMap}
      promoBanners={[]}
      {...over}
    />,
  );
  return { onSelectHouse, onToggleFavorite, onSelectRewards, onOpenMap };
};

/** The cards actually on screen, by the per-house id the list renders. */
const cardIds = () =>
  Array.from(document.querySelectorAll('[id^="house-card-"]')).map((el) => el.id.replace('house-card-', ''));

beforeEach(() => {
  vi.mocked(loadHousesAvailability).mockResolvedValue(null);
  vi.mocked(loadHouseBookingCounts).mockResolvedValue(null);
});

describe('a logged-out visitor can browse', () => {
  it('renders the list without an account', () => {
    renderBrowse();
    expect(screen.getByText('بيت الملاك ميخائيل')).toBeInTheDocument();
  });

  it('keeps the search, map, filter and sort controls reachable', () => {
    renderBrowse();
    // These ids are what the rest of the app and any future test hangs off.
    for (const id of ['user-search-query', 'open-map-btn', 'toggle-filters-btn', 'sort-houses-select', 'house-list-anchor']) {
      expect(document.getElementById(id), id).toBeTruthy();
    }
  });

  it('does not offer the loyalty card, which belongs to an account', () => {
    renderBrowse();
    expect(document.getElementById('loyalty-card-trigger')).toBeNull();
  });

  it('turns the favourites tab into a login prompt rather than a filter', async () => {
    // For a visitor this tab is NOT a filter — it calls onToggleFavorite('')
    // and App routes that to the auth screen. The list is left alone, which
    // is what stops a visitor landing on a confusing empty "favourites" view.
    const { onToggleFavorite } = renderBrowse({ houses: [house()] });
    await userEvent.click(document.getElementById('tab-favorites')!);
    expect(onToggleFavorite).toHaveBeenCalledWith('');
    expect(cardIds()).toEqual(['h1']);
  });
});

describe('only approved houses are ever listed', () => {
  it('hides pending, rejected and suspended houses', () => {
    renderBrowse({
      houses: [
        house({ id: 'ok', status: 'approved' }),
        house({ id: 'pending', status: 'pending', name: 'قيد المراجعة' }),
        house({ id: 'rejected', status: 'rejected', name: 'مرفوض' }),
      ],
    });
    expect(cardIds()).toEqual(['ok']);
  });
});

describe('search matches name, description or address', () => {
  const houses = [
    house({ id: 'byName', name: 'دير الأنبا بيشوي', description: 'x', address: 'y' }),
    house({ id: 'byDesc', name: 'a', description: 'إطلالة على البحيرة', address: 'z' }),
    house({ id: 'byAddr', name: 'b', description: 'c', address: 'وادي النطرون' }),
  ];

  it('finds a house by its name', async () => {
    renderBrowse({ houses });
    await userEvent.type(document.getElementById('user-search-query')!, 'الأنبا');
    expect(cardIds()).toEqual(['byName']);
  });

  it('finds a house by words only in its description', async () => {
    renderBrowse({ houses });
    await userEvent.type(document.getElementById('user-search-query')!, 'البحيرة');
    expect(cardIds()).toEqual(['byDesc']);
  });

  it('finds a house by its address', async () => {
    renderBrowse({ houses });
    await userEvent.type(document.getElementById('user-search-query')!, 'النطرون');
    expect(cardIds()).toEqual(['byAddr']);
  });

  it('ignores case, which matters for the Latin text in some names', async () => {
    renderBrowse({ houses: [house({ id: 'x', name: 'Pima Retreat' })] });
    await userEvent.type(document.getElementById('user-search-query')!, 'pima');
    expect(cardIds()).toEqual(['x']);
  });
});

describe('the empty state explains itself rather than showing a blank page', () => {
  it('appears when nothing matches, and suggests what to do', async () => {
    renderBrowse();
    await userEvent.type(document.getElementById('user-search-query')!, 'لا يوجد بيت بهذا الاسم إطلاقا');
    expect(cardIds()).toEqual([]);
    expect(screen.getByText(/لم نجد بيوت مؤتمرات تطابق/)).toBeInTheDocument();
    expect(screen.getByText(/جرب البحث بكلمات أبسط/)).toBeInTheDocument();
  });
});

describe('sorting', () => {
  const houses = [
    house({ id: 'cheap', name: 'أرخص', pricePerNightPerPerson: 100, rating: 3 }),
    house({ id: 'mid', name: 'وسط', pricePerNightPerPerson: 200, rating: 5 }),
    house({ id: 'dear', name: 'أغلى', pricePerNightPerPerson: 300, rating: 4 }),
  ];

  it('defaults to the highest rating first', () => {
    renderBrowse({ houses });
    expect(cardIds()).toEqual(['mid', 'dear', 'cheap']);
  });

  it('sorts by cheapest when asked', async () => {
    renderBrowse({ houses });
    await userEvent.selectOptions(document.getElementById('sort-houses-select')!, 'price_asc');
    expect(cardIds()).toEqual(['cheap', 'mid', 'dear']);
  });

  it('sorts by dearest when asked', async () => {
    renderBrowse({ houses });
    await userEvent.selectOptions(document.getElementById('sort-houses-select')!, 'price_desc');
    expect(cardIds()).toEqual(['dear', 'mid', 'cheap']);
  });
});

describe('the price ceiling', () => {
  // maxPrice starts at 400 and is a per-person-per-night cap, inclusive.
  it('excludes a house priced above the default ceiling', () => {
    renderBrowse({
      houses: [house({ id: 'under', pricePerNightPerPerson: 399 }), house({ id: 'over', pricePerNightPerPerson: 401 })],
    });
    expect(cardIds()).toEqual(['under']);
  });

  it('includes a house exactly at the ceiling', () => {
    renderBrowse({ houses: [house({ id: 'exact', pricePerNightPerPerson: 400 })] });
    expect(cardIds()).toEqual(['exact']);
  });
});

describe('the property-type tabs', () => {
  const houses = [
    house({ id: 'conf', propertyType: 'conference', name: 'مؤتمرات' }),
    house({ id: 'stud', propertyType: 'student', name: 'سكن طلاب' }),
    house({ id: 'staff', propertyType: 'staff', name: 'موظفين' }),
  ];

  it('shows everything under الكل', () => {
    renderBrowse({ houses });
    expect(cardIds().sort()).toEqual(['conf', 'staff', 'stud']);
  });

  it('narrows to one type when a tab is chosen', async () => {
    renderBrowse({ houses });
    // "سكن طلاب" is both a tab label and a house name in this fixture, so the
    // tab has to be picked as the button whose whole label is that text.
    const tab = screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'سكن طلاب')!;
    await userEvent.click(tab);
    expect(cardIds()).toEqual(['stud']);
  });
});

describe('opening a house', () => {
  it('hands the house up when the card is clicked', async () => {
    const { onSelectHouse } = renderBrowse();
    await userEvent.click(document.getElementById('house-card-h1')!);
    expect(onSelectHouse).toHaveBeenCalledTimes(1);
    expect(onSelectHouse.mock.calls[0][0].id).toBe('h1');
  });

  it('is reachable from the keyboard, since the card is a div', async () => {
    // role="button" + tabIndex=0 + an Enter/Space handler. Without the
    // handler the card would be announced as a button and do nothing.
    const { onSelectHouse } = renderBrowse();
    document.getElementById('house-card-h1')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectHouse).toHaveBeenCalledTimes(1);
  });
});

describe('comparison', () => {
  const three = [
    house({ id: 'a', name: 'أ' }), house({ id: 'b', name: 'ب' }),
    house({ id: 'c', name: 'ج' }), house({ id: 'd', name: 'د' }),
  ];
  // The card's own control, by id. Once a house is in the set the bottom
  // compare tray renders its OWN "إزالة … من المقارنة" button, so matching on
  // the label alone finds two elements.
  const compareOnCard = (id: string) => document.getElementById(`toggle-compare-card-${id}`)!;
  const compareButton = (name: string) => screen.getByLabelText(`إضافة ${name} للمقارنة`);

  it('adds a house to the comparison set', async () => {
    renderBrowse({ houses: three });
    await userEvent.click(compareOnCard('a'));
    expect(compareOnCard('a').getAttribute('aria-pressed')).toBe('true');
  });

  it('removes it again on a second press', async () => {
    renderBrowse({ houses: three });
    await userEvent.click(compareOnCard('a'));
    await userEvent.click(compareOnCard('a'));
    expect(compareOnCard('a').getAttribute('aria-pressed')).toBe('false');
  });

  it('caps the set at three and says so', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderBrowse({ houses: three });
    for (const n of ['أ', 'ب', 'ج']) await userEvent.click(compareButton(n));
    await userEvent.click(compareButton('د'));

    expect(alert).toHaveBeenCalledWith('يمكنك مقارنة ٣ بيوت خلوة كحد أقصى في نفس الوقت.');
    // The fourth was refused, not swapped in.
    expect(screen.getByLabelText('إضافة د للمقارنة')).toBeInTheDocument();
    alert.mockRestore();
  });

  it('does not open the house when the compare control is pressed', async () => {
    // handleToggleCompare stopPropagation()s; without it every compare tap
    // would also navigate into the house.
    const { onSelectHouse } = renderBrowse({ houses: three });
    await userEvent.click(compareButton('أ'));
    expect(onSelectHouse).not.toHaveBeenCalled();
  });
});

describe('favourites', () => {
  it('asks the caller to handle the toggle rather than deciding itself', async () => {
    // For a visitor App routes this to the login screen; the screen itself
    // stays ignorant of that policy.
    const { onToggleFavorite, onSelectHouse } = renderBrowse();
    await userEvent.click(screen.getByLabelText('إضافة بيت الملاك ميخائيل للمفضلة'));
    expect(onToggleFavorite).toHaveBeenCalledWith('h1');
    expect(onSelectHouse).not.toHaveBeenCalled();
  });

  it('lists only the signed-in visitor’s favourites under that tab', async () => {
    const me = { id: 'u1', name: 'أندرو', role: 'individual', favorites: ['b'] } as unknown as User;
    renderBrowse({
      houses: [house({ id: 'a', name: 'أ' }), house({ id: 'b', name: 'ب' })],
      currentUser: me,
    });
    await userEvent.click(document.getElementById('tab-favorites')!);
    expect(cardIds()).toEqual(['b']);
  });
});

describe('the filter sheet', () => {
  it('opens from the filter button and closes again', async () => {
    renderBrowse();
    // The sheet owns the only dialog on this screen.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(document.getElementById('toggle-filters-btn')!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('the two Supabase RPCs behind the list', () => {
  it('asks for popularity counts once the screen mounts', async () => {
    renderBrowse();
    await waitFor(() => expect(loadHouseBookingCounts).toHaveBeenCalled());
  });

  it('does not ask for availability while no date range is set', () => {
    // The effect guards on both dates being present AND checkIn < checkOut,
    // so the default state must not hit the RPC at all.
    renderBrowse();
    expect(loadHousesAvailability).not.toHaveBeenCalled();
  });

  it('still lists houses when the popularity RPC returns nothing', async () => {
    // null means "unavailable" and must degrade to no badges, never to an
    // empty list or a thrown render.
    vi.mocked(loadHouseBookingCounts).mockResolvedValue(null);
    renderBrowse();
    await waitFor(() => expect(loadHouseBookingCounts).toHaveBeenCalled());
    expect(cardIds()).toEqual(['h1']);
  });
});

/**
 * NOT COVERED, and why — recorded so each gap is a known one.
 *
 * THE SIX QUICK FILTERS ARE UNREACHABLE. quickWifi, quickAc, quickPrivateBath,
 * quickYouth, quickFamilies and quickStudent are declared at lines 283-288 and
 * read by matchesCriteria at 357-369, but NOTHING calls their setters —
 * no control, no prop, nowhere in the codebase. They are permanently false, so
 * those six branches can never fire and there is no way to exercise them
 * through the UI. Left exactly as they are: this phase changes no production
 * code, and deleting them is a separate decision. Flagged in the report.
 *
 * The availability EXCLUSION rule (`freeBeds < (guestCount || 1)` drops a
 * house once loadHousesAvailability has resolved) needs filterCheckIn and
 * filterCheckOut set, and the only way to set them is FilterSheet's bespoke
 * day-grid picker — there is no <input type="date"> to drive. A test that
 * clicked particular day cells would be asserting on the picker's layout, not
 * on the rule, and would break on any calendar tweak.
 *
 * What IS pinned above is the guard either side of it: the RPC is not called
 * without a valid range, and a null result degrades to a full list. The rule
 * itself stays uncovered until the picker exposes a stable handle.
 */

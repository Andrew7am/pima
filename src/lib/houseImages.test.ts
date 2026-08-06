import { describe, it, expect } from 'vitest';
import { houseUpdatePayload } from './db';
import type { RetreatHouse } from '../types';

/**
 * Browse screens hold ONE photo per house (migration 106: the houses_list view
 * returns images[1:1]). That saves the egress which put the project over quota,
 * and it introduces exactly one way to lose data: writing that one-photo array
 * back over a house that has forty.
 *
 * houseUpdatePayload is the single choke point every house write goes through —
 * the owner form, the admin's inline edit, and the approved pending-edit merge.
 * These pin the guard there.
 */

function house(over: Partial<RetreatHouse> = {}): RetreatHouse {
  return {
    id: 'h1', name: 'بيت مارمرقس', description: 'وصف', ownerId: 'u1', ownerName: 'مالك',
    governorate: 'الإسكندرية', address: 'عنوان', roomsCount: 10, bedsCount: 40,
    roomsDescription: '', pricePerNightPerPerson: 250,
    services: [], suitability: [], activities: [], conferenceHalls: [], restaurants: [],
    images: ['cover'], status: 'approved', rating: 0, reviewsCount: 0,
    createdAt: '2026-01-01T00:00:00Z', ...over,
  } as RetreatHouse;
}

describe('houseUpdatePayload and the truncated photo set', () => {
  // THE bug this exists to prevent: an owner changes a price, and the save
  // carries the one photo the list screen happened to hold.
  it('does not write images for a house that only holds its cover', () => {
    const payload = houseUpdatePayload(house({ imagesHydrated: false, images: ['cover'] }));
    expect(payload).not.toHaveProperty('images');
  });

  it('does not write image descriptions either — they key off the images', () => {
    const payload = houseUpdatePayload(house({ imagesHydrated: false }));
    expect(payload).not.toHaveProperty('image_descriptions');
  });

  // Everything else must still save. Refusing the whole write would mean an
  // owner could not change their price until the photos finished loading.
  it('still writes every other field', () => {
    const payload = houseUpdatePayload(house({ imagesHydrated: false, pricePerNightPerPerson: 999 }));
    expect(payload.price_per_night_per_person).toBe(999);
    expect(payload.name).toBe('بيت مارمرقس');
  });

  it('writes images once the full set has been fetched', () => {
    const full = ['a', 'b', 'c'];
    const payload = houseUpdatePayload(house({ imagesHydrated: true, images: full }));
    expect(payload.images).toEqual(full);
  });

  // A house read straight from public.houses has no images_count, so the
  // mapper marks it hydrated. Undefined must not be read as "not hydrated" —
  // that would quietly stop every legitimate photo edit.
  it('treats an explicitly hydrated house as writable', () => {
    expect(houseUpdatePayload(house({ imagesHydrated: true }))).toHaveProperty('images');
  });

  it('refuses when the flag is absent, because absence is not proof', () => {
    const payload = houseUpdatePayload(house({ imagesHydrated: undefined }));
    expect(payload).not.toHaveProperty('images');
  });
});

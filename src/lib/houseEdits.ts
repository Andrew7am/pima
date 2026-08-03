import { RetreatHouse } from '../types';

/**
 * What an owner may propose a change to.
 *
 * An owner's edit to an approved house does not apply directly — it waits in
 * pending_edit for an admin. This is the allow-list that builds it, and it is
 * a quiet one: a field the owner form collects but this list omits is dropped
 * on the way out, the request is sent without it, and the owner is told their
 * edit was submitted. Nothing errors. That is exactly how the day-use price
 * went missing — the form had it, the admin screen was taught to show it, and
 * it never travelled between them.
 *
 * It lives here, as data, so a test can hold it against what the form writes
 * rather than the next person having to remember this file exists.
 */
export const EDITABLE_HOUSE_FIELDS = [
  'name', 'description', 'governorate', 'address',
  'lat', 'lng', 'roomsCount', 'bedsCount',
  'roomsDescription', 'pricePerNightPerPerson', 'dayUsePricePerPerson',
  'propertyType', 'monthlyRent', 'studentHousingGender',
  'distanceFromUniversity', 'nearbyLandmark',
  'services', 'suitability',
  'conferenceHalls', 'activities', 'images', 'imageDescriptions',
] as const satisfies readonly (keyof RetreatHouse)[];

export type EditableHouseField = (typeof EDITABLE_HOUSE_FIELDS)[number];

/** The subset of a house an owner is allowed to submit for review. */
export function editableHouseFields(h: RetreatHouse): Partial<RetreatHouse> {
  const out: Partial<RetreatHouse> = {};
  for (const k of EDITABLE_HOUSE_FIELDS) {
    // Assigned through a widened record: TypeScript cannot see that the key
    // and the value come from the same field, though they always do.
    (out as Record<string, unknown>)[k] = h[k];
  }
  return out;
}

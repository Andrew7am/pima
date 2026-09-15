/**
 * What gets checked at each end of a stay.
 *
 * The labels live here, not in the database, so they can be revised without a
 * migration — what is stored against a booking (0153) is only which keys were
 * ticked, by whom and when. That is the part that has to survive: a key whose
 * label later changes still points at a moment someone stood in a room and
 * looked.
 *
 * Advisory throughout. An owner at the gate with a bus unloading must never be
 * blocked from recording an arrival because a box is unticked.
 */

export interface ChecklistItem {
  key: string;
  label: string;
  /** Shown under the label when the item is about money or damage — the two
   *  that turn into arguments afterwards. */
  note?: string;
}

export interface ChecklistTick {
  key: string;
  /** ISO. A tick with no time is not a record. */
  at: string;
  /** Who ticked it, by display name — the owner may have staff on the gate. */
  by?: string;
}

export const CHECKIN_ITEMS: ChecklistItem[] = [
  { key: 'identity', label: 'اتأكدت من اسم المسؤول ورقم تليفونه' },
  { key: 'headcount', label: 'عدّيت الأفراد فعليًا', note: 'العدد اللي وصل ممكن يفرق عن اللي في الحجز' },
  { key: 'cash', label: 'استلمت المتبقي كاش', note: 'لو في متبقي — المبلغ ظاهر في تفاصيل الحجز' },
  { key: 'rooms', label: 'سلّمت الغرف ووريتهم المكان' },
  { key: 'keys', label: 'سلّمت المفاتيح' },
  { key: 'rules', label: 'قلتلهم مواعيد البيت وقواعده' },
];

export const CHECKOUT_ITEMS: ChecklistItem[] = [
  { key: 'rooms_checked', label: 'دخلت الغرف وشوفتها', note: 'ده السطر اللي بيفرق لو حصل خلاف بعدين' },
  { key: 'damage', label: 'مفيش تلفيات', note: 'لو في، صوّرها قبل ما يمشوا' },
  { key: 'keys_back', label: 'استلمت كل المفاتيح' },
  { key: 'belongings', label: 'محدش نسي حاجة' },
  { key: 'settled', label: 'مفيش مستحقات متبقية' },
];

export const isTicked = (list: ChecklistTick[] | undefined, key: string) =>
  !!list?.some((t) => t.key === key);

/** Toggling off removes the tick rather than storing a false: an untouched box
 *  and an un-ticked one mean the same thing, and storing both invites someone
 *  to read a difference into it. */
export function toggleTick(
  list: ChecklistTick[] | undefined,
  key: string,
  by?: string,
): ChecklistTick[] {
  const current = list ?? [];
  return isTicked(current, key)
    ? current.filter((t) => t.key !== key)
    : [...current, { key, at: new Date().toISOString(), by }];
}

export const tickedCount = (list: ChecklistTick[] | undefined, items: ChecklistItem[]) =>
  items.filter((i) => isTicked(list, i.key)).length;

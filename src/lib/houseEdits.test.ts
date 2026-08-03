import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EDITABLE_HOUSE_FIELDS, editableHouseFields } from './houseEdits';
import { INITIAL_HOUSES } from '../mockData';
import type { RetreatHouse } from '../types';

describe('editableHouseFields', () => {
  const house = { ...INITIAL_HOUSES[0], dayUsePricePerPerson: 120 } as RetreatHouse;

  it('carries the day-use price through', () => {
    // The bug this file exists for: the field was collected by the owner form
    // and shown by the admin screen, and silently dropped in between.
    expect(editableHouseFields(house).dayUsePricePerPerson).toBe(120);
  });

  it('carries a withdrawal through', () => {
    // 0 means «no longer offered». Dropping it would make the offer
    // permanent — an owner could set a day price but never take it back.
    expect(editableHouseFields({ ...house, dayUsePricePerPerson: 0 }).dayUsePricePerPerson).toBe(0);
  });

  it('keeps every listed field, present or absent on the house', () => {
    const out = editableHouseFields(house);
    for (const k of EDITABLE_HOUSE_FIELDS) expect(Object.hasOwn(out, k)).toBe(true);
  });

  it('does not leak fields an owner may not change', () => {
    const out = editableHouseFields(house) as Record<string, unknown>;
    // status and rating are the platform's to set, not the owner's; ownerId
    // and id would let an edit reassign or rename the row itself.
    for (const k of ['id', 'ownerId', 'status', 'rating', 'reviewsCount', 'paymentMethods', 'pendingEdit', 'blockedDates']) {
      expect(Object.hasOwn(out, k), k).toBe(false);
    }
  });
});

describe('the allow-list against the form that feeds it', () => {
  // Reading the source is unusual, and deliberate. The failure this guards is
  // not a wrong value — it is a field the form collects, sends, and has
  // quietly removed on the way out, with no error anywhere. Nothing at
  // runtime can see that, because the shapes still typecheck: the request is
  // simply Partial<RetreatHouse> with one key fewer.
  const src = readFileSync(resolve(process.cwd(), 'src/components/owner/OwnerDashboardShell.tsx'), 'utf8');
  const submitted = [...src.matchAll(/^\s*(?:\/\/.*)?\s*([a-zA-Z]+):\s*(?:isMonthly|h\.|[a-zA-Z]+ \?|[a-zA-Z]+\.trim|\w)/gm)];

  it('lists every house field requestHouseEdit is given', () => {
    // The object literal handed to requestHouseEdit, pulled from the source.
    const call = src.slice(src.indexOf('requestHouseEdit(existing, {'));
    const body = call.slice(0, call.indexOf('\n      });'));
    const keys = [...body.matchAll(/^\s{8}([a-zA-Z]+):/gm)].map((m) => m[1]);

    expect(keys.length).toBeGreaterThan(10); // the parse found the block
    expect(keys).toContain('dayUsePricePerPerson');

    const missing = keys.filter((k) => !(EDITABLE_HOUSE_FIELDS as readonly string[]).includes(k));
    expect(missing, `collected by the owner form but stripped by EDITABLE_HOUSE_FIELDS: ${missing.join(', ')}`).toEqual([]);
  });

  it('found a real submission block rather than matching nothing', () => {
    expect(submitted.length).toBeGreaterThan(0);
  });
});

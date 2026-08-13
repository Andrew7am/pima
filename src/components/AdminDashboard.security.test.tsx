/**
 * Priority 9 — admin safety net.
 *
 * AdminDashboard is 4356 lines and had no tests. It is the highest-privilege
 * surface in the product: it can change roles, ban accounts, release accounts,
 * approve payments and confirm payouts. This file pins the contracts that stop
 * that power being turned on the wrong target — it does not attempt coverage.
 *
 * The central one is admin-on-admin protection (AdminDashboard.tsx:2642, 2650,
 * 2659): the role selector, the ban button and the release button are all
 * withheld when the row is another admin. Without it, one admin can demote,
 * lock out or erase every other admin, including themselves, and there is no
 * route back through the UI.
 *
 * The second is that «release» is not «delete». The comment at :2655 records
 * why — public.users cascades to bookings and payments, so a real delete would
 * take other guests' records with it. The UI must keep calling onReleaseUser.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import type { User } from '../types';

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({ on: vi.fn(function (this: unknown) { return this; }), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
    auth: { updateUser: vi.fn(async () => ({ error: null })) },
  },
}));

const admin = (over: Partial<User> = {}): User => ({
  id: 'u_admin', name: 'المشرف الأول', role: 'admin', email: 'admin@pima.eg',
  phone: '01000000001', points: 0, pointsHistory: [],
  ...over,
} as unknown as User);

const member = (over: Partial<User> = {}): User => ({
  id: 'u_member', name: 'عضو عادي', role: 'individual', email: 'member@pima.eg',
  phone: '01000000002', points: 0, pointsHistory: [],
  ...over,
} as unknown as User);

const mount = (users: User[], over: Record<string, unknown> = {}) => {
  const props = {
    currentUser: admin(), houses: [], users, bookings: [], reviews: [],
    onApproveHouse: vi.fn(), onRejectHouse: vi.fn(), onToggleUserRole: vi.fn(),
    onBanUser: vi.fn(), onReleaseUser: vi.fn(async () => true),
    ...over,
  };
  const view = render(<AdminDashboard {...(props as unknown as React.ComponentProps<typeof AdminDashboard>)} />);
  // Navigation is two levels: the bottom bar picks a SECTION, and only that
  // section's sub-tabs are rendered — #admin-tab-users does not exist until
  // «المستخدمين» has been chosen. The section button is unambiguous at this
  // moment precisely because the identically-labelled sub-tab is not mounted
  // yet. goTo(section, tabs[0]) lands on 'users' directly.
  fireEvent.click(screen.getAllByText('المستخدمين')[0].closest('button')!);
  const tab = view.container.querySelector<HTMLButtonElement>('#admin-tab-users');
  if (!tab) throw new Error('#admin-tab-users is gone — the admin nav contract changed');
  fireEvent.click(tab);
  return { ...view, props };
};

/**
 * Every assertion below mounts the list with exactly ONE user, so a control's
 * presence can be read off the whole container. An earlier draft rendered both
 * users together and walked up the DOM to find "the row", which silently landed
 * on the wrong ancestor and made four of these pass with the guard deleted.
 */
beforeEach(() => { window.confirm = vi.fn(() => true); });

const RELEASE = 'حذف الحساب';   // the real label; «حذف حساب» appears only inside confirm()

describe('AdminDashboard — an admin cannot be acted on from the users list', () => {
  it('lists whoever is passed in', () => {
    // Positive control for the whole file: the rows really are on screen.
    mount([admin()]);
    expect(screen.getAllByText('المشرف الأول').length).toBeGreaterThan(0);
  });

  it('offers no role selector for an admin', () => {
    mount([admin()]);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('does offer one for an ordinary member', () => {
    mount([member()]);
    expect(screen.queryAllByRole('combobox').length).toBeGreaterThan(0);
  });

  it('offers no ban control for an admin', () => {
    const { container } = mount([admin()]);
    expect(container.textContent).not.toContain('حظر');
  });

  it('does offer one for an ordinary member', () => {
    const { container } = mount([member()]);
    expect(container.textContent).toContain('حظر');
  });

  it('never calls onToggleUserRole for an admin, because there is no control to call it', () => {
    const { props } = mount([admin()]);
    screen.queryAllByRole('combobox').forEach((s) => fireEvent.change(s, { target: { value: 'individual' } }));
    expect(props.onToggleUserRole).not.toHaveBeenCalled();
  });
});

describe('AdminDashboard — banning is confirmed, un-banning is not', () => {
  // AdminDashboard.tsx:2651 — `if (usr.isBanned || confirm(...))`. Deliberate
  // asymmetry: taking someone's access away is destructive and asks; giving it
  // back is not, and should not put a dialog in the way.
  const banButton = () => screen.getByText(/^حظر$|^رفع الحظر$/).closest('button')!;

  it('asks before banning', () => {
    const { props } = mount([member()]);
    fireEvent.click(banButton());
    expect(window.confirm).toHaveBeenCalled();
    expect(props.onBanUser).toHaveBeenCalledWith('u_member', true);
  });

  it('does not ban when the admin backs out of the dialog', () => {
    window.confirm = vi.fn(() => false);
    const { props } = mount([member()]);
    fireEvent.click(banButton());
    expect(props.onBanUser).not.toHaveBeenCalled();
  });

  it('lifts a ban without a dialog', () => {
    const { props } = mount([member({ isBanned: true })]);
    fireEvent.click(banButton());
    expect(window.confirm).not.toHaveBeenCalled();
    expect(props.onBanUser).toHaveBeenCalledWith('u_member', false);
  });
});

describe('AdminDashboard — deleting an account releases it rather than dropping the row', () => {
  // public.users cascades to bookings and payments, so the UI must route this
  // through onReleaseUser, which anonymises and frees the email while every
  // financial record stays put.
  it('offers the control for an ordinary member', () => {
    mount([member()]);
    expect(screen.getByText(RELEASE)).toBeInTheDocument();
  });

  it('withholds it for an admin', () => {
    mount([admin()]);
    expect(screen.queryByText(RELEASE)).toBeNull();
  });

  it('withholds it for an account that was already released', () => {
    mount([member({ releasedAt: '2026-01-01T00:00:00Z' } as Partial<User>)]);
    expect(screen.queryByText(RELEASE)).toBeNull();
  });

  it('goes through onReleaseUser, never a delete handler, and only after confirming', () => {
    const onDeleteHouse = vi.fn();
    const { props } = mount([member()], { onDeleteHouse });
    fireEvent.click(screen.getByText(RELEASE).closest('button')!);
    expect(window.confirm).toHaveBeenCalled();
    expect(props.onReleaseUser).toHaveBeenCalledWith('u_member');
    expect(onDeleteHouse).not.toHaveBeenCalled();
  });

  it('does not release when the admin backs out', () => {
    window.confirm = vi.fn(() => false);
    const { props } = mount([member()]);
    fireEvent.click(screen.getByText(RELEASE).closest('button')!);
    expect(props.onReleaseUser).not.toHaveBeenCalled();
  });
});

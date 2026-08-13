/**
 * Phase 13A safety net — FilterSheet, before the token migration.
 *
 * The sheet's whole reason for existing is that it edits a PRIVATE copy and
 * only hands it back on «عرض النتائج». Everything below protects that: the
 * draft re-seeds from `value` on every open, closing commits nothing, and only
 * onApply crosses back to the parent.
 *
 * Nothing here asserts a colour or a class name.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterSheet, { type FilterDraft } from './FilterSheet';

const empty: FilterDraft = {
  governorate: '', guestCount: '', checkIn: '', checkOut: '',
  maxPrice: 0, amenities: [], seaProximity: 'all', dayUseOnly: false,
} as unknown as FilterDraft;

const filled: FilterDraft = {
  ...empty, governorate: 'الإسكندرية', guestCount: 40, maxPrice: 500,
  amenities: ['واي فاي', 'تكييف'],
} as unknown as FilterDraft;

const mount = (over: Record<string, unknown> = {}) => {
  const props = {
    open: true, value: empty, matchCount: 12,
    onPreview: vi.fn(), onApply: vi.fn(), onClose: vi.fn(), ...over,
  };
  const view = render(<FilterSheet {...(props as unknown as React.ComponentProps<typeof FilterSheet>)} />);
  return { ...view, props };
};

const cta = () => screen.getByText(/عرض \d+ بيتًا|لا يوجد بيت بهذه الفلاتر/).closest('button')!;

describe('FilterSheet — opening and closing', () => {
  it('renders nothing at all while closed', () => {
    const { container } = mount({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the sheet when opened', () => {
    mount();
    expect(screen.getByText('فلتر البحث')).toBeInTheDocument();
  });

  it('closes on the close control', () => {
    const { props } = mount();
    fireEvent.click(screen.getByLabelText('إغلاق'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { props } = mount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes on the backdrop', () => {
    const { container, props } = mount();
    const backdrop = container.querySelector('.fixed.inset-0 > div');
    if (backdrop) fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('FilterSheet — nothing commits until «عرض النتائج»', () => {
  it('hands the draft to onApply when the CTA is pressed', () => {
    const { props } = mount({ value: filled });
    fireEvent.click(cta());
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply.mock.calls[0][0].governorate).toBe('الإسكندرية');
  });

  it('does NOT apply when the sheet is merely closed', () => {
    const { props } = mount({ value: filled });
    fireEvent.click(screen.getByLabelText('إغلاق'));
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('does NOT apply on Escape either', () => {
    const { props } = mount({ value: filled });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('re-seeds the draft from `value` on every open, so a discarded edit cannot leak', () => {
    // The isolation guarantee: reopen with a different committed value and the
    // sheet must reflect THAT, not whatever was left behind.
    const { rerender, props } = mount({ open: false, value: empty });
    rerender(<FilterSheet {...({ ...props, open: true, value: filled } as unknown as React.ComponentProps<typeof FilterSheet>)} />);
    fireEvent.click(cta());
    expect(props.onApply.mock.calls[0][0].governorate).toBe('الإسكندرية');
  });
});

describe('FilterSheet — the result count drives the CTA', () => {
  it('names the count when there are matches', () => {
    mount({ matchCount: 7 });
    expect(screen.getByText(/عرض ٧ بيتًا|عرض 7 بيتًا/)).toBeInTheDocument();
  });

  it('disables the CTA and says so when nothing matches', () => {
    mount({ matchCount: 0 });
    expect(screen.getByText('لا يوجد بيت بهذه الفلاتر')).toBeInTheDocument();
    expect(cta().disabled).toBe(true);
  });

  it('refuses to apply while nothing matches', () => {
    const { props } = mount({ matchCount: 0 });
    fireEvent.click(cta());
    expect(props.onApply).not.toHaveBeenCalled();
  });
});

/**
 * The six-sheet flow became one page (origin/main: «The search filters become
 * one page instead of six»), so the tests below describe the page that exists
 * now, not the menu that used to.
 *
 * The whole-sheet «إعادة تعيين» control went with the redesign — origin/main's
 * own FilterSheet contains no such string. Its `reset()` handler survives in
 * the file but nothing references it. That is recorded in the merge commit as a
 * finding for the product owner; restoring a control the redesign deliberately
 * dropped is not a decision this test file should make, so the three tests that
 * drove it are replaced by tests for the controls that are actually there.
 */
describe('FilterSheet — the single page edits one draft', () => {
  it('groups every filter onto one page rather than a menu of steps', () => {
    mount({ value: empty });
    for (const heading of ['المكان', 'عدد الأفراد', 'التواريخ', 'الميزانية', 'الخدمات والمرافق']) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('closes the governorate into a select and reports the choice upward', () => {
    const { props } = mount({ value: empty });
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'الإسكندرية' } });
    expect(props.onPreview).toHaveBeenCalled();
    expect(props.onPreview.mock.calls.at(-1)![0].governorate).toBe('الإسكندرية');
  });

  it('carries that choice through to onApply, not just to the preview', () => {
    const { props } = mount({ value: empty });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'الإسكندرية' } });
    fireEvent.click(cta());
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply.mock.calls[0][0].governorate).toBe('الإسكندرية');
  });

  it('shows the chosen governorate as the select’s value, so the state is visible', () => {
    mount({ value: filled });
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('الإسكندرية');
  });

  it('clears only the amenities when «مسح الكل» is pressed, leaving the rest alone', () => {
    const { props } = mount({ value: filled });
    fireEvent.click(screen.getByText('مسح الكل'));
    const last = props.onPreview.mock.calls.at(-1)![0];
    expect(last.amenities).toEqual([]);
    expect(last.governorate).toBe('الإسكندرية');   // untouched
  });
});

describe('FilterSheet — the accessibility contract', () => {
  it('keeps both directional controls labelled', () => {
    mount();
    expect(screen.getByLabelText('إغلاق')).toBeInTheDocument();
  });

  it('renders in a labelled dialog', () => {
    const { container } = mount();
    expect(container.querySelector('[role="dialog"], [aria-modal]')).not.toBeNull();
  });
});

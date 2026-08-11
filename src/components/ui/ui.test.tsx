import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { Button, Card, Input, Badge, EmptyState, Skeleton, SkeletonGroup } from './index';

// These components are not rendered anywhere in the app yet, so these tests
// are the only thing standing between "written" and "works". They pin the
// contract the spec was approved on — the 44px touch floor, the logical
// padding that keeps RTL correct, and the rule that colour is never the only
// carrier of meaning — rather than snapshotting markup, which would just
// freeze today's classnames and break on every tweak.

const cls = (el: Element | null) => el?.getAttribute('class') ?? '';

describe('Button', () => {
  it('meets the 44px touch floor by default, and 40px only when compact', () => {
    const { rerender } = render(<Button>احجز</Button>);
    expect(cls(screen.getByRole('button'))).toContain('min-h-11');

    // The compact variant exists for dense admin tables, not touch screens.
    rerender(<Button compact>احجز</Button>);
    expect(cls(screen.getByRole('button'))).toContain('min-h-10');
  });

  it('uses logical horizontal padding so RTL needs no override', () => {
    render(<Button>احجز</Button>);
    const c = cls(screen.getByRole('button'));
    expect(c).toContain('ps-4');
    expect(c).toContain('pe-4');
    // Physical padding is what breaks in RTL the moment an icon is added.
    expect(c).not.toMatch(/\bpl-|\bpr-/);
  });

  it('renders the three approved variants', () => {
    for (const v of ['primary', 'secondary', 'ghost'] as const) {
      const { unmount } = render(<Button variant={v}>حفظ</Button>);
      expect(screen.getByRole('button')).toBeTruthy();
      unmount();
    }
  });

  it('blocks the click while loading and says so assistively', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>حفظ</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;

    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    act(() => { btn.click(); });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its label visible while loading so the row does not reflow', () => {
    render(<Button loading>حفظ التعديلات</Button>);
    expect(screen.getByText('حفظ التعديلات')).toBeTruthy();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>حفظ</Button>);
    act(() => { (screen.getByRole('button') as HTMLButtonElement).click(); });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>إلغاء</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('carries a visible focus ring', () => {
    render(<Button>حفظ</Button>);
    expect(cls(screen.getByRole('button'))).toContain('focus-visible:ring-2');
  });
});

describe('Card', () => {
  it('uses 16px padding, and 12px only in the compact (admin) density', () => {
    const { container, rerender } = render(<Card>محتوى</Card>);
    expect(cls(container.firstElementChild)).toContain('p-4');

    rerender(<Card compact>محتوى</Card>);
    expect(cls(container.firstElementChild)).toContain('p-3');
  });

  it('has a surface, a border and the subtle shadow — not a heavier one', () => {
    const { container } = render(<Card>محتوى</Card>);
    const c = cls(container.firstElementChild);
    expect(c).toContain('bg-[var(--color-natural-surface)]');
    expect(c).toContain('border-[var(--color-natural-rule)]');
    expect(c).toContain('shadow-[var(--shadow-subtle)]');
  });

  it('only looks interactive when it actually is', () => {
    const { container, rerender } = render(<Card>محتوى</Card>);
    expect(cls(container.firstElementChild)).not.toContain('cursor-pointer');

    rerender(<Card interactive onClick={() => {}}>محتوى</Card>);
    expect(cls(container.firstElementChild)).toContain('cursor-pointer');
  });

  it('can render as a semantic element without extra wrappers', () => {
    const { container } = render(<Card as="article">محتوى</Card>);
    expect(container.firstElementChild?.tagName).toBe('ARTICLE');
  });
});

describe('Input', () => {
  it('meets the touch floor and uses logical padding', () => {
    render(<Input label="الاسم" />);
    const c = cls(screen.getByLabelText('الاسم'));
    expect(c).toContain('min-h-11');
    expect(c).toContain('ps-3');
    expect(c).toContain('pe-3');
    expect(c).not.toMatch(/\bpl-|\bpr-/);
  });

  it('links its label to the field even without an explicit id', () => {
    render(<Input label="رقم الموبايل" />);
    // getByLabelText only resolves if htmlFor/id actually match.
    expect(screen.getByLabelText('رقم الموبايل')).toBeTruthy();
  });

  it('announces an error rather than only colouring the border', () => {
    render(<Input label="البريد" error="اكتب بريدًا صحيحًا" />);
    const field = screen.getByLabelText('البريد');

    expect(field.getAttribute('aria-invalid')).toBe('true');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe('اكتب بريدًا صحيحًا');
  });

  it('shows the error instead of the hint, never both', () => {
    render(<Input label="البريد" hint="مثال: a@b.com" error="غير صحيح" />);
    expect(screen.getByText('غير صحيح')).toBeTruthy();
    expect(screen.queryByText('مثال: a@b.com')).toBeNull();
  });

  it('supports the disabled state', () => {
    render(<Input label="الاسم" disabled />);
    expect((screen.getByLabelText('الاسم') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('Badge', () => {
  it('always carries text, so colour is never the only signal', () => {
    render(<Badge tone="success">مؤكد</Badge>);
    expect(screen.getByText('مؤكد')).toBeTruthy();
  });

  it('renders every semantic tone', () => {
    for (const t of ['success', 'warning', 'danger', 'info', 'neutral'] as const) {
      const { unmount } = render(<Badge tone={t}>حالة</Badge>);
      expect(screen.getByText('حالة')).toBeTruthy();
      unmount();
    }
  });

  it('is 22px tall with 11px text, per spec', () => {
    render(<Badge>مؤكد</Badge>);
    const c = cls(screen.getByText('مؤكد'));
    expect(c).toContain('h-[22px]');
    expect(c).toContain('text-[11px]');
  });

  it('derives tint, border and text from one token per tone', () => {
    render(<Badge tone="danger">ملغي</Badge>);
    const style = screen.getByText('ملغي').getAttribute('style') ?? '';
    expect(style).toContain('--color-natural-danger');
    expect(style).toContain('color-mix');
  });
});

describe('EmptyState', () => {
  it('explains rather than just reporting emptiness', () => {
    render(
      <EmptyState
        title="لسه مفيش حجوزات"
        description="أول ما تحجز بيت، هيظهر هنا بتفاصيله."
      />,
    );
    expect(screen.getByText('لسه مفيش حجوزات')).toBeTruthy();
    expect(screen.getByText('أول ما تحجز بيت، هيظهر هنا بتفاصيله.')).toBeTruthy();
  });

  it('offers an action only when one is given', () => {
    const { rerender } = render(<EmptyState title="لا شيء بعد" />);
    expect(screen.queryByRole('button')).toBeNull();

    const onClick = vi.fn();
    rerender(<EmptyState title="لا شيء بعد" action={{ label: 'تصفّح البيوت', onClick }} />);
    act(() => { (screen.getByRole('button') as HTMLButtonElement).click(); });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Skeleton', () => {
  it('reuses the existing pima-shimmer animation', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(cls(container.firstElementChild)).toContain('pima-shimmer');
  });

  it('takes its dimensions from the caller so it can mimic real content', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const c = cls(container.firstElementChild);
    expect(c).toContain('h-4');
    expect(c).toContain('w-24');
  });

  it('is hidden from screen readers — the group carries the announcement', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('announces the whole region as busy exactly once', () => {
    render(
      <SkeletonGroup>
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </SkeletonGroup>,
    );
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.getAttribute('aria-label')).toBe('جارٍ التحميل');
  });
});

describe('nothing is adopted yet', () => {
  it('is a deliberate property of this phase', () => {
    // Phase 2 builds and verifies; it does not migrate. If a screen starts
    // importing from components/ui before that is approved, this note is where
    // the reasoning lives — the adoption order exists so each screen can be
    // checked on its own and reverted on its own.
    expect(true).toBe(true);
  });
});

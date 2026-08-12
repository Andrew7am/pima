import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { SearchInput, Input } from './index';

const cls = (el: Element | null) => el?.getAttribute('class') ?? '';
const SRC = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'SearchInput.tsx'), 'utf8');
/** Source with prose stripped — the doc comment discusses `pr-10`/`right-3`
 *  to explain what this component exists to avoid, and a check for physical
 *  positioning would match the explanation rather than the code. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('SearchInput', () => {
  it('is a search field, not a bare text box', () => {
    render(<SearchInput aria-label="ابحث" />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('carries an accessible name from a visible label', () => {
    render(<SearchInput label="ابحث عن بيت" />);
    // getByLabelText fails outright if the label is not wired to the field.
    expect(screen.getByLabelText('ابحث عن بيت')).toBeInTheDocument();
  });

  it('accepts an aria-label where the design has no room for a visible one', () => {
    render(<SearchInput aria-label="ابحث باسم المكان" placeholder="ابحث" />);
    expect(screen.getByLabelText('ابحث باسم المكان')).toBeInTheDocument();
  });

  it('links label to field without the caller supplying an id', () => {
    const { container } = render(<SearchInput label="بحث" />);
    const input = container.querySelector('input')!;
    const label = container.querySelector('label')!;
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('behaves as a normal controlled field', async () => {
    const onChange = vi.fn();
    render(<SearchInput aria-label="ابحث" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'دير');
    expect(onChange).toHaveBeenCalled();
  });

  it('meets the same 44px touch floor as Input', () => {
    const { container: a } = render(<SearchInput aria-label="ابحث" />);
    const { container: b } = render(<Input />);
    expect(cls(a.querySelector('input'))).toContain('min-h-11');
    expect(cls(b.querySelector('input'))).toContain('min-h-11');
  });

  it('uses the same 14px type and 12px radius as Input', () => {
    const { container: a } = render(<SearchInput aria-label="ابحث" />);
    const { container: b } = render(<Input />);
    for (const c of ['text-[14px]', 'rounded-[12px]']) {
      expect(cls(a.querySelector('input')), `SearchInput ${c}`).toContain(c);
      expect(cls(b.querySelector('input')), `Input ${c}`).toContain(c);
    }
  });

  it('supports the disabled state the same way Input does', () => {
    const { container } = render(<SearchInput aria-label="ابحث" disabled />);
    const input = container.querySelector('input')!;
    expect(input).toBeDisabled();
    expect(cls(input)).toContain('disabled:opacity-50');
    expect(cls(input)).toContain('disabled:cursor-not-allowed');
  });

  it('shows a focus ring in the same place Input does', () => {
    const { container } = render(<SearchInput aria-label="ابحث" />);
    expect(cls(container.querySelector('input'))).toContain('focus-visible:ring-2');
  });

  describe('direction', () => {
    it('positions the icon logically, so it follows the writing direction', () => {
      const { container } = render(<SearchInput aria-label="ابحث" />);
      const icon = container.querySelector('svg')!;
      // start-* is inset-inline-start: right in Arabic, left in English, from
      // one class. The field this replaces used right-3 and would put the
      // icon on the wrong side of an English page.
      expect(cls(icon)).toContain('start-3');
    });

    it('pads the field logically to clear that icon', () => {
      const { container } = render(<SearchInput aria-label="ابحث" />);
      const c = cls(container.querySelector('input'));
      expect(c).toContain('ps-10');
      expect(c).toContain('pe-3');
    });

    it('contains no physical direction anywhere in its code', () => {
      // The whole point of the component. left/right in a class here is the
      // bug it exists to prevent.
      expect(CODE).not.toMatch(/\b(pl|pr|left|right)-\d/);
      expect(CODE).not.toMatch(/\btext-(left|right)\b/);
    });

    it('renders identically under an RTL and an LTR ancestor', () => {
      // No direction-conditional rendering: the same classes ship both ways
      // and the browser resolves them. A component that branched on dir would
      // produce different markup here.
      const rtl = render(<div dir="rtl"><SearchInput aria-label="ابحث" /></div>);
      const rtlCls = cls(rtl.container.querySelector('input'));
      const rtlIcon = cls(rtl.container.querySelector('svg'));
      rtl.unmount();

      const ltr = render(<div dir="ltr"><SearchInput aria-label="search" /></div>);
      expect(cls(ltr.container.querySelector('input'))).toBe(rtlCls);
      expect(cls(ltr.container.querySelector('svg'))).toBe(rtlIcon);
    });
  });

  it('names no palette and no literal colour', () => {
    expect(CODE).not.toMatch(/--color-(natural|owner|play)-/);
    expect(CODE).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
    expect(CODE).toMatch(/var\(--ds-/);
  });

  it('contains no theme branching', () => {
    expect(CODE).not.toMatch(/\b(owner|admin|entertainment|play)Theme\b/i);
    expect(CODE).not.toMatch(/theme\s*===/i);
    expect(CODE).not.toMatch(/\bisDark\b|\bif\s*\(\s*dark/i);
  });

  it('ships no built-in clear button, because production does not have one', () => {
    // UserDashboard clears its search from a separate «مسح» button beside the
    // field, not from inside it. An internal clear would be a second control
    // the screen never asked for — added only if a real usage needs it.
    const { container } = render(<SearchInput aria-label="ابحث" value="دير" onChange={() => {}} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

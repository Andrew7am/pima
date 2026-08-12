/**
 * Phase 12 — LandingPage behaviour, pinned before the token migration.
 *
 * The page is presentational: three props, no state, no effects, no storage.
 * `pima_seen_landing` is App.tsx's concern (lines 199/203), not this file's —
 * so there is nothing here to pin for it, and these tests deliberately do not
 * pretend otherwise.
 *
 * Nothing below asserts a colour or a class name.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from './LandingPage';

const mount = (over: Record<string, unknown> = {}) => {
  const props = { onBrowse: vi.fn(), onLogin: vi.fn(), housesCount: 42, ...over };
  const view = render(<LandingPage {...(props as unknown as React.ComponentProps<typeof LandingPage>)} />);
  return { ...view, props };
};

describe('LandingPage — the two calls to action', () => {
  it('sends «ابدأ التصفح مجاناً» to onBrowse', () => {
    const { props } = mount();
    fireEvent.click(screen.getByText('ابدأ التصفح مجاناً'));
    expect(props.onBrowse).toHaveBeenCalledTimes(1);
    expect(props.onLogin).not.toHaveBeenCalled();
  });

  it('sends the header «تسجيل الدخول» to onLogin', () => {
    const { props } = mount();
    fireEvent.click(screen.getByText('تسجيل الدخول'));
    expect(props.onLogin).toHaveBeenCalledTimes(1);
    expect(props.onBrowse).not.toHaveBeenCalled();
  });

  it('sends «إنشاء حساب» to onLogin too — one destination, two doors', () => {
    const { props } = mount();
    fireEvent.click(screen.getByText('إنشاء حساب'));
    expect(props.onLogin).toHaveBeenCalledTimes(1);
  });

  it('sends the owner CTA «سجّل بيتك الآن» to onLogin', () => {
    const { props } = mount();
    fireEvent.click(screen.getByText('سجّل بيتك الآن'));
    expect(props.onLogin).toHaveBeenCalledTimes(1);
  });
});

describe('LandingPage — the house count', () => {
  it('names the count when there are houses to name', () => {
    mount({ housesCount: 42 });
    expect(screen.getByText('42+')).toBeInTheDocument();
  });

  it('drops the whole sentence at zero rather than saying «0+»', () => {
    mount({ housesCount: 0 });
    expect(screen.queryByText(/\+/)).toBeNull();
    // The lead paragraph still stands on its own.
    expect(screen.getByText(/أكبر منصة لحجز بيوت المؤتمرات/)).toBeInTheDocument();
  });
});

describe('LandingPage — the content contract', () => {
  it('keeps the four reasons', () => {
    mount();
    for (const t of ['بيوت مؤتمرات متنوعة', 'حجز فوري', 'تقييمات حقيقية', 'أسعار شفافة'])
      expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('keeps the three booking steps in order', () => {
    const { container } = mount();
    const steps = [...container.querySelectorAll('*')]
      .filter(e => e.children.length === 0 && ['1', '2', '3'].includes((e.textContent || '').trim()))
      .map(e => e.textContent!.trim());
    expect(steps).toEqual(['1', '2', '3']);
  });

  it('keeps both section headings', () => {
    mount();
    expect(screen.getByText('ليه بيما؟')).toBeInTheDocument();
    expect(screen.getByText('إزاي تحجز؟')).toBeInTheDocument();
  });
});

describe('LandingPage — the outbound links', () => {
  it('points the guide at /dalil/', () => {
    mount();
    expect(screen.getByText('الدليل والنصائح').getAttribute('href')).toBe('/dalil/');
  });

  it('opens support in a new tab, with rel protection', () => {
    mount();
    const a = screen.getByText('تواصل معنا');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noreferrer');
  });

  it('stamps the current year in the footer', () => {
    mount();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });
});

describe('LandingPage — direction', () => {
  it('forces RTL on its own root, independent of any ancestor', () => {
    const { container } = mount();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
  });
});

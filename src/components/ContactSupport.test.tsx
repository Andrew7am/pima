import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ContactSupport from './ContactSupport';
import { supportWhatsAppNumber } from '../lib/support';

// This screen used to carry a support form with no backend: "sending" a ticket
// stored it in component state, announced «تم إرسال بلاغكم بنجاح» with a
// ticket number and a 24-hour callback promise, and listed a made-up resolved
// ticket and app version. Nothing reached anyone. The screen now routes to the
// real support WhatsApp; these guard against the fiction coming back.
const user = { name: 'مستخدم', phone: '01000000000', email: 'user@example.invalid' };

describe('ContactSupport', () => {
  it('claims no ticket system, callback or version it does not have', () => {
    const { container } = render(<ContactSupport currentUser={user} />);
    const text = container.textContent ?? '';

    expect(container.querySelector('form')).toBeNull();
    for (const fake of ['PIMA-', 'تذكرة', 'تم إرسال', '٢٤ ساعة', '24 ساعة', '2.4.0', 'Version', 'على مدار الساعة']) {
      expect(text).not.toContain(fake);
    }
  });

  it('shows no invented phone numbers or email', () => {
    const { container } = render(<ContactSupport currentUser={user} />);

    expect(container.querySelectorAll('a[href^="tel:"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/0123 456 7890|0111 222 3334|support@pima-retreats\.eg/);
  });

  it('sends problem reports to the configured support WhatsApp', () => {
    render(<ContactSupport currentUser={user} />);
    const link = screen.getByRole('link', { name: 'راسل الدعم الفني على واتساب' });

    expect(link.getAttribute('href')).toMatch(new RegExp(`^https://wa\\.me/${supportWhatsAppNumber()}\\?text=`));
  });
});

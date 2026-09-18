import React, { useState } from 'react';
import { BellRing, Check, MapPin, CalendarDays, Users } from 'lucide-react';
import { Card, Input, Button } from './ui';
import { requestPlace } from '../lib/placeRequests';
import { arabicNumber } from '../lib/arabic';
import { tapFeedback } from '../lib/haptics';
import type { User } from '../types';

/**
 * The end of a search that found nothing.
 *
 * This used to be a sentence and nothing else — «عذراً، لم نجد بيوت تطابق
 * معايير بحثك» — with no action, because at the time there genuinely was none
 * to offer: the reader already had the filters that produced the emptiness.
 *
 * There is one now, and it runs the other way. Pima has houses in one
 * governorate out of the twenty-seven the filter offers, so an empty result
 * is not usually a bad search — it is a place Pima has not reached yet. The
 * reader is the only person who can say that place is worth reaching, and
 * this is the one moment they are certain to be asked.
 *
 * Two fields. A dead end with a six-field form in front of it is still a dead
 * end; everything else — where, when, how many — is already in the search
 * they just ran, and is sent with it rather than typed again.
 */

export interface NoResultsRequestProps {
  currentUser?: User | null;
  /** The place they were looking in, when the search named one. */
  governorate?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number | null;
  /** Free text they typed, kept as the note so the admin sees the actual words. */
  query?: string;
}

export default function NoResultsRequest({
  currentUser,
  governorate = '',
  checkIn = '',
  checkOut = '',
  guests = null,
  query = '',
}: NoResultsRequestProps) {
  const [name, setName] = useState(currentUser?.name ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const place = governorate.trim();

  const submit = async () => {
    // Said here so the answer is immediate; the database checks the same
    // things again, because the RPC is reachable without this form.
    if (name.trim().length < 2) { setError('اكتب اسمك من فضلك.'); return; }
    const digits = phone.replace(/[^0-9+]/g, '');
    if (digits.length < 8) { setError('رقم الموبايل مش مظبوط.'); return; }

    setError('');
    setBusy(true);
    tapFeedback();
    const res = await requestPlace({
      name: name.trim(),
      phone,
      governorate: place || null,
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      guests: guests ?? null,
      note: query.trim() || null,
    });
    setBusy(false);
    if (res.ok === false) { setError('معلش، الطلب ماوصلش. جرب تاني.'); return; }
    setDone(true);
  };

  if (done) {
    return (
      <Card>
        <div id="place-request-done" className="flex flex-col items-center text-center gap-2 py-8 px-6">
          <span className="w-12 h-12 rounded-full bg-[var(--ds-success)]/15 grid place-items-center">
            <Check aria-hidden="true" className="w-6 h-6 text-[var(--ds-success)]" />
          </span>
          <h3 className="text-[16px] font-bold text-[var(--ds-text)]">وصلنا طلبك</h3>
          <p className="text-[12.5px] text-[var(--ds-text-2)] max-w-[38ch] leading-relaxed">
            {place
              ? <>أول ما نضيف بيت في {place} هنكلمك على الرقم اللي سيبته.</>
              : <>أول ما يتوفر مكان يناسب اللي بتدور عليه هنكلمك.</>}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 py-6 px-4 sm:px-6">
        <div className="flex flex-col items-center text-center gap-1.5">
          <span className="w-11 h-11 rounded-full bg-[var(--ds-accent)]/15 grid place-items-center">
            <BellRing aria-hidden="true" className="w-5 h-5 text-[var(--ds-accent-deep)]" />
          </span>
          <h3 className="text-[16px] font-bold text-[var(--ds-text)] text-balance">
            {place ? <>لسه مفيش بيوت في {place}</> : <>مفيش مكان مطابق لبحثك دلوقتي</>}
          </h3>
          <p className="text-[12.5px] text-[var(--ds-text-2)] max-w-[40ch] leading-relaxed">
            سيب اسمك ورقمك، وأول ما نضيف مكان {place ? <>هناك</> : <>يناسبك</>} نكلمك.
          </p>
        </div>

        {/* What is already known, shown so nobody retypes it and so it is
            clear what the call back will be about. */}
        {(place || (checkIn && checkOut) || guests) && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {place && (
              <li className="flex items-center gap-1 rounded-full bg-[var(--ds-raised)] px-2.5 py-1 text-[11px] font-bold text-[var(--ds-text-2)]">
                <MapPin aria-hidden="true" className="w-3 h-3" />{place}
              </li>
            )}
            {checkIn && checkOut && (
              <li className="flex items-center gap-1 rounded-full bg-[var(--ds-raised)] px-2.5 py-1 text-[11px] font-bold text-[var(--ds-text-2)]">
                <CalendarDays aria-hidden="true" className="w-3 h-3" />
                {checkIn} ← {checkOut}
              </li>
            )}
            {guests ? (
              <li className="flex items-center gap-1 rounded-full bg-[var(--ds-raised)] px-2.5 py-1 text-[11px] font-bold text-[var(--ds-text-2)]">
                <Users aria-hidden="true" className="w-3 h-3" />{arabicNumber(guests)} فرد
              </li>
            ) : null}
          </ul>
        )}

        <div className="flex flex-col gap-2 max-w-[22rem] w-full mx-auto">
          <Input
            id="place-request-name"
            label="الاسم"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك"
            autoComplete="name"
          />
          <Input
            id="place-request-phone"
            label="رقم الموبايل"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            // tel, not number: a number field drops a leading zero on some
            // Androids and every Egyptian mobile starts with one.
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={error || undefined}
            hint="مش هيظهر لحد غير إدارة بيما، وبنستخدمه للمكالمة دي بس."
          />
          <Button id="place-request-submit" onClick={submit} loading={busy} fullWidth className="mt-1">
            كلموني لما يتوفر
          </Button>
        </div>
      </div>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { ArrowRight, Castle, KeyRound, Loader2 } from 'lucide-react';
import JoinConferenceCard from './JoinConferenceCard';
import { createConferenceForBooking } from '../lib/conferences';
import { loadBookings } from '../lib/db';
import type { Booking } from '../types';

/**
 * The door, before there is a room.
 *
 * Opening الترفيه → المؤتمرات used to drop the servant straight into the hub.
 * If they had no conference, App.tsx invented one with createEmptyConference —
 * a hub with a made-up join code, whose every edit was discarded because a
 * conference with no bookingId has nowhere to be saved. It looked like the
 * feature had opened itself, and it looked like it worked.
 *
 * Migration 126 made opening a conference the servant's own act. This is where
 * they perform it: their approved bookings, one button each, and the field for
 * everybody else who was given a code.
 */

interface Props {
  onOpened: () => void;
  onBack: () => void;
  currentUserId: string;
}

// A booking that cannot be parsed is shown as it was stored rather than as
// «Invalid Date» — the servant can still recognise their own dates.
const fmt = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
};

export default function ConferenceGate({ onOpened, onBack, currentUserId }: Props) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    setBookings(null);
    loadBookings()
      .then((all) => {
        if (!alive) return;
        // Only mine, and only approved: those are exactly the bookings the RPC
        // will accept. Offering the button on a pending one would produce a
        // refusal the servant can do nothing about.
        setBookings(all.filter((b) => b.userId === currentUserId && b.status === 'approved'));
      })
      // Without this the spinner was forever: if the query never came back the
      // servant sat on «بنحمّل حجوزاتك…» with no button, no reason and nothing
      // to press — which looks exactly like the feature being broken.
      .catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
  }, [currentUserId, reloadKey]);

  const open = async (bookingId: string) => {
    setError('');
    setOpening(bookingId);
    const r = await createConferenceForBooking(bookingId);
    setOpening(null);
    if ('error' in r) { setError(r.error); return; }
    onOpened();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2A0F4A] via-[#1B0B33] to-[#0E0620] text-slate-100" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-bold text-purple-300 hover:text-purple-100 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </button>

        <div className="text-center space-y-2 pt-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
            <Castle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-lg font-black text-white">مركز المؤتمرات</h1>
          <p className="text-[11px] text-purple-200/70 leading-relaxed max-w-sm mx-auto">
            كل مؤتمر بيتفتح من حجز متوافق عليه. افتح مؤتمرك، أو ادخل بالكود لو حد بعتهولك.
          </p>
        </div>

        <JoinConferenceCard onJoined={onOpened} />

        <div className="space-y-3">
          <h2 className="text-[11px] font-black text-amber-200 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4" />
            <span>حجوزاتك المتوافق عليها</span>
          </h2>

          {bookings === null && !loadFailed && (
            <div className="flex items-center justify-center gap-2 py-8 text-[11px] text-purple-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>بنحمّل حجوزاتك…</span>
            </div>
          )}

          {loadFailed && (
            <div className="bg-purple-950/40 border border-purple-500/20 rounded-2xl p-4 text-center space-y-3">
              <p className="text-[11px] text-purple-200/70">مقدرناش نحمّل حجوزاتك.</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-[11px] font-black text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                حاول تاني
              </button>
            </div>
          )}

          {bookings?.length === 0 && (
            // Said plainly, because the reason matters: a servant whose booking
            // is still pending needs to chase the owner, not the app.
            <p className="text-[11px] text-purple-200/60 leading-relaxed bg-purple-950/40 border border-purple-500/20 rounded-2xl p-4 text-center">
              مفيش عندك حجز متوافق عليه دلوقتي.
              <br />
              لما صاحب البيت يوافق على حجزك، هتلاقي هنا زرار تفتح بيه مؤتمرك.
            </p>
          )}

          {bookings?.map((b) => (
            <div
              key={b.id}
              className="bg-purple-950/50 border border-purple-500/20 rounded-2xl p-4 space-y-3"
            >
              <div className="space-y-1">
                <h3 className="text-[13px] font-black text-white">{b.houseName || 'بيت المؤتمر'}</h3>
                <p className="text-[10px] text-purple-200/70">
                  {fmt(b.checkIn)} ← {fmt(b.checkOut)} · {b.guestsCount} فرد
                </p>
              </div>
              <button
                type="button"
                disabled={opening === b.id}
                onClick={() => void open(b.id)}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-purple-950 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {opening === b.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الفتح…</span>
                  </>
                ) : (
                  <span>افتح مؤتمر لهذا الحجز 👑</span>
                )}
              </button>
            </div>
          ))}

          {/* The RPC's refusals are in Arabic and are the useful part — «الحجز ده
              مش بتاعك», «لازم صاحب البيت يوافق». Shown verbatim rather than
              flattened into a generic failure. */}
          {error && (
            <p className="text-[11px] font-bold text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-2xl p-3 text-center">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

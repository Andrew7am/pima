import { useState } from 'react';
import { joinConferenceByCode } from '../lib/conferences';

/**
 * The door the code opens.
 *
 * Until migration 124 the hub printed a code and a QR that nothing read, so a
 * servant could read the code out to forty people and none of them could get
 * in. This is the field that spends it.
 *
 * Errors are shown verbatim: the RPC raises Arabic for the two cases a guest
 * actually hits — a wrong code and a closed conference — and telling those
 * apart is what stops a servant debugging their own room while their group
 * bounces off it.
 */

interface Props {
  onJoined: (conferenceId: string) => void;
  /** Optional: prefill from a scanned QR. */
  initialCode?: string;
}

export default function JoinConferenceCard({ onJoined, initialCode = '' }: Props) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const submit = async () => {
    const c = code.trim();
    if (c.length < 3) { setError('اكتب الكود اللي مسؤول المؤتمر باعتهولك.'); return; }
    setBusy(true); setError(''); setNote('');
    const r = await joinConferenceByCode(c);
    setBusy(false);
    // `in` rather than !r.ok — the narrowing on the ok flag does not carry the
    // error field through, and this reads the same either way.
    if ('error' in r) { setError(r.error); return; }
    // Rejoining is success, not a mistake — say so rather than silently
    // repeating the welcome as if it were the first time.
    setNote(r.alreadyJoined
      ? `إنت منضم بالفعل لـ«${r.title}».`
      : r.needsApproval
        ? `طلبك اتسجّل في «${r.title}» — مسؤول المؤتمر هيوافق.`
        : `أهلاً بيك في «${r.title}».`);
    onJoined(r.conferenceId);
  };

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-[#0b1b36]/70 p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-black text-white">انضم لمؤتمر</h3>
        <p className="text-[11px] text-purple-200/70 mt-0.5">
          اكتب الكود اللي مسؤول المؤتمر باعتهولك، أو امسح الـQR.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          placeholder="PM4A2B7C"
          aria-label="كود المؤتمر"
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
          className="flex-1 min-h-11 rounded-xl bg-white/5 border border-purple-500/30 px-3 text-center text-[15px] font-black tracking-widest text-white placeholder:text-purple-300/30 focus:outline-none focus:border-amber-400/60"
        />
        <button
          type="button" onClick={() => void submit()} disabled={busy}
          className="shrink-0 min-h-11 px-5 rounded-xl bg-amber-500 text-[#0b1b36] text-[13px] font-black cursor-pointer disabled:opacity-60"
        >
          {busy ? 'جاري…' : 'انضم'}
        </button>
      </div>

      {error && <p className="text-[11.5px] font-bold text-rose-300">{error}</p>}
      {note && <p className="text-[11.5px] font-bold text-emerald-300">{note}</p>}
    </div>
  );
}

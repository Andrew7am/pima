/**
 * Telling someone when a save did not happen.
 *
 * Every write in this app is dispatched and forgotten: `setState(...)` puts
 * the change on screen, the database call goes out unawaited, and if it fails
 * the only trace is a console.error nobody is looking at. There are 76 of
 * those in lib/db.ts and, before this file, zero places where a failure
 * reached the person who made it. On a phone on Egyptian mobile data that is
 * not a rare path — the owner confirms a deposit, sees it confirmed, and the
 * row never moved.
 *
 * Deliberately not a React context: nothing else in this codebase uses one,
 * and a context would mean threading a provider through every call site. A
 * module-level subscription lets a write report from anywhere — including
 * plain handlers that are not components — and one banner listens.
 */

export interface WriteFailure {
  id: number;
  /** What the user was doing, in their words: «تأكيد استلام العربون». */
  what: string;
  /** The server's own reason, when it gave one. Shown instead of the generic
   *  line, because «البيت مكتمل الإشغال» is a different problem from a
   *  dropped connection and the person needs to know which they have. */
  reason?: string;
}

/**
 * What the writes in this codebase actually return. Most give a boolean;
 * updateBookingFields answers with a reason attached, which is worth keeping.
 */
export type WriteResult = boolean | void | { ok: boolean; error?: string };

type Listener = (failures: WriteFailure[]) => void;

const listeners = new Set<Listener>();
let failures: WriteFailure[] = [];
let nextId = 1;

function emit() {
  const snapshot = failures;
  listeners.forEach((l) => l(snapshot));
}

export function subscribeToWriteFailures(listener: Listener): () => void {
  listeners.add(listener);
  listener(failures);
  return () => { listeners.delete(listener); };
}

export function reportWriteFailure(what: string, reason?: string): WriteFailure {
  const failure = { id: nextId++, what, reason };
  failures = [...failures, failure];
  emit();
  return failure;
}

export function dismissWriteFailure(id: number) {
  failures = failures.filter((f) => f.id !== id);
  emit();
}

export function clearWriteFailures() {
  failures = [];
  emit();
}

/**
 * Wrap a write and speak up if it did not land.
 *
 * Returns what the write returned, so a caller that wants to branch still
 * can, and one that does not is no worse off than before — the point is that
 * silence is no longer the only outcome.
 *
 * A rejected promise counts as a failure too: db.ts catches most errors and
 * returns false, but a network layer that throws would otherwise produce an
 * unhandled rejection and, again, a screen claiming success.
 */
export async function trackWrite(
  write: Promise<WriteResult> | WriteResult,
  what: string,
): Promise<boolean> {
  try {
    const res = await write;
    // Only an explicit false — or an { ok: false } — is a failure. Several
    // handlers resolve undefined, and treating "did not answer" as "did not
    // save" would cry wolf on every one of them.
    const isRich = typeof res === 'object' && res !== null;
    const ok = isRich ? (res as { ok: boolean }).ok !== false : res !== false;
    if (!ok) reportWriteFailure(what, isRich ? (res as { error?: string }).error : undefined);
    return ok;
  } catch (err) {
    console.error(`write failed (${what}):`, err);
    reportWriteFailure(what);
    return false;
  }
}

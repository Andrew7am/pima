import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackWrite, trackQuery, reportWriteFailure, dismissWriteFailure, clearWriteFailures,
  subscribeToWriteFailures, type WriteFailure,
} from './writeFeedback';

beforeEach(() => clearWriteFailures());

describe('trackQuery', () => {
  const current = () => { let c: WriteFailure[] = []; subscribeToWriteFailures((f) => { c = f; }); return c; };

  it('says nothing when supabase returns no error', async () => {
    expect(await trackQuery(Promise.resolve({ error: null }), 'اعتماد البيت')).toBe(true);
    expect(current()).toEqual([]);
  });

  it('reports the failure when supabase returns an error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await trackQuery(Promise.resolve({ error: { message: 'permission denied' } }), 'اعتماد البيت')).toBe(false);
    expect(current().map((f) => f.what)).toEqual(['اعتماد البيت']);
    spy.mockRestore();
  });

  it('catches a rejection rather than leaving it unhandled', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await trackQuery(Promise.reject(new Error('offline')), 'حظر مستخدم')).toBe(false);
    expect(current()).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('trackWrite', () => {
  it('says nothing when the write succeeded', async () => {
    const seen: WriteFailure[][] = [];
    subscribeToWriteFailures((f) => seen.push(f));
    const ok = await trackWrite(Promise.resolve(true), 'تأكيد استلام العربون');
    expect(ok).toBe(true);
    expect(seen[seen.length - 1]).toEqual([]);
  });

  it('reports the write that returned false, naming what was being done', async () => {
    // The whole point: db.ts returns false and logs to a console nobody reads.
    const ok = await trackWrite(Promise.resolve(false), 'تأكيد استلام العربون');
    expect(ok).toBe(false);
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current).toHaveLength(1);
    expect(current[0].what).toBe('تأكيد استلام العربون');
  });

  it('treats a thrown error as a failure rather than an unhandled rejection', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = await trackWrite(Promise.reject(new Error('offline')), 'تسجيل وصول');
    expect(ok).toBe(false);
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current[0].what).toBe('تسجيل وصول');
    spy.mockRestore();
  });

  it('accepts a plain boolean, for a call that is not async', async () => {
    expect(await trackWrite(true, 'حفظ')).toBe(true);
    expect(await trackWrite(false, 'حفظ')).toBe(false);
  });

  it('reads the richer { ok, error } shape updateBookingFields returns', async () => {
    expect(await trackWrite(Promise.resolve({ ok: true }), 'تعديل الحجز')).toBe(true);
    const ok = await trackWrite(
      Promise.resolve({ ok: false, error: 'البيت مكتمل الإشغال في هذه التواريخ' }),
      'تعديل تواريخ الحجز',
    );
    expect(ok).toBe(false);
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    // The server's reason survives — «مكتمل الإشغال» is a different problem
    // from a dropped connection, and the generic line would hide that.
    expect(current[0].reason).toBe('البيت مكتمل الإشغال في هذه التواريخ');
  });

  it('treats a write that resolves undefined as success, not failure', async () => {
    // Several handlers return void. Those must not be reported as failures
    // simply for not answering — only an explicit false is a failure.
    const ok = await trackWrite(Promise.resolve(undefined as unknown as boolean), 'حفظ');
    expect(ok).toBe(true);
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current).toEqual([]);
  });
});

describe('the failure list', () => {
  it('keeps every failure, because two lost saves are not one problem', async () => {
    await trackWrite(Promise.resolve(false), 'تأكيد العربون');
    await trackWrite(Promise.resolve(false), 'تسجيل وصول');
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current.map((f) => f.what)).toEqual(['تأكيد العربون', 'تسجيل وصول']);
  });

  it('dismisses one without disturbing the others', () => {
    const a = reportWriteFailure('أ');
    reportWriteFailure('ب');
    dismissWriteFailure(a.id);
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current.map((f) => f.what)).toEqual(['ب']);
  });

  it('gives a new subscriber what is already on screen', () => {
    reportWriteFailure('حصل قبل الاشتراك');
    let current: WriteFailure[] = [];
    subscribeToWriteFailures((f) => { current = f; });
    expect(current).toHaveLength(1);
  });

  it('stops calling a listener once it unsubscribes', () => {
    let calls = 0;
    const off = subscribeToWriteFailures(() => { calls++; });
    const atSubscribe = calls;
    off();
    reportWriteFailure('بعد إلغاء الاشتراك');
    expect(calls).toBe(atSubscribe);
  });

  it('hands listeners a new array rather than mutating the old one', () => {
    // React bails out of a re-render when the state is identical by
    // reference, so a mutated array would show the first failure and never
    // the second.
    const seen: WriteFailure[][] = [];
    subscribeToWriteFailures((f) => seen.push(f));
    reportWriteFailure('أ');
    reportWriteFailure('ب');
    expect(seen[seen.length - 1]).not.toBe(seen[seen.length - 2]);
  });
});

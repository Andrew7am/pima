// Minimal Firestore-shaped shim over Supabase, used ONLY by the ported 1v1
// "random match" game (RandomMatchGame, gameService, ChatComponent, FriendChat).
// It emulates just the surface those files use so their game logic stays
// byte-faithful to the source. Backed by the generic public.rm_docs table
// (see migration 075_random_match.sql).
//
// NOTE: updateDoc does read-merge-write rather than server-side field merges, so
// two clients writing the SAME field in the same instant can race. In practice
// the two players write different fields (their own answers/state), matching how
// the original document model was used.
import { supabase } from '../lib/supabase';

export const db = { __rmDocsDb: true } as const;

// ---- auth shim (the game always falls back to the currentUser prop) ----
export const auth: {
  currentUser: { uid: string } | null;
  onAuthStateChanged: (cb: (user: { uid: string } | null) => void) => () => void;
} = {
  currentUser: null,
  onAuthStateChanged(cb) {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        auth.currentUser = data.user ? { uid: data.user.id } : null;
        cb(auth.currentUser);
      })
      .catch(() => cb(null));
    return () => {};
  },
};

supabase.auth.getUser().then(({ data }) => {
  if (data.user) auth.currentUser = { uid: data.user.id };
}).catch(() => {});

export async function signInAnonymously(_a?: unknown): Promise<{ user: { uid: string } | null }> {
  const { data } = await supabase.auth.getUser();
  auth.currentUser = data.user ? { uid: data.user.id } : null;
  return { user: auth.currentUser };
}

// ---- refs ----
type DocRef = { __t: 'doc'; col: string; id: string };
type ColRef = { __t: 'col'; col: string };
type WhereC = { kind: 'where'; field: string; op: string; val: unknown };
type OrderC = { kind: 'orderBy'; field: string; dir: 'asc' | 'desc' };
type QueryRef = { __t: 'query'; col: string; constraints: (WhereC | OrderC)[] };

// doc(db, 'private_rooms', code) / doc(db, 'a', 'b', 'c', 'd') — segments alternate col/id.
export function doc(_db: unknown, ...segments: string[]): DocRef {
  const id = segments[segments.length - 1];
  const col = segments.slice(0, -1).join('/');
  return { __t: 'doc', col, id };
}

export function collection(_db: unknown, ...segments: string[]): ColRef {
  return { __t: 'col', col: segments.join('/') };
}

export function where(field: string, op: string, val: unknown): WhereC {
  return { kind: 'where', field, op, val };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): OrderC {
  return { kind: 'orderBy', field, dir };
}

export function query(colRef: ColRef, ...constraints: (WhereC | OrderC)[]): QueryRef {
  return { __t: 'query', col: colRef.col, constraints };
}

export function serverTimestamp(): number {
  return Date.now();
}

const ARRAY_UNION = '__rm_arrayUnion__';
export function arrayUnion(...items: unknown[]): { [ARRAY_UNION]: unknown[] } {
  return { [ARRAY_UNION]: items };
}

// ---- snapshots ----
type DocSnap = { id: string; exists: () => boolean; data: () => Record<string, unknown> | undefined };
function makeDocSnap(id: string, data: Record<string, unknown> | null): DocSnap {
  return { id, exists: () => data != null, data: () => data ?? undefined };
}

async function fetchDoc(col: string, id: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('rm_docs').select('data').eq('col', col).eq('id', id).maybeSingle();
  return data ? ((data as { data: Record<string, unknown> }).data ?? {}) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDoc(ref: DocRef): Promise<any> {
  return makeDocSnap(ref.id, await fetchDoc(ref.col, ref.id));
}

export async function setDoc(ref: DocRef, obj: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('rm_docs').upsert({ col: ref.col, id: ref.id, data: obj });
  if (error) console.warn('rmatchFirebase.setDoc:', error.message);
}

export async function updateDoc(ref: DocRef, partial: Record<string, unknown>): Promise<void> {
  const current = (await fetchDoc(ref.col, ref.id)) ?? {};
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(partial)) {
    if (v && typeof v === 'object' && ARRAY_UNION in (v as object)) {
      const additions = (v as Record<string, unknown[]>)[ARRAY_UNION];
      const existing = Array.isArray(merged[k]) ? (merged[k] as unknown[]) : [];
      merged[k] = [...existing, ...additions];
    } else {
      merged[k] = v;
    }
  }
  const { error } = await supabase.from('rm_docs').upsert({ col: ref.col, id: ref.id, data: merged });
  if (error) console.warn('rmatchFirebase.updateDoc:', error.message);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  await supabase.from('rm_docs').delete().eq('col', ref.col).eq('id', ref.id);
}

export async function addDoc(colRef: ColRef, obj: Record<string, unknown>): Promise<DocRef> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const { error } = await supabase.from('rm_docs').insert({ col: colRef.col, id, data: obj });
  if (error) console.warn('rmatchFirebase.addDoc:', error.message);
  return { __t: 'doc', col: colRef.col, id };
}

function applyConstraints(
  rows: { id: string; data: Record<string, unknown>; created_at: string }[],
  constraints: (WhereC | OrderC)[]
) {
  let out = rows.slice();
  for (const c of constraints) {
    if (c.kind === 'where') {
      out = out.filter((r) => {
        const fv = (r.data as Record<string, unknown>)[c.field];
        switch (c.op) {
          case '==': return fv === c.val;
          case '!=': return fv !== c.val;
          case '<': return (fv as number) < (c.val as number);
          case '<=': return (fv as number) <= (c.val as number);
          case '>': return (fv as number) > (c.val as number);
          case '>=': return (fv as number) >= (c.val as number);
          default: return true;
        }
      });
    } else if (c.kind === 'orderBy') {
      out.sort((a, b) => {
        const av = (a.data as Record<string, unknown>)[c.field] as number | string;
        const bv = (b.data as Record<string, unknown>)[c.field] as number | string;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return c.dir === 'desc' ? -cmp : cmp;
      });
    }
  }
  return out;
}

type QuerySnap = {
  docs: { id: string; data: () => Record<string, unknown>; ref: DocRef }[];
  forEach: (cb: (d: { id: string; data: () => Record<string, unknown>; ref: DocRef }) => void) => void;
  empty: boolean;
  size: number;
};

async function runQuery(colOrQuery: ColRef | QueryRef): Promise<QuerySnap> {
  const col = colOrQuery.col;
  const constraints = colOrQuery.__t === 'query' ? colOrQuery.constraints : [];
  const { data } = await supabase.from('rm_docs').select('id, data, created_at').eq('col', col);
  const rows = ((data ?? []) as { id: string; data: Record<string, unknown>; created_at: string }[]);
  const filtered = applyConstraints(rows, constraints);
  const docs = filtered.map((r) => ({
    id: r.id,
    data: () => r.data ?? {},
    ref: { __t: 'doc', col, id: r.id } as DocRef,
  }));
  return { docs, forEach: (cb) => docs.forEach(cb), empty: docs.length === 0, size: docs.length };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDocs(colOrQuery: ColRef | QueryRef): Promise<any> {
  return runQuery(colOrQuery);
}

// onSnapshot: doc ref -> DocSnap stream; collection/query -> QuerySnap stream.
export function onSnapshot(
  target: DocRef | ColRef | QueryRef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNext: (snap: any) => void,
  _onError?: (err: unknown) => void
): () => void {
  const col = target.col;
  if (target.__t === 'doc') {
    const id = target.id;
    getDoc(target).then(onNext).catch(() => {});
    const channel = supabase
      .channel(`rm_doc_${col}_${id}`.replace(/[^a-zA-Z0-9_]/g, '_'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rm_docs', filter: `id=eq.${id}` }, async () => {
        onNext(await getDoc(target));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }
  runQuery(target).then(onNext).catch(() => {});
  const channel = supabase
    .channel(`rm_col_${col}`.replace(/[^a-zA-Z0-9_]/g, '_'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rm_docs' }, async () => {
      onNext(await runQuery(target));
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

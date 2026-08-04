// TEMPORARY design-review page — mounts the real RandomMatchGame home for a
// user with realistic values (a fresh account, and a played-in one via
// ?level=…&xp=…&coins=…&points=…), so the layout can be judged against the
// numbers it will actually hold rather than the mock's. Delete with
// preview-rmatch.html.
import { createRoot } from 'react-dom/client';
import RandomMatchGame from './entertainment/RandomMatchGame';
import type { User } from './types';
import './index.css';

const q = new URLSearchParams(location.search);
const n = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

const user = {
  id: 'user_1',
  name: q.get('name') || 'أندرو',
  email: 'a@example.com',
  phone: '01000000000',
  role: 'user',
  points: n('points', 0),
  xp: n('xp', 0),
  level: n('level', 1),
  gameCoins: n('coins', 0),
  rating: n('rating', 100),
  favorites: [],
  createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as User;

createRoot(document.getElementById('root')!).render(
  <RandomMatchGame
    currentUser={user}
    onUpdateUser={() => undefined}
    onClose={() => undefined}
    onOpenRewards={() => undefined}
    // Real matchmaking runs for real here — there is no session in this
    // harness, so the RPC is rejected and the error path is what shows.
    onEnterMatch={(roomId) => { (window as unknown as Record<string, unknown>).__roomId = roomId; }}
  />,
);

// TEMPORARY design-review page — mounts the REAL OwnerOnboardingWizard for a
// brand-new owner (no house, no rooms), which is the state that gates a first
// registration and cannot otherwise be reached without a fresh account.
// Whatever the wizard would have written is captured and shown instead of
// being sent anywhere. Delete this and preview-onboarding.html when done.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OwnerOnboardingWizard from './components/OwnerOnboardingWizard';
import type { User, RetreatHouse, Room, OwnerPaymentMethod } from './types';
import './index.css';

const owner = {
  id: 'user_owner', name: 'أ. مينا صبحي', email: 'owner@example.com',
  phone: '01001234567', role: 'owner', points: 0, favorites: [],
  createdAt: '2025-01-01T00:00:00.000Z',
} as unknown as User;

function Preview() {
  const [captured, setCaptured] = useState<{ house?: RetreatHouse; rooms: Room[]; methods?: OwnerPaymentMethod[] }>({ rooms: [] });

  return (
    <>
      <OwnerOnboardingWizard
        owner={owner}
        existingHouse={null}
        existingRooms={[]}
        // ?fail=house or ?fail=rooms makes the corresponding write report
        // failure, which is the half of the submit path that used to be
        // untestable — it congratulated the owner either way.
        onCreateHouse={(h) => {
          setCaptured((c) => ({ ...c, house: h })); (window as unknown as Record<string, unknown>).__house = h;
          return Promise.resolve(new URLSearchParams(location.search).get('fail') !== 'house');
        }}
        onAddRoom={(r) => { (window as unknown as Record<string, unknown>).__rooms = [...(((window as unknown as Record<string, unknown>).__rooms as unknown[]) || []), r];
          setCaptured((c) => ({ ...c, rooms: [...c.rooms, r] }));
          return Promise.resolve(new URLSearchParams(location.search).get('fail') !== 'rooms');
        }}
        onAddRoomType={(t) => { (window as unknown as Record<string, unknown>).__types = [...(((window as unknown as Record<string, unknown>).__types as unknown[]) || []), t]; return Promise.resolve(true); }}
        onUpdatePaymentMethods={(_h, m) => setCaptured((c) => ({ ...c, methods: m }))}
        onLogout={() => undefined}
      />
      {captured.house && (
        <pre id="captured-house" className="fixed bottom-0 inset-x-0 max-h-[40vh] overflow-auto bg-black/90 text-emerald-300 text-[10px] p-3 z-50" dir="ltr">
          {JSON.stringify(captured, null, 2)}
        </pre>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);

// TEMPORARY design-review page — mounts the REAL AdminDashboard against the
// project's own mock data, because the admin screen otherwise needs an admin
// account and a populated database to reach. Every handler is inert: nothing
// it would have written is sent anywhere.
//
// Delete this and preview-admin.html when the review is done.
import { createRoot } from 'react-dom/client';
import AdminDashboard from './components/AdminDashboard';
import { INITIAL_USERS, INITIAL_HOUSES, INITIAL_BOOKINGS, INITIAL_REVIEWS, INITIAL_PAYMENTS } from './mockData';
import type { User, PlatformSettings } from './types';
import { DEFAULT_PLATFORM_SETTINGS } from './types';
import './index.css';

const admin = { ...INITIAL_USERS[0], role: 'admin', name: 'أ. بيشوي' } as User;
const noop = () => {};

// The finance page is entirely gated on Pima having somewhere to receive
// money — with no accounts configured it correctly reports nothing. Give the
// preview one so the figures are exercised rather than all zero.
const settings: PlatformSettings = {
  ...DEFAULT_PLATFORM_SETTINGS,
  paymentMethods: [{ id: 'pm_1', type: 'instapay', value: 'pima@instapay', label: 'إنستاباي بيما' }],
} as PlatformSettings;

function Preview() {
  return (
    <div className="min-h-screen bg-[#F1EEE6] p-3" dir="rtl">
      <AdminDashboard
        currentUser={admin}
        houses={INITIAL_HOUSES}
        users={INITIAL_USERS}
        bookings={INITIAL_BOOKINGS}
        reviews={INITIAL_REVIEWS}
        payments={INITIAL_PAYMENTS}
        settings={settings}
        onApproveHouse={noop}
        onRejectHouse={noop}
        onToggleUserRole={noop}
        onSuspendHouse={noop}
        onDeleteHouse={noop}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);

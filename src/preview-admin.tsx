// TEMPORARY design-review page — mounts the REAL AdminDashboard against the
// project's own mock data, because the admin screen otherwise needs an admin
// account and a populated database to reach. Every handler is inert: nothing
// it would have written is sent anywhere.
//
// Delete this and preview-admin.html when the review is done.
import { createRoot } from 'react-dom/client';
import AdminDashboard from './components/AdminDashboard';
import { INITIAL_USERS, INITIAL_HOUSES, INITIAL_BOOKINGS, INITIAL_REVIEWS, INITIAL_PAYMENTS } from './mockData';
import type { User } from './types';
import './index.css';

const admin = { ...INITIAL_USERS[0], role: 'admin', name: 'أ. بيشوي' } as User;
const noop = () => {};

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

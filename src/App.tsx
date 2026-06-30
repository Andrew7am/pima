import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { loadHouses, loadBookings, loadReviews, loadPayments } from './lib/db';
import { User, RetreatHouse, Booking, Review, UserRole, Attendee, RoomAllocation, AppNotification, Payment } from './types';
import { INITIAL_USERS } from './mockData';

// Component Imports
import InteractiveMap from './components/InteractiveMap';
import UserBookings from './components/UserBookings';
import OwnerDashboard from './components/OwnerDashboard';
import AdminDashboard from './components/AdminDashboard';
import HouseDetail from './components/HouseDetail';
import UserDashboard from './components/UserDashboard';
import WebLayout from './components/WebLayout';
import AuthScreen from './components/AuthScreen';
import WeeklyMenuManager from './components/WeeklyMenuManager';
import ContactSupport from './components/ContactSupport';
import RewardsDashboard from './components/RewardsDashboard';

export default function App() {
  // --- Persistent States from LocalStorage ---
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('coptic_users');
    if (saved) {
      const parsed: User[] = JSON.parse(saved);
      return parsed.map(u => {
        const initial = INITIAL_USERS.find(iu => iu.id === u.id);
        return initial ? { ...u, ...initial } : u;
      });
    }
    return INITIAL_USERS;
  });

  const [houses, setHouses] = useState<RetreatHouse[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [attendees, setAttendees] = useState<Attendee[]>(() => {
    const saved = localStorage.getItem('coptic_attendees');
    return saved ? JSON.parse(saved) : [];
  });

  const [allocations, setAllocations] = useState<RoomAllocation[]>(() => {
    const saved = localStorage.getItem('coptic_allocations');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('coptic_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [payments, setPayments] = useState<Payment[]>([]);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return null;
  });

  // --- UI Navigation States ---
  const [activeScreen, setActiveScreen] = useState<'explore' | 'bookings' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'rewards'>('explore');
  const [selectedHouse, setSelectedHouse] = useState<RetreatHouse | null>(null);

  // --- Supabase Data Loading ---
  const loadAppData = useCallback(async () => {
    const [h, b, r, p] = await Promise.all([loadHouses(), loadBookings(), loadReviews(), loadPayments()]);
    setHouses(h);
    setBookings(b);
    setReviews(r);
    setPayments(p);
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) {
      const user: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role as User['role'],
        phone: data.phone,
        organizationName: data.organization_name ?? undefined,
        isApproved: data.is_approved ?? undefined,
        points: data.points ?? 0,
        favorites: data.favorites ?? [],
        createdAt: data.created_at,
      };
      setCurrentUser(user);
      if (user.role === 'owner') setActiveScreen('owner_panel');
      else if (user.role === 'admin') setActiveScreen('admin_panel');
      else setActiveScreen('explore');
      loadAppData();
    }
    setIsAuthLoading(false);
  }, [loadAppData]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUserProfile(session.user.id);
      else setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadUserProfile(session.user.id);
      else { setCurrentUser(null); setIsAuthLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  // --- Smart Notification Generator (3 Days Before Check-in) ---
  useEffect(() => {
    if (!currentUser) return;

    // Find upcoming bookings of current user that are approved (confirmed but still not yet checked in/completed)
    const upcomingBookings = bookings.filter(
      (b) => b.userId === currentUser.id && b.status === 'approved'
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setNotifications((prev) => {
      const newNotifs = [...prev];
      let hasChanges = false;

      upcomingBookings.forEach((booking) => {
        const checkInDate = new Date(booking.checkIn);
        checkInDate.setHours(0, 0, 0, 0);

        const timeDiff = checkInDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // Remind if check-in is exactly or within 3 days and in the future (or today)
        if (daysDiff <= 3 && daysDiff >= 0) {
          // Calculate remaining balance
          const bPayments = payments.filter(
            (p) => p.bookingId === booking.id && p.paymentStatus === 'approved'
          );
          const totalPaid = bPayments.reduce((sum, p) => sum + p.amount, 0);
          const remaining = booking.totalPrice - totalPaid;

          // Check if rooms and attendees are incomplete
          const bAttendees = attendees.filter((a) => a.bookingId === booking.id);
          const bAllocations = allocations.filter((al) => al.bookingId === booking.id);
          const isRoomsIncomplete =
            bAttendees.length < booking.guestsCount ||
            bAllocations.length < booking.guestsCount;

          // If there's remaining balance OR rooms are incomplete, send notification
          if (remaining > 0 || isRoomsIncomplete) {
            const notifId = `reminder_3days_${booking.id}`;

            // Avoid duplicate notification
            if (!newNotifs.some((n) => n.id === notifId)) {
              let msg = `موعد خلوتك في بيت "${booking.houseName}" يقترب بعد ${daysDiff} أيام (${booking.checkIn}).\n`;
              if (remaining > 0) {
                msg += `⚠️ يرجى سداد المبلغ المتبقي وقدره ${remaining.toLocaleString('ar-EG')} ج.م.\n`;
              }
              if (isRoomsIncomplete) {
                msg += `⚠️ يرجى إكمال قائمة المرافقين (${bAttendees.length}/${booking.guestsCount} فرد) وتوزيع الغرف الشاغرة.`;
              }

              newNotifs.push({
                id: notifId,
                userId: currentUser.id,
                bookingId: booking.id,
                title: `تنبيه اقتراب الخلوة - بيت ${booking.houseName}`,
                message: msg,
                type: 'danger',
                isRead: false,
                createdAt: new Date().toISOString(),
              });
              hasChanges = true;
            }
          }
        }
      });

      return hasChanges ? newNotifs : prev;
    });
  }, [currentUser, bookings, payments, attendees, allocations]);

  // --- User Account Operations ---
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Add new user to the users list if not already present
    if (!users.some((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase())) {
      setUsers((prev) => [...prev, user]);
    }
    // Set appropriate initial screen
    if (user.role === 'owner') {
      setActiveScreen('owner_panel');
    } else if (user.role === 'admin') {
      setActiveScreen('admin_panel');
    } else {
      setActiveScreen('explore');
    }
    setSelectedHouse(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSelectedHouse(null);
    setActiveScreen('explore');
  };

  // --- Favorite Operations ---
  const handleToggleFavorite = (houseId: string) => {
    if (!currentUser) return;
    
    const currentFavs = currentUser.favorites || [];
    const isFav = currentFavs.includes(houseId);
    const newFavs = isFav
      ? currentFavs.filter((id) => id !== houseId)
      : [...currentFavs, houseId];
    
    const updatedUser = { ...currentUser, favorites: newFavs };
    setCurrentUser(updatedUser);
    
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
    );
  };

  // --- Booking Operations ---
  const handleBookHouse = (newBooking: Booking, pointsRedeemed: number = 0) => {
    setBookings((prev) => [newBooking, ...prev]);

    // Calculate points earned for this booking (10% of booking price)
    const pointsEarned = Math.round(newBooking.totalPrice * 0.1);

    // Update users and currentUser points/history
    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id === currentUser?.id) {
          const currentPoints = u.points || 0;
          const newPoints = Math.max(0, currentPoints - pointsRedeemed + pointsEarned);

          const history = u.pointsHistory || [];
          const newTransactions = [...history];

          if (pointsRedeemed > 0) {
            newTransactions.push({
              id: `pt_red_${Date.now()}`,
              date: new Date().toISOString(),
              amount: pointsRedeemed,
              description: `خصم نقاط لحجز بيت ${newBooking.houseName}`,
              type: 'redeemed'
            });
          }

          if (pointsEarned > 0) {
            newTransactions.push({
              id: `pt_earn_${Date.now() + 1}`,
              date: new Date().toISOString(),
              amount: pointsEarned,
              description: `نقاط مكتسبة من حجز بيت ${newBooking.houseName}`,
              type: 'earned'
            });
          }

          const updatedUser: User = {
            ...u,
            points: newPoints,
            pointsHistory: newTransactions
          };

          // Also update currentUser
          setCurrentUser(updatedUser);
          localStorage.setItem('coptic_current_user', JSON.stringify(updatedUser));

          return updatedUser;
        }
        return u;
      })
    );

    setActiveScreen('bookings');
    setSelectedHouse(null);
  };

  const handlePayDeposit = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, depositPaid: true, depositAmount: Math.round(b.totalPrice * 0.15) }
          : b
      )
    );
  };

  // --- Owner Operations ---
  const handleAddHouse = (newHouse: RetreatHouse) => {
    setHouses((prev) => [newHouse, ...prev]);
  };

  const handleApproveBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'approved' } : b))
    );
    // Find booking to notify
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        userId: b.userId,
        bookingId: b.id,
        title: 'تم قبول وتأكيد الحجز 🎉',
        message: `تهانينا! تم قبول وتأكيد حجزك في "${b.houseName}" للفترة من ${b.checkIn} إلى ${b.checkOut}. يمكنك الآن توزيع الغرف والمتابعة.`,
        type: 'success',
        isRead: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  const handleRejectBooking = (bookingId: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'rejected' } : b))
    );
    // Find booking to notify
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        userId: b.userId,
        bookingId: b.id,
        title: 'تم رفض طلب الحجز ⚠️',
        message: `نأسف لإبلاغك بأنه قد تم رفض طلب حجزك في "${b.houseName}" للفترة من ${b.checkIn} إلى ${b.checkOut} لعدم توفر السعة أو لظروف خاصة.`,
        type: 'danger',
        isRead: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  // --- Egyptian Payment System Operations ---
  const handleSubmitPayment = (payment: Payment) => {
    setPayments((prev) => [payment, ...prev]);
    
    // Update booking's paymentStatus
    setBookings((prevBookings) =>
      prevBookings.map((b) => {
        if (b.id === payment.bookingId) {
          return {
            ...b,
            paymentStatus: 'pending_verification'
          };
        }
        return b;
      })
    );

    // Get the booking
    const b = bookings.find((bk) => bk.id === payment.bookingId);
    if (b) {
      // Create user notification
      const userNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        userId: b.userId,
        bookingId: b.id,
        title: 'تم إرسال إثبات الدفع بنجاح ⏳',
        message: `تم استلام تفاصيل وإثبات الدفع الخاص بك بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م وجاري المراجعة والتحقق من قبل الإدارة لتأكيد الحجز.`,
        type: 'info',
        isRead: false,
        createdAt: new Date().toISOString()
      };

      // Create admin notification
      const adminNotif: AppNotification = {
        id: `notif_admin_${Date.now()}`,
        userId: 'user_admin',
        bookingId: b.id,
        title: 'إثبات دفع جديد بانتظار المراجعة 💸',
        message: `قام المستخدم "${b.userName}" بتقديم إثبات دفع بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م للحجز الخاص به في "${b.houseName}".`,
        type: 'info',
        isRead: false,
        createdAt: new Date().toISOString()
      };

      setNotifications((prev) => [userNotif, adminNotif, ...prev]);
    }
  };

  const handleVerifyPayment = (paymentId: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    setPayments((prevPayments) =>
      prevPayments.map((p) => (p.id === paymentId ? { ...p, paymentStatus: status, adminNotes } : p))
    );

    // Fetch updated payments state directly for finder safety
    const payment = payments.find((p) => p.id === paymentId);
    if (payment) {
      const b = bookings.find((bk) => bk.id === payment.bookingId);
      if (b) {
        // If approved, update booking status to confirmed/approved, depositPaid to true, and paymentStatus to paid_deposit or paid_full
        const updatedPaymentStatus = payment.amount >= b.totalPrice ? 'paid_full' : 'paid_deposit';
        
        setBookings((prevBookings) =>
          prevBookings.map((bk) => {
            if (bk.id === b.id) {
              return {
                ...bk,
                paymentStatus: status === 'approved' ? updatedPaymentStatus : 'unpaid',
                status: status === 'approved' ? 'approved' : bk.status,
                depositPaid: status === 'approved' ? true : bk.depositPaid,
              };
            }
            return bk;
          })
        );

        // Notifications
        if (status === 'approved') {
          const userNotif: AppNotification = {
            id: `notif_${Date.now()}`,
            userId: b.userId,
            bookingId: b.id,
            title: 'تم تأكيد الدفع والحجز بنجاح 🎉',
            message: `تهانينا! تم تأكيد وتأشير دفعتك بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م كـ "مقبولة". أصبح حجزك في "${b.houseName}" مؤكداً ومضموناً الآن. ملاحظات الإدارة: ${adminNotes || 'تم التحقق بنجاح.'}`,
            type: 'success',
            isRead: false,
            createdAt: new Date().toISOString()
          };
          setNotifications((prev) => [userNotif, ...prev]);
        } else {
          const userNotif: AppNotification = {
            id: `notif_${Date.now()}`,
            userId: b.userId,
            bookingId: b.id,
            title: 'تم رفض إثبات الدفع ⚠️',
            message: `نأسف، لقد تم رفض إثبات الدفع الذي أرسلته بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م لعدم صحة البيانات أو تعذر مطابقة التحويل. يرجى التواصل مع الإدارة أو المحاولة مجدداً بمستند صحيح. ملاحظات الإدارة: ${adminNotes || 'لم يثبت صحة التحويل.'}`,
            type: 'danger',
            isRead: false,
            createdAt: new Date().toISOString()
          };
          setNotifications((prev) => [userNotif, ...prev]);
        }
      }
    }
  };

  // --- Admin Operations ---
  const handleApproveHouse = (houseId: string) => {
    setHouses((prev) =>
      prev.map((h) => (h.id === houseId ? { ...h, status: 'approved' } : h))
    );
  };

  const handleRejectHouse = (houseId: string) => {
    setHouses((prev) =>
      prev.map((h) => (h.id === houseId ? { ...h, status: 'rejected' } : h))
    );
  };

  const handleToggleUserRole = (userId: string, newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    // If the changed user is the currently logged user, update current state too
    if (currentUser && currentUser.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, role: newRole } : null));
    }
  };

  const handleUpdateUserProfile = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('coptic_current_user', JSON.stringify(updatedUser));
    }
  };

  // --- Review Operations ---
  const handleAddReview = (newReview: Review) => {
    setReviews((prev) => [newReview, ...prev]);
    
    // Recalculate average rating for the target retreat house
    setHouses((prevHouses) =>
      prevHouses.map((h) => {
        if (h.id === newReview.houseId) {
          const matchingReviews = [...reviews.filter((r) => r.houseId === h.id), newReview];
          const average = matchingReviews.reduce((sum, r) => sum + (r.overall_rating ?? r.rating), 0) / matchingReviews.length;
          return {
            ...h,
            rating: parseFloat(average.toFixed(1)),
            reviewsCount: matchingReviews.length,
          };
        }
        return h;
      })
    );
  };

  // --- Menu Operations ---
  const handleUpdateHouseMenu = (houseId: string, updatedMenu: any) => {
    setHouses((prevHouses) =>
      prevHouses.map((h) => {
        if (h.id === houseId) {
          const updated = { ...h, menu: updatedMenu };
          if (selectedHouse && selectedHouse.id === houseId) {
            setSelectedHouse(updated);
          }
          return updated;
        }
        return h;
      })
    );
  };

  const handleUpdateHouse = (updatedHouse: RetreatHouse) => {
    setHouses((prevHouses) =>
      prevHouses.map((h) => (h.id === updatedHouse.id ? updatedHouse : h))
    );
    if (selectedHouse && selectedHouse.id === updatedHouse.id) {
      setSelectedHouse(updatedHouse);
    }
  };

  const handleUpdateReview = (updatedReview: Review) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === updatedReview.id ? updatedReview : r))
    );
  };

  const handleUpdateAttendees = (bookingId: string, bookingAttendees: Attendee[]) => {
    setAttendees(prev => {
      const filtered = prev.filter(a => a.bookingId !== bookingId);
      return [...filtered, ...bookingAttendees];
    });
  };

  const handleUpdateAllocations = (bookingId: string, bookingAllocations: RoomAllocation[]) => {
    setAllocations(prev => {
      const filtered = prev.filter(al => al.bookingId !== bookingId);
      return [...filtered, ...bookingAllocations];
    });
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleClearNotifications = () => {
    if (currentUser) {
      setNotifications((prev) =>
        prev.filter((n) => n.userId !== currentUser.id)
      );
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center">
        <div className="text-[#8A8A70] text-sm">جارٍ التحميل...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <WebLayout
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      currentUser={currentUser}
      onLogout={handleLogout}
      notifications={notifications}
      onMarkNotificationAsRead={handleMarkNotificationAsRead}
      onClearNotifications={handleClearNotifications}
    >
      {/* Screen Routing & Render Logic */}
      {selectedHouse ? (
        // Detailed Retreat House Screen
        <HouseDetail
          house={selectedHouse}
          currentUser={currentUser}
          bookings={bookings}
          reviews={reviews}
          onBack={() => setSelectedHouse(null)}
          onBook={handleBookHouse}
          onSubmitReview={handleAddReview}
          onUpdateMenu={handleUpdateHouseMenu}
          isFavorited={currentUser.favorites?.includes(selectedHouse.id) || false}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : (
        // Main Screen Tabs
        <>
          {activeScreen === 'explore' && (
            <UserDashboard
              houses={houses}
              currentUser={currentUser}
              onSelectHouse={(h) => setSelectedHouse(h)}
              onSelectRewards={() => setActiveScreen('rewards')}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeScreen === 'bookings' && (
            // User bookings & quotes tracker
            <UserBookings
              bookings={bookings}
              houses={houses}
              currentUser={currentUser}
              onPayDeposit={handlePayDeposit}
              attendees={attendees}
              allocations={allocations}
              onUpdateAttendees={handleUpdateAttendees}
              onUpdateAllocations={handleUpdateAllocations}
              payments={payments}
              onSubmitPayment={handleSubmitPayment}
            />
          )}

          {activeScreen === 'owner_panel' && currentUser.role === 'owner' && (
            // Owner dashboard
            <OwnerDashboard
              owner={currentUser}
              houses={houses}
              bookings={bookings}
              onAddHouse={handleAddHouse}
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              attendees={attendees}
              allocations={allocations}
              onUpdateAttendees={handleUpdateAttendees}
              onUpdateAllocations={handleUpdateAllocations}
              onUpdateOwnerProfile={handleUpdateUserProfile}
              onUpdateHouse={handleUpdateHouse}
              reviews={reviews}
              onUpdateReview={handleUpdateReview}
            />
          )}

          {activeScreen === 'admin_panel' && currentUser.role === 'admin' && (
            // Master Admin dashboard
            <AdminDashboard
              houses={houses}
              users={users}
              bookings={bookings}
              onApproveHouse={handleApproveHouse}
              onRejectHouse={handleRejectHouse}
              onToggleUserRole={handleToggleUserRole}
              attendees={attendees}
              allocations={allocations}
              onUpdateAttendees={handleUpdateAttendees}
              onUpdateAllocations={handleUpdateAllocations}
              payments={payments}
              onVerifyPayment={handleVerifyPayment}
            />
          )}

          {activeScreen === 'rewards' && (
            <RewardsDashboard
              currentUser={currentUser}
              onBack={() => setActiveScreen('explore')}
            />
          )}

          {activeScreen === 'meals' && (
            // Coptic Weekly Menu Manager dashboard
            <WeeklyMenuManager
              currentUser={currentUser}
            />
          )}

          {activeScreen === 'support' && (
            // Contact & Technical Support screen
            <ContactSupport
              currentUser={currentUser}
            />
          )}
        </>
      )}
    </WebLayout>
  );
}

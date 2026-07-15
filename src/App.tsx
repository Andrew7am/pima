import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import {
  mapUser, loadUsers,
  loadHouses, deleteHouse, loadBookings, loadReviews, loadReviewsForHouses, loadPayments, loadNotifications, loadPointsHistory,
  loadRoomsForHouses, loadAnnouncementsForHouses, loadWaitlistForHouses, loadPlatformAnnouncements,
  loadAttendeesForBooking, loadAllocationsForBooking, saveAttendeesForBooking, saveAllocationsForBooking, loadAllocationsCount,
  createBooking, updateBookingStatus, updateBookingFields,
  createReview, updateReview as updateReviewDb, deleteReview as deleteReviewDb, createPayment, updatePaymentStatus,
  markNotificationRead,
  createRoom, updateRoom as updateRoomDb, deleteRoom as deleteRoomDb,
  createWaitlistEntry,
  createPlatformAnnouncement, setPlatformAnnouncementActive, deletePlatformAnnouncement,
  loadPlatformSettings, updatePlatformSettings,
  deleteOwnAccount,
  getHouseOwnerContact,
  loadAuditLog,
  loadPaymentProofImage,
} from './lib/db';
import { User, RetreatHouse, Booking, Review, UserRole, Attendee, RoomAllocation, AppNotification, Payment, PointsTransaction, Room, Announcement, WaitlistEntry, PlatformAnnouncement, PlatformSettings, DEFAULT_PLATFORM_SETTINGS, AuditLogEntry } from './types';

// Component Imports
import UserBookings from './components/UserBookings';
import OwnerDashboard from './components/OwnerDashboard';
import AdminDashboard from './components/AdminDashboard';
import HouseDetail from './components/HouseDetail';
import UserDashboard from './components/UserDashboard';
import WebLayout from './components/WebLayout';
import AuthScreen from './components/AuthScreen';
import WeeklyMenuManager from './components/WeeklyMenuManager';
import ContactSupport from './components/ContactSupport';
import ProfileScreen from './components/ProfileScreen';
import PrivacyPolicy from './components/PrivacyPolicy';
import EntertainmentHome from './entertainment/EntertainmentHome';
import TriviaGame from './entertainment/games/TriviaGame';
import WhoAmIGame from './entertainment/games/WhoAmIGame';
import HymnsGame from './entertainment/games/HymnsGame';
import FillVerseGame from './entertainment/games/FillVerseGame';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import CompleteProfileScreen from './components/CompleteProfileScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import BannedScreen from './components/BannedScreen';
import InteractiveMap from './components/InteractiveMap';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);

  const [houses, setHouses] = useState<RetreatHouse[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [allocations, setAllocations] = useState<RoomAllocation[]>([]);
  const [allocationsCount, setAllocationsCount] = useState(0);
  const [ownerContacts, setOwnerContacts] = useState<Record<string, { name: string; phone: string }>>({});
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('coptic_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [platformAnnouncements, setPlatformAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return null;
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // --- UI Navigation States ---
  const [activeScreen, setActiveScreen] = useState<'explore' | 'bookings' | 'map' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'profile' | 'privacy' | 'entertainment' | 'trivia' | 'whoami' | 'hymns' | 'fillverse'>('explore');
  const [selectedHouse, setSelectedHouse] = useState<RetreatHouse | null>(null);

  // --- Supabase Data Loading ---
  // rooms/announcements/reviews/waitlist are NOT loaded here — they're
  // public/RLS-scoped tables fetched only for whichever house(s) are
  // actually being viewed (see the lazy-load effects below), not wholesale
  // on every login the way they used to be.
  const loadAppData = useCallback(async (userId?: string) => {
    const [u, h, b, p, pa, st, ac] = await Promise.all([
      loadUsers(), loadHouses(), loadBookings(), loadPayments(),
      loadPlatformAnnouncements(),
      loadPlatformSettings(), loadAllocationsCount(),
    ]);
    setUsers(u);
    setHouses(h);
    setBookings(b);
    setPayments(p);
    setPlatformAnnouncements(pa);
    setSettings(st);
    setAllocationsCount(ac);
    if (userId) {
      const n = await loadNotifications(userId);
      setNotifications(n);
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    const [{ data }, pointsHistory] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      loadPointsHistory(userId),
    ]);
    if (data) {
      const user: User = { ...mapUser(data), pointsHistory };
      setCurrentUser(user);
      if (user.role === 'owner') setActiveScreen('owner_panel');
      else if (user.role === 'admin') setActiveScreen('admin_panel');
      else setActiveScreen('explore');
      loadAppData(user.id);
    }
    setIsAuthLoading(false);
  }, [loadAppData]);

  // Points are earned server-side (DB trigger on bookings/reviews) so a
  // payment confirmed by the owner/admin, or a referral bonus paid to a
  // different user, still lands correctly under RLS. Re-pull the balance
  // for display whenever the signed-in user is the one affected.
  const refreshCurrentUserPoints = useCallback(async (userId: string) => {
    const [{ data }, pointsHistory] = await Promise.all([
      supabase.from('users').select('points').eq('id', userId).single(),
      loadPointsHistory(userId),
    ]);
    setCurrentUser((prev) => {
      if (!prev || prev.id !== userId) return prev;
      return { ...prev, points: data?.points ?? prev.points, pointsHistory };
    });
  }, []);

  // House rating/reviewsCount are recomputed server-side by the migration-020
  // trigger whenever a review is added/deleted — re-pull the real value
  // instead of trusting a locally-guessed average (same principle as
  // refreshCurrentUserPoints and the booking price/deposit fix).
  const refreshHouseRating = useCallback(async (houseId: string) => {
    const { data } = await supabase.from('houses').select('rating, reviews_count').eq('id', houseId).single();
    if (data) {
      setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, rating: Number(data.rating), reviewsCount: data.reviews_count as number } : h)));
    }
  }, []);

  // onAuthStateChange fires immediately with the current session right after
  // subscribing (INITIAL_SESSION), so a separate getSession() call here was
  // redundant — it made loadAppData's 10 full-table queries fire 2-3x on
  // every single page load, which was the dominant contributor to egress.
  //
  // TOKEN_REFRESHED fires automatically (~every 55min per open tab, and also
  // on tab refocus in some cases) purely to renew the JWT — it does NOT mean
  // the user's data changed, so re-running loadUserProfile/loadAppData (9
  // full-table queries) for it was pure waste, silently multiplying egress
  // for anyone who leaves a tab open. Only reload on an actual sign-in.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') { setIsPasswordRecovery(true); return; }
      if (_event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') return;
      if (session) loadUserProfile(session.user.id);
      else { setCurrentUser(null); setIsAuthLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  // Deep link support: opening a shared house link (?house=<id>) jumps
  // straight to that house once its data is loaded. The query param is
  // stripped right after so navigating away and back doesn't reopen it.
  useEffect(() => {
    if (houses.length === 0) return;
    const houseId = new URLSearchParams(window.location.search).get('house');
    if (!houseId) return;
    const house = houses.find((h) => h.id === houseId);
    if (house) {
      setSelectedHouse(house);
      setActiveScreen('explore');
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [houses]);

  // rooms/announcements/reviews/waitlist (public/RLS-scoped tables, scoped
  // server-side by house_id — see loadAppData) are fetched lazily rather
  // than for every login: one house's worth when its detail page opens, and
  // every house the owner runs when they open their dashboard.
  useEffect(() => {
    if (!selectedHouse) return;
    const houseId = selectedHouse.id;
    Promise.all([
      loadRoomsForHouses([houseId]), loadAnnouncementsForHouses([houseId]),
      loadReviewsForHouses([houseId]), loadWaitlistForHouses([houseId]),
    ]).then(([hRooms, hAnnouncements, hReviews, hWaitlist]) => {
      setRooms((prev) => [...prev.filter((r) => r.houseId !== houseId), ...hRooms]);
      setAnnouncements((prev) => [...prev.filter((a) => a.houseId !== houseId), ...hAnnouncements]);
      setReviews((prev) => [...prev.filter((rv) => rv.houseId !== houseId), ...hReviews]);
      setWaitlist((prev) => [...prev.filter((w) => w.houseId !== houseId), ...hWaitlist]);
    });
  }, [selectedHouse]);

  useEffect(() => {
    if (activeScreen !== 'owner_panel' || !currentUser) return;
    const ownerHouseIds = houses.filter((h) => h.ownerId === currentUser.id).map((h) => h.id);
    if (ownerHouseIds.length === 0) return;
    Promise.all([
      loadRoomsForHouses(ownerHouseIds), loadAnnouncementsForHouses(ownerHouseIds),
      loadReviewsForHouses(ownerHouseIds), loadWaitlistForHouses(ownerHouseIds),
    ]).then(([oRooms, oAnnouncements, oReviews, oWaitlist]) => {
      setRooms((prev) => [...prev.filter((r) => !ownerHouseIds.includes(r.houseId)), ...oRooms]);
      setAnnouncements((prev) => [...prev.filter((a) => !ownerHouseIds.includes(a.houseId)), ...oAnnouncements]);
      setReviews((prev) => [...prev.filter((rv) => !ownerHouseIds.includes(rv.houseId)), ...oReviews]);
      setWaitlist((prev) => [...prev.filter((w) => !ownerHouseIds.includes(w.houseId)), ...oWaitlist]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen, currentUser?.id, houses.length]);

  // Audit log (migration 032) + full reviews (admin moderation needs every
  // review platform-wide, not just one house's) — admin-only, fetched only
  // when the admin actually opens the admin panel, not on every login.
  useEffect(() => {
    if (activeScreen !== 'admin_panel' || currentUser?.role !== 'admin') return;
    loadAuditLog().then(setAuditLog);
    loadReviews().then(setReviews);
  }, [activeScreen, currentUser?.role]);

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

  const handleDeleteAccount = async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await deleteOwnAccount();
    if (result.ok) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setSelectedHouse(null);
      setActiveScreen('explore');
    }
    return result;
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
  const handleBookHouse = async (newBooking: Booking, pointsRedeemed: number = 0): Promise<boolean> => {
    // Persist to Supabase first — the DB trigger enforces bed-capacity per dates
    const res = await createBooking(newBooking);
    if (!res.ok) {
      if (res.error === 'INSUFFICIENT_CAPACITY') {
        const avail = res.availableBeds ?? 0;
        if (avail === 0) {
          alert('عذراً، البيت مكتمل الإشغال في هذه التواريخ. الرجاء اختيار تواريخ أخرى.');
        } else {
          alert(`عذراً، لم يتبقَ سوى ${avail} سرير متاح في هذه التواريخ، وطلبك يتطلب ${newBooking.guestsCount} فرد. الرجاء تقليل عدد الأفراد أو تغيير التواريخ.`);
        }
      } else {
        alert('حدث خطأ في حفظ الحجز. حاول مرة أخرى.');
      }
      return false;
    }
    // Use the server-persisted row, not the client's copy — the DB trigger
    // may have recomputed total_price/deposit_amount against the current
    // platform settings (e.g. if the deposit rate changed after this form
    // loaded), and we want the UI to reflect what was actually saved.
    const savedBooking = res.booking ?? newBooking;
    setBookings((prev) => [savedBooking, ...prev]);

    // Points are EARNED server-side only when a payment is actually confirmed
    // (see migration 005) — never at booking time. Redemption goes through the
    // redeem_points() SECURITY DEFINER function (migration 017), which validates
    // the balance server-side; the old client-side `update({ points })` path is
    // now blocked by the privileged-column protection trigger so a user can no
    // longer just grant themselves points from the browser console.
    if (pointsRedeemed > 0 && currentUser) {
      const description = `خصم نقاط لحجز بيت ${newBooking.houseName}`;
      const { data: remaining, error } = await supabase.rpc('redeem_points', {
        p_amount: pointsRedeemed,
        p_description: description,
      });
      if (error) {
        console.error('redeemPoints:', error);
      } else {
        const redemptionTx: PointsTransaction = {
          id: `pt_red_${Date.now()}`,
          date: new Date().toISOString(),
          amount: pointsRedeemed,
          description,
          type: 'redeemed',
        };
        const newPoints = typeof remaining === 'number'
          ? remaining
          : Math.max(0, (currentUser.points || 0) - pointsRedeemed);
        const updatedUser: User = {
          ...currentUser,
          points: newPoints,
          pointsHistory: [...(currentUser.pointsHistory || []), redemptionTx],
        };
        setCurrentUser(updatedUser);
        setUsers((prevUsers) => prevUsers.map((u) => (u.id === currentUser.id ? updatedUser : u)));
      }
    }

    setActiveScreen('bookings');
    setSelectedHouse(null);
    return true;
  };

  const handleJoinWaitlist = (entry: WaitlistEntry): boolean => {
    setWaitlist((prev) => [...prev, entry]);
    createWaitlistEntry(entry);
    return true;
  };

  const handleCancelBooking = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target || target.status !== 'pending') return;
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
    const ok = await updateBookingStatus(bookingId, 'cancelled');
    if (!ok) {
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'pending' } : b));
    }
  };

  // --- Owner Operations ---
  const handleAddHouse = (newHouse: RetreatHouse) => {
    setHouses((prev) => [newHouse, ...prev]);
    supabase.from('houses').insert({
      id: newHouse.id, name: newHouse.name, description: newHouse.description,
      owner_id: newHouse.ownerId, owner_name: newHouse.ownerName,
      governorate: newHouse.governorate, address: newHouse.address,
      lat: newHouse.lat, lng: newHouse.lng,
      rooms_count: newHouse.roomsCount, beds_count: newHouse.bedsCount,
      rooms_description: newHouse.roomsDescription,
      price_per_night_per_person: newHouse.pricePerNightPerPerson,
      services: newHouse.services, suitability: newHouse.suitability,
      activities: newHouse.activities, images: newHouse.images,
      conference_halls: newHouse.conferenceHalls, restaurants: newHouse.restaurants,
      status: newHouse.status, rating: newHouse.rating, reviews_count: newHouse.reviewsCount,
      property_type: newHouse.propertyType ?? null,
      sea_proximity: newHouse.seaProximity ?? null,
      student_housing_gender: newHouse.studentHousingGender ?? null,
      distance_from_university: newHouse.distanceFromUniversity ?? null,
      monthly_rent: newHouse.monthlyRent ?? null,
      room_capacity: newHouse.roomCapacity ?? null,
      housing_rules: newHouse.housingRules ?? [],
      contract_terms: newHouse.contractTerms ?? null,
      menu: newHouse.menu ?? null,
      created_at: newHouse.createdAt,
    }).then(({ error }) => { if (error) console.error('addHouse:', error); });
  };

  // Notifications are created server-side through the authorized
  // emit_notification RPC (migration 021) — a raw client INSERT is blocked
  // (no INSERT policy) so notifications can't be forged. The local push is
  // optimistic for the acting user's own view.
  const pushNotification = (n: AppNotification) => {
    setNotifications((prev) => [n, ...prev]);
    supabase.rpc('emit_notification', {
      p_target: n.userId,
      p_booking: n.bookingId || '',
      p_title: n.title,
      p_message: n.message,
      p_type: n.type,
    }).then(({ error }) => { if (error) console.error('emit_notification:', error); });
  };

  const handleApproveBooking = (bookingId: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'approved' } : b)));
    updateBookingStatus(bookingId, 'approved');
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
        title: 'تم قبول وتأكيد الحجز 🎉',
        message: `تهانينا! تم قبول وتأكيد حجزك في "${b.houseName}" للفترة من ${b.checkIn} إلى ${b.checkOut}.`,
        type: 'success', isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  const handleRejectBooking = (bookingId: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'rejected' } : b)));
    updateBookingStatus(bookingId, 'rejected');
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
        title: 'تم رفض طلب الحجز ⚠️',
        message: `نأسف لإبلاغك بأنه قد تم رفض طلب حجزك في "${b.houseName}" للفترة من ${b.checkIn} إلى ${b.checkOut}.`,
        type: 'danger', isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  // Owner marks that they've received the deposit in-person / off-platform
  const handleConfirmDepositReceived = (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    // Fallback only fires if depositAmount was somehow never set — use the
    // live admin-configured rate (migration 024), not a stale hard-coded one.
    const depositAmount = target ? (target.depositAmount || Math.round(target.totalPrice * settings.depositRate)) : 0;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, depositPaid: true, depositAmount, paymentStatus: 'paid_deposit' }
          : b
      )
    );
    updateBookingFields(bookingId, { depositPaid: true, depositAmount, paymentStatus: 'paid_deposit' })
      .then(() => { if (target && currentUser?.id === target.userId) refreshCurrentUserPoints(target.userId); });
    if (target) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: target.userId, bookingId: target.id,
        title: 'تم استلام العربون بنجاح ✓',
        message: `أكد ${target.houseName} استلام العربون بمبلغ ${depositAmount.toLocaleString()} ج.م. الحجز مؤمن الآن.`,
        type: 'success', isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  // Owner marks guest as checked in (arrived on-site)
  const handleCheckInBooking = (bookingId: string) => {
    const checkedInAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, checkedInAt } : b))
    );
    updateBookingFields(bookingId, { checkedInAt });
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
        title: 'تم تسجيل وصولك 🏠',
        message: `تم تسجيل وصولك بنجاح لبيت "${b.houseName}". نتمنى لك إقامة مباركة وممتعة!`,
        type: 'info', isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  // Owner marks guest as checked out (booking completed)
  const handleCheckOutBooking = (bookingId: string) => {
    const checkedOutAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed', checkedOutAt } : b))
    );
    updateBookingFields(bookingId, { status: 'completed', checkedOutAt });
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
        title: 'شكراً لإقامتك 💚',
        message: `تمت مغادرتك من "${b.houseName}". يسعدنا مشاركتك تقييمك للبيت لتساعد الآخرين.`,
        type: 'success', isRead: false, createdAt: new Date().toISOString()
      });
    }
  };

  // --- Egyptian Payment System Operations ---
  const handleSubmitPayment = (payment: Payment) => {
    setPayments((prev) => [payment, ...prev]);
    createPayment(payment);

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
    updateBookingFields(payment.bookingId, { paymentStatus: 'pending_verification' });

    // The guest "proof received" and per-admin "new payment to review"
    // notifications are created server-side by the payments-insert trigger
    // (migration 021), which also fixes the old hardcoded 'user_admin'
    // recipient that never existed.
  };

  const handleVerifyPayment = (paymentId: string, status: 'approved' | 'rejected', adminNotes?: string) => {
    setPayments((prevPayments) =>
      prevPayments.map((p) => (p.id === paymentId ? { ...p, paymentStatus: status, adminNotes } : p))
    );

    const payment = payments.find((p) => p.id === paymentId);
    if (payment) {
      // Persist updated payment to Supabase
      updatePaymentStatus(paymentId, status, adminNotes);
      const b = bookings.find((bk) => bk.id === payment.bookingId);
      if (b) {
        const updatedPaymentStatus: Booking['paymentStatus'] = payment.amount >= b.totalPrice ? 'paid_full' : 'paid_deposit';

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
        // Persist booking update to Supabase
        if (status === 'approved') {
          updateBookingFields(b.id, {
            paymentStatus: updatedPaymentStatus,
            status: 'approved',
            depositPaid: true,
          }).then(() => { if (currentUser?.id === b.userId) refreshCurrentUserPoints(b.userId); });
        } else {
          updateBookingFields(b.id, { paymentStatus: 'unpaid' })
            .then(() => { if (currentUser?.id === b.userId) refreshCurrentUserPoints(b.userId); });
        }

        if (status === 'approved') {
          pushNotification({
            id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
            title: 'تم تأكيد الدفع والحجز بنجاح 🎉',
            message: `تهانينا! تم تأكيد دفعتك بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م. أصبح حجزك في "${b.houseName}" مؤكداً ومضموناً الآن. ${adminNotes ? 'ملاحظات: ' + adminNotes : ''}`,
            type: 'success', isRead: false, createdAt: new Date().toISOString()
          });
        } else {
          pushNotification({
            id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
            title: 'تم رفض إثبات الدفع ⚠️',
            message: `نأسف، تم رفض إثبات الدفع بمبلغ ${payment.amount.toLocaleString('ar-EG')} ج.م. يرجى المحاولة مجدداً. ${adminNotes ? 'ملاحظات: ' + adminNotes : ''}`,
            type: 'danger', isRead: false, createdAt: new Date().toISOString()
          });
        }
      }
    }
  };

  // --- Admin Operations ---
  const handleApproveHouse = (houseId: string) => {
    setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, status: 'approved' } : h)));
    supabase.from('houses').update({ status: 'approved' }).eq('id', houseId).then(({ error }) => {
      if (error) console.error('approveHouse:', error);
    });
  };

  const handleRejectHouse = (houseId: string) => {
    setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, status: 'rejected' } : h)));
    supabase.from('houses').update({ status: 'rejected' }).eq('id', houseId).then(({ error }) => {
      if (error) console.error('rejectHouse:', error);
    });
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
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    // Persist to Supabase
    supabase.from('users').update({
      name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone,
      organization_name: updatedUser.organizationName ?? null,
      points: updatedUser.points ?? 0,
      favorites: updatedUser.favorites ?? [],
      role: updatedUser.role,
      date_of_birth: updatedUser.dateOfBirth ?? null,
      address: updatedUser.address ?? null,
      governorate: updatedUser.governorate ?? null,
      church_name: updatedUser.churchName ?? null,
      priest_name: updatedUser.priestName ?? null,
    }).eq('id', updatedUser.id).then(({ error }) => {
      if (error) console.error('updateUserProfile:', error);
    });
  };

  // Admin-only: approve or reject a pending servant/owner account. Requires
  // the users_update_admin RLS policy (migration 008) since this touches
  // someone else's row, not the caller's own.
  const handleSetUserApproval = (userId: string, status: 'approved' | 'rejected') => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, approvalStatus: status } : u)));
    supabase.from('users').update({ approval_status: status }).eq('id', userId).then(({ error }) => {
      if (error) console.error('setUserApproval:', error);
    });
    pushNotification({
      id: `notif_${Date.now()}`, userId, bookingId: '',
      title: status === 'approved' ? 'تم اعتماد حسابك ✓' : 'تعذر اعتماد حسابك',
      message: status === 'approved'
        ? 'تهانينا! تم مراجعة حسابك والموافقة عليه، يمكنك الآن استخدام المنصة بالكامل.'
        : 'نأسف، تعذرت الموافقة على حسابك حالياً. تواصل مع الدعم الفني لمزيد من التفاصيل.',
      type: status === 'approved' ? 'success' : 'danger', isRead: false, createdAt: new Date().toISOString()
    });
  };

  // Admin edits the platform economics (migration 024). Optimistic; the
  // update RLS-fails silently for non-admins, so only admins persist.
  const handleUpdateSettings = (next: PlatformSettings) => {
    setSettings(next);
    updatePlatformSettings(next);
  };

  // --- Admin control powers (migration 023) ---

  // Take down an approved house (or bring a suspended one back). Admin-only
  // via houses_update_admin; the owner-protection trigger (019) skips admins.
  const handleSuspendHouse = (houseId: string, suspend: boolean) => {
    const newStatus: RetreatHouse['status'] = suspend ? 'suspended' : 'approved';
    setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, status: newStatus } : h)));
    if (selectedHouse?.id === houseId) setSelectedHouse((prev) => (prev ? { ...prev, status: newStatus } : prev));
    supabase.from('houses').update({ status: newStatus }).eq('id', houseId)
      .then(({ error }) => { if (error) console.error('suspendHouse:', error); });
  };

  // Ban / unban any account. is_banned is admin-only (locked by the
  // migration-023 protection trigger for everyone else).
  const handleBanUser = (userId: string, banned: boolean) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isBanned: banned } : u)));
    supabase.from('users').update({ is_banned: banned }).eq('id', userId)
      .then(({ error }) => { if (error) console.error('banUser:', error); });
  };

  // Cancel any booking (fraud / dispute). Admin-only via bookings_update_admin.
  const handleAdminCancelBooking = (bookingId: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'rejected' } : b)));
    updateBookingStatus(bookingId, 'rejected');
    const b = bookings.find((bk) => bk.id === bookingId);
    if (b) {
      pushNotification({
        id: `notif_${Date.now()}`, userId: b.userId, bookingId: b.id,
        title: 'تم إلغاء الحجز من الإدارة',
        message: `نأسف لإبلاغك بأن إدارة المنصة قامت بإلغاء حجزك في "${b.houseName}". للاستفسار تواصل مع الدعم الفني.`,
        type: 'danger', isRead: false, createdAt: new Date().toISOString(),
      });
    }
  };

  // Delete a spam / abusive review. Admin-only via reviews_delete_admin.
  // Re-pulls the house's real rating from the server (migration-020 trigger)
  // instead of guessing an average locally.
  const handleDeleteReview = async (reviewId: string) => {
    const target = reviews.find((r) => r.id === reviewId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    await deleteReviewDb(reviewId);
    if (target) refreshHouseRating(target.houseId);
  };

  // --- Review Operations ---
  const handleAddReview = async (newReview: Review) => {
    // Optimistic insert; rolled back if the DB rejects it.
    setReviews((prev) => [newReview, ...prev]);

    // Awards points server-side (migration 005) and enforces the
    // "must have a confirmed booking" rule (migration 020).
    const ok = await createReview(newReview);
    if (!ok) {
      setReviews((prev) => prev.filter((r) => r.id !== newReview.id));
      alert('لا يمكنك تقييم هذا البيت إلا بعد أن يكون لديك حجز مؤكد به.');
      return;
    }
    if (currentUser?.id === newReview.userId) refreshCurrentUserPoints(newReview.userId);

    // House rating + reviews_count are recomputed server-side by the
    // migration-020 trigger — pull the real value rather than guessing.
    refreshHouseRating(newReview.houseId);
  };

  // --- Menu Operations ---
  const handleUpdateHouseMenu = (houseId: string, updatedMenu: any) => {
    setHouses((prevHouses) =>
      prevHouses.map((h) => {
        if (h.id === houseId) {
          const updated = { ...h, menu: updatedMenu };
          if (selectedHouse && selectedHouse.id === houseId) setSelectedHouse(updated);
          return updated;
        }
        return h;
      })
    );
    supabase.from('houses').update({ menu: updatedMenu }).eq('id', houseId)
      .then(({ error }) => { if (error) console.error('updateHouseMenu:', error); });
  };

  // Shared column mapping so a full house update (owner form) and an
  // approved pending-edit merge (admin) never drift out of sync again.
  const houseUpdatePayload = (h: RetreatHouse) => ({
    name: h.name, description: h.description,
    governorate: h.governorate,
    address: h.address, lat: h.lat, lng: h.lng,
    rooms_count: h.roomsCount, beds_count: h.bedsCount,
    rooms_description: h.roomsDescription,
    price_per_night_per_person: h.pricePerNightPerPerson,
    images: h.images,
    image_descriptions: h.imageDescriptions ?? {},
    blocked_dates: h.blockedDates ?? [],
    services: h.services, activities: h.activities, suitability: h.suitability,
    conference_halls: h.conferenceHalls, restaurants: h.restaurants,
    property_type: h.propertyType ?? null,
    student_housing_gender: h.studentHousingGender ?? null,
    distance_from_university: h.distanceFromUniversity ?? null,
    monthly_rent: h.monthlyRent ?? null,
    housing_rules: h.housingRules ?? [],
    contract_terms: h.contractTerms ?? null,
    menu: h.menu ?? null, status: h.status,
  });

  const handleUpdateHouse = (updatedHouse: RetreatHouse) => {
    setHouses((prevHouses) =>
      prevHouses.map((h) => (h.id === updatedHouse.id ? updatedHouse : h))
    );
    if (selectedHouse && selectedHouse.id === updatedHouse.id) setSelectedHouse(updatedHouse);
    supabase.from('houses').update(houseUpdatePayload(updatedHouse)).eq('id', updatedHouse.id).then(({ error }) => {
      if (error) console.error('updateHouse:', error);
    });
  };

  // Owner-submitted edits to an already-approved house are staged here
  // instead of applying immediately — the admin approves or rejects them.
  const handleRequestHouseEdit = (houseId: string, changes: Partial<RetreatHouse>) => {
    setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, pendingEdit: changes } : h)));
    supabase.from('houses').update({ pending_edit: changes }).eq('id', houseId).then(({ error }) => {
      if (error) console.error('requestHouseEdit:', error);
    });
  };

  const handleApproveHouseEdit = (houseId: string) => {
    const house = houses.find((h) => h.id === houseId);
    if (!house?.pendingEdit) return;
    const merged: RetreatHouse = { ...house, ...house.pendingEdit, pendingEdit: undefined };
    setHouses((prev) => prev.map((h) => (h.id === houseId ? merged : h)));
    if (selectedHouse && selectedHouse.id === houseId) setSelectedHouse(merged);
    supabase.from('houses').update({ ...houseUpdatePayload(merged), pending_edit: null }).eq('id', houseId).then(({ error }) => {
      if (error) console.error('approveHouseEdit:', error);
    });
  };

  const handleRejectHouseEdit = (houseId: string) => {
    setHouses((prev) => prev.map((h) => (h.id === houseId ? { ...h, pendingEdit: undefined } : h)));
    supabase.from('houses').update({ pending_edit: null }).eq('id', houseId).then(({ error }) => {
      if (error) console.error('rejectHouseEdit:', error);
    });
  };

  const handleDeleteHouse = (houseId: string) => {
    setHouses((prev) => prev.filter((h) => h.id !== houseId));
    if (selectedHouse && selectedHouse.id === houseId) setSelectedHouse(null);
    deleteHouse(houseId);
  };

  const handleAddRoom = (newRoom: Room) => {
    setRooms((prev) => [...prev, newRoom]);
    createRoom(newRoom);
  };

  const handleUpdateRoom = (updatedRoom: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === updatedRoom.id ? updatedRoom : r)));
    updateRoomDb(updatedRoom);
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    deleteRoomDb(roomId);
  };

  // --- Platform-wide announcement carousel (admin-only) ---
  const handleAddPlatformAnnouncement = (a: PlatformAnnouncement) => {
    setPlatformAnnouncements((prev) => [a, ...prev]);
    createPlatformAnnouncement(a);
  };

  const handleTogglePlatformAnnouncement = (id: string, isActive: boolean) => {
    setPlatformAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isActive } : a)));
    setPlatformAnnouncementActive(id, isActive);
  };

  const handleDeletePlatformAnnouncement = (id: string) => {
    setPlatformAnnouncements((prev) => prev.filter((a) => a.id !== id));
    deletePlatformAnnouncement(id);
  };

  const handleUpdateReview = (updatedReview: Review) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === updatedReview.id ? updatedReview : r))
    );
    updateReviewDb(updatedReview);
  };

  // Attendees/allocations aren't part of loadAppData (see loadAttendeesForBooking
  // comment in db.ts) — pull them in only when RoomDistribution is about to open
  // for a specific booking, not on every login/page load.
  const handleOpenRoomDistribution = useCallback(async (bookingId: string) => {
    const [bookingAttendees, bookingAllocations] = await Promise.all([
      loadAttendeesForBooking(bookingId),
      loadAllocationsForBooking(bookingId),
    ]);
    setAttendees(prev => [...prev.filter(a => a.bookingId !== bookingId), ...bookingAttendees]);
    setAllocations(prev => [...prev.filter(al => al.bookingId !== bookingId), ...bookingAllocations]);
  }, []);

  // House owner contact (migration 031) — only revealed once the guest's own
  // booking is approved and deposit-paid, so fetch it lazily per booking the
  // first time UserBookings needs to render the reveal card, not up front.
  const handleRevealOwnerContact = useCallback(async (bookingId: string) => {
    const contact = await getHouseOwnerContact(bookingId);
    if (contact) {
      setOwnerContacts((prev) => ({ ...prev, [bookingId]: contact }));
    }
  }, []);

  const handleUpdateAttendees = (bookingId: string, bookingAttendees: Attendee[]) => {
    setAttendees(prev => {
      const filtered = prev.filter(a => a.bookingId !== bookingId);
      return [...filtered, ...bookingAttendees];
    });
    saveAttendeesForBooking(bookingId, bookingAttendees);
  };

  const handleUpdateAllocations = (bookingId: string, bookingAllocations: RoomAllocation[]) => {
    setAllocations(prev => {
      const filtered = prev.filter(al => al.bookingId !== bookingId);
      return [...filtered, ...bookingAllocations];
    });
    saveAllocationsForBooking(bookingId, bookingAllocations);
  };

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    markNotificationRead(id);
  };

  const handleClearNotifications = () => {
    if (currentUser) {
      setNotifications((prev) => prev.filter((n) => n.userId !== currentUser.id));
      supabase.from('notifications').delete().eq('user_id', currentUser.id)
        .then(({ error }) => { if (error) console.error('clearNotifications:', error); });
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center">
        <div className="text-[#8A8A70] text-sm">جارٍ التحميل...</div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <ResetPasswordScreen onDone={() => setIsPasswordRecovery(false)} />;
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  // Google sign-in (and any pre-existing account from before these fields
  // existed) may be missing profile details the registration form normally
  // collects up front. Admin accounts are provisioned directly and are exempt.
  const isChurchAffiliated = currentUser.role === 'individual' || currentUser.role === 'servant';
  const needsOrgName = currentUser.role === 'servant' || currentUser.role === 'owner';
  const needsProfileCompletion = currentUser.role !== 'admin' && (
    !currentUser.phone ||
    currentUser.dateOfBirth === undefined ||
    !currentUser.governorate ||
    (isChurchAffiliated && (!currentUser.churchName || !currentUser.priestName)) ||
    (needsOrgName && !currentUser.organizationName)
  );

  if (needsProfileCompletion) {
    return (
      <CompleteProfileScreen
        currentUser={currentUser}
        onComplete={(fields) => {
          handleUpdateUserProfile({
            ...currentUser,
            role: fields.role,
            phone: fields.phone,
            dateOfBirth: fields.dateOfBirth,
            governorate: fields.governorate,
            address: fields.address,
            organizationName: fields.organizationName ?? currentUser.organizationName,
            churchName: fields.churchName,
            priestName: fields.priestName,
          });
        }}
      />
    );
  }

  // Banned accounts (admin action, migration 023) are blocked from the app entirely.
  if (currentUser.isBanned) {
    return <BannedScreen currentUser={currentUser} onLogout={handleLogout} />;
  }

  // Servant/owner accounts need admin review before they can use the app —
  // grandfathered existing accounts are already 'approved' (migration 008),
  // so this only affects new signups going forward.
  const needsApproval = (currentUser.role === 'servant' || currentUser.role === 'owner') &&
    currentUser.approvalStatus !== 'approved';

  if (needsApproval) {
    return <PendingApprovalScreen currentUser={currentUser} onLogout={handleLogout} />;
  }

  // Navigating via sidebar should always clear any open house detail
  const navigate = (screen: typeof activeScreen) => {
    setSelectedHouse(null);
    setActiveScreen(screen);
  };

  return (
    <WebLayout
      activeScreen={activeScreen}
      setActiveScreen={navigate}
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
          rooms={rooms.filter((r) => r.houseId === selectedHouse.id)}
          announcements={announcements.filter((a) => a.houseId === selectedHouse.id && a.isActive)}
          waitlist={waitlist}
          onJoinWaitlist={handleJoinWaitlist}
          settings={settings}
        />
      ) : (
        // Main Screen Tabs
        <>
          {activeScreen === 'explore' && (
            <UserDashboard
              houses={houses}
              currentUser={currentUser}
              onSelectHouse={(h) => setSelectedHouse(h)}
              onSelectRewards={() => setActiveScreen('profile')}
              onToggleFavorite={handleToggleFavorite}
              platformAnnouncements={platformAnnouncements.filter((a) => a.isActive)}
            />
          )}

          {activeScreen === 'map' && (
            // Interactive map — every approved house with a location, always
            // in sync with the live houses list (new houses appear automatically)
            <div className="h-[calc(100dvh-180px)]">
              <InteractiveMap houses={houses} onSelectHouse={(h) => setSelectedHouse(h)} />
            </div>
          )}

          {activeScreen === 'bookings' && (
            // User bookings & quotes tracker
            <UserBookings
              bookings={bookings}
              houses={houses}
              currentUser={currentUser}
              onCancelBooking={handleCancelBooking}
              attendees={attendees}
              allocations={allocations}
              onUpdateAttendees={handleUpdateAttendees}
              onUpdateAllocations={handleUpdateAllocations}
              onOpenRoomDistribution={handleOpenRoomDistribution}
              payments={payments}
              onSubmitPayment={handleSubmitPayment}
              settings={settings}
              ownerContacts={ownerContacts}
              onRevealOwnerContact={handleRevealOwnerContact}
            />
          )}

          {activeScreen === 'owner_panel' && currentUser.role === 'owner' && (
            // Owner dashboard
            <OwnerDashboard
              owner={currentUser}
              houses={houses}
              bookings={bookings}
              settings={settings}
              onAddHouse={handleAddHouse}
              onUpdateHouse={handleUpdateHouse}
              onRequestHouseEdit={handleRequestHouseEdit}
              onDeleteHouse={handleDeleteHouse}
              onApproveBooking={handleApproveBooking}
              onRejectBooking={handleRejectBooking}
              onConfirmDeposit={handleConfirmDepositReceived}
              onCheckInBooking={handleCheckInBooking}
              onCheckOutBooking={handleCheckOutBooking}
              attendees={attendees}
              allocations={allocations}
              onUpdateAttendees={handleUpdateAttendees}
              onUpdateAllocations={handleUpdateAllocations}
              onOpenRoomDistribution={handleOpenRoomDistribution}
              reviews={reviews}
              onUpdateReview={handleUpdateReview}
              rooms={rooms}
              onAddRoom={handleAddRoom}
              onUpdateRoom={handleUpdateRoom}
              onDeleteRoom={handleDeleteRoom}
              waitlist={waitlist}
            />
          )}

          {activeScreen === 'admin_panel' && currentUser.role === 'admin' && (
            // Master Admin dashboard
            <AdminDashboard
              houses={houses}
              users={users}
              bookings={bookings}
              reviews={reviews}
              onApproveHouse={handleApproveHouse}
              onRejectHouse={handleRejectHouse}
              onApproveHouseEdit={handleApproveHouseEdit}
              onRejectHouseEdit={handleRejectHouseEdit}
              onToggleUserRole={handleToggleUserRole}
              onSuspendHouse={handleSuspendHouse}
              onBanUser={handleBanUser}
              onCancelBooking={handleAdminCancelBooking}
              onDeleteReview={handleDeleteReview}
              allocationsCount={allocationsCount}
              payments={payments}
              onVerifyPayment={handleVerifyPayment}
              onSetUserApproval={handleSetUserApproval}
              platformAnnouncements={platformAnnouncements}
              onAddPlatformAnnouncement={handleAddPlatformAnnouncement}
              onTogglePlatformAnnouncement={handleTogglePlatformAnnouncement}
              onDeletePlatformAnnouncement={handleDeletePlatformAnnouncement}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              auditLog={auditLog}
              onLoadProofImage={loadPaymentProofImage}
            />
          )}

          {activeScreen === 'profile' && (
            <ProfileScreen
              currentUser={currentUser}
              onLogout={handleLogout}
              onBack={() => setActiveScreen('explore')}
              onNavigateSupport={() => setActiveScreen('support')}
              onNavigatePrivacy={() => setActiveScreen('privacy')}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeScreen === 'meals' && (
            // Coptic Weekly Menu Manager dashboard
            <WeeklyMenuManager
              currentUser={currentUser}
            />
          )}

          {activeScreen === 'support' && (
            // Contact & Technical Support screen — reached from Profile, not the bottom nav
            <ContactSupport
              currentUser={currentUser}
              onBack={() => setActiveScreen('profile')}
            />
          )}

          {activeScreen === 'privacy' && (
            // Privacy policy & terms — reached from Profile, not the bottom nav
            <PrivacyPolicy onBack={() => setActiveScreen('profile')} />
          )}

          {activeScreen === 'entertainment' && (
            <EntertainmentHome
              currentUser={currentUser}
              onBack={() => setActiveScreen('explore')}
              onOpenTrivia={() => setActiveScreen('trivia')}
              onOpenWhoAmI={() => setActiveScreen('whoami')}
              onOpenHymns={() => setActiveScreen('hymns')}
              onOpenFillVerse={() => setActiveScreen('fillverse')}
            />
          )}

          {activeScreen === 'trivia' && (
            <TriviaGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}

          {activeScreen === 'whoami' && (
            <WhoAmIGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}

          {activeScreen === 'hymns' && (
            <HymnsGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}

          {activeScreen === 'fillverse' && (
            <FillVerseGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}
        </>
      )}
    </WebLayout>
  );
}

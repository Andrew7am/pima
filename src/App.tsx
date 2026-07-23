import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';
import {
  mapUser, loadUsers,
  loadHouses, deleteHouse, createHouse as createHouseDb, updateHouse as updateHouseDb, houseUpdatePayload as houseUpdatePayloadDb,
  loadBookings, loadReviews, loadReviewsForHouses, loadPayments, loadNotifications, subscribeToNotifications, loadPointsHistory,
  subscribeToBookingsForUser, subscribeToBookingsForHouse, subscribeToRoomsForHouse,
  loadRoomsForHouses, loadAnnouncementsForHouses, loadWaitlistForHouses, loadPlatformAnnouncements,
  loadAttendeesForBooking, loadAllocationsForBooking, saveAttendeesForBooking, saveAllocationsForBooking, loadAllocationsCount,
  createBooking, updateBookingStatus, updateBookingFields,
  createReview, updateReview as updateReviewDb, deleteReview as deleteReviewDb, createPayment, updatePaymentStatus,
  markNotificationRead,
  createRoom, updateRoom as updateRoomDb, deleteRoom as deleteRoomDb,
  createWaitlistEntry,
  loadExpensesForHouses, createExpense as createExpenseDb, deleteExpense as deleteExpenseDb,
  loadPayoutsForHouses, createPayout as createPayoutDb,
  createPlatformAnnouncement, setPlatformAnnouncementActive, deletePlatformAnnouncement,
  loadPlatformSettings, updatePlatformSettings,
  deleteOwnAccount,
  loadAuditLog,
  loadPaymentProofImage,
} from './lib/db';
import { autoAllocate } from './lib/roomAllocation';
import { User, RetreatHouse, Booking, Review, UserRole, Attendee, RoomAllocation, AppNotification, Payment, PointsTransaction, Room, Announcement, WaitlistEntry, PlatformAnnouncement, PlatformSettings, DEFAULT_PLATFORM_SETTINGS, AuditLogEntry, Expense, Payout } from './types';

// Component Imports
// Route-level code splitting: heavy, role- or navigation-gated screens load on
// demand so the first paint (landing / guest browsing) ships a much smaller
// bundle. Each lazy() render site sits under a <Suspense> boundary below.
const UserBookings = lazy(() => import('./components/UserBookings'));
const OwnerDashboardShell = lazy(() => import('./components/owner/OwnerDashboardShell'));
const OwnerFoodMenu = lazy(() => import('./components/owner/OwnerFoodMenu'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
import HouseDetail from './components/HouseDetail';
import UserDashboard from './components/UserDashboard';
import WebLayout from './components/WebLayout';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
const ContactSupport = lazy(() => import('./components/ContactSupport'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
import PrivacyPolicy from './components/PrivacyPolicy';
const EntertainmentHome = lazy(() => import('./entertainment/EntertainmentHome'));
const TriviaGame = lazy(() => import('./entertainment/games/TriviaGame'));
const WhoAmIGame = lazy(() => import('./entertainment/games/WhoAmIGame'));
const HymnsGame = lazy(() => import('./entertainment/games/HymnsGame'));
const FillVerseGame = lazy(() => import('./entertainment/games/FillVerseGame'));
const MultiplayerLobby = lazy(() => import('./entertainment/multiplayer/MultiplayerLobby'));
const LiveMatchGame = lazy(() => import('./entertainment/multiplayer/LiveMatchGame'));
const AchievementsScreen = lazy(() => import('./entertainment/AchievementsScreen'));
import AchievementToast from './entertainment/AchievementToast';
const FriendsScreen = lazy(() => import('./entertainment/FriendsScreen'));
const ChatThreadScreen = lazy(() => import('./entertainment/ChatThreadScreen'));
import ResetPasswordScreen from './components/ResetPasswordScreen';
import CompleteProfileScreen from './components/CompleteProfileScreen';
import PendingApprovalScreen from './components/PendingApprovalScreen';
const OwnerOnboardingWizard = lazy(() => import('./components/OwnerOnboardingWizard'));
import BannedScreen from './components/BannedScreen';
const InteractiveMap = lazy(() => import('./components/InteractiveMap'));
import UpdateBanner from './components/UpdateBanner';
import { useVersionCheck } from './lib/useVersionCheck';

// The 3-day check-in reminder (below) is a client-only synthetic
// notification — it has no row in `public.notifications`, so marking it
// "read" server-side is a no-op and it used to regenerate unread every
// session. Track dismissals locally instead so a user can actually get rid
// of one for good (until the underlying condition changes and a new id is
// generated for the next reminder cycle).
const DISMISSED_REMINDERS_KEY = 'coptic_dismissed_reminders';
function getDismissedReminders(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_REMINDERS_KEY) || '[]')); }
  catch { return new Set(); }
}
function dismissReminder(id: string) {
  const set = getDismissedReminders();
  set.add(id);
  localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify([...set]));
}

// Shown while a lazily-loaded screen chunk is being fetched.
function ScreenFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#3A6B4C] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<User[]>([]);

  const [houses, setHouses] = useState<RetreatHouse[]>([]);
  // Tracks whether loadAppData's houses fetch and the owner's own
  // rooms fetch have actually landed — see the owner-onboarding gate below,
  // which must not render the wizard while these are still unknown.
  const [housesLoaded, setHousesLoaded] = useState(false);
  const [ownerRoomsChecked, setOwnerRoomsChecked] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [allocations, setAllocations] = useState<RoomAllocation[]>([]);
  const [allocationsCount, setAllocationsCount] = useState(0);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('coptic_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const newVersionAvailable = useVersionCheck();
  const showUpdateBanner = newVersionAvailable && !updateBannerDismissed;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [platformAnnouncements, setPlatformAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return null;
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Guest mode: logged-out visitors browse houses freely; the auth screen
  // only appears when they ask for it (or hit a gated action like booking).
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  // Marketing landing — shown to a web visitor's FIRST arrival only. Skipped on
  // the native app, on a shared ?house= deep link, and on every return visit
  // (localStorage flag) so returning users and search-engine re-crawls land
  // straight on the browsable house list instead of behind the splash.
  const [showLanding, setShowLanding] = useState(() => {
    if (Capacitor.isNativePlatform()) return false;
    if (new URLSearchParams(window.location.search).get('house')) return false;
    if (/^\/house\/[^/]+\/?$/.test(window.location.pathname)) return false; // prerendered house page
    try { if (localStorage.getItem('pima_seen_landing')) return false; } catch { /* ignore */ }
    return true;
  });
  const dismissLanding = () => {
    try { localStorage.setItem('pima_seen_landing', '1'); } catch { /* ignore */ }
    setShowLanding(false);
  };
  // Mirrors currentUser?.id for the onAuthStateChange closure below, which
  // only runs its effect once (deps: [loadUserProfile]) so it would
  // otherwise always see the `currentUser` from its first render.
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => { currentUserIdRef.current = currentUser?.id ?? null; }, [currentUser]);
  // Tracks the last house id reflected in the address bar so the URL-sync effect
  // only rewrites to "/" when a house was actually open (an in-app close), never
  // on the initial mount where the deep-link effect is about to open one.
  const prevHouseRef = useRef<string | null>(null);

  // --- UI Navigation States ---
  const [activeScreen, setActiveScreen] = useState<'explore' | 'bookings' | 'map' | 'owner_panel' | 'admin_panel' | 'meals' | 'support' | 'profile' | 'privacy' | 'entertainment' | 'trivia' | 'whoami' | 'hymns' | 'fillverse' | 'multiplayer_lobby' | 'live_match' | 'achievements' | 'friends' | 'chat_thread'>('explore');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  // Newly-unlocked achievement ids awaiting their celebration toast — lives
  // here (not inside a game screen) so an unlock survives navigating away
  // from the game that triggered it. See AchievementToast.tsx.
  const [unlockedAchievementQueue, setUnlockedAchievementQueue] = useState<string[]>([]);
  const handleAchievementsUnlocked = (ids: string[]) => {
    setUnlockedAchievementQueue((prev) => [...prev, ...ids]);
  };
  // Which friend's chat thread is open — set right before navigating to 'chat_thread'
  const [activeChatFriend, setActiveChatFriend] = useState<{ id: string; name: string } | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<RetreatHouse | null>(null);
  // Keeps the owner onboarding wizard mounted through its own success
  // screen — see the gate right before the owner shell renders.
  const [justFinishedOnboarding, setJustFinishedOnboarding] = useState(false);

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
    setHousesLoaded(true);
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

  // What a logged-out visitor needs to browse: approved houses (RLS filters
  // to approved for anon), platform announcements, and settings. Reviews/
  // rooms/announcements for one house load lazily when its page opens (the
  // selectedHouse effect below — those tables have public SELECT policies).
  const loadPublicData = useCallback(async () => {
    const [h, pa, st] = await Promise.all([
      loadHouses(), loadPlatformAnnouncements(), loadPlatformSettings(),
    ]);
    setHouses(h);
    setHousesLoaded(true);
    setPlatformAnnouncements(pa);
    setSettings(st);
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
  //
  // SIGNED_IN has the same trap: supabase-js can re-fire it when a
  // backgrounded tab regains focus and re-validates the existing session,
  // even though nothing actually changed. loadUserProfile always resets
  // activeScreen to 'explore'/'owner_panel'/'admin_panel' (128-130), so
  // without this guard, switching tabs mid-match (e.g. to share a private
  // room code) silently kicked the player out of the match back to the
  // hub the moment they returned — reported as "the room closes itself".
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') { setIsPasswordRecovery(true); return; }
      if (_event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') return;
      if (session) {
        if (session.user.id === currentUserIdRef.current) return;
        loadUserProfile(session.user.id);
      } else {
        // No session (fresh visitor or just logged out) — land on guest
        // browsing, not the auth screen, and pull the public data set.
        setCurrentUser(null);
        setShowAuthScreen(false);
        setIsAuthLoading(false);
        loadPublicData();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile, loadPublicData]);

  // Live notification delivery — without this, a new notification (booking
  // approved, deposit confirmed, new message, account approved, etc.) never
  // appears until the user reloads the page (loadNotifications is a one-shot
  // fetch, only re-run from loadAppData at login). Dedup by id since the
  // initial loadAppData fetch and this subscription can race on startup.
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubscribe = subscribeToNotifications(currentUser.id, (n) => {
      setNotifications((prev) => (prev.some((existing) => existing.id === n.id) ? prev : [n, ...prev]));
    });
    return unsubscribe;
  }, [currentUser?.id]);

  // Live booking delivery for guests — a status change the owner makes
  // (approve/reject/deposit/check-in/check-out) appears immediately instead
  // of only after a reload.
  useEffect(() => {
    if (!currentUser?.id || currentUser.role === 'owner' || currentUser.role === 'admin') return;
    const unsubscribe = subscribeToBookingsForUser(currentUser.id, (event, booking) => {
      setBookings((prev) => {
        const exists = prev.some((b) => b.id === booking.id);
        if (event === 'INSERT' && !exists) return [booking, ...prev];
        return prev.map((b) => (b.id === booking.id ? booking : b));
      });
    });
    return unsubscribe;
  }, [currentUser?.id, currentUser?.role]);

  // Live booking + room delivery for owners — a new booking request or a
  // guest self-cancel appears immediately; room status stays in sync across
  // devices/tabs. Owners are capped at one house, so a single house_id filter
  // covers everything (see the "Restricted to 1 house maximum" convention
  // used throughout the owner dashboard).
  const ownerHouseId = currentUser?.role === 'owner' ? houses.find((h) => h.ownerId === currentUser.id)?.id : undefined;
  useEffect(() => {
    if (!currentUser?.id || currentUser.role !== 'owner' || !ownerHouseId) return;

    const unsubscribeBookings = subscribeToBookingsForHouse(ownerHouseId, (event, booking) => {
      setBookings((prev) => {
        const exists = prev.some((b) => b.id === booking.id);
        if (event === 'INSERT' && !exists) return [booking, ...prev];
        return prev.map((b) => (b.id === booking.id ? booking : b));
      });
    });
    const unsubscribeRooms = subscribeToRoomsForHouse(
      ownerHouseId,
      (room) => setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev.map((r) => (r.id === room.id ? room : r)) : [...prev, room])),
      (roomId) => setRooms((prev) => prev.filter((r) => r.id !== roomId)),
    );
    return () => { unsubscribeBookings(); unsubscribeRooms(); };
  }, [currentUser?.id, currentUser?.role, ownerHouseId]);

  // Native Google Sign-In: AuthScreen.tsx opens the OAuth URL in a system
  // browser tab (Browser.open, not this WebView — Google blocks OAuth
  // inside embedded webviews). This catches the app regaining control via
  // the custom-scheme redirect (see NATIVE_AUTH_REDIRECT in AuthScreen.tsx
  // and the matching intent-filter in AndroidManifest.xml) and completes
  // the session — the resulting SIGNED_IN event then flows through the
  // onAuthStateChange handler above as normal.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith('com.pimastay.app://auth-callback')) return;
      await Browser.close();
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }
      const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    });
    return () => { listenerPromise.then((l) => l.remove()); };
  }, []);

  // Deep link support: opening a shared house link jumps straight to that
  // house once its data is loaded. Two URL shapes resolve here — the prerendered
  // SEO page path /house/<id>/ (see vite.config.ts seoPagesPlugin) and the
  // legacy ?house=<id> query. The URL is normalised to "/" right after so
  // navigating away and back doesn't reopen it.
  // localStorage fallback: web Google OAuth does a full-page redirect back
  // to the bare origin (path/query lost), so requireLogin also stashes the
  // intended house there — restored here after the round-trip.
  useEffect(() => {
    if (houses.length === 0) return;
    let houseId: string | null = new URLSearchParams(window.location.search).get('house');
    if (!houseId) {
      const m = window.location.pathname.match(/^\/house\/([^/]+)\/?$/);
      if (m) houseId = decodeURIComponent(m[1]);
    }
    if (!houseId) {
      try { houseId = localStorage.getItem('pima_pending_house'); } catch { /* storage unavailable */ }
    }
    if (!houseId) return;
    try { localStorage.removeItem('pima_pending_house'); } catch { /* storage unavailable */ }
    const house = houses.find((h) => h.id === houseId);
    if (house) {
      setSelectedHouse(house);
      setActiveScreen('explore');
      // Normalise ?house= / localStorage entry points to the clean, shareable
      // /house/<id>/ path; a real prerendered path stays as-is.
      if (!Capacitor.isNativePlatform())
        window.history.replaceState({ house: house.id }, '', `/house/${house.id}/`);
    } else if (!Capacitor.isNativePlatform()) {
      window.history.replaceState({}, '', '/');
    }
  }, [houses]);

  // Reflect the open house in the address bar (web only) so the URL is
  // shareable/copyable and the browser back button closes the detail view.
  // Pairs with the popstate listener below; the "current !== target" guards
  // keep the two from looping when one triggers the other.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const current = window.location.pathname;
    if (selectedHouse) {
      const target = `/house/${selectedHouse.id}/`;
      if (current !== target) window.history.pushState({ house: selectedHouse.id }, '', target);
      prevHouseRef.current = selectedHouse.id;
    } else {
      if (prevHouseRef.current && /^\/house\/[^/]+\/?$/.test(current)) {
        window.history.pushState({}, '', '/');
      }
      prevHouseRef.current = null;
    }
  }, [selectedHouse]);

  // Browser back/forward: resolve the house from the URL and open/close the
  // detail view to match, so history navigation feels native.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const onPop = () => {
      const m = window.location.pathname.match(/^\/house\/([^/]+)\/?$/);
      if (m) {
        const h = houses.find((x) => x.id === decodeURIComponent(m[1]));
        if (h) { setSelectedHouse(h); setActiveScreen('explore'); }
      } else {
        setSelectedHouse(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
    // Owners need their own rooms loaded even before reaching 'owner_panel'
    // now — the onboarding-completeness gate (isOwnerOnboardingComplete)
    // checks room count before the owner shell ever renders.
    if ((activeScreen !== 'owner_panel' && currentUser?.role !== 'owner') || !currentUser) return;
    if (!housesLoaded) return; // wait for loadAppData's houses fetch before deriving ownerHouseIds from it
    const ownerHouseIds = houses.filter((h) => h.ownerId === currentUser.id).map((h) => h.id);
    if (ownerHouseIds.length === 0) { setOwnerRoomsChecked(true); return; }
    Promise.all([
      loadRoomsForHouses(ownerHouseIds), loadAnnouncementsForHouses(ownerHouseIds),
      loadReviewsForHouses(ownerHouseIds), loadWaitlistForHouses(ownerHouseIds), loadExpensesForHouses(ownerHouseIds),
      loadPayoutsForHouses(ownerHouseIds),
    ]).then(([oRooms, oAnnouncements, oReviews, oWaitlist, oExpenses, oPayouts]) => {
      setRooms((prev) => [...prev.filter((r) => !ownerHouseIds.includes(r.houseId)), ...oRooms]);
      setAnnouncements((prev) => [...prev.filter((a) => !ownerHouseIds.includes(a.houseId)), ...oAnnouncements]);
      setReviews((prev) => [...prev.filter((rv) => !ownerHouseIds.includes(rv.houseId)), ...oReviews]);
      setWaitlist((prev) => [...prev.filter((w) => !ownerHouseIds.includes(w.houseId)), ...oWaitlist]);
      setExpenses((prev) => [...prev.filter((e) => !ownerHouseIds.includes(e.houseId)), ...oExpenses]);
      setPayouts((prev) => [...prev.filter((p) => !ownerHouseIds.includes(p.houseId)), ...oPayouts]);
      setOwnerRoomsChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen, currentUser?.id, currentUser?.role, houses.length, housesLoaded]);

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

            // Avoid duplicate notification, and don't resurrect one the user already dismissed.
            if (!newNotifs.some((n) => n.id === notifId) && !getDismissedReminders().has(notifId)) {
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
    setHousesLoaded(false);
    setOwnerRoomsChecked(false);
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

  // Owner records a phone/walk-in booking (source manual/temporary) on their
  // own house. Same server-side capacity check as guest bookings; unlike
  // handleBookHouse it doesn't navigate away or touch points.
  const handleOwnerCreateBooking = async (newBooking: Booking): Promise<boolean> => {
    const res = await createBooking(newBooking);
    if (!res.ok) {
      if (res.error === 'INSUFFICIENT_CAPACITY') {
        const avail = res.availableBeds ?? 0;
        alert(avail === 0
          ? 'البيت مكتمل الإشغال في هذه التواريخ.'
          : `لم يتبقَ سوى ${avail} سرير متاح في هذه التواريخ، والحجز يتطلب ${newBooking.guestsCount} فرد.`);
      } else {
        alert('حدث خطأ في حفظ الحجز. حاول مرة أخرى.');
      }
      return false;
    }
    setBookings((prev) => [res.booking ?? newBooking, ...prev]);
    return true;
  };

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

  const handleAddExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
    createExpenseDb(expense);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    deleteExpenseDb(expenseId);
  };

  const handleRequestPayout = async (payout: Payout): Promise<boolean> => {
    const ok = await createPayoutDb(payout);
    if (ok) setPayouts((prev) => [payout, ...prev]);
    return ok;
  };

  // Cancelling/rejecting a booking frees its rooms immediately — the guest
  // roster (attendees) stays intact for records, only the room/bed link
  // clears, since another booking may need those beds right away.
  const freeBookingAllocations = async (bookingId: string) => {
    const existing = await loadAllocationsForBooking(bookingId);
    if (existing.length === 0) return;
    setAllocations((prev) => prev.filter((al) => al.bookingId !== bookingId));
    await saveAllocationsForBooking(bookingId, []);
  };

  // Guests may cancel pending AND approved bookings (migration 054 amended
  // the column guard to allow approved → cancelled). The refund entitlement
  // per the declared policy is shown by UserBookings before confirming;
  // the owner is notified server-side by the status-change trigger (047).
  const handleCancelBooking = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target || (target.status !== 'pending' && target.status !== 'approved')) return;
    const previousStatus = target.status;
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
    const ok = await updateBookingStatus(bookingId, 'cancelled');
    if (!ok) {
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: previousStatus } : b));
      return;
    }
    freeBookingAllocations(bookingId);
  };

  // --- Owner Operations ---
  const handleAddHouse = (newHouse: RetreatHouse) => {
    setHouses((prev) => [newHouse, ...prev]);
    createHouseDb(newHouse);
  };

  // Notifications are created server-side through the authorized
  // emit_notification RPC (migration 021) — a raw client INSERT is blocked
  // (no INSERT policy) so notifications can't be forged. `n.userId` is the
  // recipient, not the caller, so there's nothing to push into local state
  // here — the recipient's own session picks it up via the realtime
  // subscription (subscribeToNotifications) once the RPC commits.
  const pushNotification = (n: AppNotification) => {
    supabase.rpc('emit_notification', {
      p_target: n.userId,
      p_booking: n.bookingId || '',
      p_title: n.title,
      p_message: n.message,
      p_type: n.type,
    }).then(({ error }) => { if (error) console.error('emit_notification:', error); });
  };

  // Notification on approve/reject now fires server-side (migration 047,
  // trg_notify_guest_on_booking_update) — atomic with the status change
  // itself, unlike the old fire-and-forget client RPC call.
  const handleApproveBooking = (bookingId: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'approved' } : b)));
    updateBookingStatus(bookingId, 'approved');
  };

  const handleRejectBooking = (bookingId: string) => {
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'rejected' } : b)));
    updateBookingStatus(bookingId, 'rejected');
    freeBookingAllocations(bookingId);
  };

  // Owner edits a booking's dates/guest-count (manual/temporary bookings,
  // or adjusting a still-pending platform booking). If the booking already
  // had room allocations, immediately re-run Smart allocation for just this
  // booking against current room availability — never touches any other
  // booking's allocations.
  const handleUpdateBookingDetails = async (
    bookingId: string,
    fields: { checkIn?: string; checkOut?: string; guestsCount?: number }
  ): Promise<boolean> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return false;
    const res = await updateBookingFields(bookingId, fields);
    if (!res.ok) {
      if (res.error === 'INSUFFICIENT_CAPACITY') {
        const avail = res.availableBeds ?? 0;
        alert(avail === 0
          ? 'البيت مكتمل الإشغال في هذه التواريخ.'
          : `لم يتبقَ سوى ${avail} سرير متاح في هذه التواريخ.`);
      } else {
        alert('حدث خطأ في تعديل الحجز. حاول مرة أخرى.');
      }
      return false;
    }
    const updated = { ...target, ...fields };
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));

    const bookingAllocations = await loadAllocationsForBooking(bookingId);
    if (bookingAllocations.length > 0) {
      const houseRooms = rooms.filter((r) => r.houseId === updated.houseId);
      if (houseRooms.length > 0) {
        const bookingAttendees = await loadAttendeesForBooking(bookingId);
        const otherAllocations = [...allocations.filter((al) => al.bookingId !== bookingId), ...bookingAllocations];
        const newAllocations = autoAllocate(bookingAttendees, houseRooms, bookings, otherAllocations, bookingId, {
          mode: 'smart', separateGenders: true, groupTypesTogether: true,
          checkIn: updated.checkIn, checkOut: updated.checkOut, houseId: updated.houseId,
        });
        setAttendees((prev) => [...prev.filter((a) => a.bookingId !== bookingId), ...bookingAttendees]);
        setAllocations((prev) => [...prev.filter((al) => al.bookingId !== bookingId), ...newAllocations]);
        await saveAllocationsForBooking(bookingId, newAllocations);
      }
    }
    return true;
  };

  // Owner-triggered recompute. With bookingId: unconditionally re-run Smart
  // allocation for that one booking. Without it (house-wide): gap-filling
  // only — skip bookings that are already fully allocated or have guests
  // already checked in, so a live guesthouse never gets its settled
  // bookings disruptively reshuffled by a single click.
  const handleRecalculateAllocation = async (houseId: string, bookingId?: string): Promise<void> => {
    const houseRooms = rooms.filter((r) => r.houseId === houseId);
    if (houseRooms.length === 0) {
      alert('لا توجد غرف حقيقية مسجلة لهذا البيت بعد.');
      return;
    }
    const targets = bookingId
      ? bookings.filter((b) => b.id === bookingId)
      : bookings.filter((b) => b.houseId === houseId && (b.status === 'pending' || b.status === 'approved') && !b.checkedInAt);

    for (const b of targets) {
      const bookingAttendees = await loadAttendeesForBooking(b.id);
      if (bookingAttendees.length === 0) continue;
      const currentAllocations = await loadAllocationsForBooking(b.id);
      if (!bookingId && currentAllocations.length >= bookingAttendees.length) continue;

      const otherAllocations = [...allocations.filter((al) => al.bookingId !== b.id), ...currentAllocations];
      const newAllocations = autoAllocate(bookingAttendees, houseRooms, bookings, otherAllocations, b.id, {
        mode: 'smart', separateGenders: true, groupTypesTogether: true, checkIn: b.checkIn, checkOut: b.checkOut, houseId,
      });
      setAttendees((prev) => [...prev.filter((a) => a.bookingId !== b.id), ...bookingAttendees]);
      setAllocations((prev) => [...prev.filter((al) => al.bookingId !== b.id), ...newAllocations]);
      await saveAllocationsForBooking(b.id, newAllocations);
    }
  };

  // Owner marks that they've received the deposit in-person / off-platform.
  // Notification fires server-side (migration 047).
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
  };

  // Owner marks guest as checked in (arrived on-site). Notification fires
  // server-side (migration 047).
  const handleCheckInBooking = (bookingId: string) => {
    const checkedInAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, checkedInAt } : b))
    );
    updateBookingFields(bookingId, { checkedInAt });
  };

  // Owner marks guest as checked out (booking completed). Notification
  // fires server-side (migration 047).
  const handleCheckOutBooking = (bookingId: string) => {
    const checkedOutAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed', checkedOutAt } : b))
    );
    updateBookingFields(bookingId, { status: 'completed', checkedOutAt });
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

        // Notification (payment confirmed/rejected, and booking
        // approved/deposit-received when applicable) now fires server-side
        // (migration 047, trg_notify_guest_on_payment_update +
        // trg_notify_guest_on_booking_update) — atomic with these writes.
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
  // Notification fires server-side (migration 047, trg_notify_user_on_approval_update).
  const handleSetUserApproval = (userId: string, status: 'approved' | 'rejected') => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, approvalStatus: status } : u)));
    supabase.from('users').update({ approval_status: status }).eq('id', userId).then(({ error }) => {
      if (error) console.error('setUserApproval:', error);
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

  // Self-service avatar update (any role) — used by ProfileScreen and, once
  // set, surfaced in the owner's Messages conversation list/thread.
  const handleUpdateAvatar = (avatarUrl: string) => {
    if (!currentUser) return;
    setCurrentUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, avatarUrl } : u)));
    supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', currentUser.id)
      .then(({ error }) => { if (error) console.error('updateAvatar:', error); });
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

  const handleUpdateHouse = (updatedHouse: RetreatHouse) => {
    setHouses((prevHouses) =>
      prevHouses.map((h) => (h.id === updatedHouse.id ? updatedHouse : h))
    );
    if (selectedHouse && selectedHouse.id === updatedHouse.id) setSelectedHouse(updatedHouse);
    updateHouseDb(updatedHouse);
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
    supabase.from('houses').update({ ...houseUpdatePayloadDb(merged), pending_edit: null }).eq('id', houseId).then(({ error }) => {
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

  // Owner contact reveal was removed in migration 056 (anti-
  // disintermediation): the guest talks to the owner ONLY through
  // booking_messages. Kept the state field so any stale prop consumers
  // still see an empty map, but no fetch fires.

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

  const handleMarkNotificationAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    // Synthetic client-only reminders (id starts with 'reminder_') have no
    // DB row — nothing to persist, and dismissDismissible tracks those.
    if (id.startsWith('reminder_')) { dismissReminder(id); return; }
    const ok = await markNotificationRead(id);
    if (!ok) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
    }
  };

  const handleClearNotifications = async () => {
    if (!currentUser) return;
    const cleared = notifications.filter((n) => n.userId === currentUser.id);
    setNotifications((prev) => prev.filter((n) => n.userId !== currentUser.id));
    cleared.filter((n) => n.id.startsWith('reminder_')).forEach((n) => dismissReminder(n.id));
    const { error } = await supabase.from('notifications').delete().eq('user_id', currentUser.id);
    if (error) {
      console.error('clearNotifications:', error);
      setNotifications((prev) => [...cleared, ...prev]);
    }
  };

  // A guest hit a gated action (book/favorite/waitlist/…): remember which
  // house they were on — both in the URL (survives the in-app auth screen)
  // and localStorage (survives the web Google OAuth full-page redirect) —
  // then show the auth screen. After login, the deep-link effect above
  // reopens that same house.
  const requireLogin = (houseId?: string) => {
    if (houseId) {
      window.history.replaceState({}, '', `${window.location.pathname}?house=${houseId}`);
      try { localStorage.setItem('pima_pending_house', houseId); } catch { /* storage unavailable */ }
    }
    setShowAuthScreen(true);
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
    if (showLanding) {
      return <LandingPage housesCount={houses.length} onBrowse={dismissLanding} onLogin={() => { dismissLanding(); setShowAuthScreen(true); }} />;
    }
    if (showAuthScreen) {
      return <AuthScreen onBackToBrowse={() => setShowAuthScreen(false)} />;
    }
    // Guest mode — browse approved houses, house details, and the map
    // without an account. Anything else routes to the auth screen.
    const guestNavigate = (screen: typeof activeScreen) => {
      if (screen !== 'explore' && screen !== 'map' && screen !== 'privacy') { requireLogin(); return; }
      setSelectedHouse(null);
      setActiveScreen(screen);
    };
    return (
      <>
      <WebLayout
        activeScreen={activeScreen}
        setActiveScreen={guestNavigate}
        currentUser={null}
        onLogout={() => {}}
        notifications={[]}
        onMarkNotificationAsRead={() => {}}
        onClearNotifications={() => {}}
        onRequireLogin={() => requireLogin(selectedHouse?.id)}
      >
        <Suspense fallback={<ScreenFallback />}>
        {selectedHouse ? (
          <HouseDetail
            house={selectedHouse}
            currentUser={null}
            bookings={[]}
            reviews={reviews}
            onBack={() => setSelectedHouse(null)}
            onBook={() => requireLogin(selectedHouse.id)}
            onSubmitReview={() => requireLogin(selectedHouse.id)}
            isFavorited={false}
            onToggleFavorite={() => requireLogin(selectedHouse.id)}
            rooms={rooms.filter((r) => r.houseId === selectedHouse.id)}
            announcements={announcements.filter((a) => a.houseId === selectedHouse.id && a.isActive)}
            waitlist={waitlist}
            settings={settings}
            onRequireLogin={() => requireLogin(selectedHouse.id)}
          />
        ) : activeScreen === 'map' ? (
          <div className="h-[calc(100dvh-180px)]">
            <InteractiveMap houses={houses} onSelectHouse={(h) => setSelectedHouse(h)} />
          </div>
        ) : activeScreen === 'privacy' ? (
          <PrivacyPolicy onBack={() => setActiveScreen('explore')} />
        ) : (
          <UserDashboard
            houses={houses}
            currentUser={null}
            onSelectHouse={(h) => setSelectedHouse(h)}
            onSelectRewards={() => requireLogin()}
            onToggleFavorite={() => requireLogin(selectedHouse?.id)}
            platformAnnouncements={platformAnnouncements.filter((a) => a.isActive)}
          />
        )}
        </Suspense>
      </WebLayout>
      <a
        href="https://wa.me/201234567890?text=%D8%B3%D9%84%D8%A7%D9%85%20%D9%88%D9%86%D8%B9%D9%85%D8%A9%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%A8%D9%8A%D9%88%D8%AA%20%D8%A7%D9%84%D9%85%D8%A4%D8%AA%D9%85%D8%B1%D8%A7%D8%AA"
        target="_blank"
        rel="noreferrer"
        className="fixed left-4 bottom-20 z-50 w-12 h-12 bg-[#25D366] hover:bg-[#1DA851] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="تواصل معنا عبر واتساب"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </>
    );
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

  // A newly-approved owner (or an existing one whose house predates
  // payment methods / priced rooms) is blocked from the rest of the
  // owner shell until their house has: a photo, a service, a priced
  // room, and a payment method. Same severity as the approval gate
  // above — the wizard itself handles creating the house on first use.
  if (currentUser.role === 'owner') {
    // houses/rooms load asynchronously AFTER isAuthLoading already flips
    // false (loadAppData isn't awaited in loadUserProfile), so on a fresh
    // login this block used to run with houses still empty — an owner who
    // already finished onboarding would see the wizard flash for however
    // long those two sequential fetches took (houses, then their rooms)
    // before flipping back to the real dashboard. Show a plain loading
    // screen instead of guessing "incomplete" while we don't actually know yet.
    if (!housesLoaded || !ownerRoomsChecked) {
      return (
        <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center">
          <div className="text-[#8A8A70] text-sm">جارٍ تحميل بيانات بيتك...</div>
        </div>
      );
    }
    const ownerHouse = houses.find((h) => h.ownerId === currentUser.id) ?? null;
    const ownerRooms = ownerHouse ? rooms.filter((r) => r.houseId === ownerHouse.id) : [];
    const onboardingComplete = !!ownerHouse
      && ownerHouse.images.length > 0
      && ownerHouse.services.length > 0
      && ownerRooms.length > 0
      && ownerHouse.paymentMethods.length > 0;
    // Keep showing the wizard through its own success screen even once
    // the underlying data satisfies onboardingComplete — otherwise the
    // gate flips the instant handleSubmit's state updates land and the
    // success screen never gets a chance to render.
    if (!onboardingComplete || justFinishedOnboarding) {
      return (
        <Suspense fallback={<ScreenFallback />}>
          <OwnerOnboardingWizard
            owner={currentUser}
            existingHouse={ownerHouse}
            existingRooms={ownerRooms}
            onCreateHouse={handleAddHouse}
            onAddRoom={handleAddRoom}
            onUpdatePaymentMethods={(house, methods) => handleUpdateHouse({ ...house, paymentMethods: methods })}
            onLogout={handleLogout}
            onSubmitted={() => setJustFinishedOnboarding(true)}
            onContinue={() => setJustFinishedOnboarding(false)}
          />
        </Suspense>
      );
    }
  }

  // Navigating via sidebar should always clear any open house detail
  const navigate = (screen: typeof activeScreen) => {
    setSelectedHouse(null);
    setActiveScreen(screen);
  };

  return (
    <>
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
      <Suspense fallback={<ScreenFallback />}>
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
            />
          )}

          {activeScreen === 'owner_panel' && currentUser.role === 'owner' && (
            // Owner dashboard
            <OwnerDashboardShell
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
              notifications={notifications}
              onMarkNotificationAsRead={handleMarkNotificationAsRead}
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              payouts={payouts}
              onRequestPayout={handleRequestPayout}
              users={users}
              onNavigateSupport={() => setActiveScreen('support')}
              onCreateBooking={handleOwnerCreateBooking}
              onUpdateBookingDetails={handleUpdateBookingDetails}
              onRecalculateAllocation={handleRecalculateAllocation}
              onLogout={handleLogout}
            />
          )}

          {activeScreen === 'admin_panel' && currentUser.role === 'admin' && (
            // Master Admin dashboard
            <AdminDashboard
              currentUser={currentUser}
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
              onUpdateHouse={handleUpdateHouse}
              onDeleteHouse={handleDeleteHouse}
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
              onUpdateAvatar={handleUpdateAvatar}
            />
          )}

          {activeScreen === 'meals' && (
            // Owner food-menu editor, wired to RetreatHouse.menu (replaces the old
            // disconnected localStorage-only WeeklyMenuManager at this route).
            <OwnerFoodMenu
              house={houses.find((h) => h.ownerId === currentUser.id)}
              onUpdateHouse={handleUpdateHouse}
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
              onOpenMultiplayer={() => setActiveScreen('multiplayer_lobby')}
              onOpenAchievements={() => setActiveScreen('achievements')}
              onOpenFriends={() => setActiveScreen('friends')}
            />
          )}

          {activeScreen === 'trivia' && (
            <TriviaGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              onAchievementsUnlocked={handleAchievementsUnlocked}
            />
          )}

          {activeScreen === 'whoami' && (
            <WhoAmIGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              onAchievementsUnlocked={handleAchievementsUnlocked}
            />
          )}

          {activeScreen === 'hymns' && (
            <HymnsGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              onAchievementsUnlocked={handleAchievementsUnlocked}
            />
          )}

          {activeScreen === 'fillverse' && (
            <FillVerseGame
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              onAchievementsUnlocked={handleAchievementsUnlocked}
            />
          )}

          {activeScreen === 'multiplayer_lobby' && (
            <MultiplayerLobby
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onEnterMatch={(roomId) => { setActiveRoomId(roomId); setActiveScreen('live_match'); }}
            />
          )}

          {activeScreen === 'live_match' && activeRoomId && (
            <LiveMatchGame
              currentUser={currentUser}
              roomId={activeRoomId}
              onBack={() => { setActiveRoomId(null); setActiveScreen('multiplayer_lobby'); }}
              onUserUpdated={(patch) => setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev))}
              onAchievementsUnlocked={handleAchievementsUnlocked}
            />
          )}

          {activeScreen === 'achievements' && (
            <AchievementsScreen
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
            />
          )}

          {activeScreen === 'friends' && (
            <FriendsScreen
              currentUser={currentUser}
              onBack={() => setActiveScreen('entertainment')}
              onOpenChat={(friendId, friendName) => {
                setActiveChatFriend({ id: friendId, name: friendName });
                setActiveScreen('chat_thread');
              }}
            />
          )}

          {activeScreen === 'chat_thread' && activeChatFriend && (
            <ChatThreadScreen
              currentUser={currentUser}
              friendId={activeChatFriend.id}
              friendName={activeChatFriend.name}
              onBack={() => { setActiveChatFriend(null); setActiveScreen('friends'); }}
            />
          )}
        </>
      )}
      </Suspense>
    </WebLayout>
    {activeScreen !== 'owner_panel' && activeScreen !== 'admin_panel' && (
      <a
        href="https://wa.me/201234567890?text=%D8%B3%D9%84%D8%A7%D9%85%20%D9%88%D9%86%D8%B9%D9%85%D8%A9%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%A8%D9%8A%D9%88%D8%AA%20%D8%A7%D9%84%D9%85%D8%A4%D8%AA%D9%85%D8%B1%D8%A7%D8%AA"
        target="_blank"
        rel="noreferrer"
        className="fixed left-4 bottom-20 z-50 w-12 h-12 bg-[#25D366] hover:bg-[#1DA851] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
        title="تواصل معنا عبر واتساب"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    )}
    <AchievementToast
      queue={unlockedAchievementQueue}
      onShown={() => setUnlockedAchievementQueue((prev) => prev.slice(1))}
    />
    {showUpdateBanner && (
      <UpdateBanner onReload={() => window.location.reload()} onDismiss={() => setUpdateBannerDismissed(true)} />
    )}
    </>
  );
}

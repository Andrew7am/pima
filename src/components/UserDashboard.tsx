import React, { useState, useEffect } from 'react';
import { RetreatHouse, User, PromoBanner, Booking, Review } from '../types';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../mockData';
import { Search, MapPin, Map as MapIcon, SlidersHorizontal, Grid, Star, Sparkles, Building, Waves, Trees, Check, GraduationCap, Briefcase, Home, Wifi, Wind, Users, Award, ChevronLeft, Heart, Scale, Layers, X, ArrowLeftRight, CalendarCheck, BookOpen, BedDouble, ArrowLeft, SquareParking, Flame } from 'lucide-react';
import { SummerOfferCarousel, CountdownOfferBanner } from './PromoBanners';
import { loadHousesAvailability, loadHouseBookingCounts } from '../lib/db';
import { computeStayPrice } from '../lib/pricing';
import { isBannerLive, matchesAudience, pickExperimentVariants } from '../lib/bannerVisibility';
import { bannerSeed } from '../lib/bannerEvents';
import { copticSeason } from '../lib/copticSeason';
import type { BannerLiveData } from './banner/BannerCanvas';

// Arabic count agreement — 1 is singular, 2 is dual, 3–10 takes the plural,
// and 11 upwards goes back to the singular. "1 سرير" reads as broken Arabic.
function bedsLabel(n: number): string {
  if (n === 1) return 'سرير واحد';
  if (n === 2) return 'سريرين';
  if (n >= 3 && n <= 10) return `${n} أسرّة`;
  return `${n} سرير`;
}

// Same agreement for the result count, and the dual does NOT repeat the
// numeral: "وجدنا بيتين", never "وجدنا 2 بيتين". The verb has to agree too.
function resultsLabel(n: number): { count: string | null; noun: string } {
  if (n === 1) return { count: null, noun: 'بيتاً واحداً يناسب بحثك' };
  if (n === 2) return { count: null, noun: 'بيتين يناسبان بحثك' };
  if (n <= 10) return { count: String(n), noun: 'بيوت تناسب بحثك' };
  return { count: String(n), noun: 'بيتاً يناسب بحثك' };
}

interface UserDashboardProps {
  houses: RetreatHouse[];
  currentUser: User | null; // null = logged-out visitor browsing publicly
  onSelectHouse: (house: RetreatHouse) => void;
  onSelectRewards: () => void;
  onToggleFavorite: (houseId: string) => void;
  /** Switches to the map screen — the same search shown geographically, which
   *  is why it lives beside the search box rather than in the bottom bar. */
  onOpenMap?: () => void;
  promoBanners?: PromoBanner[];
  /** Only used to answer a banner audience rule of "has booked before". */
  bookings?: Booking[];
  /** Source for testimonial banners — a real review or nothing. */
  reviews?: Review[];
}

export default function UserDashboard({
  houses,
  currentUser,
  onSelectHouse,
  onSelectRewards,
  onToggleFavorite,
  onOpenMap,
  promoBanners = [],
  bookings = [],
  reviews = [],
}: UserDashboardProps) {
  // Respect the admin's slide order (the `sort` the reorder arrows write) rather
  // than whatever order the array happens to be in after an in-session edit.
  // isBannerLive also honours draft/scheduled windows, so a banner appears and
  // disappears on its own schedule without anyone toggling it.
  // live (schedule) → audience (who it's for) → one variant per split test.
  const eligible = promoBanners.filter((b) => isBannerLive(b) && matchesAudience(b, currentUser, bookings));
  const chosen = pickExperimentVariants(eligible, bannerSeed());
  const carouselSlides = chosen
    .filter((b) => b.placement === 'carousel')
    .slice()
    .sort((a, b) => a.sort - b.sort || a.createdAt.localeCompare(b.createdAt));
  const countdownBanner = chosen.find((b) => b.placement === 'countdown');
  const openHouseById = (houseId: string) => {
    const h = houses.find((x) => x.id === houseId);
    if (h) onSelectHouse(h);
  };

  // ── Live numbers/quotes for banner elements ──────────────────────────────
  // Both come from the database or not at all: a banner asking for remaining
  // beds shows the real count for its own house and window, and a testimonial
  // banner quotes a real review. When neither exists the element renders
  // nothing rather than inventing scarcity or praise.
  const [bannerLive, setBannerLive] = useState<Record<string, BannerLiveData>>({});
  const needsLive = chosen.filter((b) =>
    b.linkedHouseId && b.layout?.elements.some((e) => e.visible && (e.type === 'availability' || e.type === 'testimonial')));
  const needsLiveKey = needsLive.map((b) => `${b.id}:${b.linkedHouseId}:${b.startsAt ?? ''}:${b.endsAt ?? ''}`).join('|');

  useEffect(() => {
    if (!needsLiveKey) { setBannerLive({}); return; }
    let cancelled = false;
    (async () => {
      const next: Record<string, BannerLiveData> = {};
      for (const b of needsLive) {
        const wantsBeds = b.layout?.elements.some((e) => e.visible && e.type === 'availability');
        const wantsQuote = b.layout?.elements.some((e) => e.visible && e.type === 'testimonial');
        const entry: BannerLiveData = {};

        if (wantsBeds) {
          // The banner's own window, or the coming week when it isn't scheduled.
          const from = (b.startsAt ?? new Date().toISOString()).slice(0, 10);
          const to = (b.endsAt ?? new Date(Date.now() + 7 * 86400000).toISOString()).slice(0, 10);
          const avail = await loadHousesAvailability(from, to);
          const free = avail?.[b.linkedHouseId!];
          if (typeof free === 'number') entry.freeBeds = free;
        }

        if (wantsQuote) {
          const best = reviews
            .filter((r) => r.houseId === b.linkedHouseId && r.rating >= 4 && r.comment.trim().length > 10)
            .sort((x, y) => y.rating - x.rating || y.createdAt.localeCompare(x.createdAt))[0];
          if (best) {
            entry.testimonial = {
              text: best.comment.trim(),
              author: best.displayAnonymous ? 'ضيف بيما' : best.userName,
              rating: best.rating,
            };
          }
        }
        next[b.id] = entry;
      }
      if (!cancelled) setBannerLive(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLiveKey, reviews.length]);
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGov, setSelectedGov] = useState('');
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number>(400);
  const [selectedSuitabilities, setSelectedSuitabilities] = useState<('youth' | 'children' | 'families' | 'retreat')[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'conference' | 'student' | 'staff' | 'favorites'>('all');
  const [selectedSeaProximity, setSelectedSeaProximity] = useState<'all' | 'near' | 'view' | 'beach' | 'far'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'price_asc' | 'price_desc'>('rating');

  // Real date-availability: when both dates are set, the migration-053 RPC
  // returns aggregate free beds per house (server-side, RLS-safe — booking
  // rows themselves are never exposed). null = no date filter active.
  const [filterCheckIn, setFilterCheckIn] = useState('');
  const [filterCheckOut, setFilterCheckOut] = useState('');
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!filterCheckIn || !filterCheckOut || filterCheckIn >= filterCheckOut) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    loadHousesAvailability(filterCheckIn, filterCheckOut).then((result) => {
      if (!cancelled) setAvailability(result);
    });
    return () => { cancelled = true; };
  }, [filterCheckIn, filterCheckOut]);

  // Real popularity (migration-086 RPC, aggregate counts only). The badge goes
  // to the top three approved houses over the last year, and only when they
  // have enough bookings for "الأكثر حجزًا" to mean something (≥3). null = RPC
  // unavailable → no badges, never a guess.
  const [bookingCounts, setBookingCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadHouseBookingCounts().then((result) => {
      if (!cancelled) setBookingCounts(result);
    });
    return () => { cancelled = true; };
  }, []);
  const mostBookedIds = React.useMemo(() => {
    if (!bookingCounts) return new Set<string>();
    return new Set(
      Object.entries(bookingCounts)
        .filter(([, n]) => n >= 3)
        // Tie-break on id so the badge lands on the same houses every render;
        // the RPC's row order is not guaranteed and would make it flicker.
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([id]) => id),
    );
  }, [bookingCounts]);

  // «حجزتم هنا قبل كده» is personal memory, not popularity, so it needs no
  // server aggregate. The userId filter is not redundant: RLS scopes a plain
  // guest to their own rows, but an owner or admin browsing this screen also
  // receives other people's bookings, and without it they would be told they
  // had stayed somewhere they never booked.
  const bookedBeforeIds = React.useMemo(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      bookings
        .filter((b) => b.userId === currentUser.id && (b.status === 'approved' || b.status === 'completed'))
        .map((b) => b.houseId),
    );
  }, [bookings, currentUser]);

  // Nights in the chosen window, so a card can quote a whole stay rather than a
  // per-person-per-night rate nobody budgets in.
  const stayNights =
    filterCheckIn && filterCheckOut && filterCheckIn < filterCheckOut
      ? Math.round(
          (new Date(`${filterCheckOut}T00:00:00`).getTime() - new Date(`${filterCheckIn}T00:00:00`).getTime()) / 86400000,
        )
      : 0;
  const partySize = typeof guestCount === 'number' && guestCount > 0 ? guestCount : 0;

  // House comparison states
  const [comparedHouseIds, setComparedHouseIds] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const handleToggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent card click/details opening
    if (comparedHouseIds.includes(id)) {
      setComparedHouseIds(comparedHouseIds.filter(item => item !== id));
    } else {
      if (comparedHouseIds.length >= 3) {
        alert('يمكنك مقارنة ٣ بيوت خلوة كحد أقصى في نفس الوقت.');
        return;
      }
      setComparedHouseIds([...comparedHouseIds, id]);
    }
  };

  // Quick Filters States (Wi-Fi, AC, Private Bathroom, Youth, Families, Students)
  const [quickWifi, setQuickWifi] = useState(false);
  const [quickAc, setQuickAc] = useState(false);
  const [quickPrivateBath, setQuickPrivateBath] = useState(false);
  const [quickYouth, setQuickYouth] = useState(false);
  const [quickFamilies, setQuickFamilies] = useState(false);
  const [quickStudent, setQuickStudent] = useState(false);

  // Toggle suitability filter
  const handleSuitabilityFilterToggle = (suit: 'youth' | 'children' | 'families' | 'retreat') => {
    if (selectedSuitabilities.includes(suit)) {
      setSelectedSuitabilities(selectedSuitabilities.filter(s => s !== suit));
    } else {
      setSelectedSuitabilities([...selectedSuitabilities, suit]);
    }
  };

  // Toggle amenity filter
  const handleAmenityFilterToggle = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter(a => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  // Filter retreat houses based on selected options and search query
  const filteredHouses = houses.filter((house) => {
    // Only display approved houses to clients
    if (house.status !== 'approved') return false;

    // Property type filter / Favorites filter
    const propertyType = house.propertyType || 'conference';
    if (selectedType !== 'all') {
      if (selectedType === 'favorites') {
        const userFavs = currentUser?.favorites || [];
        if (!userFavs.includes(house.id)) return false;
      } else if (propertyType !== selectedType) {
        return false;
      }
    }

    // Search query matches name, description or address
    const matchesSearch = 
      house.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      house.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      house.address.toLowerCase().includes(searchQuery.toLowerCase());

    // Governorate match
    const matchesGov = selectedGov ? house.governorate === selectedGov : true;

    // Guest capacity match
    const matchesGuests = guestCount ? house.bedsCount >= guestCount : true;

    // Price match
    const matchesPrice = house.pricePerNightPerPerson <= maxPrice;

    // Suitabilities match (must match all selected suitabilities if any)
    const matchesSuitability = selectedSuitabilities.length > 0 
      ? selectedSuitabilities.every((suit) => house.suitability.includes(suit))
      : true;

    // Amenities match (must contain all selected services)
    const matchesAmenities = selectedAmenities.length > 0
      ? selectedAmenities.every((amenity) => house.services.includes(amenity))
      : true;

    // Quick Amenities Filters
    if (quickWifi && !house.services.includes('واي فاي')) return false;
    if (quickAc && !house.services.includes('تكييف')) return false;
    if (quickPrivateBath) {
      const hasBath = house.roomsDescription.includes('حمام') || 
                      house.description.includes('حمام') || 
                      house.services.some(s => s.includes('حمام') || s.includes('حمام خاص') || s.includes('حمام داخلي خاص'));
      if (!hasBath) return false;
    }

    // Quick Suitability/Category Filters
    if (quickYouth && !house.suitability.includes('youth')) return false;
    if (quickFamilies && !house.suitability.includes('families')) return false;
    if (quickStudent && house.propertyType !== 'student') return false;

    // Sea proximity filter
    if (selectedSeaProximity !== 'all' && house.seaProximity !== selectedSeaProximity) return false;

    // Real availability for the selected dates: enough free beds for the
    // requested group (or at least one bed when no count was given).
    if (availability !== null) {
      const freeBeds = availability[house.id] ?? 0;
      if (freeBeds < (guestCount || 1)) return false;
    }

    return matchesSearch && matchesGov && matchesGuests && matchesPrice && matchesSuitability && matchesAmenities;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.pricePerNightPerPerson - b.pricePerNightPerPerson;
    if (sortBy === 'price_desc') return b.pricePerNightPerPerson - a.pricePerNightPerPerson;
    return b.rating - a.rating;
  });

  return (
    // Warm cream surface, bled past the shell's px-4 py-6 so the hero can run
    // edge to edge. The house cards keep their own dark glass panels — they are
    // the one thing on this screen that is deliberately not cream.
    <div className="min-h-screen bg-gradient-to-b from-[#FBF9F4] via-[#F7F3EA] to-[#F3EFE4] text-[#2D2D24] -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl px-4 py-5 space-y-5 text-right">

      {/* Follows the Coptic calendar on its own — no one has to remember to
          switch it on, and it disappears outside the fasts and feasts. */}
      {(() => {
        const s = copticSeason();
        if (s.season === 'ordinary') return null;
        return (
          <div className="flex items-center justify-center gap-2 bg-gradient-to-l from-[#0A2342] to-[#123E75] text-white rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[10px] font-black text-[#C5A059]">{s.label}</span>
            <span className="w-1 h-1 rounded-full bg-white/40" />
            <span className="text-[11px] font-bold">{s.greeting}</span>
          </div>
        );
      })()}

      {/* Hero + floating search. The search bar is pulled up over the bottom of
          the banner so the two read as one unit; the banner itself stays purely
          promotional — no brand marks, no controls inside it. */}
      <div className="relative pb-7">
        <SummerOfferCarousel slides={carouselSlides} live={bannerLive} onOpenHouse={openHouseById} onCta={() => document.getElementById('house-list-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

        <div className="absolute inset-x-2 -bottom-0 z-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-1 bg-white/85 backdrop-blur-xl border border-white/70 rounded-full shadow-[0_8px_24px_rgba(45,45,36,0.14)] p-1.5">
            {/* Filters — start of the row in RTL */}
            <button
              id="toggle-filters-btn"
              onClick={() => setShowFilters(!showFilters)}
              className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-2 text-[10.5px] font-black transition-all cursor-pointer ${
                showFilters ? 'bg-[#5A5A40] text-white' : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
              }`}
              title="فلاتر متقدمة"
              aria-label="فلاتر متقدمة"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>فلتر</span>
            </button>

            <span aria-hidden="true" className="w-px h-6 bg-[#E3DCCC] shrink-0" />

            <div className="relative flex-1 min-w-0">
              <Search className="absolute top-1/2 -translate-y-1/2 right-2.5 w-4 h-4 text-[#B5AF98] pointer-events-none" />
              <input
                id="user-search-query"
                type="text"
                placeholder="ابحث باسم البيت، المحافظة، الكلمات المفتاحية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-2 pl-2 pr-9 text-[11px] text-[#2D2D24] placeholder:text-[#B5AF98] focus:outline-none"
              />
            </div>

            {onOpenMap && (
              <>
                <span aria-hidden="true" className="w-px h-6 bg-[#E3DCCC] shrink-0" />
                <button
                  id="open-map-btn"
                  type="button"
                  onClick={onOpenMap}
                  className="shrink-0 flex items-center gap-1 rounded-full px-3 py-2 text-[10.5px] font-black text-[#4A4A3A] hover:bg-[#F1ECE0] transition-all cursor-pointer"
                  title="عرض البيوت على الخريطة"
                  aria-label="عرض البيوت على الخريطة"
                >
                  <MapPin className="w-4 h-4" />
                  <span>الخريطة</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick cards — the guide and the loyalty balance, one short row. */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href="/dalil/"
          className="flex items-center gap-2 bg-white border border-[#EDE7DA] rounded-2xl px-3 py-2.5 shadow-[0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_4px_12px_rgba(45,45,36,0.08)] transition-shadow group"
        >
          <span className="shrink-0 w-9 h-9 rounded-xl bg-[#F6F0E2] flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[#C5A059]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-black text-[#2D2D24] leading-tight">دليل المستخدم</span>
            <span className="block text-[9px] font-bold text-[#8A8A70] truncate">تعرف على كل المزايا</span>
          </span>
        </a>

        {currentUser && currentUser.role !== 'owner' ? (
          <button
            id="loyalty-card-trigger"
            type="button"
            onClick={onSelectRewards}
            className="flex items-center gap-2 bg-white border border-[#EDE7DA] rounded-2xl px-3 py-2.5 shadow-[0_2px_8px_rgba(45,45,36,0.04)] hover:shadow-[0_4px_12px_rgba(45,45,36,0.08)] transition-shadow text-right cursor-pointer"
          >
            <span className="shrink-0 w-9 h-9 rounded-xl bg-[#F6F0E2] flex items-center justify-center">
              <Award className="w-4 h-4 text-[#C5A059]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-[#2D2D24] leading-tight">برنامج الولاء والنقاط</span>
              <span className="block text-[9px] font-bold text-[#8A8A70] truncate">
                رصيدك: <span className="text-[#C5A059] font-black">{(currentUser.points || 0).toLocaleString('ar-EG')}</span> نقطة
              </span>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white border border-[#EDE7DA] rounded-2xl px-3 py-2.5 shadow-[0_2px_8px_rgba(45,45,36,0.04)]">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-[#F6F0E2] flex items-center justify-center">
              <Award className="w-4 h-4 text-[#C5A059]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-[#2D2D24] leading-tight">برنامج الولاء والنقاط</span>
              <span className="block text-[9px] font-bold text-[#8A8A70] truncate">سجّل واكسب نقاط مع كل حجز</span>
            </span>
          </div>
        )}
      </div>

      {/* Category Tabs Selection */}
      <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-white border border-[#EDE7DA] rounded-2xl shadow-[0_2px_8px_rgba(45,45,36,0.04)]">
        <button
          onClick={() => setSelectedType('all')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'all'
              ? 'bg-[#5A5A40] text-white shadow-sm'
              : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>الكل</span>
        </button>
        <button
          onClick={() => setSelectedType('conference')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'conference'
              ? 'bg-[#5A5A40] text-white shadow-sm'
              : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>مؤتمرات</span>
        </button>
        <button
          onClick={() => setSelectedType('student')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'student'
              ? 'bg-[#5A5A40] text-white shadow-sm'
              : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>سكن طلاب</span>
        </button>
        <button
          onClick={() => setSelectedType('staff')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'staff'
              ? 'bg-[#5A5A40] text-white shadow-sm'
              : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>موظفين</span>
        </button>
        {currentUser ? (
          <button
            id="tab-favorites"
            onClick={() => setSelectedType('favorites')}
            className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
              selectedType === 'favorites'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[#4A4A3A] hover:bg-[#F1ECE0]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${selectedType === 'favorites' ? 'fill-white text-white' : 'text-rose-500 fill-rose-500'}`} />
            <span>المفضلة</span>
          </button>
        ) : (
          // Guest: the favorites tab is a login prompt (App routes onToggleFavorite to auth)
          <button
            id="tab-favorites"
            onClick={() => onToggleFavorite('')}
            className="py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer text-[#4A4A3A] hover:bg-[#F1ECE0]"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>المفضلة</span>
          </button>
        )}
      </div>

      {/* Advanced Filters Expandable Drawer — opened from the floating search bar */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-4 border border-[#EDE7DA] shadow-[0_4px_16px_rgba(45,45,36,0.06)] space-y-4 text-xs text-[#2D2D24] animate-in slide-in-from-top-3 duration-200">
          <div className="text-xs font-bold text-[#2D2D24] pb-2 border-b border-[#EDE7DA]">فلاتر البحث التفصيلية:</div>

          <div className="grid grid-cols-2 gap-3">
            {/* Governorate filter */}
            <div>
              <label className="block text-[10px] text-[#8A8A70] mb-1 font-bold">المحافظة:</label>
              <select
                id="filter-gov-select"
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="w-full bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl px-2.5 py-1.5 text-[#2D2D24] focus:outline-none [color-scheme:dark]"
              >
                <option value="">كل محافظات مصر</option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Guest/Individual Count */}
            <div>
              <label className="block text-[10px] text-[#8A8A70] mb-1 font-bold">عدد الأفراد المطلوب استيعابهم:</label>
              <input
                id="filter-guest-input"
                type="number"
                placeholder="مثال: ٥٠ فرد"
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl px-2.5 py-1.5 text-[#2D2D24] focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Real availability by dates — checks live bookings server-side */}
          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-200">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>المتاح فعلياً في تواريخك (يفحص الحجوزات الحقيقية):</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#8A8A70] mb-1 font-bold">تاريخ الوصول:</label>
                <input
                  id="filter-checkin-input"
                  type="date"
                  value={filterCheckIn}
                  onChange={(e) => setFilterCheckIn(e.target.value)}
                  className="w-full bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl px-2.5 py-1.5 text-[#2D2D24] focus:outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#8A8A70] mb-1 font-bold">تاريخ المغادرة:</label>
                <input
                  id="filter-checkout-input"
                  type="date"
                  value={filterCheckOut}
                  min={filterCheckIn || undefined}
                  onChange={(e) => setFilterCheckOut(e.target.value)}
                  className="w-full bg-[#FBF9F4] border border-[#EDE7DA] rounded-xl px-2.5 py-1.5 text-[#2D2D24] focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>
            {availability !== null && (
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] text-emerald-300 font-bold">✅ بتشوف دلوقتي البيوت المتاحة فعلاً من {filterCheckIn} إلى {filterCheckOut}{guestCount ? ` لعدد ${guestCount} فرد` : ''}</span>
                <button
                  type="button"
                  onClick={() => { setFilterCheckIn(''); setFilterCheckOut(''); }}
                  className="text-[9.5px] font-extrabold text-rose-300 hover:underline cursor-pointer"
                >
                  إلغاء فلتر التواريخ
                </button>
              </div>
            )}
          </div>

          {/* Price night range slider */}
          <div>
            <div className="flex justify-between text-[10px] text-[#8A8A70] font-bold mb-1">
              <span>الحد الأقصى لسعر الفرد/ليلة:</span>
              <span className="text-[#2D2D24] font-extrabold">{maxPrice} ج.م</span>
            </div>
            <input
              id="filter-price-slider"
              type="range"
              min={100}
              max={500}
              step={10}
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseInt(e.target.value))}
              className="w-full accent-[#5A5A40] cursor-pointer"
            />
          </div>

          {/* Sea Proximity Filter (الموقع وقرب البحر) */}
          <div>
            <span className="block text-[10px] text-[#8A8A70] mb-1.5 font-bold">الموقع وقرب البحر:</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                { key: 'all', label: 'الكل', icon: <Home className="w-3.5 h-3.5" /> },
                { key: 'beach', label: 'على الشاطئ مباشرة', icon: <Waves className="w-3.5 h-3.5" /> },
                { key: 'view', label: 'إطلالة على البحر 🌅', icon: <Sparkles className="w-3.5 h-3.5" /> },
                { key: 'near', label: 'قريب من البحر 🌊', icon: <Waves className="w-3.5 h-3.5 text-blue-500" /> },
                { key: 'far', label: 'بعيد عن البحر', icon: <Trees className="w-3.5 h-3.5" /> }
              ].map((item) => {
                const isSelected = selectedSeaProximity === item.key;
                return (
                  <button
                    id={`filter-sea-${item.key}`}
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedSeaProximity(item.key as any)}
                    className={`px-2 py-2 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-sm'
                        : 'bg-[#FBF9F4] border-[#EDE7DA] text-[#4A4A3A] hover:bg-[#F1ECE0]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suitability Filters Checklist */}
          <div>
            <span className="block text-[10px] text-[#8A8A70] mb-1.5 font-bold">مناسب من حيث الفئات لـ:</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SUITABILITY_MAP) as ('youth' | 'children' | 'families' | 'retreat')[]).map((key) => {
                const isSelected = selectedSuitabilities.includes(key);
                return (
                  <button
                    id={`filter-suitability-${key}`}
                    key={key}
                    type="button"
                    onClick={() => handleSuitabilityFilterToggle(key)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                      isSelected 
                        ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-sm' 
                        : 'bg-[#FBF9F4] border-[#EDE7DA] text-[#4A4A3A] hover:bg-[#F1ECE0]'
                    }`}
                  >
                    {SUITABILITY_MAP[key]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Services Checklist */}
          <div>
            <span className="block text-[10px] text-[#8A8A70] mb-1.5 font-bold">الخدمات والمرافق الأساسية المتوفرة بالبيت:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {AMENITIES_LIST.map((srv) => {
                const isSelected = selectedAmenities.includes(srv);
                return (
                  <button
                    id={`filter-amenity-${srv}`}
                    key={srv}
                    type="button"
                    onClick={() => handleAmenityFilterToggle(srv)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-semibold text-right transition-all ${
                      isSelected 
                        ? 'bg-[#3A3A2C] border-[#8A8A70] text-[#E4E1CB]'
                        : 'bg-[#FBF9F4] border-[#EDE7DA] text-[#8A8A70] hover:bg-[#F1ECE0]'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#5A5A40] border-[#5A5A40] text-white' : 'bg-[#FBF9F4] border-[#5A573F]'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span>{srv}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="flex justify-end pt-2 border-t border-[#EDE7DA]">
            <button
              id="clear-filters-btn"
              type="button"
              onClick={() => {
                setSelectedGov('');
                setGuestCount('');
                setMaxPrice(400);
                setSelectedSuitabilities([]);
                setSelectedAmenities([]);
                setSelectedSeaProximity('all');
              }}
              className="text-[10px] text-[#8A8A70] hover:text-[#2D2D24] font-bold"
            >
              إعادة تعيين كافة الفلاتر
            </button>
          </div>
        </div>
      )}

      {/* Houses Feed List */}
      <div id="house-list-anchor" className="space-y-3.5 text-[#2D2D24]">
        {/* Result count and sort. The filter control is not repeated here — it
            lives in the floating search bar, and one entry point is enough. */}
        <div className="flex justify-between items-center px-1 gap-2">
          {(() => {
            const { count, noun } = resultsLabel(filteredHouses.length);
            return (
              <span className="text-[12px] font-black text-[#2D2D24]">
                وجدنا {count && <span className="text-[#C5A059]">{count}</span>} {noun}
              </span>
            );
          })()}
          <div className="relative shrink-0">
            <select
              id="sort-houses-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="ترتيب النتائج"
              className="appearance-none bg-white border border-[#EDE7DA] rounded-full pr-7 pl-3 py-1.5 text-[10px] font-bold text-[#4A4A3A] shadow-[0_2px_8px_rgba(45,45,36,0.04)] focus:outline-none cursor-pointer"
            >
              <option value="rating">الأفضل تقييماً</option>
              <option value="price_asc">الأقل سعراً</option>
              <option value="price_desc">الأعلى سعراً</option>
            </select>
            <SlidersHorizontal aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 right-2 w-3 h-3 text-[#8A8A70] pointer-events-none" />
          </div>
        </div>

        {filteredHouses.length === 0 ? (
          <div className="bg-[#FFFFFF] rounded-3xl p-8 border border-[#EDE7DA] text-center space-y-2">
            <p className="text-xs font-bold text-[#2D2D24]">عذراً، لم نجد بيوت مؤتمرات تطابق معايير بحثك الحالية.</p>
            <p className="text-[10px] text-[#8A8A70]">جرب البحث بكلمات أبسط أو تخفيف فلاتر التصفية.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHouses.map((house) => (
              <div
                id={`house-card-${house.id}`}
                key={house.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectHouse(house)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectHouse(house);
                  }
                }}
                className="relative bg-[#2A2A20] rounded-3xl border border-[#3C3C2E] shadow-sm overflow-hidden hover:shadow-md active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C5A059] transition-all duration-300 cursor-pointer group"
              >
                {/* The photo is the whole card; the details panel floats over it. */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Lazy — a filtered list can be dozens of cards on a phone, and
                      only the first two are ever on screen. */}
                  <img
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    src={house.images[0]}
                    alt={house.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Owner photos are uncontrolled — this keeps the overlay pills
                      readable whether the shot is a bright facade or a dusk pool. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
                </div>

                {/* Rating, and real popularity beside it (top-3 by confirmed
                    bookings over the last year — see mostBookedIds) */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="bg-white/95 backdrop-blur-sm text-[#4A4A3A] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{house.rating.toFixed(1)}</span>
                  </span>
                  {mostBookedIds.has(house.id) && (
                    <span className="bg-rose-700/90 backdrop-blur-sm text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Flame className="w-3 h-3" />
                      الأكثر حجزًا
                    </span>
                  )}
                </div>

                {/* Location, and the owner's landmark line beside it. The row is
                    capped to the strip left of the details panel and the landmark
                    truncates — owners write this freely, and a long one would
                    otherwise slide under the panel. */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 max-w-[47%]">
                  <span className="bg-[#5A5A40]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                    <MapPin className="w-3 h-3" />
                    {house.governorate}
                  </span>
                  {house.nearbyLandmark && (
                    <span className="bg-black/45 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full truncate min-w-0">
                      {house.nearbyLandmark}
                    </span>
                  )}
                </div>

                {/* Favourite + compare — the only two actions on the photo */}
                <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
                  <button
                    id={`toggle-fav-card-${house.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening house details
                      onToggleFavorite(house.id);
                    }}
                    className="bg-white/95 hover:bg-white text-rose-500 hover:text-rose-600 p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer"
                    title={currentUser?.favorites?.includes(house.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    aria-label={currentUser?.favorites?.includes(house.id) ? `إزالة ${house.name} من المفضلة` : `إضافة ${house.name} للمفضلة`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${currentUser?.favorites?.includes(house.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                  </button>

                  <button
                    id={`toggle-compare-card-${house.id}`}
                    type="button"
                    onClick={(e) => handleToggleCompare(house.id, e)}
                    className={`p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer ${
                      comparedHouseIds.includes(house.id)
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-white/95 text-slate-400 hover:text-[#5A5A40] hover:bg-white'
                    }`}
                    title={comparedHouseIds.includes(house.id) ? 'إزالة من المقارنة' : 'إضافة للمقارنة والمفاضلة'}
                    aria-label={comparedHouseIds.includes(house.id) ? `إزالة ${house.name} من المقارنة` : `إضافة ${house.name} للمقارنة`}
                    aria-pressed={comparedHouseIds.includes(house.id)}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Status badges — only what the guest is filtering on right now
                    (real availability) and what tells them the listing is a
                    different kind of place. Amenities stay inside. */}
                <div className="absolute top-11 left-3 flex flex-col gap-1 items-start">
                  {availability !== null && (
                    <span className="bg-emerald-600/95 backdrop-blur-sm text-white text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                      ✓ متاح في تواريخك
                    </span>
                  )}
                  {bookedBeforeIds.has(house.id) && (
                    <span className="bg-[#0A2342]/90 backdrop-blur-sm text-[#C5A059] text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                      ⭐ حجزتم هنا قبل كده
                    </span>
                  )}
                  {house.propertyType === 'student' && (
                    <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm text-white ${house.studentHousingGender === 'girls' ? 'bg-[#9C4B64]' : 'bg-[#4B6B9C]'}`}>
                      {house.studentHousingGender === 'girls' ? 'سكن طالبات ♀' : 'سكن طلاب ♂'}
                    </span>
                  )}
                  {house.propertyType === 'staff' && (
                    <span className="bg-[#4B7C6B] text-white text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                      سكن موظفين ومغتربين
                    </span>
                  )}
                </div>

                {/* Details panel — frosted glass floating over the photo. Its
                    height is what drives the card's height. */}
                <div className="relative flex p-2.5">
                  <div className="w-[47%] bg-black/35 backdrop-blur-xl rounded-2xl border border-white/25 shadow-sm p-2.5 space-y-1.5">
                    <h3 className="text-[11.5px] font-black text-white leading-snug line-clamp-2">
                      {house.name}
                    </h3>

                    <p className="text-[9.5px] text-white/70 font-bold line-clamp-2 leading-relaxed">
                      {house.description}
                    </p>

                    {/* Capacity is always known; the two service icons only appear
                        for houses that actually list them, so a house without a
                        garage shows three icons rather than a blank slot. */}
                    <div className="flex items-start gap-1.5 pt-0.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                          <Users className="w-4 h-4" />
                        </span>
                        <span className="text-[9.5px] font-black text-white leading-none">
                          {house.propertyType === 'student' || house.propertyType === 'staff' ? house.roomCapacity : house.bedsCount}
                        </span>
                        <span className="text-[8px] font-bold text-white/70 leading-none">
                          {house.propertyType === 'student' || house.propertyType === 'staff' ? 'بالغرفة' : 'فرد'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                          <BedDouble className="w-4 h-4" />
                        </span>
                        <span className="text-[9.5px] font-black text-white leading-none">{house.roomsCount}</span>
                        <span className="text-[8px] font-bold text-white/70 leading-none">غرف</span>
                      </div>

                      {(house.services.includes('موقف مجاني') || house.services.includes('جراج خاص')) && (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                            <SquareParking className="w-4 h-4" />
                          </span>
                          <span className="text-[8px] font-bold text-white/70 leading-none text-center">
                            {house.services.includes('موقف مجاني') ? <>موقف<br />مجاني</> : <>جراج<br />خاص</>}
                          </span>
                        </div>
                      )}

                      {house.services.includes('واي فاي') && (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                            <Wifi className="w-4 h-4" />
                          </span>
                          <span className="text-[8px] font-bold text-white/70 leading-none text-center">واي<br />فاي</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1 pt-1">
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? (
                        <>
                          <span className="text-[15px] font-black text-[#E8C88A] leading-none">{house.monthlyRent ?? 0}</span>
                          <span className="text-[8.5px] font-bold text-white/70">ج.م / شهريًا</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[8.5px] font-bold text-white/70">من</span>
                          <span className="text-[15px] font-black text-[#E8C88A] leading-none">{house.pricePerNightPerPerson}</span>
                          <span className="text-[8.5px] font-bold text-white/70">ج.م / الليلة للفرد</span>
                        </>
                      )}
                    </div>

                    {/* Once the guest has told us dates and how many they are, the
                        card stops quoting a per-night rate and answers the two
                        questions they actually have: what will this cost us, and
                        who else will be here. Both come from numbers we already
                        hold — the stay-price math and the availability RPC. */}
                    {(() => {
                      if (house.propertyType === 'student' || house.propertyType === 'staff') return null;

                      const total = stayNights && partySize
                        ? computeStayPrice(house, filterCheckIn, filterCheckOut, partySize).total
                        : 0;
                      const freeBeds = availability?.[house.id];
                      const hasBeds = typeof freeBeds === 'number' && house.bedsCount > 0;
                      // Clamped: a bad row shouldn't render "110% booked".
                      const freeShare = hasBeds ? Math.min(1, Math.max(0, freeBeds / house.bedsCount)) : null;
                      const short = partySize && typeof freeBeds === 'number' ? partySize - freeBeds : 0;

                      if (!total && freeShare === null) return null;

                      return (
                        <div className="pt-1.5 mt-1 border-t border-white/15 space-y-1">
                          {total > 0 && (
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-[8.5px] font-bold text-white/70">الإجمالي</span>
                                <span className="text-[13px] font-black text-white leading-none">
                                  {total.toLocaleString('en-US')}
                                </span>
                                <span className="text-[8.5px] font-bold text-white/70">ج.م</span>
                              </div>
                              <span className="text-[8px] font-bold text-white/60">
                                {partySize} فرد × {stayNights} {stayNights === 1 ? 'ليلة' : stayNights === 2 ? 'ليلتين' : 'ليالي'}
                              </span>
                            </div>
                          )}

                          {/* Does it fit? Only answerable once they've said how many. */}
                          {hasBeds && partySize > 0 && (
                            short > 0 ? (
                              <span className="block text-[8px] font-black text-amber-300">
                                ينقص {bedsLabel(short)} عن عددكم
                              </span>
                            ) : (
                              <span className="block text-[8px] font-black text-emerald-300">
                                يكفي عددكم — متاح {bedsLabel(freeBeds)}
                              </span>
                            )
                          )}

                          {/* "Will we have the place to ourselves?" — a selling
                              point for a family and for a group booking a whole
                              retreat, and a warning for anyone wanting quiet.
                              Suppressed when the house can't hold them anyway:
                              "nearly empty" beside "you're 57 beds short" reads
                              as a contradiction even though both are true. */}
                          {short <= 0 && freeShare !== null && freeShare >= 0.85 && (
                            <span className="block text-[8px] font-bold text-white/60">البيت شبه فاضي في تواريخكم</span>
                          )}
                          {short <= 0 && freeShare !== null && freeShare <= 0.4 && (
                            <span className="block text-[8px] font-bold text-white/60">
                              محجوز {Math.round((1 - freeShare) * 100)}٪ في تواريخكم
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="relative flex items-center justify-center bg-gradient-to-l from-[#B8944E] to-[#E0C48A] text-white rounded-full py-2 mt-1">
                      <span className="text-[10px] font-extrabold">عرض التفاصيل</span>
                      <span className="absolute right-1.5 w-5 h-5 rounded-full bg-black/25 flex items-center justify-center">
                        <ArrowLeft className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom promo (limited-time countdown offer) — admin-managed, falls back to ported default */}
      <CountdownOfferBanner banner={countdownBanner} live={countdownBanner ? bannerLive[countdownBanner.id] : undefined} onOpenHouse={openHouseById} onCta={() => document.getElementById('house-list-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      {/* Compare Floating Bar — the thumbnails matter: after scrolling past a
          dozen cards nobody remembers which three they ticked. */}
      {comparedHouseIds.length > 0 && (
        <div className="sticky bottom-2 z-35 bg-[#FFFFFF] border border-[#EDE7DA] rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 animate-bounce-once">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              {comparedHouseIds.map((id) => {
                const picked = houses.find((h) => h.id === id);
                if (!picked) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => handleToggleCompare(id, e)}
                    title={`إزالة ${picked.name} من المقارنة`}
                    aria-label={`إزالة ${picked.name} من المقارنة`}
                    className="relative w-8 h-8 rounded-xl overflow-hidden border border-[#EDE7DA] group/thumb cursor-pointer"
                  >
                    <img referrerPolicy="no-referrer" src={picked.images[0]} alt="" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/45 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-right min-w-0">
              <span className="text-[11px] font-extrabold text-[#2D2D24] block">
                {comparedHouseIds.length} من ٣ للمقارنة
              </span>
              <span className="text-[9px] text-[#8A8A70] font-bold">
                {comparedHouseIds.length < 2 ? 'اختر بيتًا آخر على الأقل' : 'اضغط على صورة لإزالتها'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setComparedHouseIds([])}
              className="text-[#8A8A70] hover:text-rose-300 text-[10px] font-bold px-2 py-1.5 rounded-xl hover:bg-rose-900/20 transition-all cursor-pointer"
            >
              مسح
            </button>
            <button
              onClick={() => setShowComparisonModal(true)}
              disabled={comparedHouseIds.length < 2}
              className="bg-[#5A5A40] hover:bg-[#4A4A3A] disabled:bg-[#3F3F33] disabled:text-[#8A8570] disabled:cursor-not-allowed text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>قارن</span>
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 text-right">
          <div className="bg-[#FBF9F4] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#EDE7DA] animate-scale-up">
            {/* Header */}
            <div className="bg-[#5A5A40] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-200" />
                <h3 className="text-xs font-extrabold">مقارنة بيوت الخلوة والمؤتمرات 📊</h3>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comparison Body — laid out as bands rather than three separate
                cards, so the same metric always sits on the same line across
                every house. That alignment is what makes it a comparison. */}
            {(() => {
              const picked = comparedHouseIds
                .map((id) => houses.find((h) => h.id === id))
                .filter((h): h is RetreatHouse => Boolean(h));
              if (!picked.length) return null;

              const isMonthly = (h: RetreatHouse) => h.propertyType === 'student' || h.propertyType === 'staff';
              // Nightly-per-person and monthly rent are different units, as are
              // beds and per-room capacity. Only crown a winner when every house
              // in the set is quoted on the same basis.
              const sameBasis = picked.every(isMonthly) || picked.every((h) => !isMonthly(h));
              const priceOf = (h: RetreatHouse) => (isMonthly(h) ? h.monthlyRent ?? 0 : h.pricePerNightPerPerson);
              const capacityOf = (h: RetreatHouse) => (isMonthly(h) ? h.roomCapacity ?? 0 : h.bedsCount);
              // A "best" that every house ties on tells the guest nothing.
              const bestOf = (pick: (h: RetreatHouse) => number, mode: 'min' | 'max') => {
                const values = picked.map(pick);
                const best = mode === 'min' ? Math.min(...values) : Math.max(...values);
                return values.filter((v) => v === best).length === values.length ? null : best;
              };
              const cheapest = sameBasis ? bestOf(priceOf, 'min') : null;
              const roomiest = sameBasis ? bestOf(capacityOf, 'max') : null;
              const topRated = bestOf((h) => h.rating, 'max');

              const cols = { gridTemplateColumns: `repeat(${picked.length}, minmax(0, 1fr))` };
              const Win = () => (
                <span className="bg-emerald-600 text-white text-[7px] font-black px-1 py-0.5 rounded-full">الأفضل</span>
              );
              const Band = ({ label, children }: { label: string; children: React.ReactNode }) => (
                <div className="space-y-1">
                  <span className="text-[8.5px] text-[#8A8A70] font-black block border-b border-[#EDE7DA] pb-0.5">{label}</span>
                  <div className="grid gap-2" style={cols}>{children}</div>
                </div>
              );

              return (
                <div className="p-4 overflow-y-auto space-y-3 text-[10px] leading-relaxed">
                  {/* Header: photo + name per column */}
                  <div className="grid gap-2" style={cols}>
                    {picked.map((h) => (
                      <div key={h.id} className="text-center space-y-1">
                        <div className="h-14 bg-[#2A2A20] rounded-xl overflow-hidden border border-[#EDE7DA]">
                          <img referrerPolicy="no-referrer" loading="lazy" src={h.images[0]} alt={h.name} className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-extrabold text-[#2D2D24] line-clamp-2 leading-tight text-[9px]">{h.name}</h4>
                      </div>
                    ))}
                  </div>

                  <Band label="الموقع">
                    {picked.map((h) => (
                      <span key={h.id} className="font-bold text-[#2D2D24] text-center block">{h.governorate}</span>
                    ))}
                  </Band>

                  {/* On a mixed set the band label can't name one unit without
                      lying about the other column, so it goes neutral and each
                      value carries its own unit instead. */}
                  <Band label={!sameBasis ? 'السعر' : picked.every(isMonthly) ? 'الإيجار الشهري' : 'السعر لليلة للفرد'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${cheapest !== null && priceOf(h) === cheapest ? 'text-emerald-300' : 'text-[#E4E1CB]'}`}>
                          {priceOf(h)} ج.م
                        </span>
                        {!sameBasis && (
                          <span className="text-[7.5px] text-[#8A8A70] font-bold">{isMonthly(h) ? 'شهريًا' : 'لليلة للفرد'}</span>
                        )}
                        {cheapest !== null && priceOf(h) === cheapest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label={!sameBasis ? 'السعة' : picked.every(isMonthly) ? 'سعة الغرفة' : 'عدد الأسرّة'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${roomiest !== null && capacityOf(h) === roomiest ? 'text-emerald-300' : 'text-[#2D2D24]'}`}>
                          {capacityOf(h)}
                        </span>
                        {!sameBasis && (
                          <span className="text-[7.5px] text-[#8A8A70] font-bold">{isMonthly(h) ? 'بالغرفة' : 'سرير'}</span>
                        )}
                        {roomiest !== null && capacityOf(h) === roomiest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label="التقييم">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                          {h.rating.toFixed(1)}
                        </span>
                        {topRated !== null && h.rating === topRated && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band label="الفئات المناسبة">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.suitability.map((s) => (
                          <span key={s} className="bg-[#8A8A70]/25 text-[#4A4A3A] text-[7.5px] px-1 py-0.5 rounded-sm font-semibold">
                            {SUITABILITY_MAP[s]}
                          </span>
                        ))}
                      </div>
                    ))}
                  </Band>

                  <Band label="الخدمات">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.services.slice(0, 2).map((s) => (
                          <span key={s} className="bg-emerald-900/30 text-emerald-200 text-[7px] px-1 py-0.5 rounded-sm font-bold">
                            {s}
                          </span>
                        ))}
                        {h.services.length > 2 && (
                          <span className="text-[7px] text-[#8A8A70] font-bold px-1 py-0.5">+{h.services.length - 2}</span>
                        )}
                      </div>
                    ))}
                  </Band>

                  {!sameBasis && (
                    <p className="text-[8.5px] text-[#8A8A70] font-bold text-center bg-[#F3EFE4] rounded-xl p-2">
                      البيوت المختارة أسعارها محسوبة بطرق مختلفة (ليلة للفرد مقابل إيجار شهري)، فمفيش مقارنة مباشرة للسعر أو السعة.
                    </p>
                  )}

                  <div className="grid gap-2 pt-1" style={cols}>
                    {picked.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => {
                          onSelectHouse(h);
                          setShowComparisonModal(false);
                        }}
                        className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[9px] font-bold py-1.5 rounded-xl transition-all text-center cursor-pointer"
                      >
                        عرض التفاصيل
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="bg-[#2A2A20] p-3 text-center border-t border-[#EDE7DA]">
              <button
                onClick={() => setShowComparisonModal(false)}
                className="bg-[#FFFFFF] border border-[#EDE7DA] text-[#2D2D24] hover:bg-[#F3EFE4] text-[10px] font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                إغلاق المقارنة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

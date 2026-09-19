import React, { useState, useEffect } from 'react';
import { RetreatHouse, User, PromoBanner, Booking, Review } from '../types';
import { arabicNumber, arabicDecimal, arabicPlural, arabicUnit, HOUSE_FORMS, GUEST_FORMS } from '../lib/arabic';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../mockData';
import { Search, Gift, MapPin, Map as MapIcon, SlidersHorizontal, Grid, Star, Sparkles, Building, Waves, Trees, Check, GraduationCap, Briefcase, Home, Wifi, Wind, Users, Heart, Scale, Layers, X, ArrowLeftRight, CalendarCheck, BookOpen, BedDouble, ArrowLeft, SquareParking, Flame, Sun } from 'lucide-react';
import { SummerOfferCarousel, CountdownOfferBanner } from './PromoBanners';
import { loadHousesAvailability, loadHouseBookingCounts } from '../lib/db';
import { computeStayPrice, offersDayUse , hasLiveDiscount } from '../lib/pricing';
import { isBannerLive, matchesAudience, pickExperimentVariants } from '../lib/bannerVisibility';
import { bannerSeed } from '../lib/bannerEvents';
import { copticSeason } from '../lib/copticSeason';
import { tapFeedback } from '../lib/haptics';
import SearchInput from './ui/SearchInput';
import { useRevealOnScroll } from '../lib/useRevealOnScroll';
import { useHeroParallax } from '../lib/useHeroParallax';
import FilterSheet from './FilterSheet';
import type { FilterDraft } from './FilterSheet';
import type { BannerLiveData } from './banner/BannerCanvas';
import { Card, EmptyState } from './ui';
import NoResultsRequest from './NoResultsRequest';
import { matchGovernorate } from '../lib/placeRequests';

/**
 * One rate on a listing card.
 *
 * The two of these are the loudest thing on the card by design: the number is
 * the largest type in the panel, larger than the house's own name. A guest
 * comparing four houses is comparing prices, and a listing that makes them
 * open the place to find one is a listing they scroll past.
 *
 * Equal boxes, equal weight — a day and a night are two offers, not a headline
 * and a footnote.
 */
/**
 * The badges an admin may put on a card, and nothing else.
 *
 * A fixed table rather than free text: a badge is Pima speaking in its own
 * voice about a house, and «آخر غرفتين!» typed into a box is a claim the
 * platform cannot stand behind. The database holds the key and enforces the
 * same list (0164); this holds how it reads.
 */
export const HOUSE_BADGES: Record<string, { label: string; cls: string }> = {
  most_booked: { label: 'الأكثر حجزًا', cls: 'bg-rose-700/90' },
  featured:    { label: 'مميّز',        cls: 'bg-[var(--ds-accent-deep)]/95' },
  new:         { label: 'جديد',         cls: 'bg-emerald-700/90' },
  family:      { label: 'مناسب للعائلات', cls: 'bg-[var(--ds-brand)]/90' },
  quiet:       { label: 'هادي',          cls: 'bg-sky-800/90' },
};

function PriceBox({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl bg-white/15 border border-white/20 px-1.5 py-0.5 text-center">
      {/* The icon sits above the label rather than beside it. Beside it, the
          two together needed a 92px box, and the narrowest real card gives
          barely half that — both labels came out ellipsised, and the ellipsis
          ate the word that says which price this is. */}
      {/* The icon moved onto the label's line. Stacked, the box was three
          rows tall and the two of them set the card's height more than
          anything else in the panel. */}
      {/* 9.5px and full white, not 8px at 70%. This word is the whole
          difference between the two boxes, and it was the faintest thing in
          them — sitting on glass over an uncontrolled photograph, where 70%
          of white is not a reliable 70% of anything. */}
      <span className="flex items-center justify-center gap-1 text-[11px] font-black text-white">
        <Icon className="w-3 h-3 text-[#E8C88A] shrink-0" />
        {label}
      </span>
      {/* flex-wrap, because the box is now narrow enough that «٣٩٥ ج.م» does
          not fit beside itself on a 320px phone. Wrapping drops the unit under
          the number and costs a few pixels of height there; not wrapping clips
          the price, which is the one number on the card people are scanning
          for. */}
      <span className="flex flex-wrap items-baseline justify-center gap-x-0.5 mt-0.5">
        <span className="text-[14px] font-black text-[#E8C88A] leading-none [font-variant-numeric:tabular-nums]">{arabicNumber(value)}</span>
        <span className="text-[11px] font-bold text-white/70">ج.م</span>
      </span>
    </div>
  );
}

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
  if (n === 0) return { count: null, noun: 'لا يوجد بيت يناسب بحثك' };
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

// Module scope, alongside PriceBox above, on purpose: declared inside the
// render body these would be new component types on every render and React
// would remount every comparison row instead of updating it. Band takes the
// column template as a prop since it can no longer close over it.
function Win() {
  return <span className="bg-[var(--ds-success)] text-[var(--ds-on-success)] text-[11px] font-black px-1 py-0.5 rounded-full">الأفضل</span>;
}

function Band({ label, cols, children }: { label: string; cols: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] text-[var(--ds-text-2)] font-black block border-b border-[var(--ds-border)] pb-0.5">{label}</span>
      <div className="grid gap-2" style={cols}>{children}</div>
    </div>
  );
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
  /**
   * Whether this is one of the narrow phones.
   *
   * Only the search hint asks. At 375 the bar gives the field 213px and the
   * full «ابحث باسم البيت، مدينة أو منطقة» fits; at 320 the field is 158 and
   * the same string loses its last three words. A Tailwind variant cannot
   * reach a placeholder's TEXT, only its size, and making it smaller still
   * does not fit — so the short form is chosen here instead of being cut
   * mid-word on screen.
   */
  const [narrowPhone, setNarrowPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 374px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 374px)');
    const sync = () => setNarrowPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  /** Open while the field has focus and something typed — the suggestions. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [selectedGov, setSelectedGov] = useState('');
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number>(400);
  const [dayUseOnly, setDayUseOnly] = useState(false);
  const [selectedSuitabilities, setSelectedSuitabilities] = useState<('youth' | 'children' | 'families' | 'retreat')[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  // Live draft while the sheet is open, so its CTA can count before applying.
  const [filterPreview, setFilterPreview] = useState<FilterDraft | null>(null);
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

  // «الأكثر حجزًا» was computed here — top three approved houses by confirmed
  // bookings over a year — and «حجزتم هنا قبل كده» from the viewer's own
  // bookings. Both are the admin's to set now (0164), so a badge is a decision
  // about what to put forward rather than a threshold nobody chose.
  //
  // «حجزتم هنا قبل كده» is not among the ones an admin can set, and its
  // automatic version goes with the rest: it is a statement about the person
  // reading the card, so an admin switching it on would tell every visitor
  // they had stayed somewhere they never did.

  /**
   * Whether this is a search or a browse.
   *
   * «وجدنا ١٢ مكانًا يناسب بحثك» and the sort control used to sit above the
   * list always, so a guest who had asked for nothing was told how many houses
   * matched a search they had not made — the whole catalogue, described as a
   * result. Both belong to a search, and this is what says one happened: a
   * query, a category, a date range, or any filter moved off its default.
   */
  const hasSearched =
    searchQuery.trim() !== ''
    || selectedGov !== ''
    || Boolean(filterCheckIn && filterCheckOut)
    || guestCount !== ''
    || maxPrice !== 400
    || dayUseOnly
    || selectedSuitabilities.length > 0
    || selectedAmenities.length > 0
    || selectedSeaProximity !== 'all';

  /**
   * What the typing could mean.
   *
   * Built from the governorates that actually have houses, not a list of
   * Egypt: an offer to search a place with nothing in it is a dead end, and
   * the guest cannot tell it apart from a place that is simply not on Pima.
   *
   * Each match gives one row for the place and one per kind of place that
   * exists there — «مؤتمرات في الإسكندرية» is only offered when there is a
   * conference house in Alexandria.
   */
  const suggestions = React.useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 1) return [] as { label: string; gov: string; type: 'all' | 'conference' | 'student' | 'staff' }[];
    const govs = [...new Set(houses.filter((h) => h.status === 'approved').map((h) => h.governorate))]
      .filter((g) => g && g.includes(q))
      .slice(0, 2);
    const KIND: { type: 'conference' | 'student' | 'staff'; word: string }[] = [
      { type: 'conference', word: 'مؤتمرات' },
      { type: 'student', word: 'سكن طلاب' },
      { type: 'staff', word: 'سكن موظفين' },
    ];
    const out: { label: string; gov: string; type: 'all' | 'conference' | 'student' | 'staff' }[] = [];
    for (const gov of govs) {
      out.push({ label: gov, gov, type: 'all' });
      out.push({ label: `بيوت في ${gov}`, gov, type: 'all' });
      for (const k of KIND) {
        if (houses.some((h) => h.status === 'approved' && h.governorate === gov && h.propertyType === k.type)) {
          out.push({ label: `${k.word} في ${gov}`, gov, type: k.type });
        }
      }
    }
    return out.slice(0, 6);
  }, [searchQuery, houses]);

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

  // One predicate, parameterised by the six sheet-owned criteria. The list and
  // the sheet's "عرض N بيتًا" both run it, so the number on the button is the
  // number of cards you get — a count computed a second way would drift.
  const matchesCriteria = (house: RetreatHouse, c: FilterDraft): boolean => {
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
    const matchesGov = c.governorate ? house.governorate === c.governorate : true;

    // Guest capacity match
    const matchesGuests = c.guestCount ? house.bedsCount >= c.guestCount : true;

    // Price match
    const matchesPrice = house.pricePerNightPerPerson <= c.maxPrice;

    // «يوم روحي» — only houses that have actually priced a day. A house whose
    // owner set the price back to 0 has withdrawn the offer, and offersDayUse
    // is the one place that decision is read.
    const matchesDayUse = c.dayUseOnly ? offersDayUse(house) : true;

    // Suitabilities match (must match all selected suitabilities if any)
    const matchesSuitability = selectedSuitabilities.length > 0 
      ? selectedSuitabilities.every((suit) => house.suitability.includes(suit))
      : true;

    // Amenities match (must contain all selected services)
    const matchesAmenities = c.amenities.length > 0
      ? c.amenities.every((amenity) => house.services.includes(amenity))
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
    if (c.seaProximity !== 'all' && house.seaProximity !== c.seaProximity) return false;

    // Real availability for the selected dates: enough free beds for the
    // requested group (or at least one bed when no count was given). Only the
    // committed dates have availability loaded, so a draft that changes dates
    // counts on capacity alone until it is applied.
    if (availability !== null && c.checkIn === filterCheckIn && c.checkOut === filterCheckOut) {
      const freeBeds = availability[house.id] ?? 0;
      if (freeBeds < (c.guestCount || 1)) return false;
    }

    return matchesSearch && matchesGov && matchesGuests && matchesPrice && matchesDayUse && matchesSuitability && matchesAmenities;
  };

  // What the committed filters currently select.
  const committed: FilterDraft = {
    governorate: selectedGov,
    guestCount,
    checkIn: filterCheckIn,
    checkOut: filterCheckOut,
    maxPrice,
    amenities: selectedAmenities,
    seaProximity: selectedSeaProximity,
    dayUseOnly,
  };

  const filteredHouses = houses.filter((h) => matchesCriteria(h, committed)).sort((a, b) => {
    if (sortBy === 'price_asc') return a.pricePerNightPerPerson - b.pricePerNightPerPerson;
    if (sortBy === 'price_desc') return b.pricePerNightPerPerson - a.pricePerNightPerPerson;
    return b.rating - a.rating;
  });

  // Live count for the sheet's CTA: the draft while the sheet is open and being
  // edited, the committed set otherwise.
  const previewCount = filterPreview
    ? houses.filter((h) => matchesCriteria(h, filterPreview)).length
    : filteredHouses.length;

  // Cards rise into place as they scroll in. One observer over the whole grid,
  // keyed to the result count so a filter change re-observes what is now
  // rendered. Declared here because it reads filteredHouses.
  const cardGridRef = useRevealOnScroll<HTMLDivElement>(filteredHouses.length);
  const heroParallaxRef = useHeroParallax<HTMLDivElement>(20);

  return (
    // Warm cream surface, bled past the shell's px-4 py-6 so the hero can run
    // edge to edge. The house cards keep their own dark glass panels — they are
    // the one thing on this screen that is deliberately not cream.
    // Full-bleed on purpose: a capped, centred column left big empty margins on
    // a wide screen and read as a shrunken page. Desktop is handled by giving
    // the CONTENT more columns (see the house grid), not by narrowing the page.
    <div className="min-h-screen bg-gradient-to-b from-[var(--ds-bg)] via-[color-mix(in_srgb,var(--ds-bg)_50%,var(--ds-raised))] to-[var(--ds-raised)] text-[var(--ds-text)] -mx-4 -my-6 sm:mx-0 sm:my-0 sm:rounded-3xl px-4 py-5 text-right">
      {/* Content tier — the gradient above stays full-bleed, the catalog does not. */}
      <div className="pima-page-wide space-y-5">

      {/* Follows the Coptic calendar on its own — no one has to remember to
          switch it on, and it disappears outside the fasts and feasts. */}
      {(() => {
        const s = copticSeason();
        if (s.season === 'ordinary') return null;
        return (
          <div className="pima-brand-panel pima-brand-panel--to-left flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[11px] font-black text-[var(--ds-accent)]">{s.label}</span>
            {/* currentColor, so the dot follows whichever ink the panel is
                using — white on navy in light, --ds-text on the dark surface. */}
            <span className="w-1 h-1 rounded-full bg-current/40" />
            <span className="text-[11px] font-bold">{s.greeting}</span>
          </div>
        );
      })()}

      {/* Hero + floating search. The search bar is pulled up over the bottom of
          the banner so the two read as one unit; the banner itself stays purely
          promotional — no brand marks, no controls inside it. */}
      {/* Hero + floating search read as one composition: the bar clips the hero
          rather than sitting under it, and the wrapper's padding is only what
          the overhang and its shadow need — no gap between the two. */}
      {/* No padding here, so the wrapper is exactly the hero: that makes the
          bar's offset mean what it says. Previous attempts padded the wrapper
          and then solved for the offset, which is how the overlap kept landing
          at 11, 15 and 19px instead of the 35 asked for. mb-5 carries the
          overhang and the bar's shadow. */}
      {/* -mx-4 cancels this page's own px-4 so the hero reaches the phone's
          edges; sm:mx-0 hands the margins back where the page becomes a
          centred card. */}
      {/* Results are their own page. The hero, the loyalty and guide cards,
          the category tabs and the at-a-glance strip are all there to help
          somebody who has not decided yet — once they have searched, every one
          of them is between them and the answer. The search bar is the only
          thing here that a result still needs, so it stays and the rest folds
          away. */}
      <div className={hasSearched ? 'relative mb-3' : 'relative mb-13 -mx-4 sm:mx-0'}>
        {/* Parallax wraps the hero, not the search bar: the bar has to stay
            welded to the hero's edge, and moving both would just move the
            composition. */}
        {!hasSearched && (
          <div ref={heroParallaxRef} className="pima-parallax">
            <SummerOfferCarousel edgeToEdge slides={carouselSlides} live={bannerLive} onOpenHouse={openHouseById} onCta={() => document.getElementById('house-list-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>
        )}

        {/* -bottom-8 puts the bar's bottom 32px past the hero. It sat at 16
            and covered most of the photograph's bottom band; now it rides the
            edge and leaves the picture whole. mb-13 on the wrapper carries the
            deeper overhang, so the gap to whatever follows is unchanged.
            inset-x-7 on a phone, not inset-x-3: the hero grew by the 16px of
            page padding it used to sit inside, and the bar has to stay where
            it was rather than follow it out to the screen edge. */}

        {/* Absolutely placed over the hero while there is a hero to sit on,
            and an ordinary block once there is not. */}
        <div className={hasSearched
          ? 'relative z-20'
          : 'absolute inset-x-6 -bottom-8 z-20 pima-rise pima-rise-2'}>
          {/* Frosted white: saturated blur is what makes it read as glass over a
              photograph. The shadow is kept tight and low so it does not cast a
              grey band up across the banner it is sitting on. */}
          {/* 56px tall, radius 28 — which is what rounded-full resolves to on
              a 56px box — and 24px in from the screen on each side.

              No padding and no gaps: the three sections run edge to edge and
              are separated by 1px rules, the way the spec draws them. That is
              not only cosmetic. Padding plus gaps was 48px of the bar, and
              the bar is 327px here; giving it back is what lets the field
              hold «ابحث باسم البيت، مدينة أو منطقة» whole.

              No transition on the focus border. border-color reads an
              unregistered custom property, and a transition on one never
              resolves when the theme changes — the border would keep the
              previous theme's colour for good. Button, Input and SearchInput
              all document the same refusal. */}
          <div className="relative flex items-center h-14 bg-[var(--ds-surface)]/80 backdrop-blur-2xl backdrop-saturate-150 border border-[var(--ds-surface)]/80 rounded-full shadow-[0_6px_18px_-6px_rgba(45,45,36,0.22),0_1px_4px_rgba(45,45,36,0.06)] focus-within:border-[var(--ds-accent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ds-accent)_22%,transparent),0_6px_18px_-6px_rgba(45,45,36,0.22)]">
            {/* DOM order is right-to-left on screen: map sits at the right end,
                filter at the left, matching the approved layout. */}
            {onOpenMap && (
              <>
                {/* The hairline rules that used to separate the three are
                    gone. Three shapes with 12px between them already read as
                    three; the rules were doing the same job twice and eating
                    the gap that was supposed to do it. */}
                <button
                  id="open-map-btn"
                  type="button"
                  onClick={onOpenMap}
                  className="shrink-0 grid place-items-center rounded-full w-14 h-14 text-[var(--ds-text)] hover:bg-[var(--ds-raised)] transition-colors cursor-pointer"
                  title="عرض البيوت على الخريطة"
                  aria-label="عرض البيوت على الخريطة"
                >
                  <MapPin className="w-6 h-6" />
                </button>
                <span aria-hidden="true" className="w-px self-stretch my-3 bg-[var(--ds-border)]/60 shrink-0" />
              </>
            )}

            {/* The canonical field, with its surface turned off. This is a
                SEGMENT of a frosted pill that shares one border with the map
                and filter buttons either side of it, so the component's own
                opaque background, border and 12px radius would nest a solid
                box inside the glass. `surface={false}` omits exactly those
                three; everything that makes it a search field — the 44px
                floor, the logical icon and padding, type=search, the focus
                ring — comes from the shared component. */}
            <SearchInput
              id="user-search-query"
              surface={false}
              // The bar is the frosted glass; the field is the brighter pill
              // sitting on it. surface={false} strips the component's own
              // box so this one can be the shape the spec draws.
              className="bg-[var(--ds-surface)]/55 backdrop-blur-md rounded-full placeholder:text-[11px]"
              leadingIcon={false}
              leading={
                // A real button, not an ornament. A filled gold circle is the
                // loudest thing in the bar, and the list already filters as
                // you type — so tapping it does the thing a phone keyboard
                // cannot: puts the keyboard away and moves to the results.
                <button
                  id="search-go-btn"
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setSuggestOpen(false);
                    (document.getElementById('user-search-query') as HTMLInputElement | null)?.blur();
                    document.getElementById('house-list-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  aria-label="ابحث"
                  // 44px of tappable area around a 40px circle — the circle is
                  // the size the spec draws, 44 is the floor a thumb needs.
                  className="absolute start-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center cursor-pointer"
                >
                  <span className="w-10 h-10 rounded-full bg-[var(--ds-accent)] grid place-items-center shadow-sm">
                    <Search aria-hidden="true" className="w-4 h-4 text-[var(--ds-on-accent)]" />
                  </span>
                </button>
              }
              // The spec's own numbers do not fit a 375px screen: two 88px
              // buttons, 12px of padding and 12px gaps leave the field 125px,
              // and the placeholder it writes measures 186. Asked which half
              // to keep, the answer was the text — so الخريطة and فلتر are
              // the 44px circles their icons already were, the field takes
              // what they gave back, and the hint is written in full.
              //
              // The hint is 11px and the value stays 14. At 14 the string
              // needs 186px against the field's 153 and lost its last word;
              // at 11 it finishes. Shrinking the whole field would have
              // shrunk what people type, which is the one thing here that
              // has to stay easy to read back.
              placeholder={narrowPhone ? 'ابحث باسم البيت' : 'ابحث باسم البيت، مدينة أو منطقة'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="ابحث عن بيت"
              wrapperClassName="flex-1 min-w-0"
              onFocus={() => setSuggestOpen(true)}
              // A blur fires before the click on a suggestion lands, so the
              // close waits for it. Any shorter and the row is gone by the
              // time the tap arrives and nothing happens.
              onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            />

            {hasSearched && (
              <button
                id="clear-search-btn"
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGov('');
                  setGuestCount('');
                  setMaxPrice(400);
                  setDayUseOnly(false);
                  setSelectedSuitabilities([]);
                  setSelectedAmenities([]);
                  setSelectedSeaProximity('all');
                  setFilterCheckIn('');
                  setFilterCheckOut('');
                  setSuggestOpen(false);
                }}
                className="shrink-0 w-11 h-11 grid place-items-center text-[var(--ds-text-2)] hover:text-[var(--ds-text)] transition-colors cursor-pointer"
                title="امسح البحث"
                aria-label="امسح البحث وارجع للصفحة الرئيسية"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            )}

            {suggestOpen && suggestions.length > 0 && (
              <ul
                id="search-suggestions"
                className="absolute top-full right-0 left-0 mt-2 z-30 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl shadow-lg overflow-hidden py-1"
              >
                {suggestions.map((sg) => (
                  <li key={sg.label}>
                    <button
                      type="button"
                      // onMouseDown, not onClick: the field's blur would
                      // otherwise unmount this row before the click resolved.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedGov(sg.gov);
                        setSelectedType(sg.type);
                        setSearchQuery('');
                        setSuggestOpen(false);
                      }}
                      className="w-full text-right flex items-center gap-2 px-3 min-h-11 text-[12px] font-bold text-[var(--ds-text)] hover:bg-[var(--ds-raised)] transition-colors cursor-pointer"
                    >
                      <MapPin aria-hidden="true" className="w-3.5 h-3.5 text-[var(--ds-text-2)] shrink-0" />
                      <span className="truncate">{sg.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <span aria-hidden="true" className="w-px self-stretch my-3 bg-[var(--ds-border)]/60 shrink-0" />

            <button
              id="toggle-filters-btn"
              onClick={() => { tapFeedback(); setShowFilters(!showFilters); }}
              className={`shrink-0 grid place-items-center rounded-full w-14 h-14 transition-colors cursor-pointer ${
                showFilters ? 'bg-[var(--ds-primary)] text-[var(--ds-on-primary)]' : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
              }`}
              title="فلاتر متقدمة"
              aria-label="فلاتر متقدمة"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {!hasSearched && (
      <>
      {/* Quick cards, one short row. Loyalty is first so it lands on the RIGHT
          in RTL, with the guide beside it — the approved order.

          To the spec: 56px tall, 16 radius, 12px between them, 12px inside,
          a 40px disc and a 24px chevron slot. The disc went from a 36px
          rounded square to a 40px circle, which is the change that makes the
          pair read as one family with the round controls in the bar above. */}
      {/* Side by side from 375 up, which is where a 161px card has the 90px
          of text column its own labels need. At 320 the pair is 138px each
          and every line wrapped, so below that they stack and each one gets
          the full width — 56px tall either way, which is the point. */}
      <div className="grid grid-cols-2 max-[374px]:grid-cols-1 gap-3">
        {currentUser && currentUser.role !== 'owner' ? (
          <button
            id="loyalty-card-trigger"
            type="button"
            onClick={onSelectRewards}
            className="flex items-center gap-3 min-h-14 py-2 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl px-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] transition-shadow duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] pima-press text-right cursor-pointer"
          >
            <span className="shrink-0 w-10 h-10 rounded-full bg-[var(--ds-accent-soft)]/40 flex items-center justify-center">
              <Gift className="w-5 h-5 text-[var(--ds-accent-deep)]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-[var(--ds-text)] leading-tight">الولاء والنقاط</span>
              <span className="block text-[11px] font-bold text-[var(--ds-text-2)]">
                رصيدك: <span className="text-[var(--ds-accent)] font-black">{(currentUser.points || 0).toLocaleString('ar-EG')}</span> نقطة
              </span>
            </span>
            {/* A 24px slot, the glyph smaller inside it. The spec's 24 is
                the space the arrow is given; a 24px chevron drawn edge to
                edge next to an 11px label is a second headline. */}
          </button>
        ) : (
          <div className="flex items-center gap-3 min-h-14 py-2 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl px-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]">
            <span className="shrink-0 w-10 h-10 rounded-full bg-[var(--ds-accent-soft)]/40 flex items-center justify-center">
              <Gift className="w-5 h-5 text-[var(--ds-accent-deep)]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-[var(--ds-text)] leading-tight">الولاء والنقاط</span>
              <span className="block text-[11px] font-bold text-[var(--ds-text-2)]">سجّل واكسب</span>
            </span>
          </div>
        )}

        <a
          href="/dalil/"
          className="flex items-center gap-3 min-h-14 py-2 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl px-3 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] transition-shadow duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] pima-press group"
        >
          <span className="shrink-0 w-10 h-10 rounded-full bg-[var(--ds-accent-soft)]/40 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[var(--ds-accent-deep)]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-black text-[var(--ds-text)] leading-tight">دليل المستخدم</span>
            <span className="block text-[11px] font-bold text-[var(--ds-text-2)]">اعرف كل المزايا</span>
          </span>
        </a>
      </div>

      {/* Category Tabs Selection */}
      <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] animate-in fade-in duration-500">
        <button
          onClick={() => { tapFeedback(); setSelectedType('all'); }}
          className={`py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press ${
            selectedType === 'all'
              ? 'bg-gradient-to-b from-[var(--ds-accent-soft)] to-[var(--ds-accent)] text-[var(--ds-on-accent)] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]'
              : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>الكل</span>
        </button>
        <button
          onClick={() => { tapFeedback(); setSelectedType('conference'); }}
          className={`py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press ${
            selectedType === 'conference'
              ? 'bg-gradient-to-b from-[var(--ds-accent-soft)] to-[var(--ds-accent)] text-[var(--ds-on-accent)] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]'
              : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>مؤتمرات</span>
        </button>
        <button
          onClick={() => { tapFeedback(); setSelectedType('student'); }}
          className={`py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press ${
            selectedType === 'student'
              ? 'bg-gradient-to-b from-[var(--ds-accent-soft)] to-[var(--ds-accent)] text-[var(--ds-on-accent)] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]'
              : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>سكن طلاب</span>
        </button>
        <button
          onClick={() => { tapFeedback(); setSelectedType('staff'); }}
          className={`py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press ${
            selectedType === 'staff'
              ? 'bg-gradient-to-b from-[var(--ds-accent-soft)] to-[var(--ds-accent)] text-[var(--ds-on-accent)] scale-[1.02] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)]'
              : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>موظفين</span>
        </button>
        {currentUser ? (
          <button
            id="tab-favorites"
            onClick={() => { tapFeedback(); setSelectedType('favorites'); }}
            className={`py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press ${
              selectedType === 'favorites'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-[var(--ds-text)] hover:bg-[var(--ds-raised)]'
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
            className="py-2.5 px-1 rounded-xl text-[11px] font-extrabold transition-all duration-[250ms] ease-[cubic-bezier(0.33,1,0.68,1)] flex flex-col items-center justify-center gap-1.5 cursor-pointer pima-press text-[var(--ds-text)] hover:bg-[var(--ds-raised)]"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>المفضلة</span>
          </button>
        )}
      </div>

      {/* At-a-glance strip. Every number is derived from the list the guest is
          actually looking at, so it moves with the filters instead of quoting
          the whole catalogue. Hidden when a filter empties the list — three
          zeroes say nothing. */}
      {filteredHouses.length > 0 && (() => {
        const rated = filteredHouses.filter((h) => h.reviewsCount > 0);
        const avg = rated.length
          ? (rated.reduce((s, h) => s + h.rating, 0) / rated.length).toFixed(1)
          : null;
        const nightly = filteredHouses.filter((h) => h.propertyType !== 'student' && h.propertyType !== 'staff');
        const from = nightly.length ? Math.min(...nightly.map((h) => h.pricePerNightPerPerson)) : null;
        const cover = filteredHouses.find((h) => h.images[0])?.images[0];

        return (
          <div className="relative bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] overflow-hidden animate-in fade-in duration-500">
            {/* Photo anchors the right edge, the cells run leftwards from it —
                price, count, rating — matching the approved strip. */}
            {cover && (
              <>
                <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" aria-hidden="true"
                  className="absolute inset-y-0 right-0 w-24 h-full object-cover" />
                <div className="absolute inset-y-0 right-0 w-36 bg-gradient-to-r from-[var(--ds-surface)] via-[var(--ds-surface)]/85 to-transparent" />
              </>
            )}
            <div className="relative flex items-stretch justify-start divide-x divide-x-reverse divide-[var(--ds-border)] py-2.5 pl-3 pr-24">
              {from !== null && (
                <div className="flex flex-col items-center gap-0.5 px-2.5">
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)] leading-none">ابتداءً من</span>
                  <span className="text-[12px] font-black text-[var(--ds-accent)] leading-none">{arabicNumber(from)} <span className="text-[11px] text-[var(--ds-text-2)]">ج.م</span></span>
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)]">لليلة للفرد</span>
                </div>
              )}
              <div className="flex flex-col items-center justify-center gap-0.5 px-2.5">
                <span className="flex items-center gap-1 text-[12px] font-black text-[var(--ds-text)] leading-none">
                  <Home className="w-3.5 h-3.5 text-[var(--ds-primary)]" />
                  {arabicNumber(filteredHouses.length)}
                </span>
                <span className="text-[11px] font-bold text-[var(--ds-text-2)]">{arabicUnit(filteredHouses.length, HOUSE_FORMS)} متاح</span>
              </div>
              {avg && (
                <div className="flex flex-col items-center justify-center gap-0.5 px-2.5">
                  <span className="flex items-center gap-1 text-[12px] font-black text-[var(--ds-text)] leading-none">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {avg}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--ds-text-2)]">متوسط التقييم</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      </>
      )}

      {/* Filters live in their own sheet now. The old inline drawer put every
          control on the page at once, which is what pushed the results below
          the fold whenever it was open. */}
      <FilterSheet
        open={showFilters}
        value={committed}
        matchCount={previewCount}
        onPreview={setFilterPreview}
        onClose={() => { setShowFilters(false); setFilterPreview(null); }}
        onApply={(d) => {
          setSelectedGov(d.governorate);
          setGuestCount(d.guestCount);
          setFilterCheckIn(d.checkIn);
          setFilterCheckOut(d.checkOut);
          setMaxPrice(d.maxPrice);
          setSelectedAmenities(d.amenities);
          setSelectedSeaProximity(d.seaProximity);
          setDayUseOnly(d.dayUseOnly);
          setShowFilters(false);
          setFilterPreview(null);
        }}
      />
      {/* Houses Feed List */}
      <div id="house-list-anchor" className="space-y-3.5 text-[var(--ds-text)]">
        {/* Result count and sort. The filter control is not repeated here — it
            lives in the floating search bar, and one entry point is enough. */}
        {/* Only after a search. This row — «وجدنا ١٢ مكانًا يناسب بحثك» and the
            sort control — used to sit above the list always, so somebody who
            had asked for nothing was told how many houses matched a search
            they never made: the whole catalogue, described as a result. Before
            a search the page is for looking around, and says nothing about
            results. */}
        {hasSearched && (
          <div className="space-y-2">
            {/* What was searched for, above the count, so the number has a
                subject. Only when it is a place — «نتائج البحث في» reads
                oddly over a free-text query like «واي فاي». */}
            {selectedGov && (
              <h2 className="px-1 text-[12.5px] font-black text-[var(--ds-text)]">
                نتائج البحث في {selectedGov}
              </h2>
            )}
        {/* The count, then the three orderings as buttons.
            A <select> put them behind a tap and a system sheet: you could not
            see what the list was sorted by without opening it, and on iOS the
            sheet covers the results you are about to reorder. Three buttons
            fit, and the chosen one says so.
            «المسافة» is deliberately absent. Ordering by it means knowing
            where the reader is, which is a location permission and a decision
            about asking for one — not a fourth button. */}
        <div className="flex items-center justify-between gap-2 px-1">
          {(() => {
            const { count, noun } = resultsLabel(filteredHouses.length);
            // «وجدنا» only when something WAS found. With none, the prefix
            // produced «وجدنا لا يوجد بيت يناسب بحثك» — we found there is no
            // house — which then ran past the slot and was clipped mid-word.
            const empty = filteredHouses.length === 0;
            return (
              <span className={`text-[12px] font-black text-[var(--ds-text)] min-w-0 ${empty ? 'leading-tight' : 'truncate'}`}>
                {empty ? noun : <>وجدنا {count && <span className="text-[var(--ds-accent)]">{count}</span>} {noun}</>}
              </span>
            );
          })()}
        </div>

        {/* Nothing found is nothing to order. The three buttons sat above
            «لا يوجد بيت يناسب بحثك» offering to sort it by price. */}
        {filteredHouses.length > 0 && (
        <div className="flex items-center gap-1.5 px-1 overflow-x-auto pima-no-scrollbar">
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-black text-[var(--ds-text-2)] pe-1">
            <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5" />
            ترتيب
          </span>
          {([
            { key: 'rating', label: 'الأفضل تقييماً' },
            { key: 'price_asc', label: 'الأقل سعراً' },
            { key: 'price_desc', label: 'الأعلى سعراً' },
          ] as const).map((o) => (
            <button
              key={o.key}
              id={`sort-${o.key}`}
              type="button"
              onClick={() => { tapFeedback(); setSortBy(o.key); }}
              aria-pressed={sortBy === o.key}
              className={`shrink-0 rounded-full px-3 min-h-11 text-[11px] font-black border transition-colors cursor-pointer ${
                sortBy === o.key
                  ? 'bg-[var(--ds-accent-deep)] text-white border-transparent'
                  : 'bg-[var(--ds-surface)] text-[var(--ds-text)] border-[var(--ds-border)] hover:bg-[var(--ds-raised)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        )}
          </div>
        )}

        {filteredHouses.length === 0 ? (
          hasSearched ? (
            // This used to be one sentence and a full stop, and its comment
            // said no action was offered because there was none to offer —
            // the reader already had the filters that produced the emptiness.
            //
            // That was true of the filters and false of the catalogue. Pima
            // has houses in one governorate and the filter lists twenty-seven,
            // so an empty result here is usually not a bad search: it is a
            // place Pima has not reached. The reader is the only one who can
            // say that place is worth reaching, and this is the one moment
            // they are certain to be asked.
            <NoResultsRequest
              currentUser={currentUser}
              // The filter's governorate when they used it, and otherwise
              // whatever place their typing was reaching for. Without the
              // second half almost every request would arrive with no place
              // on it: the suggestion list is built from governorates that
              // have houses, so the one case this screen exists for is the
              // one case it cannot suggest, and «المنيا» stays free text.
              governorate={selectedGov || matchGovernorate(searchQuery, GOVERNORATES) || ''}
              checkIn={filterCheckIn}
              checkOut={filterCheckOut}
              guests={guestCount === '' ? null : guestCount}
              query={searchQuery}
            />
          ) : (
            // Nothing was searched for and the list is still empty, so the
            // catalogue itself is empty. A different sentence — the old one
            // blamed «معايير بحثك الحالية» for a search nobody ran — and
            // nothing to ask for, because there is no place to ask about.
            <Card>
              <EmptyState title="لسه مفيش بيوت معروضة." />
            </Card>
          )
        ) : (
          // One card per row was fine on a phone but wasted a desktop: each
          // card stretched to the full width and its photo was cropped to a
          // 6.7:1 strip. Columns are what absorb the extra width — the page
          // itself stays full-bleed.
          <div ref={cardGridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                // pima-reveal is an entrance only — the observer adds .is-in as
                // the card scrolls in and then stops watching it. Nothing about
                // the card's own layout, colour or type is touched.
                // --pima-panel-w is the details panel's width, declared once
                // here because two things depend on it: the panel, and the
                // offset that keeps the favourite button clear of it. Written
                // as a literal in both places they drift, and the drift is the
                // heart sliding back under the glass.
                // A percentage with a floor. 41% is where the information stops
                // stacking on itself — narrower and «عرض التفاصيل» and «٣٩٥ ج.م»
                // start wrapping — and the floor keeps a 320px phone above the
                // same limit, where a flat 41% would be 121px.
                style={{ ['--pima-panel-w' as string]: 'max(41%, 132px)' }}
                // The panel used to set this. Now that it floats, the card needs a
                // shape of its own — and the brief asks for «نفس مقاس الكارت
                // الحالي», so it keeps the ratio it already had. min-height is
                // the floor the panel's own content needs on a narrow phone.
                className="pima-reveal relative w-full aspect-[1.58/1] min-h-[248px] bg-[#2A2A20] rounded-3xl border border-[#3C3C2E] shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03)] overflow-hidden active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)] cursor-pointer group"
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
                <div className="absolute top-3 left-3 right-[calc(var(--pima-panel-w)+7rem)] max-[374px]:right-[calc(var(--pima-panel-w)+4.5rem)] flex items-center gap-1.5 overflow-hidden">
                  <span className="shrink-0 bg-[var(--ds-surface)]/95 backdrop-blur-sm text-[var(--ds-text)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{arabicDecimal(house.rating)}</span>
                  </span>
                  {/* Only when it is actually live. A discount badge on a
                      house whose offer has ended, or has not started, is a
                      price the guest cannot get — and they find out at the
                      last screen. hasLiveDiscount checks the window against
                      today, the same way the booking price will. */}
                  {hasLiveDiscount(house) && (
                    <span className="bg-[var(--ds-accent-deep)] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <Sparkles className="w-3 h-3" />
                      خصم {arabicNumber(Math.round((house.discountPct ?? 0) * 100))}٪
                    </span>
                  )}
                </div>

                {/* The photograph carries no location pills any more.
                    «الإسكندرية» was on one of them AND on the line under the
                    house name inside the panel — the same fact twice on a card
                    the size of a thumbnail, once over the picture it was
                    hiding. The panel's copy is the one that stays, because it
                    sits with the name it belongs to.

                    The owner's landmark («المنتزه») went with the row it
                    shared. It is not repeated anywhere, so if it comes back it
                    comes back inside the panel, not over the photograph. */}

                {/* Favourite + compare — the only two actions on the photo.
                    They sat at right-3, which in RTL is exactly where the
                    details panel sits: the panel paints over them, and a tap
                    on the heart landed on the house name inside the glass and
                    opened the house instead. Offset by the panel's own width
                    so they stay on the photograph at any card size — the one
                    place they can be tapped. */}
                <div className="absolute top-2.5 right-[calc(var(--pima-panel-w)+0.75rem)] z-10 flex items-center gap-0 max-[374px]:flex-col">
                  <button
                    id={`toggle-fav-card-${house.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening house details
                      tapFeedback();
                      onToggleFavorite(house.id);
                    }}
                    className="w-11 h-11 grid place-items-center cursor-pointer group/fav"
                    title={currentUser?.favorites?.includes(house.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    aria-label={currentUser?.favorites?.includes(house.id) ? `إزالة ${house.name} من المفضلة` : `إضافة ${house.name} للمفضلة`}
                  >
                    <span className="w-8 h-8 rounded-full bg-[var(--ds-surface)]/95 group-hover/fav:bg-[var(--ds-surface)] grid place-items-center shadow transition-colors duration-200">
                      <Heart className={`w-3.5 h-3.5 ${currentUser?.favorites?.includes(house.id) ? 'fill-rose-500 text-rose-500' : 'text-[var(--ds-text-faint)]'}`} />
                    </span>
                  </button>

                  <button
                    id={`toggle-compare-card-${house.id}`}
                    type="button"
                    onClick={(e) => handleToggleCompare(house.id, e)}
                    className="w-11 h-11 grid place-items-center cursor-pointer group/cmp"
                    title={comparedHouseIds.includes(house.id) ? 'إزالة من المقارنة' : 'إضافة للمقارنة والمفاضلة'}
                    aria-label={comparedHouseIds.includes(house.id) ? `إزالة ${house.name} من المقارنة` : `إضافة ${house.name} للمقارنة`}
                    aria-pressed={comparedHouseIds.includes(house.id)}
                  >
                    <span className={`w-8 h-8 rounded-full grid place-items-center shadow transition-colors duration-200 ${
                      comparedHouseIds.includes(house.id)
                        ? 'bg-amber-600 text-white group-hover/cmp:bg-amber-700'
                        : 'bg-[var(--ds-surface)]/95 text-[var(--ds-text-faint)] group-hover/cmp:text-[var(--ds-primary)] group-hover/cmp:bg-[var(--ds-surface)]'
                    }`}>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </div>

                {/* Status badges — only what the guest is filtering on right now
                    (real availability) and what tells them the listing is a
                    different kind of place. Amenities stay inside. */}
                <div className="absolute top-11 left-3 right-[calc(var(--pima-panel-w)+7rem)] max-[374px]:right-[calc(var(--pima-panel-w)+4.5rem)] flex flex-col gap-1 items-start overflow-hidden">
                  {house.badge && HOUSE_BADGES[house.badge] && (
                    <span className={`max-w-full backdrop-blur-sm text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow ${HOUSE_BADGES[house.badge].cls}`}>
                      <span className="truncate">{HOUSE_BADGES[house.badge].label}</span>
                    </span>
                  )}
                  {availability !== null && (
                    <span className="bg-[var(--ds-success)]/95 backdrop-blur-sm text-[var(--ds-on-success)] text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                      ✓ متاح في تواريخك
                    </span>
                  )}

                  {house.propertyType === 'student' && (
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-sm text-white ${house.studentHousingGender === 'girls' ? 'bg-[#9C4B64]' : 'bg-[#4B6B9C]'}`}>
                      {house.studentHousingGender === 'girls' ? 'سكن طالبات ♀' : 'سكن طلاب ♂'}
                    </span>
                  )}
                  {house.propertyType === 'staff' && (
                    <span className="bg-[#4B7C6B] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                      سكن موظفين ومغتربين
                    </span>
                  )}
                </div>

                {/* Details panel — frosted glass floating over the photo.
                    It used to sit in flow and set the card's height, so it ran
                    the full height edge to edge and read as a grey slab bolted
                    to the side. Floating it free of every edge fixed that and
                    cost something else: a 10px seam of photograph ran down the
                    outside of the pane and across its top and bottom, too thin
                    to show anything and enough to make the panel look like it
                    had come loose.

                    So it is flush on three sides — top, bottom, and the card's
                    own start edge — and rounded only on the edge that faces the
                    picture. The card clips the other corners with its own
                    radius, which is what makes the two read as one shape. */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {/* Frosted glass, not a dark rectangle. The tint is a cool
                      navy rather than plain black: over the warm photographs
                      owners upload, black alone reads as a muddy brown smear
                      and stops looking like glass. The inset highlight is the
                      lit top edge every real pane has, and it is what keeps the
                      panel from looking painted on.
                      shadow-[...] carries both, because Tailwind takes one
                      box-shadow property. */}
                  <div
                    className="pointer-events-auto self-stretch overflow-hidden rounded-e-[22px] border-s-0 border border-white/[0.22] backdrop-blur-[24px] px-2.5 py-2.5 flex flex-col justify-center gap-1
                               shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_30px_rgba(0,0,0,0.12)]"
                    style={{ width: 'var(--pima-panel-w)', backgroundColor: 'rgba(20, 32, 40, 0.30)' }}
                  >
                    {/* leading-[1.9], not leading-snug. Cairo asks for about
                        1.9× its size in Arabic, and line-clamp clips at the
                        line box — so «كينج» lost the tail of its ج on every
                        card whose name happens to carry a descender. */}
                    <h3 className="text-[12px] font-black text-white leading-[1.45] pb-0.5 line-clamp-2">
                      {house.name}
                    </h3>

                    {/* Governorate only, and now the only place the card says
                        where it is. The full «landmark — governorate» made this
                        the longest line in the panel and it truncated on every
                        card, which is why it is still only the governorate. */}
                    <p className="flex items-center gap-1 text-[11px] font-bold text-white/70 leading-[1.5]">
                      <MapPin className="w-3 h-3 text-[#E8C88A] shrink-0" />
                      <span className="truncate">{house.governorate}</span>
                    </p>

                    <span aria-hidden="true" className="block h-px bg-white/20" />

                    {/* Three, and only three. A fourth and a fifth turned this
                        row into a legend to be decoded rather than a glance. */}
                    <div className="flex items-start gap-1.5">
                      <div className="flex flex-col items-center">
                        <span className="w-6 h-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                          <Users className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[11px] font-black text-white leading-none">
                          {arabicNumber(house.propertyType === 'student' || house.propertyType === 'staff' ? house.roomCapacity : house.bedsCount)}
                        </span>
                        <span className="text-[11px] font-bold text-white/70">
                          {house.propertyType === 'student' || house.propertyType === 'staff' ? 'بالغرفة' : 'فرد'}
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="w-6 h-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                          <BedDouble className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[11px] font-black text-white leading-none">{arabicNumber(house.roomsCount)}</span>
                        <span className="text-[11px] font-bold text-white/70">غرف</span>
                      </div>

                      {(house.services.includes('موقف مجاني') || house.services.includes('جراج خاص')) && (
                        <div className="flex flex-col items-center">
                          <span className="w-6 h-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                            <SquareParking className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11px] font-bold text-white/70 text-center whitespace-nowrap">
                            {house.services.includes('موقف مجاني') ? 'موقف' : 'جراج'}
                          </span>
                        </div>
                      )}

                      {/* The third slot, and only if the first two left one:
                          wifi steps in when the house has no parking so the
                          row is three or two, never a gap where one was. The
                          «يوم روحي» badge that used to live here is gone — the
                          day rate now has a box of its own below, and saying
                          it twice was saying it once too many. */}
                      {!(house.services.includes('موقف مجاني') || house.services.includes('جراج خاص'))
                        && house.services.includes('واي فاي') && (
                        <div className="flex flex-col items-center">
                          <span className="w-6 h-6 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white">
                            <Wifi className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11px] font-bold text-white/70 text-center whitespace-nowrap">واي فاي</span>
                        </div>
                      )}
                    </div>

                    {/* The rates. In RTL the first box is the RIGHT one, so
                        the night — the rate every house has — leads, and the
                        day sits beside it where a house sells one. A house
                        that does not gets one full-width box rather than an
                        empty half pretending to be a choice. */}
                    <div className="flex items-stretch gap-1.5">
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? (
                        <PriceBox icon={BedDouble} label="شهر" value={house.monthlyRent ?? 0} />
                      ) : (
                        <>
                          <PriceBox icon={BedDouble} label="ليلة" value={house.pricePerNightPerPerson} />
                          {offersDayUse(house) && (
                            <PriceBox icon={Sun} label="يوم" value={house.dayUsePricePerPerson as number} />
                          )}
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
                                <span className="text-[11px] font-bold text-white/70">الإجمالي</span>
                                <span className="text-[12px] font-black text-white leading-none">
                                  {arabicNumber(total)}
                                </span>
                                <span className="text-[11px] font-bold text-white/70">ج.م</span>
                              </div>
                              <span className="text-[11px] font-bold text-white/60">
                                {arabicPlural(partySize, GUEST_FORMS)} × {stayNights === 1 ? 'ليلة' : stayNights === 2 ? 'ليلتين' : `${arabicNumber(stayNights)} ليالي`}
                              </span>
                            </div>
                          )}

                          {/* Does it fit? Only answerable once they've said how many. */}
                          {hasBeds && partySize > 0 && (
                            short > 0 ? (
                              <span className="block text-[11px] font-black text-amber-300">
                                ينقص {bedsLabel(short)} عن عددكم
                              </span>
                            ) : (
                              <span className="block text-[11px] font-black text-emerald-300">
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
                            <span className="block text-[11px] font-bold text-white/60">البيت شبه فاضي في تواريخكم</span>
                          )}
                          {short <= 0 && freeShare !== null && freeShare <= 0.4 && (
                            <span className="block text-[11px] font-bold text-white/60">
                              محجوز {Math.round((1 - freeShare) * 100)}٪ في تواريخكم
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* The arrow was absolutely positioned and the label was
                        centred under it. That was fine on a wide panel and stops
                        being fine as the panel narrows for the photograph's sake:
                        the two meet in the middle and the arrow sits on the ع.
                        A flex row cannot overlap itself. */}
                    <div className="flex items-center justify-center gap-1.5 bg-gradient-to-l from-[var(--ds-accent-deep)] to-[var(--ds-accent)] text-white rounded-full px-2 py-1 mt-0.5">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-black/25 flex items-center justify-center">
                        <ArrowLeft className="w-3 h-3" />
                      </span>
                      {/* No truncate, deliberately: if this ever stops fitting it
                          should be caught by the overflow check, not quietly
                          shortened to «عرض التفا…» — which is how it reached a
                          screenshot once. */}
                      <span className="text-[11px] font-extrabold whitespace-nowrap">عرض التفاصيل</span>
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
        <div className="sticky bottom-2 z-35 bg-[var(--ds-surface)] border border-[var(--ds-border)] rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 animate-bounce-once">
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
                    className="relative w-8 h-8 rounded-xl overflow-hidden border border-[var(--ds-border)] group/thumb cursor-pointer"
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
              <span className="text-[11px] font-extrabold text-[var(--ds-text)] block">
                {comparedHouseIds.length} من ٣ للمقارنة
              </span>
              <span className="text-[11px] text-[var(--ds-text-2)] font-bold">
                {comparedHouseIds.length < 2 ? 'اختر بيتًا آخر على الأقل' : 'اضغط على صورة لإزالتها'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setComparedHouseIds([])}
              className="text-[var(--ds-text-2)] hover:text-rose-300 text-[11px] font-bold px-2 py-1.5 rounded-xl hover:bg-rose-900/20 transition-all cursor-pointer"
            >
              مسح
            </button>
            <button
              onClick={() => setShowComparisonModal(true)}
              disabled={comparedHouseIds.length < 2}
              className="bg-[var(--ds-primary)] hover:bg-[var(--ds-text)] disabled:bg-[color-mix(in_srgb,var(--ds-primary)_70%,black)] disabled:text-[var(--ds-text-2)] disabled:cursor-not-allowed text-[var(--ds-on-primary)] text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>قارن</span>
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal — a full-screen overlay; `fixed` takes it out of the
          capped panel, so it still covers the whole viewport. */}
      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 text-right">
          <div className="bg-[var(--ds-bg)] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[var(--ds-border)] animate-scale-up">
            {/* Header */}
            <div className="bg-[var(--ds-primary)] text-[var(--ds-on-primary)] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-200" />
                <h3 className="text-xs font-extrabold">مقارنة بيوت الخلوة والمؤتمرات 📊</h3>
              </div>
              <button aria-label="إغلاق المقارنة"
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
              return (
                <div className="p-4 overflow-y-auto space-y-3 text-[11px] leading-relaxed">
                  {/* Header: photo + name per column */}
                  <div className="grid gap-2" style={cols}>
                    {picked.map((h) => (
                      <div key={h.id} className="text-center space-y-1">
                        <div className="h-14 bg-[#2A2A20] rounded-xl overflow-hidden border border-[var(--ds-border)]">
                          <img referrerPolicy="no-referrer" loading="lazy" src={h.images[0]} alt={h.name} className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-extrabold text-[var(--ds-text)] line-clamp-2 leading-tight text-[11px]">{h.name}</h4>
                      </div>
                    ))}
                  </div>

                  <Band cols={cols} label="الموقع">
                    {picked.map((h) => (
                      <span key={h.id} className="font-bold text-[var(--ds-text)] text-center block">{h.governorate}</span>
                    ))}
                  </Band>

                  {/* On a mixed set the band label can't name one unit without
                      lying about the other column, so it goes neutral and each
                      value carries its own unit instead. */}
                  <Band cols={cols} label={!sameBasis ? 'السعر' : picked.every(isMonthly) ? 'الإيجار الشهري' : 'السعر لليلة للفرد'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${cheapest !== null && priceOf(h) === cheapest ? 'text-emerald-300' : 'text-[#E4E1CB]'}`}>
                          {priceOf(h)} ج.م
                        </span>
                        {!sameBasis && (
                          <span className="text-[11px] text-[var(--ds-text-2)] font-bold">{isMonthly(h) ? 'شهريًا' : 'لليلة للفرد'}</span>
                        )}
                        {cheapest !== null && priceOf(h) === cheapest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band cols={cols} label={!sameBasis ? 'السعة' : picked.every(isMonthly) ? 'سعة الغرفة' : 'عدد الأسرّة'}>
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className={`font-black ${roomiest !== null && capacityOf(h) === roomiest ? 'text-emerald-300' : 'text-[var(--ds-text)]'}`}>
                          {capacityOf(h)}
                        </span>
                        {!sameBasis && (
                          <span className="text-[11px] text-[var(--ds-text-2)] font-bold">{isMonthly(h) ? 'بالغرفة' : 'سرير'}</span>
                        )}
                        {roomiest !== null && capacityOf(h) === roomiest && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band cols={cols} label="التقييم">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                          {arabicDecimal(h.rating)}
                        </span>
                        {topRated !== null && h.rating === topRated && <Win />}
                      </div>
                    ))}
                  </Band>

                  <Band cols={cols} label="الفئات المناسبة">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.suitability.map((s) => (
                          <span key={s} className="bg-[var(--ds-text-2)]/25 text-[var(--ds-text)] text-[11px] px-1 py-0.5 rounded-sm font-semibold">
                            {SUITABILITY_MAP[s]}
                          </span>
                        ))}
                      </div>
                    ))}
                  </Band>

                  <Band cols={cols} label="الخدمات">
                    {picked.map((h) => (
                      <div key={h.id} className="flex flex-wrap gap-0.5 justify-center content-start">
                        {h.services.slice(0, 2).map((s) => (
                          <span key={s} className="bg-emerald-900/30 text-emerald-200 text-[11px] px-1 py-0.5 rounded-sm font-bold">
                            {s}
                          </span>
                        ))}
                        {h.services.length > 2 && (
                          <span className="text-[11px] text-[var(--ds-text-2)] font-bold px-1 py-0.5">+{h.services.length - 2}</span>
                        )}
                      </div>
                    ))}
                  </Band>

                  {!sameBasis && (
                    <p className="text-[11px] text-[var(--ds-text-2)] font-bold text-center bg-[var(--ds-raised)] rounded-xl p-2">
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
                        className="w-full bg-[var(--ds-primary)] hover:bg-[var(--ds-text)] text-[var(--ds-on-primary)] text-[11px] font-bold py-1.5 rounded-xl transition-all text-center cursor-pointer"
                      >
                        عرض التفاصيل
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="bg-[#2A2A20] p-3 text-center border-t border-[var(--ds-border)]">
              <button
                onClick={() => setShowComparisonModal(false)}
                className="bg-[var(--ds-surface)] border border-[var(--ds-border)] text-[var(--ds-text)] hover:bg-[var(--ds-raised)] text-[11px] font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                إغلاق المقارنة
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

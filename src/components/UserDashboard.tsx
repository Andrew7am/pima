import React, { useState } from 'react';
import { PlatformAnnouncement, RetreatHouse, User } from '../types';
import { GOVERNORATES, AMENITIES_LIST, SUITABILITY_MAP } from '../mockData';
import { Search, MapPin, SlidersHorizontal, Grid, Star, Sparkles, Building, Waves, Trees, Check, GraduationCap, Briefcase, Home, Wifi, Wind, Users, Award, ChevronLeft, Heart, Scale, Layers, X, ArrowLeftRight } from 'lucide-react';
import AnnouncementCarousel from './AnnouncementCarousel';

interface UserDashboardProps {
  houses: RetreatHouse[];
  currentUser: User;
  onSelectHouse: (house: RetreatHouse) => void;
  onSelectRewards: () => void;
  onToggleFavorite: (houseId: string) => void;
  platformAnnouncements?: PlatformAnnouncement[];
}

export default function UserDashboard({
  houses,
  currentUser,
  onSelectHouse,
  onSelectRewards,
  onToggleFavorite,
  platformAnnouncements = []
}: UserDashboardProps) {
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
        const userFavs = currentUser.favorites || [];
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

    return matchesSearch && matchesGov && matchesGuests && matchesPrice && matchesSuitability && matchesAmenities;
  });

  return (
    <div className="space-y-4 text-right">
      
      {/* Top banner: rotates through admin-published announcements every ~6s,
          always falls back to the welcome message when none are active */}
      <AnnouncementCarousel
        currentUser={currentUser}
        announcements={platformAnnouncements}
        houses={houses}
        onSelectHouse={onSelectHouse}
      />

      {/* Loyalty/Rewards Status Bar card */}
      {currentUser.role !== 'owner' && (
        <div 
          id="loyalty-card-trigger"
          onClick={onSelectRewards} 
          className="bg-white hover:bg-[#FDFBF7] transition-all rounded-xl p-2 px-3 border border-[#D6D6C2] flex justify-between items-center cursor-pointer shadow-xs select-none"
        >
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-lg bg-amber-50 border border-amber-200">
              <Award className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            </div>
            <div className="text-right">
              <span className="text-[8.5px] text-[#8A8A70] block font-bold">برنامج مكافآت ونقاط الولاء:</span>
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] font-black text-[#4A4A3A]">رصيد نقاطك: {(currentUser.points || 0).toLocaleString('ar-EG')} نقطة</span>
                <span className="text-[7.5px] font-black text-[#C5A059] bg-[#0A2342] px-1.5 py-0.2 rounded-full">
                  {(currentUser.points || 0) >= 1000 ? 'المستوى الذهبي 🥇' : (currentUser.points || 0) >= 500 ? 'المستوى الفضي 🥈' : 'المستوى البرونزي 🥉'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-[8.5px] text-[#5A5A40] font-bold flex items-center gap-0.5">
            <span>التفاصيل</span>
            <ChevronLeft className="w-2.5 h-2.5" />
          </div>
        </div>
      )}

      {/* Category Tabs Selection */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-[#F3F0E8] border border-[#E7E5DB] rounded-2xl">
        <button
          onClick={() => setSelectedType('all')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'all'
              ? 'bg-[#464E3D] text-white shadow-sm'
              : 'text-[#2D2D24] hover:bg-[#E7E2D5]'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>الكل</span>
        </button>
        <button
          onClick={() => setSelectedType('conference')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'conference'
              ? 'bg-[#464E3D] text-white shadow-sm'
              : 'text-[#2D2D24] hover:bg-[#E7E2D5]'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>مؤتمرات</span>
        </button>
        <button
          onClick={() => setSelectedType('student')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'student'
              ? 'bg-[#464E3D] text-white shadow-sm'
              : 'text-[#2D2D24] hover:bg-[#E7E2D5]'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>سكن طلاب</span>
        </button>
        <button
          onClick={() => setSelectedType('staff')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'staff'
              ? 'bg-[#464E3D] text-white shadow-sm'
              : 'text-[#2D2D24] hover:bg-[#E7E2D5]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>موظفين</span>
        </button>
        <button
          id="tab-favorites"
          onClick={() => setSelectedType('favorites')}
          className={`py-2 px-1 rounded-xl text-[8.5px] font-extrabold transition-all duration-200 flex flex-col items-center gap-1 cursor-pointer ${
            selectedType === 'favorites'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-[#2D2D24] hover:bg-[#E7E2D5]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${selectedType === 'favorites' ? 'fill-white text-white' : 'text-rose-500 fill-rose-500'}`} />
          <span>المفضلة</span>
        </button>
      </div>

      {/* Search Bar & Filters Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="user-search-query"
            type="text"
            placeholder="ابحث باسم البيت، المحافظة، الكلمات المفتاحية..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#D6D6C2] rounded-2xl py-2 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none shadow-sm"
          />
          <Search className="absolute top-2.5 right-3 w-4 h-4 text-[#BCBC9D]" />
        </div>

        {/* Filters Toggle Button */}
        <button
          id="toggle-filters-btn"
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-2xl border transition-all ${
            showFilters ? 'bg-[#5A5A40] border-[#5A5A40] text-white' : 'bg-white border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB]'
          }`}
          title="فلاتر متقدمة"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Advanced Filters Expandable Drawer */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-4 border border-[#D6D6C2] shadow-md space-y-4 text-xs text-[#4A4A3A] animate-in slide-in-from-top-3 duration-200">
          <div className="text-xs font-bold text-[#4A4A3A] pb-2 border-b border-[#D6D6C2]">فلاتر البحث التفصيلية:</div>

          <div className="grid grid-cols-2 gap-3">
            {/* Governorate filter */}
            <div>
              <label className="block text-[10px] text-[#8A8A70] mb-1 font-bold">المحافظة:</label>
              <select
                id="filter-gov-select"
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="w-full bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-[#4A4A3A] focus:outline-none"
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
                className="w-full bg-white border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-[#4A4A3A] focus:outline-none"
              />
            </div>
          </div>

          {/* Price night range slider */}
          <div>
            <div className="flex justify-between text-[10px] text-[#8A8A70] font-bold mb-1">
              <span>الحد الأقصى لسعر الفرد/ليلة:</span>
              <span className="text-[#4A4A3A] font-extrabold">{maxPrice} ج.م</span>
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
                        : 'bg-[#F9F9F4] border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB]'
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
                        : 'bg-[#EBEBE0] border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#DEDECB]'
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
                        ? 'bg-[#EBEBE0] border-[#BCBC9D] text-[#5A5A40]' 
                        : 'bg-white border-[#D6D6C2] text-[#8A8A70] hover:bg-[#DEDECB]'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#5A5A40] border-[#5A5A40] text-white' : 'bg-white border-[#D6D6C2]'
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
          <div className="flex justify-end pt-2 border-t border-[#D6D6C2]">
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
              className="text-[10px] text-[#8A8A70] hover:text-[#4A4A3A] font-bold"
            >
              إعادة تعيين كافة الفلاتر
            </button>
          </div>
        </div>
      )}

      {/* Houses Feed List */}
      <div className="space-y-3.5 text-[#4A4A3A]">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-extrabold text-[#4A4A3A]">الأماكن المتاحة ({filteredHouses.length}):</span>
          <span className="text-[11px] text-[#8A8A70]">مرتبة حسب الأفضل تقييماً</span>
        </div>

        {filteredHouses.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-[#D6D6C2] text-center space-y-2">
            <p className="text-xs font-bold text-[#4A4A3A]">عذراً، لم نجد بيوت مؤتمرات تطابق معايير بحثك الحالية.</p>
            <p className="text-[10px] text-[#8A8A70]">جرب البحث بكلمات أبسط أو تخفيف فلاتر التصفية.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHouses.map((house) => (
              <div
                id={`house-card-${house.id}`}
                key={house.id}
                onClick={() => onSelectHouse(house)}
                className="bg-white rounded-3xl border border-[#D6D6C2] shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col group"
              >
                {/* Image & rating */}
                <div className="relative h-44 bg-[#EBEBE0] overflow-hidden">
                  <img
                    referrerPolicy="no-referrer"
                    src={house.images[0]}
                    alt={house.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Location badge */}
                  <span className="absolute top-3 right-3 bg-[#5A5A40]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full animate-fade-in">
                    {house.governorate}
                  </span>

                  {/* Rating tag */}
                  <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[#4A4A3A] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{house.rating.toFixed(1)}</span>
                  </span>

                  {/* Heart button */}
                  <button
                    id={`toggle-fav-card-${house.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening house details
                      onToggleFavorite(house.id);
                    }}
                    className="absolute top-2.5 left-16 bg-white/95 hover:bg-white text-rose-500 hover:text-rose-600 p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer"
                    title={currentUser.favorites?.includes(house.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${currentUser.favorites?.includes(house.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                  </button>

                  {/* Comparison button */}
                  <button
                    id={`toggle-compare-card-${house.id}`}
                    type="button"
                    onClick={(e) => handleToggleCompare(house.id, e)}
                    className={`absolute top-2.5 left-27 p-1.5 rounded-full flex items-center justify-center shadow transition-all duration-200 cursor-pointer ${
                      comparedHouseIds.includes(house.id) 
                        ? 'bg-amber-600 text-white hover:bg-amber-700' 
                        : 'bg-white/95 text-slate-400 hover:text-[#5A5A40] hover:bg-white'
                    }`}
                    title={comparedHouseIds.includes(house.id) ? 'إزالة من المقارنة' : 'إضافة للمقارنة والمفاضلة'}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Property type or student gender badges */}
                  <div className="absolute top-12 right-3 flex flex-col gap-1 items-end">
                    {house.propertyType === 'student' && (
                      <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm text-white ${house.studentHousingGender === 'girls' ? 'bg-[#9C4B64]' : 'bg-[#4B6B9C]'}`}>
                        {house.studentHousingGender === 'girls' ? 'سكن طالبات ♀' : 'سكن طلاب ♂'}
                      </span>
                    )}
                    {house.propertyType === 'staff' && (
                      <span className="bg-[#4B7C6B] text-white text-[8.5px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                        سكن موظفين ومغتربين 💼
                      </span>
                    )}
                    {house.distanceFromUniversity && (
                      <span className="bg-[#EBEBE0]/90 backdrop-blur-sm text-[#4A4A3A] text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {house.distanceFromUniversity}
                      </span>
                    )}
                  </div>

                  {/* Suitability tags overlay */}
                  <div className="absolute bottom-3 right-3 flex flex-wrap gap-1">
                    {house.suitability.slice(0, 2).map((suit) => (
                      <span key={suit} className="bg-[#8A8A70]/90 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">
                        {SUITABILITY_MAP[suit]}
                      </span>
                    ))}
                  </div>

                  {/* Sea proximity overlay badge */}
                  {house.seaProximity && house.seaProximity !== 'far' && (
                    <span className="absolute bottom-3 left-3 bg-blue-900/90 backdrop-blur-sm text-amber-200 text-[9px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                      {house.seaProximity === 'beach' && '🏖️ على الشاطئ مباشرة'}
                      {house.seaProximity === 'view' && '🌅 إطلالة على البحر'}
                      {house.seaProximity === 'near' && '🌊 قريب من البحر'}
                    </span>
                  )}
                </div>

                {/* Details info */}
                <div className="p-4 space-y-2">
                  <h3 className="text-xs font-bold text-[#4A4A3A] line-clamp-1 group-hover:text-[#5A5A40] transition-colors">
                    {house.name}
                  </h3>
                  
                  <p className="text-[11px] text-[#8A8A70] line-clamp-2 leading-relaxed">
                    {house.description}
                  </p>

                  <div className="flex justify-between items-center pt-2.5 border-t border-[#D6D6C2] text-[10px] font-semibold text-[#8A8A70]">
                    <div className="flex gap-2">
                      <span>• {house.roomsCount} غرفة</span>
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? (
                        <span>• سعة {house.roomCapacity} أفراد / غرفة</span>
                      ) : (
                        <span>• {house.bedsCount} سرير</span>
                      )}
                    </div>

                    <div className="text-[#4A4A3A] font-extrabold text-xs">
                      {house.propertyType === 'student' || house.propertyType === 'staff' ? (
                        <>
                          <span>{house.monthlyRent} ج.م</span>
                          <span className="text-[9px] text-[#8A8A70] font-medium"> / شهرياً</span>
                        </>
                      ) : (
                        <>
                          <span>{house.pricePerNightPerPerson} ج.م</span>
                          <span className="text-[9px] text-[#8A8A70] font-medium"> / ليلة للفرد</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compare Floating Bar */}
      {comparedHouseIds.length > 0 && (
        <div className="sticky bottom-2 z-35 bg-white border border-[#D6D6C2] rounded-2xl p-3.5 shadow-lg flex items-center justify-between gap-3 animate-bounce-once">
          <div className="flex items-center gap-2">
            <div className="bg-amber-50 p-1.5 rounded-xl border border-amber-200">
              <Scale className="w-4 h-4 text-amber-700 animate-pulse" />
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#8A8A70] font-black block">مقارنة الخلوات المحددة:</span>
              <span className="text-[11px] font-extrabold text-[#4A4A3A]">لقد اخترت {comparedHouseIds.length} من أصل ٣ بيوت للمقارنة</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setComparedHouseIds([])}
              className="text-[#8A8A70] hover:text-rose-600 text-[10px] font-bold px-2 py-1.5 rounded-xl hover:bg-rose-50 transition-all cursor-pointer"
            >
              مسح الكل
            </button>
            <button
              onClick={() => setShowComparisonModal(true)}
              className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>مقارنة الآن 📊</span>
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 text-right">
          <div className="bg-[#FAF8F5] rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#D6D6C2] animate-scale-up">
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

            {/* Comparison Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-[10px] leading-relaxed">
              <p className="text-[#8A8A70] text-center font-bold text-[9.5px]">قارن بين أفضل الميزات والأسعار لاختيار البيت الأنسب لخدمتك وكنيستك.</p>
              
              <div className="grid grid-cols-3 gap-2.5 items-stretch">
                {comparedHouseIds.map((id) => {
                  const compHouse = houses.find(h => h.id === id);
                  if (!compHouse) return null;

                  return (
                    <div key={id} className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden flex flex-col justify-between shadow-xs">
                      {/* Photo & Name */}
                      <div className="space-y-1">
                        <div className="h-16 bg-[#EBEBE0] relative">
                          <img
                            referrerPolicy="no-referrer"
                            src={compHouse.images[0]}
                            alt={compHouse.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2 text-center">
                          <h4 className="font-extrabold text-[#4A4A3A] line-clamp-2 h-7 leading-tight">{compHouse.name}</h4>
                        </div>
                      </div>

                      {/* Info points */}
                      <div className="border-t border-[#EBEBE0] p-2 space-y-2 bg-[#FAF8F5]/50 flex-1">
                        <div>
                          <span className="text-[8px] text-[#8A8A70] block">الموقع والمدينة:</span>
                          <span className="font-bold text-[#4A4A3A]">{compHouse.governorate}</span>
                        </div>

                        <div className="border-t border-[#EBEBE0]/80 pt-1">
                          <span className="text-[8px] text-[#8A8A70] block">السعر المقدر للفرد:</span>
                          <span className="font-black text-[#5A5A40]">
                            {compHouse.propertyType === 'student' || compHouse.propertyType === 'staff' 
                              ? `${compHouse.monthlyRent} ج.م` 
                              : `${compHouse.pricePerNightPerPerson} ج.م`}
                          </span>
                        </div>

                        <div className="border-t border-[#EBEBE0]/80 pt-1">
                          <span className="text-[8px] text-[#8A8A70] block">إجمالي السعة الاستيعابية:</span>
                          <span className="font-bold text-[#4A4A3A]">
                            {compHouse.propertyType === 'student' || compHouse.propertyType === 'staff'
                              ? `${compHouse.roomCapacity} غ`
                              : `${compHouse.bedsCount} س`}
                          </span>
                        </div>

                        <div className="border-t border-[#EBEBE0]/80 pt-1">
                          <span className="text-[8px] text-[#8A8A70] block">التقييم العام:</span>
                          <span className="font-black text-amber-600 flex items-center gap-0.5 justify-center">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
                            <span>{compHouse.rating.toFixed(1)}</span>
                          </span>
                        </div>

                        <div className="border-t border-[#EBEBE0]/80 pt-1">
                          <span className="text-[8px] text-[#8A8A70] block">الفئات المناسبة:</span>
                          <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                            {compHouse.suitability.map(s => (
                              <span key={s} className="bg-[#8A8A70]/15 text-[#5A5A40] text-[7.5px] px-1 py-0.5 rounded-sm font-semibold">
                                {SUITABILITY_MAP[s]}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-[#EBEBE0]/80 pt-1">
                          <span className="text-[8px] text-[#8A8A70] block">أبرز الخدمات:</span>
                          <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                            {compHouse.services.slice(0, 2).map(s => (
                              <span key={s} className="bg-emerald-50 text-emerald-800 text-[7px] px-1 py-0.5 rounded-sm font-bold">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="p-2 bg-white border-t border-[#EBEBE0]">
                        <button
                          onClick={() => {
                            onSelectHouse(compHouse);
                            setShowComparisonModal(false);
                          }}
                          className="w-full bg-[#5A5A40] hover:bg-[#4A4A3A] text-white text-[9px] font-bold py-1.5 rounded-xl transition-all text-center cursor-pointer"
                        >
                          عرض وتفاصيل الحجز
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#EBEBE0] p-3 text-center border-t border-[#D6D6C2]">
              <button
                onClick={() => setShowComparisonModal(false)}
                className="bg-white border border-[#D6D6C2] text-[#4A4A3A] hover:bg-[#FAF8F5] text-[10px] font-bold px-4 py-1.5 rounded-xl transition-all cursor-pointer"
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

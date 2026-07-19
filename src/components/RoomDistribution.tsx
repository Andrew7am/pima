import React, { useState, useEffect } from 'react';
import { Booking, User, Attendee, RoomAllocation, RetreatHouse, Room } from '../types';
import {
  Users, Check, Plus, Trash2, Shield, Settings, Shuffle, ArrowLeftRight,
  UserMinus, UserPlus, AlertTriangle, Sparkles, RefreshCw, X, ChevronDown, CheckCircle, Save, Minus
} from 'lucide-react';
import { autoAllocate, quickAssignRoom } from '../lib/roomAllocation';
import { getRoomFreeBedsForRange } from '../lib/roomOccupancy';

// Deterministic room generator
export interface HouseRoom {
  id: string;
  name: string;
  capacity: number;
}

export function generateHouseRooms(houseId: string, roomsCount: number, bedsCount: number): HouseRoom[] {
  const rooms: HouseRoom[] = [];
  let remainingBeds = bedsCount;
  let remainingRooms = roomsCount;
  
  for (let i = 1; i <= roomsCount; i++) {
    if (i === roomsCount) {
      rooms.push({
        id: `${houseId}_room_${i}`,
        name: remainingBeds > 5 ? `جناح ${100 + i}` : `غرفة ${100 + i}`,
        capacity: Math.max(1, remainingBeds)
      });
      break;
    }
    
    // Determine this room's capacity with some variety
    let capacity = 2;
    const averageBedsPerRoom = remainingBeds / remainingRooms;
    
    if (averageBedsPerRoom >= 5) {
      capacity = 6;
    } else if (averageBedsPerRoom >= 4) {
      capacity = 4;
    } else if (averageBedsPerRoom >= 3) {
      capacity = 3;
    } else if (averageBedsPerRoom >= 2) {
      capacity = 2;
    } else {
      capacity = 1;
    }
    
    capacity = Math.min(remainingBeds - (remainingRooms - 1), capacity);
    capacity = Math.max(1, capacity);
    
    rooms.push({
      id: `${houseId}_room_${i}`,
      name: capacity > 4 ? `جناح ${100 + i}` : `غرفة ${100 + i}`,
      capacity: capacity
    });
    
    remainingBeds -= capacity;
    remainingRooms--;
  }
  
  return rooms;
}

// Original packing algorithm, kept verbatim as the fallback for houses that
// haven't configured real Room rows yet (generateHouseRooms's virtual list
// has no dates/other-booking awareness, so the real-room engine in
// lib/roomAllocation.ts doesn't apply to it).
function legacyAutoAllocate(
  rooms: HouseRoom[],
  attendees: Attendee[],
  separateGenders: boolean,
  groupTypesTogether: boolean,
  bookingId: string
): RoomAllocation[] {
  const sortedRooms = [...rooms].sort((a, b) => b.capacity - a.capacity);
  const tempAllocations: RoomAllocation[] = [];

  if (separateGenders) {
    const males = attendees.filter(a => a.gender === 'male');
    const females = attendees.filter(a => a.gender === 'female');

    if (groupTypesTogether) {
      males.sort((a, b) => a.groupType.localeCompare(b.groupType));
      females.sort((a, b) => a.groupType.localeCompare(b.groupType));
    }

    const roomOccupancies: { [roomId: string]: { currentCount: number; assignedGender: 'male' | 'female' | null } } = {};
    sortedRooms.forEach(r => {
      roomOccupancies[r.id] = { currentCount: 0, assignedGender: null };
    });

    let maleIdx = 0;
    for (const room of sortedRooms) {
      if (maleIdx >= males.length) break;
      const occupancy = roomOccupancies[room.id];
      if (occupancy.assignedGender === null || occupancy.assignedGender === 'male') {
        occupancy.assignedGender = 'male';
        const availableBeds = room.capacity - occupancy.currentCount;
        for (let bed = 1; bed <= availableBeds; bed++) {
          if (maleIdx >= males.length) break;
          const attendee = males[maleIdx++];
          tempAllocations.push({
            id: `alloc_${bookingId}_${attendee.id}_${Date.now()}`,
            bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: occupancy.currentCount + 1
          });
          occupancy.currentCount++;
        }
      }
    }

    let femaleIdx = 0;
    for (const room of sortedRooms) {
      if (femaleIdx >= females.length) break;
      const occupancy = roomOccupancies[room.id];
      if (occupancy.assignedGender === null) {
        occupancy.assignedGender = 'female';
        const availableBeds = room.capacity - occupancy.currentCount;
        for (let bed = 1; bed <= availableBeds; bed++) {
          if (femaleIdx >= females.length) break;
          const attendee = females[femaleIdx++];
          tempAllocations.push({
            id: `alloc_${bookingId}_${attendee.id}_${Date.now()}`,
            bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: occupancy.currentCount + 1
          });
          occupancy.currentCount++;
        }
      }
    }

    const unassignedMales = males.slice(maleIdx);
    const unassignedFemales = females.slice(femaleIdx);
    const allUnassigned = [...unassignedMales, ...unassignedFemales];

    if (allUnassigned.length > 0) {
      for (const room of sortedRooms) {
        const occupancy = roomOccupancies[room.id];
        const availableBeds = room.capacity - occupancy.currentCount;
        if (availableBeds > 0) {
          for (let bed = 1; bed <= availableBeds; bed++) {
            if (allUnassigned.length === 0) break;
            const attendee = allUnassigned.shift()!;
            tempAllocations.push({
              id: `alloc_${bookingId}_${attendee.id}_${Date.now()}`,
              bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: occupancy.currentCount + 1
            });
            occupancy.currentCount++;
          }
        }
      }
    }
  } else {
    const sortedAttendees = [...attendees];
    if (groupTypesTogether) {
      sortedAttendees.sort((a, b) => a.groupType.localeCompare(b.groupType));
    }

    let attIdx = 0;
    for (const room of sortedRooms) {
      if (attIdx >= sortedAttendees.length) break;
      for (let bed = 1; bed <= room.capacity; bed++) {
        if (attIdx >= sortedAttendees.length) break;
        const attendee = sortedAttendees[attIdx++];
        tempAllocations.push({
          id: `alloc_${bookingId}_${attendee.id}_${Date.now()}`,
          bookingId, attendeeId: attendee.id, roomId: room.id, bedNumber: bed
        });
      }
    }
  }

  return tempAllocations;
}

const COPTIC_MOCK_NAMES = [
  { name: 'مينا جرجس', gender: 'male', groupType: 'youth' },
  { name: 'كيرلس مجدي', gender: 'male', groupType: 'youth' },
  { name: 'مريم يوسف', gender: 'female', groupType: 'youth' },
  { name: 'ابانوب عادل', gender: 'male', groupType: 'youth' },
  { name: 'دميانة سمير', gender: 'female', groupType: 'youth' },
  { name: 'شنودة مكرم', gender: 'male', groupType: 'other' },
  { name: 'توني أشرف', gender: 'male', groupType: 'youth' },
  { name: 'يوستينا رافت', gender: 'female', groupType: 'youth' },
  { name: 'مارك عاطف', gender: 'male', groupType: 'youth' },
  { name: 'مارينا وحيد', gender: 'female', groupType: 'youth' },
  { name: 'جون فايز', gender: 'male', groupType: 'youth' },
  { name: 'فبرونيا عماد', gender: 'female', groupType: 'youth' },
  { name: 'بيشوي صفوت', gender: 'male', groupType: 'family' },
  { name: 'مريم صفوت', gender: 'female', groupType: 'family' },
  { name: 'الطفل ديفيد بيشوي', gender: 'male', groupType: 'child' },
  { name: 'الطفلة ساندي بيشوي', gender: 'female', groupType: 'child' },
  { name: 'جرجس ابراهيم', gender: 'male', groupType: 'family' },
  { name: 'تريزا عزمي', gender: 'female', groupType: 'family' },
  { name: 'توماس جرجس', gender: 'male', groupType: 'child' },
  { name: 'روماني نبيل', gender: 'male', groupType: 'youth' },
  { name: 'ماري منير', gender: 'female', groupType: 'youth' },
  { name: 'فادي هاني', gender: 'male', groupType: 'youth' },
  { name: 'كيرلس عماد', gender: 'male', groupType: 'youth' },
  { name: 'سارة منصف', gender: 'female', groupType: 'youth' },
  { name: 'مايكل سعيد', gender: 'male', groupType: 'other' },
  { name: 'سوزان مكرم', gender: 'female', groupType: 'family' },
  { name: 'الطفل فيلوبتير مايكل', gender: 'male', groupType: 'child' },
  { name: 'ايرين فوزي', gender: 'female', groupType: 'other' },
  { name: 'بيتر بهجت', gender: 'male', groupType: 'youth' },
  { name: 'كرستينا ناصف', gender: 'female', groupType: 'youth' }
];

interface RoomDistributionProps {
  booking: Booking;
  house: RetreatHouse;
  currentUser: User;
  onClose: () => void;
  globalAttendees: Attendee[];
  globalAllocations: RoomAllocation[];
  onUpdateAttendees: (bookingId: string, attendees: Attendee[]) => void;
  onUpdateAllocations: (bookingId: string, allocations: RoomAllocation[]) => void;
  houseRooms?: Room[];
  allBookings?: Booking[];
}

export default function RoomDistribution({
  booking,
  house,
  currentUser,
  onClose,
  globalAttendees,
  globalAllocations,
  onUpdateAttendees,
  onUpdateAllocations,
  houseRooms = [],
  allBookings = [],
}: RoomDistributionProps) {
  // Local state initialized from globals
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [allocations, setAllocations] = useState<RoomAllocation[]>([]);

  // Real rooms (if this house has configured any) drive quick-mode + the
  // date-aware Smart/Comfort engine; otherwise fall back to the legacy
  // virtual-room algorithm unchanged.
  const realRoomsAvailable = houseRooms.length > 0;
  const [distributionMode, setDistributionMode] = useState<'quick' | 'detailed'>(realRoomsAvailable ? 'quick' : 'detailed');
  const [allocMode, setAllocMode] = useState<'smart' | 'comfort'>('smart');

  // Configuration states
  const [separateGenders, setSeparateGenders] = useState(true);
  const [groupTypesTogether, setGroupTypesTogether] = useState(true);
  
  // Input fields for adding/editing attendees
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female'>('male');
  const [newGroupType, setNewGroupType] = useState<'youth' | 'family' | 'child' | 'other'>('youth');
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);

  // Active interaction states
  const [selectedAttendeeForMove, setSelectedAttendeeForMove] = useState<Attendee | null>(null);
  const [swapSourceAttendee, setSwapSourceAttendee] = useState<Attendee | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Load house rooms — real rooms (with per-date free-bed awareness) if the
  // house has configured any, else the legacy generated/virtual list.
  const rooms: HouseRoom[] = realRoomsAvailable
    ? houseRooms.map((r) => ({ id: r.id, name: r.name, capacity: r.bedsCount }))
    : generateHouseRooms(house.id, house.roomsCount, house.bedsCount);
  const totalBedsAvailable = realRoomsAvailable
    ? houseRooms.reduce((s, r) => s + r.bedsCount, 0)
    : house.bedsCount;

  // Load attendees and allocations for this specific booking on mount
  useEffect(() => {
    const bookingAttendees = globalAttendees.filter(a => a.bookingId === booking.id);
    const bookingAllocations = globalAllocations.filter(al => al.bookingId === booking.id);
    
    setAttendees(bookingAttendees);
    setAllocations(bookingAllocations);
  }, [globalAttendees, globalAllocations, booking.id]);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Generate mock attendees automatically to make it easy for testing
  const handleGenerateMockAttendees = () => {
    const needed = booking.guestsCount;
    const generated: Attendee[] = [];
    
    for (let i = 0; i < needed; i++) {
      const template = COPTIC_MOCK_NAMES[i % COPTIC_MOCK_NAMES.length];
      // Generate slightly unique names if we exceed list length
      const nameSuffix = i >= COPTIC_MOCK_NAMES.length ? ` ${Math.floor(i / COPTIC_MOCK_NAMES.length) + 1}` : '';
      generated.push({
        id: `att_${booking.id}_${i}_${Date.now()}`,
        bookingId: booking.id,
        name: `${template.name}${nameSuffix}`,
        gender: template.gender as 'male' | 'female',
        groupType: template.groupType as 'youth' | 'family' | 'child' | 'other'
      });
    }

    setAttendees(generated);
    setAllocations([]); // Reset allocations on regen
    onUpdateAttendees(booking.id, generated);
    onUpdateAllocations(booking.id, []);
    showToast(`تم توليد قائمة حضور تحتوي على ${generated.length} اسم افتراضي بنجاح! 🎉`, 'success');
  };

  // Add a single attendee manually
  const handleAddAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (editingAttendeeId) {
      // Editing mode
      const updated = attendees.map(a => {
        if (a.id === editingAttendeeId) {
          return { ...a, name: newName.trim(), gender: newGender, groupType: newGroupType };
        }
        return a;
      });
      setAttendees(updated);
      onUpdateAttendees(booking.id, updated);
      setEditingAttendeeId(null);
      showToast('تم تعديل بيانات الزائر بنجاح.', 'success');
    } else {
      // Create mode
      if (attendees.length >= booking.guestsCount) {
        showToast(`تنبيه: لقد تجاوزت العدد المحجوز في الفاتورة (${booking.guestsCount} فرد). يمكنك المتابعة ولكن يرجى مراجعة الاستقبال.`, 'warning');
      }

      const newAttendee: Attendee = {
        id: `att_${booking.id}_${Date.now()}`,
        bookingId: booking.id,
        name: newName.trim(),
        gender: newGender,
        groupType: newGroupType
      };

      const updated = [...attendees, newAttendee];
      setAttendees(updated);
      onUpdateAttendees(booking.id, updated);
      showToast('تمت إضافة الحاضر بنجاح.', 'success');
    }

    setNewName('');
    setNewGender('male');
    setNewGroupType('youth');
  };

  // Start editing attendee
  const startEditAttendee = (attendee: Attendee) => {
    setEditingAttendeeId(attendee.id);
    setNewName(attendee.name);
    setNewGender(attendee.gender);
    setNewGroupType(attendee.groupType);
  };

  // Delete attendee
  const handleDeleteAttendee = (id: string) => {
    const updatedAttendees = attendees.filter(a => a.id !== id);
    const updatedAllocations = allocations.filter(al => al.attendeeId !== id);
    
    setAttendees(updatedAttendees);
    setAllocations(updatedAllocations);
    
    onUpdateAttendees(booking.id, updatedAttendees);
    onUpdateAllocations(booking.id, updatedAllocations);
    
    showToast('تم حذف الزائر وإلغاء تسكينه إن وجد.', 'info');
  };

  // Clear all attendees and allocations
  const handleResetAll = () => {
    if (confirm('هل أنت متأكد من رغبتك في مسح قائمة الحضور بالكامل وإعادة ضبط التوزيع؟')) {
      setAttendees([]);
      setAllocations([]);
      onUpdateAttendees(booking.id, []);
      onUpdateAllocations(booking.id, []);
      showToast('تمت إعادة الضبط بنجاح.', 'info');
    }
  };

  // Clear room allocations only
  const handleClearAllocationsOnly = () => {
    setAllocations([]);
    onUpdateAllocations(booking.id, []);
    showToast('تم مسح جميع التسكينات وتفريغ الغرف.', 'info');
  };

  // MAIN AUTO-ALLOCATION ALGORITHM — real rooms use the date-aware Smart/
  // Comfort engine (lib/roomAllocation.ts); virtual rooms keep the original
  // algorithm unchanged (legacyAutoAllocate).
  const handleAutoAllocate = () => {
    if (attendees.length === 0) {
      showToast('خطأ: لا يوجد حضور مسجلون لتوزيعهم. الرجاء إضافة حضور أولاً أو توليد قائمة افتراضية.', 'warning');
      return;
    }

    const tempAllocations: RoomAllocation[] = realRoomsAvailable
      ? autoAllocate(attendees, houseRooms, allBookings, globalAllocations, booking.id, {
          mode: allocMode, separateGenders, groupTypesTogether,
          checkIn: booking.checkIn, checkOut: booking.checkOut, houseId: house.id,
        })
      : legacyAutoAllocate(rooms, attendees, separateGenders, groupTypesTogether, booking.id);

    setAllocations(tempAllocations);
    onUpdateAllocations(booking.id, tempAllocations);

    const assignedCount = tempAllocations.length;
    const missingCount = attendees.length - assignedCount;

    if (missingCount > 0) {
      showToast(`تم توزيع ${assignedCount} فرد بنجاح! تنبيه: لم يتم تسكين ${missingCount} فرد لعدم كفاية الأسرة المتاحة${realRoomsAvailable ? ' في هذه التواريخ' : ' بالبيت'}.`, 'warning');
    } else {
      showToast(`رائع! تم التوزيع التلقائي الذكي لجميع الزوار (${assignedCount} فرد) بالكامل بنجاح! 🛏️✨`, 'success');
    }
  };

  // QUICK MODE — bed-count steppers per room, no named roster required.
  const handleQuickAdjust = (room: HouseRoom, delta: number) => {
    const realRoom = houseRooms.find((r) => r.id === room.id);
    if (!realRoom) return;
    if (delta > 0) {
      const freeForOthers = getRoomFreeBedsForRange(realRoom, globalAllocations, allBookings, booking.checkIn, booking.checkOut, booking.id);
      const currentInRoom = allocations.filter((al) => al.roomId === room.id).length;
      if (currentInRoom >= freeForOthers) {
        showToast(`لا توجد أسرة متاحة إضافية في ${room.name} لهذه التواريخ.`, 'warning');
        return;
      }
    }
    const result = quickAssignRoom(attendees, allocations, realRoom, delta, booking.id);
    setAttendees(result.attendees);
    setAllocations(result.allocations);
    onUpdateAttendees(booking.id, result.attendees);
    onUpdateAllocations(booking.id, result.allocations);
  };

  // Helper to check what room an attendee is currently in
  const getAttendeeAllocation = (attendeeId: string) => {
    return allocations.find(al => al.attendeeId === attendeeId);
  };

  // Manual movement of attendee to a specific room
  const handleMoveAttendee = (attendeeId: string, targetRoomId: string | 'unassigned') => {
    // Check if target is 'unassigned' (meaning removing them from any room)
    if (targetRoomId === 'unassigned') {
      const updated = allocations.filter(al => al.attendeeId !== attendeeId);
      setAllocations(updated);
      onUpdateAllocations(booking.id, updated);
      showToast('تم إلغاء تسكين الشخص وإعادته للقائمة.', 'info');
      setSelectedAttendeeForMove(null);
      return;
    }

    const targetRoom = rooms.find(r => r.id === targetRoomId);
    if (!targetRoom) return;

    // Check capacity of target room — for real rooms, respect what OTHER
    // bookings already hold for these dates, not just a flat capacity.
    const currentAllocatedCount = allocations.filter(al => al.roomId === targetRoomId && al.attendeeId !== attendeeId).length;
    const realTargetRoom = houseRooms.find((r) => r.id === targetRoomId);
    const effectiveCapacity = realTargetRoom
      ? getRoomFreeBedsForRange(realTargetRoom, globalAllocations, allBookings, booking.checkIn, booking.checkOut, booking.id) + currentAllocatedCount
      : targetRoom.capacity;
    if (currentAllocatedCount >= effectiveCapacity) {
      showToast(`خطأ: لا يمكن تسكين الشخص في ${targetRoom.name} لأنها ممتلئة بالكامل (${effectiveCapacity}/${targetRoom.capacity} أسرة متاحة).`, 'warning');
      return;
    }

    // Remove old allocation if any
    const baseAllocations = allocations.filter(al => al.attendeeId !== attendeeId);
    
    // Find next available bed number in target room
    const occupiedBedNumbers = baseAllocations.filter(al => al.roomId === targetRoomId).map(al => al.bedNumber);
    let nextBed = 1;
    while (occupiedBedNumbers.includes(nextBed)) {
      nextBed++;
    }

    const newAlloc: RoomAllocation = {
      id: `alloc_${booking.id}_${attendeeId}_${Date.now()}`,
      bookingId: booking.id,
      attendeeId,
      roomId: targetRoomId,
      bedNumber: nextBed
    };

    const updated = [...baseAllocations, newAlloc];
    setAllocations(updated);
    onUpdateAllocations(booking.id, updated);
    
    const attendeeName = attendees.find(a => a.id === attendeeId)?.name || 'الزائر';
    showToast(`تم نقل ${attendeeName} إلى ${targetRoom.name} بنجاح.`, 'success');
    setSelectedAttendeeForMove(null);
  };

  // Swap attendees between rooms
  const handleSwapAttendees = (att1: Attendee, att2: Attendee) => {
    const alloc1 = allocations.find(al => al.attendeeId === att1.id);
    const alloc2 = allocations.find(al => al.attendeeId === att2.id);

    // If neither is allocated, we cannot swap rooms
    if (!alloc1 && !alloc2) {
      showToast('خطأ: لا يمكن التبديل لأن كلا الشخصين غير مسكنين في غرف.', 'warning');
      return;
    }

    let updated = [...allocations];

    // Remove old allocations
    updated = updated.filter(al => al.attendeeId !== att1.id && al.attendeeId !== att2.id);

    if (alloc1) {
      // Put attendee 2 in attendee 1's old spot
      updated.push({
        ...alloc1,
        id: `alloc_${booking.id}_${att2.id}_${Date.now()}`,
        attendeeId: att2.id
      });
    }

    if (alloc2) {
      // Put attendee 1 in attendee 2's old spot
      updated.push({
        ...alloc2,
        id: `alloc_${booking.id}_${att1.id}_${Date.now() + 1}`,
        attendeeId: att1.id
      });
    }

    setAllocations(updated);
    onUpdateAllocations(booking.id, updated);
    showToast(`تم تبديل التسكين بين ${att1.name} و ${att2.name} بنجاح! 🔄`, 'success');
    setSwapSourceAttendee(null);
  };

  // Helper to translate GroupType
  const getGroupTypeLabel = (gt: Attendee['groupType']) => {
    switch (gt) {
      case 'youth': return 'شباب';
      case 'family': return 'عائلة';
      case 'child': return 'طفل';
      case 'other': return 'أخرى';
    }
  };

  const getGroupTypeColor = (gt: Attendee['groupType']) => {
    switch (gt) {
      case 'youth': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'family': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'child': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'other': return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const isInsufficientBeds = attendees.length > totalBedsAvailable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#FDFBF7] md:rounded-[32px] w-full max-w-2xl h-full md:h-[780px] border border-[#D6D6C2] flex flex-col overflow-hidden relative shadow-2xl text-right animate-in fade-in duration-200">
        
        {/* Floating Top Toast Banner */}
        {toastMessage && (
          <div className="absolute top-16 left-4 right-4 z-50 p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-lg animate-in slide-in-from-top-4 duration-300 bg-white">
            <span className="text-sm">
              {toastMessage.type === 'success' && '✅'}
              {toastMessage.type === 'warning' && '⚠️'}
              {toastMessage.type === 'info' && '💡'}
            </span>
            <div className="flex-1 text-[#4A4A3A]">{toastMessage.text}</div>
            <button onClick={() => setToastMessage(null)} className="text-[#8A8A70] hover:text-[#4A4A3A]">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-[#4A4A3A] text-white px-5 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">نظام التوزيع التلقائي الذكي للغرف</h3>
              <p className="text-[10px] text-white/80 font-medium">مؤتمر: {booking.houseName} | {booking.guestsCount} فرد</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            id="close-allocation-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          
          {/* House overall bed capability warning */}
          {isInsufficientBeds && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] text-amber-900 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold">تحذير السعة الاستيعابية:</span> إجمالي عدد الزوار المطلوب تسكينهم ({attendees.length} فرد) يتخطى إجمالي عدد الأسرة المتاحة في هذا البيت ({totalBedsAvailable} سرير). سيتم توزيع الأفراد حتى اكتمال السعة فقط.
              </div>
            </div>
          )}

          {/* Mode toggle — quick (bed-count only) vs detailed (named roster) */}
          {realRoomsAvailable && (
            <div className="bg-white rounded-2xl p-2 border border-[#D6D6C2] shadow-sm flex items-center gap-2">
              {([
                { key: 'quick', label: 'توزيع سريع (عدد الأسرة)' },
                { key: 'detailed', label: 'توزيع مفصّل (بالأسماء)' },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  id={`mode-${m.key}-btn`}
                  type="button"
                  onClick={() => setDistributionMode(m.key)}
                  className={`flex-1 text-[10px] font-extrabold py-2 rounded-xl transition-all cursor-pointer ${
                    distributionMode === m.key ? 'bg-[#5A5A40] text-white' : 'bg-[#FBFBFA] text-[#8A8A70] border border-[#D6D6C2]/60'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Quick Auto-Allocate Config Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
            <h4 className="text-xs font-black text-[#4A4A3A] flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-[#8A8A70]" />
              <span>خيارات وقواعد التسكين التلقائي:</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-[10.5px] font-bold text-[#4A4A3A]">
              <label className="flex items-center gap-2 cursor-pointer bg-[#FBFBFA] border border-[#D6D6C2]/60 p-2 rounded-xl hover:bg-[#EBEBE0]/20">
                <input
                  id="sep-genders-cb"
                  type="checkbox"
                  checked={separateGenders}
                  onChange={(e) => setSeparateGenders(e.target.checked)}
                  className="w-4 h-4 accent-[#5A5A40] cursor-pointer"
                />
                <span>فصل الجنسين (رجال / سيدات)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-[#FBFBFA] border border-[#D6D6C2]/60 p-2 rounded-xl hover:bg-[#EBEBE0]/20">
                <input
                  id="group-together-cb"
                  type="checkbox"
                  checked={groupTypesTogether}
                  onChange={(e) => setGroupTypesTogether(e.target.checked)}
                  className="w-4 h-4 accent-[#5A5A40] cursor-pointer"
                />
                <span>تجميع الفئات المتشابهة معاً</span>
              </label>
            </div>

            {realRoomsAvailable && (
              <div className="flex items-center gap-2 pt-2 border-t border-[#D6D6C2]/40 text-[10px] font-bold text-[#4A4A3A]">
                <span className="text-[#8A8A70]">نمط التوزيع:</span>
                {([
                  { key: 'smart', label: 'ذكي (أقل عدد غرف)' },
                  { key: 'comfort', label: 'مريح (مساحة أكبر)' },
                ] as const).map((m) => (
                  <label key={m.key} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="alloc-mode" checked={allocMode === m.key} onChange={() => setAllocMode(m.key)} className="accent-[#5A5A40] cursor-pointer" />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D6D6C2]/40">
              <div className="text-[10px] text-[#8A8A70] font-bold">
                توزيع ذكي مبرمج للغرف بضغطة واحدة
              </div>

              <div className="flex gap-2">
                {allocations.length > 0 && (
                  <button
                    id="clear-all-allocations-btn"
                    onClick={handleClearAllocationsOnly}
                    className="bg-[#FBFBFA] hover:bg-[#EBEBE0]/50 border border-[#D6D6C2] text-rose-700 font-extrabold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تفريغ الغرف</span>
                  </button>
                )}
                
                <button
                  id="auto-assign-rooms-btn"
                  onClick={handleAutoAllocate}
                  className="bg-[#5A5A40] hover:bg-[#4A4A3A] text-white font-extrabold px-4 py-1.5 rounded-xl text-[10px] shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>تسكين تلقائي للغرف</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Attendee Manager Section */}
          <div className="bg-white rounded-2xl p-4 border border-[#D6D6C2] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#D6D6C2]/40 pb-2">
              <h4 className="text-xs font-black text-[#4A4A3A] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#8A8A70]" />
                <span>مسجلي المؤتمر ({attendees.length} / {booking.guestsCount} فرد):</span>
              </h4>
              
              {attendees.length === 0 && (
                <button
                  id="generate-mock-attendees"
                  onClick={handleGenerateMockAttendees}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-black px-2.5 py-1 rounded-xl text-[9px] transition-all cursor-pointer flex items-center gap-1 animate-pulse"
                >
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  <span>توليد كشف حضور تلقائي</span>
                </button>
              )}
            </div>

            {/* Form to Add / Edit attendee */}
            <form onSubmit={handleAddAttendee} className="bg-[#FBFBFA] p-2.5 rounded-xl border border-[#D6D6C2]/60 grid grid-cols-12 gap-2 text-[10px]">
              <div className="col-span-5">
                <label className="block text-[#8A8A70] font-bold mb-0.5">اسم الزائر ثنائي:</label>
                <input
                  id="attendee-input-name"
                  type="text"
                  required
                  placeholder="مثال: يوسف ماهر"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-[#D6D6C2] text-xs px-2 py-1.5 rounded-lg text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-bold"
                />
              </div>

              <div className="col-span-3">
                <label className="block text-[#8A8A70] font-bold mb-0.5">النوع:</label>
                <select
                  id="attendee-input-gender"
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as 'male' | 'female')}
                  className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-bold"
                >
                  <option value="male">ذكر (رجال)</option>
                  <option value="female">أنثى (سيدات)</option>
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-[#8A8A70] font-bold mb-0.5">الفئة:</label>
                <select
                  id="attendee-input-group"
                  value={newGroupType}
                  onChange={(e) => setNewGroupType(e.target.value as any)}
                  className="w-full bg-white border border-[#D6D6C2] text-[10px] px-2 py-1.5 rounded-lg text-[#4A4A3A] focus:outline-none focus:border-[#5A5A40] font-bold"
                >
                  <option value="youth">شباب</option>
                  <option value="family">أسر / عائلات</option>
                  <option value="child">أطفال</option>
                  <option value="other">خدام / أخرى</option>
                </select>
              </div>

              <div className="col-span-1 flex items-end justify-center">
                <button
                  id="save-attendee-btn"
                  type="submit"
                  className="w-full h-8 bg-[#5A5A40] hover:bg-[#4A4A3A] text-white rounded-lg flex items-center justify-center font-bold cursor-pointer transition-colors"
                  title={editingAttendeeId ? "تعديل الحاضر" : "إضافة الحاضر"}
                >
                  {editingAttendeeId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </form>

            {/* List of Attendees (Scrollable horizontal/compact) */}
            {attendees.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                <div className="text-[9px] text-[#8A8A70] font-extrabold">الأسماء المقيدة بالكشف وحالة تسكينهم:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[10px]">
                  {attendees.map(att => {
                    const alloc = getAttendeeAllocation(att.id);
                    const roomName = alloc ? rooms.find(r => r.id === alloc.roomId)?.name : null;
                    const isSwapActive = swapSourceAttendee !== null && swapSourceAttendee.id !== att.id;

                    return (
                      <div key={att.id} className="flex items-center justify-between p-1.5 bg-[#FBFBFA] border border-[#D6D6C2]/50 rounded-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-[#4A4A3A]">{att.name}</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded border font-semibold ${getGroupTypeColor(att.groupType)}`}>
                            {getGroupTypeLabel(att.groupType)}
                          </span>
                          <span className="text-[8px] text-[#8A8A70]">
                            {att.gender === 'male' ? '👨' : '👩'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {roomName ? (
                            <span className="text-[8px] font-bold bg-[#EBEBE0] text-[#5A5A40] px-1.5 py-0.5 rounded">
                              {roomName}
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                              غير مسكن
                            </span>
                          )}

                          {/* Action triggers */}
                          <div className="flex items-center gap-0.5 mr-1">
                            {/* Swap action button */}
                            {roomName && (
                              <button
                                onClick={() => {
                                  if (swapSourceAttendee) {
                                    handleSwapAttendees(swapSourceAttendee, att);
                                  } else {
                                    setSwapSourceAttendee(att);
                                    showToast(`اختر شخصاً آخر لتبديل الغرفة مع ${att.name}`, 'info');
                                  }
                                }}
                                className={`p-1 rounded hover:bg-slate-100 ${swapSourceAttendee?.id === att.id ? 'bg-amber-100 text-amber-700' : 'text-slate-600'}`}
                                title="تبديل مع زائر آخر"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            )}

                            {/* Edit */}
                            <button onClick={() => startEditAttendee(att)} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="تعديل">
                              <span className="text-[9px]">⚙️</span>
                            </button>

                            {/* Delete */}
                            <button onClick={() => handleDeleteAttendee(att.id)} className="p-1 hover:bg-rose-50 rounded text-rose-700" title="مسح">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[9px] pt-1">
                  <span className="text-[#8A8A70] font-bold">* اضغط على زر 🔄 لتبديل الغرف بين الزوار بسهولة.</span>
                  <button onClick={handleResetAll} className="text-rose-700 hover:underline font-extrabold cursor-pointer">
                    مسح الكشف وإعادة التعيين بالكامل
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ROOM DISTRIBUTION DASHBOARD */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-[#4A4A3A] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-700" />
                <span>مخطط توزيع الغرف والمرافق (يوليو ٢٠٢٦):</span>
              </span>
              <span className="text-[9px] text-[#8A8A70] font-bold">
                إشغال: {allocations.length} / {totalBedsAvailable} سرير متاح
              </span>
            </h4>

            {/* Quick mode: bed-count steppers per room, no named roster needed */}
            {distributionMode === 'quick' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" dir="rtl">
                {rooms.map((room) => {
                  const used = allocations.filter((al) => al.roomId === room.id).length;
                  const realRoom = houseRooms.find((r) => r.id === room.id);
                  const freeForOthers = realRoom
                    ? getRoomFreeBedsForRange(realRoom, globalAllocations, allBookings, booking.checkIn, booking.checkOut, booking.id)
                    : room.capacity;
                  const cap = Math.min(room.capacity, freeForOthers + used);
                  return (
                    <div key={room.id} className={`bg-white rounded-2xl border p-3 space-y-2 ${used >= cap ? 'border-[#5A5A40]/40 bg-[#EBEBE0]/10' : 'border-[#D6D6C2]'}`}>
                      <div className="text-xs font-extrabold text-[#4A4A3A]">{room.name}</div>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => handleQuickAdjust(room, -1)} disabled={used <= 0}
                          className="w-7 h-7 rounded-lg bg-[#FBFBFA] border border-[#D6D6C2] flex items-center justify-center disabled:opacity-30 cursor-pointer">
                          <Minus className="w-3.5 h-3.5 text-[#4A4A3A]" />
                        </button>
                        <span className="text-sm font-black text-[#4A4A3A]">{used} / {cap}</span>
                        <button type="button" onClick={() => handleQuickAdjust(room, 1)} disabled={used >= cap}
                          className="w-7 h-7 rounded-lg bg-[#5A5A40] flex items-center justify-center disabled:opacity-30 cursor-pointer">
                          <Plus className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Detailed mode: Room Distribution Grid with named attendees */}
            {distributionMode === 'detailed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
              {rooms.map(room => {
                const roomAllocations = allocations.filter(al => al.roomId === room.id);
                const assignedAttendees = roomAllocations.map(al => attendees.find(a => a.id === al.attendeeId)).filter(Boolean) as Attendee[];
                const remaining = room.capacity - roomAllocations.length;
                
                // Determine room gender profile (if any)
                const genders = assignedAttendees.map(a => a.gender);
                const isAllMale = genders.length > 0 && genders.every(g => g === 'male');
                const isAllFemale = genders.length > 0 && genders.every(g => g === 'female');
                const isMixed = genders.length > 0 && !isAllMale && !isAllFemale;

                return (
                  <div 
                    key={room.id}
                    className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all shadow-sm ${
                      remaining === 0 
                        ? 'border-[#5A5A40]/40 bg-[#EBEBE0]/10' 
                        : 'border-[#D6D6C2] hover:border-[#8A8A70]'
                    }`}
                  >
                    {/* Room Header Info */}
                    <div className="flex items-start justify-between pb-2 border-b border-[#D6D6C2]/40">
                      <div>
                        <div className="font-extrabold text-[#4A4A3A] text-xs flex items-center gap-1">
                          <span>{room.name}</span>
                          {isAllMale && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-black">رجال</span>}
                          {isAllFemale && <span className="text-[8px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-black">سيدات</span>}
                          {isMixed && <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.2 rounded font-black">مختلط</span>}
                        </div>
                        <span className="text-[9px] text-[#8A8A70] font-bold">السعة الكلية: {room.capacity} سرير</span>
                      </div>

                      <div className="text-right">
                        {remaining === 0 ? (
                          <span className="text-[8px] bg-[#5A5A40] text-white px-1.5 py-0.5 rounded font-black">
                            ممتلئة بالكامل
                          </span>
                        ) : (
                          <span className="text-[8px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded font-black">
                            متاح {remaining} أسرة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assigned Attendees List */}
                    <div className="py-2.5 space-y-1.5 min-h-[60px]">
                      {assignedAttendees.length === 0 ? (
                        <div className="text-center py-3 text-[9px] text-[#8A8A70] font-semibold">
                          لا يوجد أي فرد مسكن في هذه الغرفة حالياً
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {assignedAttendees.map((att, index) => {
                            const bedAlloc = roomAllocations.find(al => al.attendeeId === att.id);
                            return (
                              <div key={att.id} className="flex items-center justify-between text-[10px] bg-[#FBFBFA] p-1.5 rounded-lg border border-[#D6D6C2]/40">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#8A8A70] font-bold text-[9px]">سرير {bedAlloc?.bedNumber}:</span>
                                  <span className="font-black text-[#4A4A3A]">{att.name}</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className={`text-[7.5px] px-1 rounded font-bold ${getGroupTypeColor(att.groupType)}`}>
                                    {getGroupTypeLabel(att.groupType)}
                                  </span>

                                  {/* Remove from room button */}
                                  <button
                                    onClick={() => handleMoveAttendee(att.id, 'unassigned')}
                                    className="p-0.5 hover:bg-rose-50 text-rose-700 rounded"
                                    title="إزالة من الغرفة"
                                  >
                                    <UserMinus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick Move/Settle Actions inside the card */}
                    <div className="pt-2 border-t border-[#D6D6C2]/40 flex justify-between items-center text-[10px]">
                      <span className="text-[8.5px] text-[#8A8A70] font-bold">تسكين يدوي سريع:</span>
                      
                      <div className="flex gap-1.5">
                        {/* Dropdown for non-assigned attendees to instantly add them */}
                        {remaining > 0 && (
                          <div className="relative">
                            <select
                              id={`assign-to-${room.id}`}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleMoveAttendee(e.target.value, room.id);
                                  e.target.value = ''; // Reset select
                                }
                              }}
                              className="bg-[#FBFBFA] border border-[#D6D6C2] text-[8.5px] font-black rounded-lg px-1.5 py-0.5 text-[#5A5A40] cursor-pointer focus:outline-none"
                              defaultValue=""
                            >
                              <option value="" disabled>+ تسكين فرد</option>
                              {attendees
                                .filter(att => !allocations.some(al => al.attendeeId === att.id))
                                .map(att => (
                                  <option key={att.id} value={att.id}>
                                    {att.name} ({att.gender === 'male' ? 'رجال' : 'سيدات'})
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
            )}
          </div>

        </div>

        {/* Modal Footer Summary */}
        <div className="bg-[#EBEBE0] p-4 border-t border-[#D6D6C2] flex justify-between items-center relative z-20">
          <div className="text-[10px] text-[#4A4A3A] font-bold space-y-0.5">
            <div>إجمالي الزوار المسجلين بكشف المؤتمر: <strong className="font-extrabold">{attendees.length} فرد</strong></div>
            <div>أفراد تم تسكينهم بالفعل: <strong className="font-extrabold text-[#5A5A40]">{allocations.length} / {attendees.length}</strong></div>
          </div>

          <button
            id="allocation-save-close-btn"
            onClick={onClose}
            className="bg-[#4A4A3A] hover:bg-[#3A3A2C] text-white px-5 py-2 rounded-xl text-xs font-black shadow transition-all cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>حفظ وتأكيد مخطط التوزيع</span>
          </button>
        </div>

      </div>
    </div>
  );
}

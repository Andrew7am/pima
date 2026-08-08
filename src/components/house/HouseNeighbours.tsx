import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getHouseNeighbours, type HouseNeighbour } from '../../lib/selfRegister';
import { arabicDateRange } from '../../lib/arabic';
import { BOOKING_GROUPS } from '../../lib/bookingGroups';

/**
 * Who else is in the building those nights.
 *
 * A servant bringing forty teenage girls has a right to know, before he
 * leaves Cairo, that a boys' secondary group shares the house. Today the only
 * person holding that fact is the owner, who has no reason to volunteer it,
 * and the servant finds out in a car park.
 *
 * It reads like a privacy leak until you invert it: this is a safeguarding
 * fact, and withholding it protects nobody.
 *
 * So it is aggregate only, and the SERVER enforces that rather than this
 * component being trusted to — get_house_neighbours (migration 111) returns
 * the kind of group and a size band, never an exact count, never the church,
 * the servant, a name or a phone, and it verifies the caller holds an
 * approved booking at that house before returning anything. There is
 * deliberately no way to contact the other group from here: knowing they are
 * there is the whole feature.
 */
export default function HouseNeighbours({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = useState<HouseNeighbour[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHouseNeighbours(bookingId).then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, [bookingId]);

  // Nothing while loading, and nothing when the house is theirs alone —
  // «مفيش حد معاكم» is a line nobody needs to read.
  if (!rows || rows.length === 0) return null;

  const label = (key: string) =>
    BOOKING_GROUPS.find((g) => g.key === key)?.label ?? 'مجموعة';

  return (
    <div className="bg-[#F7F5EF] border border-[#E7E5DB] rounded-2xl p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-black text-[#0A2342]">
        <Users className="w-3.5 h-3.5 text-[#C5A059]" />
        في البيت معاكم
      </div>
      {rows.map((n, i) => (
        <div key={i} className="text-[11px] text-[#4A4A3A] font-bold">
          {label(n.bookingType)} · {n.sizeBand} فرد
          <span className="text-[#8A8A70] font-medium"> · {arabicDateRange(n.checkIn, n.checkOut)}</span>
        </div>
      ))}
      <p className="text-[10px] text-[#8A8A70] leading-relaxed">
        بنقولك ده علشان تظبط الأدوار والإشراف بالليل. مفيش أي بيانات عن المجموعة التانية غير ده.
      </p>
    </div>
  );
}

import React, { useState } from 'react';
import { RetreatHouse } from '../../types';
import { Utensils, Check, X } from 'lucide-react';

interface OwnerFoodMenuProps {
  house?: RetreatHouse;
  onUpdateHouse?: (house: RetreatHouse) => void;
}

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

type MenuDay = { day: string; breakfast: string; lunch: string; dinner: string; price?: number };

function emptyWeek(): MenuDay[] {
  return WEEK_DAYS.map((day) => ({ day, breakfast: '', lunch: '', dinner: '' }));
}

export default function OwnerFoodMenu({ house, onUpdateHouse }: OwnerFoodMenuProps) {
  const [activeMenu, setActiveMenu] = useState<'regular' | 'fasting'>('regular');
  const [savedMsg, setSavedMsg] = useState('');

  if (!house) {
    return (
      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-8 text-center text-xs text-[var(--color-owner-secondary)]">
        أضف بيانات بيتك أولاً قبل إدارة قائمة الطعام.
      </div>
    );
  }

  const menu = house.menu ?? { isIncluded: true, allowsSpecialRequests: false, weeklyMenu: emptyWeek(), fastingWeeklyMenu: emptyWeek() };
  const days = activeMenu === 'regular' ? (menu.weeklyMenu ?? emptyWeek()) : (menu.fastingWeeklyMenu ?? emptyWeek());

  const commit = (nextMenu: RetreatHouse['menu']) => {
    onUpdateHouse?.({ ...house, menu: nextMenu });
    setSavedMsg('تم حفظ التعديل ✓');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const updateDay = (dayIndex: number, field: 'breakfast' | 'lunch' | 'dinner' | 'price', value: string) => {
    const listKey = activeMenu === 'regular' ? 'weeklyMenu' : 'fastingWeeklyMenu';
    const currentList = (activeMenu === 'regular' ? menu.weeklyMenu : menu.fastingWeeklyMenu) ?? emptyWeek();
    const updatedList = currentList.map((d, i) =>
      i === dayIndex ? { ...d, [field]: field === 'price' ? (value ? parseFloat(value) : undefined) : value } : d
    );
    commit({ ...menu, [listKey]: updatedList });
  };

  return (
    <div className="space-y-3">
      <div className="bg-[var(--color-owner-surface)] rounded-3xl border border-[var(--color-owner-border)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-[var(--color-owner-primary)]" />
          <span className="text-xs font-black text-[var(--color-owner-text)]">إعدادات الوجبات العامة</span>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px]">
          <button
            id="menu-toggle-included"
            type="button"
            onClick={() => commit({ ...menu, isIncluded: !menu.isIncluded })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition-all ${
              menu.isIncluded ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-[var(--color-owner-bg)] border-[var(--color-owner-border)] text-[var(--color-owner-secondary)]'
            }`}
          >
            {menu.isIncluded ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            الوجبات شاملة في السعر
          </button>
          <button
            id="menu-toggle-special"
            type="button"
            onClick={() => commit({ ...menu, allowsSpecialRequests: !menu.allowsSpecialRequests })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold cursor-pointer transition-all ${
              menu.allowsSpecialRequests ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-[var(--color-owner-bg)] border-[var(--color-owner-border)] text-[var(--color-owner-secondary)]'
            }`}
          >
            {menu.allowsSpecialRequests ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            يقبل طلبات خاصة (صيامي/نباتي)
          </button>
          {!menu.isIncluded && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-[var(--color-owner-secondary)]">سعر الوجبة الإضافية (ج.م):</label>
              <input
                id="menu-extra-price"
                type="number"
                min={0}
                value={menu.extraMealPrice ?? ''}
                onChange={(e) => commit({ ...menu, extraMealPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-20 bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[10px] px-2 py-1 rounded-lg text-[var(--color-owner-text)] focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          id="menu-tab-regular"
          type="button"
          onClick={() => setActiveMenu('regular')}
          className={`flex-1 text-center py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
            activeMenu === 'regular' ? 'bg-[var(--color-owner-primary)] text-white shadow-sm' : 'bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] text-[var(--color-owner-secondary)]'
          }`}
        >
          القائمة العادية
        </button>
        <button
          id="menu-tab-fasting"
          type="button"
          onClick={() => setActiveMenu('fasting')}
          className={`flex-1 text-center py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
            activeMenu === 'fasting' ? 'bg-[var(--color-owner-primary)] text-white shadow-sm' : 'bg-[var(--color-owner-surface)] border border-[var(--color-owner-border)] text-[var(--color-owner-secondary)]'
          }`}
        >
          قائمة الصيام
        </button>
      </div>

      {savedMsg && (
        <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center font-bold">{savedMsg}</div>
      )}

      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={d.day} className="bg-[var(--color-owner-surface)] rounded-2xl border border-[var(--color-owner-border)] p-3 space-y-2">
            <div className="text-xs font-black text-[var(--color-owner-text)]">{d.day}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">الإفطار:</label>
                <input
                  id={`menu-${activeMenu}-${i}-breakfast`}
                  type="text"
                  value={d.breakfast}
                  onChange={(e) => updateDay(i, 'breakfast', e.target.value)}
                  className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">الغداء:</label>
                <input
                  id={`menu-${activeMenu}-${i}-lunch`}
                  type="text"
                  value={d.lunch}
                  onChange={(e) => updateDay(i, 'lunch', e.target.value)}
                  className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-bold text-[var(--color-owner-secondary)] mb-0.5">العشاء:</label>
                <input
                  id={`menu-${activeMenu}-${i}-dinner`}
                  type="text"
                  value={d.dinner}
                  onChange={(e) => updateDay(i, 'dinner', e.target.value)}
                  className="w-full bg-[var(--color-owner-bg)] border border-[var(--color-owner-border)] text-[10px] px-2 py-1.5 rounded-lg text-[var(--color-owner-text)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

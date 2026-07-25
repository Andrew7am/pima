import React, { useEffect, useState } from 'react';
import { Eye, MousePointerClick, TrendingUp, TrendingDown, Minus, BarChart3, Loader2, Smartphone, Monitor, Apple, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Banner analytics — every number here comes from the banner_events table
// (migration 083). Nothing is estimated or filled in: before events exist the
// panels say so instead of showing invented figures.

interface Totals { impressions: number; clicks: number }
interface SeriesRow { day: string; impressions: number; clicks: number }
interface BannerRow { banner_id: string; title: string; placement: string; image_url: string | null; impressions: number; clicks: number }
interface ElementRow { element: string; clicks: number }
interface PlatformRow { platform: string; impressions: number }
interface Analytics {
  days: number; totals: Totals; previous: Totals;
  series: SeriesRow[]; banners: BannerRow[]; elements: ElementRow[]; platforms: PlatformRow[];
}

const RANGES = [
  { days: 7, label: 'آخر ٧ أيام' },
  { days: 30, label: 'آخر ٣٠ يوم' },
  { days: 90, label: 'آخر ٩٠ يوم' },
];

const ELEMENT_LABEL: Record<string, string> = {
  button: 'زر الإجراء', title: 'العنوان', subtitle: 'الوصف',
  badge: 'الشارة', image: 'الصورة', icons: 'الأيقونات', logo: 'الشعار',
};

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType }> = {
  android: { label: 'أندرويد', Icon: Smartphone },
  ios: { label: 'آيفون', Icon: Apple },
  web: { label: 'ويب', Icon: Monitor },
};

const ar = (n: number) => n.toLocaleString('ar-EG');
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return <span className="text-[9px] font-bold text-[#8A8A70]">لا توجد فترة سابقة للمقارنة</span>;
  const change = ((now - before) / before) * 100;
  const flat = Math.abs(change) < 0.5;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const cls = flat ? 'text-[#8A8A70]' : change > 0 ? 'text-emerald-700' : 'text-rose-600';
  return (
    <span className={`text-[9px] font-black flex items-center gap-0.5 ${cls}`}>
      <Icon className="w-3 h-3" />
      {flat ? 'بدون تغيير' : `${change > 0 ? '+' : ''}${change.toFixed(1)}% عن الفترة السابقة`}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, tint, children }: {
  icon: React.ElementType; label: string; value: string; tint: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-1 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${tint}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tint }} />
        </span>
        <span className="text-[9.5px] font-bold text-[#8A8A70]">{label}</span>
      </div>
      <div className="text-lg font-black text-[#2E2E24] leading-none">{value}</div>
      {children}
    </div>
  );
}

export default function BannerAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    supabase.rpc('banner_analytics', { p_days: days }).then(({ data: res, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message.includes('banner_analytics') ? 'قاعدة البيانات لسه ما اتحدّثتش — طبّق migration 083.' : err.message);
      else setData(res as Analytics);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [days]);

  const totals = data?.totals ?? { impressions: 0, clicks: 0 };
  const prev = data?.previous ?? { impressions: 0, clicks: 0 };
  const ctr = pct(totals.clicks, totals.impressions);
  const prevCtr = pct(prev.clicks, prev.impressions);
  const maxDay = Math.max(1, ...(data?.series ?? []).map((s) => s.impressions));
  const noData = !loading && !error && totals.impressions === 0 && totals.clicks === 0;

  return (
    <div className="space-y-3">
      {/* Header + range */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-black text-[#0A2342] flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-[#C5A059]" /> إحصائيات البانرات
          </h3>
          <p className="text-[9px] font-bold text-[#8A8A70]">أرقام فعلية من مشاهدات ونقرات الزوار داخل التطبيق</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => setDays(r.days)}
              className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-bold border transition-all cursor-pointer ${
                days === r.days ? 'bg-[#0A2342] text-white border-[#0A2342]' : 'bg-white text-[#5A5A40] border-[#D6D6C2] hover:bg-[#FAF8F5]'
              }`}>{r.label}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-12 flex flex-col items-center gap-2 text-[#8A8A70]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-[10px] font-bold">جارٍ تحميل الإحصائيات…</span>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[10.5px] font-bold text-amber-900 leading-relaxed">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {noData && (
            <div className="bg-[#FAF8F5] border border-dashed border-[#D6D6C2] rounded-2xl p-5 text-center space-y-1">
              <p className="text-[11px] font-black text-[#4A4A3A]">لسه مفيش بيانات في الفترة دي</p>
              <p className="text-[9.5px] font-bold text-[#8A8A70] leading-relaxed max-w-sm mx-auto">
                التتبّع اشتغل من دلوقتي: كل مرة زائر يشوف بانر أو يضغط عليه هيتسجّل هنا.
                الأرقام هتبدأ تظهر خلال ساعات من أول زيارة.
              </p>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <Kpi icon={Eye} label="المشاهدات" value={ar(totals.impressions)} tint="#0A2342">
              <Delta now={totals.impressions} before={prev.impressions} />
            </Kpi>
            <Kpi icon={MousePointerClick} label="النقرات" value={ar(totals.clicks)} tint="#5A5A40">
              <Delta now={totals.clicks} before={prev.clicks} />
            </Kpi>
            <Kpi icon={TrendingUp} label="نسبة النقر (CTR)" value={`${ctr.toFixed(2)}%`} tint="#C5A059">
              <Delta now={+ctr.toFixed(2)} before={+prevCtr.toFixed(2)} />
            </Kpi>
          </div>

          {/* Daily series */}
          {(data?.series.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-2">
              <span className="text-[10px] font-black text-[#4A4A3A]">المشاهدات والنقرات يومياً</span>
              <div className="flex items-end gap-1 h-24">
                {data!.series.map((s) => (
                  <div key={s.day} className="flex-1 flex flex-col justify-end items-center gap-0.5 group relative min-w-0">
                    <div className="w-full bg-[#0A2342] rounded-t transition-all group-hover:bg-[#123E75]"
                      style={{ height: `${(s.impressions / maxDay) * 100}%` }} />
                    <div className="w-full bg-[#C5A059] rounded-b" style={{ height: `${(s.clicks / maxDay) * 100}%` }} />
                    <span className="absolute -top-5 opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded whitespace-nowrap transition-opacity pointer-events-none">
                      {ar(s.impressions)} / {ar(s.clicks)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-[9px] font-bold text-[#8A8A70]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0A2342]" /> مشاهدات</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#C5A059]" /> نقرات</span>
              </div>
            </div>
          )}

          {/* Ranking */}
          {(data?.banners.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-[#D6D6C2] overflow-hidden">
              <div className="px-3 py-2 border-b border-[#D6D6C2]/60 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#C5A059]" />
                <span className="text-[10px] font-black text-[#4A4A3A]">ترتيب البانرات</span>
              </div>
              <div className="divide-y divide-[#D6D6C2]/50">
                {data!.banners.map((b, i) => {
                  const rate = pct(b.clicks, b.impressions);
                  const medal = ['bg-[#C5A059] text-[#3a2e12]', 'bg-slate-300 text-slate-700', 'bg-amber-700 text-white'][i];
                  return (
                    <div key={b.banner_id} className="flex items-center gap-2.5 px-3 py-2">
                      <span className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${medal ?? 'bg-[#EBEBE0] text-[#8A8A70]'}`}>{i + 1}</span>
                      {b.image_url
                        ? <img src={b.image_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover border border-[#E7E5DB] shrink-0" />
                        : <div className="w-10 h-10 rounded-lg bg-[#EBEBE0]/60 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10.5px] font-black text-[#4A4A3A] truncate">{b.title}</p>
                        <p className="text-[9px] font-bold text-[#8A8A70]">{b.placement === 'carousel' ? 'كاروسيل' : 'عدّاد'}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <div className="text-[10px] font-black text-[#0A2342]">{rate.toFixed(2)}%</div>
                        <div className="text-[8.5px] font-bold text-[#8A8A70]">{ar(b.impressions)} مشاهدة · {ar(b.clicks)} نقرة</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Where do they tap + platform */}
          <div className="grid grid-cols-2 gap-2">
            {(data?.elements.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-1.5">
                <span className="text-[10px] font-black text-[#4A4A3A]">أكتر جزء بيتضغط</span>
                {data!.elements.map((e) => (
                  <div key={e.element} className="space-y-0.5">
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-[#5A5A40]">{ELEMENT_LABEL[e.element] ?? e.element}</span>
                      <span className="text-[#8A8A70]">{ar(e.clicks)}</span>
                    </div>
                    <div className="h-1.5 bg-[#EBEBE0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#5A5A40] rounded-full" style={{ width: `${pct(e.clicks, totals.clicks)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(data?.platforms.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl border border-[#D6D6C2] p-3 space-y-1.5">
                <span className="text-[10px] font-black text-[#4A4A3A]">المشاهدات حسب الجهاز</span>
                {data!.platforms.map((p) => {
                  const meta = PLATFORM_META[p.platform] ?? PLATFORM_META.web;
                  const Icon = meta.Icon;
                  return (
                    <div key={p.platform} className="space-y-0.5">
                      <div className="flex justify-between text-[9px] font-bold">
                        <span className="text-[#5A5A40] flex items-center gap-1"><Icon className="w-3 h-3" />{meta.label}</span>
                        <span className="text-[#8A8A70]">{ar(p.impressions)}</span>
                      </div>
                      <div className="h-1.5 bg-[#EBEBE0] rounded-full overflow-hidden">
                        <div className="h-full bg-[#0A2342] rounded-full" style={{ width: `${pct(p.impressions, totals.impressions)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

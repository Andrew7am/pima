// TEMPORARY check — renders the real WriteFailureBanner and drives it with
// the real trackWrite, so the path that only ever existed as a console.error
// can be seen. Delete with preview-writefail.html.
import { createRoot } from 'react-dom/client';
import WriteFailureBanner from './components/WriteFailureBanner';
import { trackWrite } from './lib/writeFeedback';
import './index.css';

function Preview() {
  return (
    <div className="min-h-screen bg-[#EBEBE0] p-6 space-y-3" dir="rtl">
      <h1 className="text-lg font-black text-[#2D2D24]">فحص تنبيه فشل الحفظ</h1>
      <div className="flex flex-wrap gap-2">
        <button id="fail-plain" type="button" className="bg-[#5A5A40] text-white text-xs font-bold px-3 py-2 rounded-xl"
          onClick={() => trackWrite(Promise.resolve(false), 'تأكيد استلام العربون')}>
          حفظ يرجع false
        </button>
        <button id="fail-reason" type="button" className="bg-[#5A5A40] text-white text-xs font-bold px-3 py-2 rounded-xl"
          onClick={() => trackWrite(Promise.resolve({ ok: false, error: 'البيت مكتمل الإشغال في هذه التواريخ' }), 'تعديل تواريخ الحجز')}>
          حفظ يرجع سبب
        </button>
        <button id="fail-throw" type="button" className="bg-[#5A5A40] text-white text-xs font-bold px-3 py-2 rounded-xl"
          onClick={() => trackWrite(Promise.reject(new Error('offline')), 'تسجيل وصول الضيف')}>
          حفظ يرمي خطأ
        </button>
        <button id="ok-write" type="button" className="bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl"
          onClick={() => trackWrite(Promise.resolve(true), 'حفظ ناجح')}>
          حفظ ناجح (لازم مايظهرش حاجة)
        </button>
      </div>
      <WriteFailureBanner />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);

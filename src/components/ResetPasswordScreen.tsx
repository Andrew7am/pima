import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import Logo from './Logo';
import { supabase } from '../lib/supabase';

interface ResetPasswordScreenProps {
  onDone: () => void;
}

export default function ResetPasswordScreen({ onDone }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError('حدث خطأ أثناء تحديث كلمة المرور. حاول مرة أخرى.');
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#EBEBE0] flex items-center justify-center p-4 font-sans select-none antialiased text-right">
      <div className="w-full max-w-md bg-[#FDFBF7] rounded-[32px] border border-[#D6D6C2] shadow-2xl p-6 space-y-6 relative overflow-hidden text-[#4A4A3A]">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#0A2342] to-[#C5A059]" />

        <div className="pt-2">
          <Logo variant="full" size={130} className="shadow-none border-none p-0 bg-transparent" />
        </div>

        {success ? (
          <div className="space-y-4 text-center py-2">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-4 leading-relaxed">
              تم تحديث كلمة المرور بنجاح. يمكنك الآن متابعة استخدام حسابك.
            </div>
            <button
              type="button"
              onClick={onDone}
              className="w-full bg-[#0A2342] hover:bg-[#071930] text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors"
            >
              متابعة
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-[#4A4A3A]">تعيين كلمة مرور جديدة:</h2>
              <p className="text-[10px] text-[#8A8A70]">أدخل كلمة المرور الجديدة لحسابك.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 text-center">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">كلمة المرور الجديدة:</label>
                <div className="relative">
                  <input type="password" required minLength={6} placeholder="6 أحرف على الأقل" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2.5 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <Lock className="absolute top-3 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#8A8A70] mb-1">تأكيد كلمة المرور:</label>
                <div className="relative">
                  <input type="password" required minLength={6} placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-[#D6D6C2] rounded-xl py-2.5 pl-3 pr-10 text-xs text-[#4A4A3A] focus:outline-none" />
                  <Lock className="absolute top-3 right-3 w-4 h-4 text-[#BCBC9D]" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#0A2342] hover:bg-[#071930] disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl shadow-md text-center transition-colors">
              {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

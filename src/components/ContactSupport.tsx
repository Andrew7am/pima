import React, { useState } from 'react';
import {
  Phone, Mail, Facebook, Instagram, MessageCircle,
  Send, AlertCircle, Info, CheckCircle2, ShieldCheck, HeartHandshake
} from 'lucide-react';

interface ContactSupportProps {
  currentUser: {
    name: string;
    phone: string;
    email: string;
  };
}

interface SupportTicket {
  id: string;
  type: string;
  subject: string;
  details: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export default function ContactSupport({ currentUser }: ContactSupportProps) {
  const [ticketType, setTicketType] = useState<'technical' | 'suggestion' | 'feedback'>('technical');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  
  const [submittedTickets, setSubmittedTickets] = useState<SupportTicket[]>([
    {
      id: 'PIMA-8821',
      type: 'اقتراح لتطوير التطبيق',
      subject: 'إضافة فلتر مخصص لبيوت الإسكندرية القريبة من البحر',
      details: 'نقترح إضافة خيار تصفية للبحث السريع عن البيوت التي تقع مباشرة على البحر أو تمتلك شاطئ خاص في العجمي وأبوقير.',
      status: 'resolved',
      createdAt: '2026-06-25T11:20:00Z'
    }
  ]);

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [newTicketId, setNewTicketId] = useState('');

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !details.trim()) {
      alert('الرجاء كتابة عنوان وبلاغ المشكلة بالتفصيل.');
      return;
    }

    const ticketId = `PIMA-${Math.floor(10000 + Math.random() * 90000)}`;
    const typeLabel = 
      ticketType === 'technical' ? 'مشكلة تقنية في التطبيق' : 
      ticketType === 'suggestion' ? 'اقتراح لتطوير التطبيق' : 'تقييم وملاحظات عامة';

    const newTicket: SupportTicket = {
      id: ticketId,
      type: typeLabel,
      subject,
      details,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setSubmittedTickets(prev => [newTicket, ...prev]);
    setNewTicketId(ticketId);
    setShowSuccessToast(true);

    // Reset fields
    setSubject('');
    setDetails('');

    // Hide toast after 8 seconds
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 8000);
  };

  return (
    <div className="space-y-4 pb-12 text-right text-[#4A4A3A]" dir="rtl">
      
      {/* Title & Brand Intro */}
      <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-[#0A2342] to-[#C5A059]" />
        
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#0A2342]/10 rounded-2xl">
            <HeartHandshake className="w-6 h-6 text-[#0A2342]" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-[#0A2342]">التواصل والدعم الفني وخدمة عملاء بيما</h1>
            <p className="text-[10px] text-[#8A8A70] font-bold">نسعد بخدمتكم وتلقي آرائكم واستفساراتكم على مدار الساعة</p>
          </div>
        </div>
        <p className="text-xs text-[#4A4A3A] leading-relaxed mt-2 font-medium">
          يسعى فريق خدمة «بيما | PiMa» لتقديم أفضل تجربة لتنسيق خلوات ومؤتمرات الكنيسة القبطية. إذا كنت تواجه مشكلة أو تود تقديم اقتراح لخدمة الكنيسة بشكل أفضل، تواصل معنا فوراً!
        </p>
      </div>

      {/* Grid: Call Support & Social Medias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Contact info Box */}
        <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-4">
          <div className="border-b border-[#D6D6C2]/40 pb-2">
            <h2 className="text-xs font-black text-[#0A2342]">قنوات التواصل المباشر</h2>
            <p className="text-[9px] text-[#8A8A70] font-bold">انقر على الرقم للاتصال بنا مباشرة</p>
          </div>

          <div className="space-y-2.5">
            {/* Click to Call 1 */}
            <a 
              href="tel:01234567890" 
              className="flex items-center justify-between p-3 rounded-2xl bg-[#FDFBF7] border border-[#D6D6C2]/60 hover:border-[#C5A059] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 group-hover:bg-emerald-100">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8A8A70] font-bold block leading-none">تليفون الحجوزات وخدمة العملاء</span>
                  <span className="text-xs font-black text-[#0A2342] mt-1 block tracking-wider" dir="ltr">0123 456 7890</span>
                </div>
              </div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-xl group-hover:scale-105 transition-all">اتصل الآن 📞</span>
            </a>

            {/* Click to Call 2 */}
            <a 
              href="tel:01112223334" 
              className="flex items-center justify-between p-3 rounded-2xl bg-[#FDFBF7] border border-[#D6D6C2]/60 hover:border-[#C5A059] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 group-hover:bg-blue-100">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8A8A70] font-bold block leading-none">الدعم الفني والشكاوى</span>
                  <span className="text-xs font-black text-[#0A2342] mt-1 block tracking-wider" dir="ltr">0111 222 3334</span>
                </div>
              </div>
              <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-2.5 py-1 rounded-xl group-hover:scale-105 transition-all">اتصل الآن 📞</span>
            </a>

            {/* Official Email */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FDFBF7] border border-[#D6D6C2]/60">
              <div className="w-9 h-9 rounded-xl bg-[#0A2342]/5 text-[#0A2342] flex items-center justify-center border border-[#0A2342]/10">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-right flex-1">
                <span className="text-[10px] text-[#8A8A70] font-bold block leading-none">البريد الإلكتروني الرسمي للمنصة</span>
                <span className="text-xs font-black text-[#0A2342] mt-1 block tracking-normal select-all" dir="ltr">support@pima-retreats.eg</span>
              </div>
            </div>
          </div>

          {/* Social Platforms */}
          <div className="pt-2">
            <span className="block text-[10px] font-extrabold text-[#8A8A70] mb-2.5">تابعونا على مواقع التواصل الاجتماعي:</span>
            <div className="grid grid-cols-3 gap-2">
              {/* WhatsApp direct link */}
              <a 
                href="https://wa.me/201234567890?text=سلام%20ونعمة%20أريد%20الاستفسار%20عن%20بيوت%20المؤتمرات" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[#D6D6C2]/50 hover:border-emerald-500 bg-emerald-50/20 text-emerald-800 text-[10px] font-extrabold transition-all hover:bg-emerald-50"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>واتساب</span>
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/share/1F27QZY4xR/?mibextid=wwXIfr"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[#D6D6C2]/50 hover:border-blue-600 bg-blue-50/20 text-blue-800 text-[10px] font-extrabold transition-all hover:bg-blue-50"
              >
                <Facebook className="w-4 h-4 text-blue-600" />
                <span>فيسبوك</span>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/pima_app?igsh=Zzh2YmxsbWs5Nm82&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[#D6D6C2]/50 hover:border-pink-600 bg-pink-50/20 text-pink-800 text-[10px] font-extrabold transition-all hover:bg-pink-50"
              >
                <Instagram className="w-4 h-4 text-pink-600" />
                <span>إنستجرام</span>
              </a>
            </div>
          </div>
        </div>

        {/* About App Box */}
        <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="border-b border-[#D6D6C2]/40 pb-2 mb-3">
              <h2 className="text-xs font-black text-[#0A2342]">حول التطبيق والخدمة</h2>
              <p className="text-[9px] text-[#8A8A70] font-bold">تفاصيل وتراخيص الإصدار الحالي</p>
            </div>

            <p className="text-xs text-[#4A4A3A] leading-relaxed font-medium">
              تطبيق <strong className="text-[#0A2342] font-black">بيما | PiMa</strong> هو النظام الرقمي الأول لتصفح وإدارة بيوت المؤتمرات والفنادق والمغتربين للمسيحيين بمصر. يهدف لتخفيف التعب الملقى على عاتق أمناء الخدمة والآباء الكهنة في البحث عن الخلوات المناسبة لأسرهم واجتماعاتهم بمختلف المحافظات.
            </p>
          </div>

          <div className="bg-[#FDFBF7] border border-[#D6D6C2]/80 rounded-2xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-[#8A8A70] font-bold">اسم التطبيق:</span>
              <span className="text-[#0A2342] font-extrabold">بيما | PiMa لبيوت المؤتمرات</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-[#8A8A70] font-bold">رقم الإصدار:</span>
              <span className="text-amber-800 font-extrabold" dir="ltr">Version 2.4.0 (استقرار)</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-[#8A8A70] font-bold">تاريخ التحديث:</span>
              <span className="text-[#4A4A3A] font-extrabold">يوليو ٢٠٢٦ م.</span>
            </div>
            <div className="flex justify-between items-center text-[10.5px] border-t border-[#D6D6C2]/40 pt-1.5 mt-1.5">
              <span className="text-[#8A8A70] font-bold">المطور التقني:</span>
              <span className="text-[#0A2342] font-black flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>خدمة بيوت المؤتمرات القبطية</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Submission Notification Toast */}
      {showSuccessToast && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-950 p-4 rounded-3xl shadow-lg flex items-start gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="text-xs font-black text-emerald-800">تم إرسال بلاغكم بنجاح!</h4>
            <p className="text-[10.5px] leading-relaxed font-bold">
              نشكر محبتكم واهتمامكم بتطوير الخدمة! تم تسجيل البلاغ/الاقتراح برقم تذكرة <strong className="text-emerald-900 underline font-black" dir="ltr">#{newTicketId}</strong> بنجاح. سيقوم مهندسو الدعم بمراجعة طلبكم والتواصل معكم عبر التليفون المسجل خلال ٢٤ ساعة كحد أقصى.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setShowSuccessToast(false)} 
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Report a Problem or Submit Feedback Form */}
      <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 h-1 bg-[#C5A059] w-32" />
        
        <div className="border-b border-[#D6D6C2]/40 pb-2.5 mb-4">
          <h2 className="text-xs font-black text-[#0A2342]">إرسال بلاغ أو اقتراح للدعم الفني</h2>
          <p className="text-[9px] text-[#8A8A70] font-bold">مساحتك لإبداء رأيك أو الإبلاغ عن مشكلة تواجهك في تصفح التطبيق</p>
        </div>

        <form onSubmit={handleSubmitReport} className="space-y-3">
          
          {/* Ticket Type */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[#8A8A70]">نوع البلاغ الموجه للخدمة:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                id="type-tech"
                type="button"
                onClick={() => setTicketType('technical')}
                className={`py-2 px-1.5 rounded-xl text-[9.5px] font-extrabold transition-all cursor-pointer text-center border ${
                  ticketType === 'technical'
                    ? 'bg-[#0A2342] text-white border-[#0A2342] shadow-sm'
                    : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:bg-[#FDFBF7]'
                }`}
              >
                ⚠️ مشكلة تقنية
              </button>
              
              <button
                id="type-sug"
                type="button"
                onClick={() => setTicketType('suggestion')}
                className={`py-2 px-1.5 rounded-xl text-[9.5px] font-extrabold transition-all cursor-pointer text-center border ${
                  ticketType === 'suggestion'
                    ? 'bg-[#0A2342] text-white border-[#0A2342] shadow-sm'
                    : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:bg-[#FDFBF7]'
                }`}
              >
                💡 اقتراح فكرة جديد
              </button>

              <button
                id="type-feed"
                type="button"
                onClick={() => setTicketType('feedback')}
                className={`py-2 px-1.5 rounded-xl text-[9.5px] font-extrabold transition-all cursor-pointer text-center border ${
                  ticketType === 'feedback'
                    ? 'bg-[#0A2342] text-white border-[#0A2342] shadow-sm'
                    : 'bg-white text-[#4A4A3A] border-[#D6D6C2] hover:bg-[#FDFBF7]'
                }`}
              >
                ⭐ رأي وتقييم عام
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[#8A8A70]">عنوان الموضوع / التذكرة:</label>
            <input
              id="ticket-subject"
              type="text"
              required
              placeholder="مثال: مشكلة في تصفح المنيو الأسبوعي للبيت الكنسي"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl px-3 py-2 text-xs text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#C5A059] focus:border-[#C5A059] font-bold text-right"
            />
          </div>

          {/* Details */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[#8A8A70]">تفاصيل الشكوى أو الاقتراح بالتفصيل:</label>
            <textarea
              id="ticket-details"
              required
              rows={4}
              placeholder="الرجاء وصف ما واجهته أو فكرتك بالتفصيل لمساعدتنا على معالجة المشكلة أو تضمين اقتراحك بأسرع وقت..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl px-3 py-2 text-xs text-[#4A4A3A] focus:outline-none focus:ring-1 focus:ring-[#C5A059] focus:border-[#C5A059] font-medium text-right leading-relaxed"
            />
          </div>

          {/* Grid Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#8A8A70]">الاسم الكامل:</label>
              <input
                id="ticket-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-xs text-[#4A4A3A] focus:outline-none font-bold text-right"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#8A8A70]">رقم الموبايل للمتابعة:</label>
              <input
                id="ticket-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-xs text-[#4A4A3A] focus:outline-none font-bold text-right tracking-wider"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#8A8A70]">البريد الإلكتروني:</label>
              <input
                id="ticket-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FDFBF7] border border-[#D6D6C2] rounded-xl px-2.5 py-1.5 text-xs text-[#4A4A3A] focus:outline-none font-bold text-left"
                dir="ltr"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            id="submit-ticket-btn"
            type="submit"
            className="w-full mt-2 bg-[#0A2342] hover:bg-[#071930] text-white py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 text-[#C5A059]" />
            <span>إرسال التذكرة لفريق الدعم الفني</span>
          </button>
        </form>
      </div>

      {/* Submitted Tickets History */}
      <div className="bg-white rounded-3xl p-5 border border-[#D6D6C2] shadow-sm space-y-3">
        <div className="border-b border-[#D6D6C2]/40 pb-2 flex items-center justify-between">
          <h2 className="text-xs font-black text-[#0A2342]">تاريخ بلاغاتك واقتراحاتك السابقة</h2>
          <span className="text-[9px] text-[#8A8A70] font-bold">جلسة العمل الحالية</span>
        </div>

        {submittedTickets.length === 0 ? (
          <p className="text-[11px] text-[#8A8A70] text-center py-4">لا توجد بلاغات مسجلة بعد في هذه الجلسة.</p>
        ) : (
          <div className="space-y-3">
            {submittedTickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="bg-[#FDFBF7] border border-[#D6D6C2]/50 rounded-2xl p-3 text-right space-y-1.5 relative overflow-hidden"
              >
                {/* Status ribbon */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className={`text-[8.5px] px-2 py-0.5 rounded-full font-black ${
                    ticket.status === 'resolved' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800 animate-pulse'
                  }`}>
                    {ticket.status === 'resolved' ? '✓ تم الحل' : '⏳ جاري المراجعة'}
                  </span>
                </div>

                <div className="text-[10px] text-[#C5A059] font-black">{ticket.type}</div>
                <h4 className="text-xs font-extrabold text-[#4A4A3A] pl-16 leading-tight">{ticket.subject}</h4>
                <p className="text-[10px] text-[#8A8A70] leading-relaxed font-semibold">{ticket.details}</p>
                
                <div className="flex items-center justify-between text-[8.5px] text-[#BCBC9D] pt-2 border-t border-[#D6D6C2]/30 mt-1">
                  <span>رقم التذكرة: {ticket.id}</span>
                  <span>تاريخ التسجيل: {new Date(ticket.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

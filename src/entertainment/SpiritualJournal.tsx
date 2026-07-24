import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Sparkles, Plus, Trash2, Edit2, Download, Save, Heart, 
  CheckSquare, ArrowRight, Clipboard, Trash, AlertCircle, FileText
} from 'lucide-react';
import { User, SpiritualJournalEntry } from '../types';
import { 
  listenToUserSpiritualJournalEntries, 
  createSpiritualJournalEntry, 
  updateSpiritualJournalEntry, 
  deleteSpiritualJournalEntry 
} from '../lib/spiritualJournalDb';
import { motion, AnimatePresence } from 'motion/react';

interface SpiritualJournalProps {
  currentUser: User;
  onBack?: () => void;
}

// Suggested spiritual verses to help users easily pick & add
const SUGGESTED_VERSES = [
  "«عَلَى الرَّبِّ تَوَكَّلْ بِكُلِّ قَلْبِكَ، وَعَلَى فَهْمِكَ لاَ تَعْتَمِدْ.» (أمثال ٣: ٥)",
  "«مُلْقِينَ كُلَّ هَمِّكُمْ عَلَيْهِ، لأَنَّهُ هُوَ يَعْتَنِي بِكُمْ.» (١ بطرس ٥: ٧)",
  "«لِتَكُنْ لاَ مَشِيئَتِي بَلْ مَشِيئَتُكَ.» (لوقا ٢٢: ٤٢)",
  "«صَلُّوا بِلاَ انْقِطَاعٍ.» (١ تسالونيكي ٥: ١٧)",
  "«اِسْهَرُوا وَصَلُّوا لِكَيْ لاَ تَدْخُلُوا فِي تَجْرِبَةٍ.» (متى ٢٦: ٤١)",
  "«كُنْ أَمِيناً إِلَى الْمَوْتِ فَسَأُعْطِيكَ إِكْلِيلَ الْحَيَاةِ.» (رؤيا ٢: ١٠)",
  "«وَلَكِنِ انْمُوا فِي النِّعْمَةِ وَفِي مَعْرِفَةِ رَبِّنَا وَمُخَلِّصِنَا يَسُوعَ الْمَسِيحِ.» (٢ بطرس ٣: ١٨)",
  "«سِرَاجٌ لِرِجْلِي كَلاَمُكَ وَنُورٌ لِسَبِيلِي.» (مزمور ١١٩: ١٠٥)"
];

// Suggested spiritual decisions/commitments
const SUGGESTED_DECISIONS = [
  "المواظبة على صلاة باكر والغروب يومياً 🌅",
  "تخصيص 15 دقيقة يومياً لقراءة وتأمل الإنجيل 📖",
  "المواظبة على الاعتراف الشهري والتناول بانتظام ⛪",
  "تدريب الصمت والابتعاد عن الغضب والكلام السلبي 🤫",
  "تقديم خدمة تطوعية أسبوعية لمساعدة الآخرين 🤝",
  "المحافظة على ابتسامة السلام والاتضاع مع الجميع 😊"
];

export default function SpiritualJournal({ currentUser, onBack }: SpiritualJournalProps) {
  const [entries, setEntries] = useState<SpiritualJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEntry, setActiveEntry] = useState<Partial<SpiritualJournalEntry> | null>(null);
  
  // Form Temporary States
  const [tempTitle, setTempTitle] = useState('');
  const [tempContent, setTempContent] = useState('');
  const [tempVerses, setTempVerses] = useState<string[]>([]);
  const [tempDecisions, setTempDecisions] = useState<string[]>([]);
  
  // Custom item adder inputs
  const [verseInput, setVerseInput] = useState('');
  const [decisionInput, setDecisionInput] = useState('');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscribe to real-time entries for the current user
  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToUserSpiritualJournalEntries(currentUser.id, (userEntries) => {
      setEntries(userEntries);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser.id]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleStartCreate = () => {
    setTempTitle(`تأمل خلوة اليوم - ${new Date().toLocaleDateString('ar-EG')}`);
    setTempContent('');
    setTempVerses([]);
    setTempDecisions([]);
    setVerseInput('');
    setDecisionInput('');
    setActiveEntry({ id: `journal_${Date.now()}` });
    setIsEditing(true);
  };

  const handleStartEdit = (entry: SpiritualJournalEntry) => {
    setTempTitle(entry.title);
    setTempContent(entry.content);
    setTempVerses(entry.favoriteVerses || []);
    setTempDecisions(entry.decisions || []);
    setVerseInput('');
    setDecisionInput('');
    setActiveEntry(entry);
    setIsEditing(true);
  };

  const handleAddVerse = (verseText: string) => {
    if (!verseText.trim()) return;
    if (tempVerses.includes(verseText.trim())) {
      showToast('هذه الآية مضافة بالفعل! 📜');
      return;
    }
    setTempVerses([...tempVerses, verseText.trim()]);
    setVerseInput('');
  };

  const handleRemoveVerse = (idx: number) => {
    setTempVerses(tempVerses.filter((_, i) => i !== idx));
  };

  const handleAddDecision = (decisionText: string) => {
    if (!decisionText.trim()) return;
    if (tempDecisions.includes(decisionText.trim())) {
      showToast('هذا القرار مضاف بالفعل! 🎯');
      return;
    }
    setTempDecisions([...tempDecisions, decisionText.trim()]);
    setDecisionInput('');
  };

  const handleRemoveDecision = (idx: number) => {
    setTempDecisions(tempDecisions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!tempTitle.trim()) {
      showToast('الرجاء إدخال عنوان لمذكرات اليوم ✏️');
      return;
    }
    if (!tempContent.trim()) {
      showToast('الرجاء تدوين تأملك الروحي قبل الحفظ 📖');
      return;
    }

    if (!activeEntry || !activeEntry.id) return;

    const isNew = !entries.some(e => e.id === activeEntry.id);

    if (isNew) {
      await createSpiritualJournalEntry({
        id: activeEntry.id,
        userId: currentUser.id,
        title: tempTitle.trim(),
        content: tempContent.trim(),
        favoriteVerses: tempVerses,
        decisions: tempDecisions
      });
      showToast('تم حفظ التأمل الروحي بنجاح في السحابة! ☁️✨');
    } else {
      await updateSpiritualJournalEntry(activeEntry.id, {
        title: tempTitle.trim(),
        content: tempContent.trim(),
        favoriteVerses: tempVerses,
        decisions: tempDecisions
      });
      showToast('تم تحديث التأمل بنجاح! 💾');
    }

    setIsEditing(false);
    setActiveEntry(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا التأمل الروحي بالكامل؟')) {
      await deleteSpiritualJournalEntry(id);
      showToast('تم حذف التأمل الروحي.');
    }
  };

  const handleExportTextFile = (entry: SpiritualJournalEntry) => {
    const headerBorder = "==================================================";
    const sectionBorder = "--------------------------------------------------";
    const formattedText = `
${headerBorder}
⛪ مذكرات الخلوة الشخصية والتأملات الروحية - منصة بيما (PiMa) ⛪
${headerBorder}

المستخدم: ${currentUser.name}
عنوان التأمل: ${entry.title}
التاريخ والوقت: ${new Date(entry.createdAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${sectionBorder}
📖 أولاً: تأملاتي اليومية (Daily Reflections)
${sectionBorder}

${entry.content}

${sectionBorder}
📜 ثانياً: الآيات الروحية المحفوظة (Favorite Verses)
${sectionBorder}
${entry.favoriteVerses && entry.favoriteVerses.length > 0 
  ? entry.favoriteVerses.map((verse, i) => `[${i + 1}] ${verse}`).join('\n\n') 
  : "لم يتم حفظ آيات محددة في هذا اليوم."}

${sectionBorder}
🎯 ثالثاً: الالتزامات والقرارات الروحية (Spiritual Decisions)
${sectionBorder}
${entry.decisions && entry.decisions.length > 0 
  ? entry.decisions.map((decision, i) => `[${i + 1}] ${decision}`).join('\n') 
  : "لم يتم اتخاذ قرارات محددة في هذا اليوم."}

${headerBorder}
صُنع بحب وبركة في منصة بيما لبيوت المؤتمرات القبطية الكنسية
المستقبل الروحي يبدأ بكلمات من النور والنمو المستمر مع مخلصنا الصالح
${headerBorder}
`;

    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `مذكرات_الخلوة_${entry.title.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير التأمل كملف نصي بنجاح! 💾');
  };

  return (
    <div className="space-y-6 text-right select-none" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-96 bg-[#0A2342] text-amber-300 border-2 border-amber-500/50 px-5 py-3.5 rounded-2xl shadow-2xl z-50 flex items-center gap-3 font-sans"
          >
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">✨</div>
            <p className="text-xs font-black leading-relaxed">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Screen Header & Navigation */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        {onBack && (
          <button 
            onClick={onBack}
            className="bg-white hover:bg-slate-50 text-slate-600 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border border-slate-200 shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-base font-black text-[#0A2342]">مذكرات الخلوة الشخصية 📖</h3>
        </div>
      </div>

      {!isEditing ? (
        /* ================= LIST VIEW ================= */
        <div className="space-y-4">
          
          {/* Welcome Cathedral-like Intro Card */}
          <div className="bg-gradient-to-br from-purple-950 via-[#2E1065] to-[#1E1B4B] text-white p-5 rounded-3xl border border-amber-500/30 shadow-md relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 space-y-2">
              <h4 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>مساحتك الروحية الخاصة والآمنة ✝️</span>
              </h4>
              <p className="text-[11px] text-purple-200 leading-relaxed font-semibold">
                اكتب تأملاتك اليومية في خلوتك، احفظ آياتك المحببة، ودون قراراتك الروحية للتغيير والنمو الشخصي. جميع بياناتك تُحفظ بشكل آمن وتلقائي في السحابة مع إمكانية تحميلها في أي وقت كملف نصي.
              </p>
              
              <div className="pt-2">
                <button
                  onClick={handleStartCreate}
                  className="bg-amber-500 hover:bg-amber-600 text-purple-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>تدوين تأمل روحي جديد</span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Entries */}
          {loading ? (
            <div className="text-center py-16 text-slate-400 font-bold space-y-2">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">جاري تحميل مذكراتك الروحية الآمنة...</p>
            </div>
          ) : entries.length === 0 ? (
            /* Empty state */
            <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-3xl mx-auto shadow-inner">
                🕯️
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-slate-800">مخدعك الروحي الصامت ينتظرك...</h5>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  لم تقم بتدوين أي تأمل روحي حتى الآن. اضغط على الزر بالأعلى لتكتب أول تدوينة وتخلد بركات خلوتك!
                </p>
              </div>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ابدأ الكتابة الآن</span>
              </button>
            </div>
          ) : (
            /* Entries Grid */
            <div className="space-y-3">
              <h5 className="text-xs font-black text-slate-400">تأملاتك السابقة ({entries.length})</h5>
              
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div 
                    key={entry.id}
                    className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all text-right space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleExportTextFile(entry)}
                          className="p-1.5 text-[#0A2342] hover:bg-slate-100 rounded-lg transition-colors border border-slate-100"
                          title="تصدير كملف نصي"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-100"
                          title="تعديل التأمل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-rose-650 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                          title="حذف التأمل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-extrabold text-[#0A2342]">{entry.title}</h4>
                        <span className="text-[10px] text-slate-400 font-mono font-bold block">
                          📅 {new Date(entry.createdAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-bold border-t border-slate-100/50 pt-2 line-clamp-3">
                      {entry.content}
                    </p>

                    {/* Verses and Decisions Quick Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {entry.favoriteVerses && entry.favoriteVerses.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[9.5px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Heart className="w-3 h-3 text-amber-600 shrink-0 fill-amber-500" />
                          <span>{entry.favoriteVerses.length} آية محفوظة</span>
                        </div>
                      )}
                      {entry.decisions && entry.decisions.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{entry.decisions.length} قرار روحي</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= EDIT / CREATE FORM VIEW ================= */
        <div className="space-y-4 animate-in fade-in duration-300">
          
          {/* Back to list button inside form */}
          <div className="flex justify-start">
            <button
              onClick={() => {
                setIsEditing(false);
                setActiveEntry(null);
              }}
              className="text-xs font-black text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>إلغاء والعودة للقائمة</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-5 shadow-sm">
            
            {/* Title field */}
            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700">عنوان التأمل / مذكرات اليوم: *</label>
              <input
                type="text"
                required
                placeholder="مثال: تأمل اليوم الأول - خلوة السلام والصمت"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-black text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            {/* Daily Reflections Content Textarea */}
            <div className="space-y-1">
              <label className="block text-xs font-black text-slate-700 flex justify-between items-center">
                <span>كتابة التأملات الروحية اليومية: *</span>
                <span className="text-[10px] text-amber-600 font-bold">مساحة خاصة للتعبير والتأمل</span>
              </label>
              <textarea
                required
                rows={6}
                placeholder="اكتب هنا تأملك بوضوح وهدوء... تأمل في كلام الإنجيل، الصلاة، شعورك في الخلوة، ومقاصدك الروحية للتقرب إلى الله وصانع الخيرات..."
                value={tempContent}
                onChange={(e) => setTempContent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-bold text-slate-800 leading-relaxed focus:bg-white focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-300 resize-none"
              />
            </div>

            {/* SECTION 2: FAVORITE BIBLE VERSES */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center gap-1 text-[#0A2342]">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                <h4 className="text-xs font-black">الآيات الروحية المفضلة والآيات المحفوظة 📜</h4>
              </div>

              {/* Added Verses List */}
              {tempVerses.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                  {tempVerses.map((verse, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start justify-between gap-2.5 bg-white p-2 rounded-xl border border-slate-100 text-[10.5px] font-bold text-slate-700 leading-relaxed shadow-3xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveVerse(idx)}
                        className="text-rose-600 hover:text-rose-800 p-0.5"
                        title="حذف الآية"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                      <span className="flex-1 text-right">{verse}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-bold bg-slate-50 p-3 rounded-2xl text-center">
                  لم تقم بإضافة آيات لهذا اليوم بعد. أضف آيتك الخاصة أو اختر من المقترحات بالأسفل!
                </p>
              )}

              {/* Add Custom Verse Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="أدخل آية جديدة (مثال: «الرَّبُّ نُورِي وَخَلاَصِي...»)"
                  value={verseInput}
                  onChange={(e) => setVerseInput(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 flex-1 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddVerse(verseInput)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  إضافة
                </button>
              </div>

              {/* Quick Suggestion Chips for Verses */}
              <div className="space-y-1">
                <span className="block text-[9px] font-black text-slate-400">💡 اضغط لإضافة آية مقترحة فوراً:</span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
                  {SUGGESTED_VERSES.map((verse, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddVerse(verse)}
                      className="text-[9px] bg-white hover:bg-amber-50 hover:border-amber-400/50 text-slate-600 hover:text-amber-800 border border-slate-100 rounded-lg px-2 py-1 font-bold text-right leading-tight max-w-full truncate transition-all cursor-pointer shadow-3xs"
                    >
                      {verse}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 3: SPIRITUAL DECISIONS / COMMITMENTS */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center gap-1 text-[#0A2342]">
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-black">القرارات والالتزامات الروحية والعملية للمستقبل 🎯</h4>
              </div>

              {/* Added Decisions List */}
              {tempDecisions.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                  {tempDecisions.map((decision, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100 text-[10.5px] font-bold text-slate-700 leading-tight shadow-3xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveDecision(idx)}
                        className="text-rose-600 hover:text-rose-800 p-0.5"
                        title="حذف القرار"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                      <span className="flex-1 text-right">{decision}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 font-bold bg-slate-50 p-3 rounded-2xl text-center">
                  لم تختر قرارات روحية لتطبيقها اليوم بعد. ابدأ بصياغة قراراتك أو اختر من المقترحة بالأسفل!
                </p>
              )}

              {/* Add Custom Decision Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="أدخل قرار روحي (مثال: قراءة إصحاح يومياً)"
                  value={decisionInput}
                  onChange={(e) => setDecisionInput(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 flex-1 focus:bg-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddDecision(decisionInput)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                >
                  إضافة
                </button>
              </div>

              {/* Quick Suggestion Chips for Decisions */}
              <div className="space-y-1">
                <span className="block text-[9px] font-black text-slate-400">💡 اضغط لإضافة قرار وتعهد مقترح:</span>
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                  {SUGGESTED_DECISIONS.map((decision, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddDecision(decision)}
                      className="text-[9px] bg-white hover:bg-emerald-50 hover:border-emerald-400/50 text-slate-600 hover:text-emerald-800 border border-slate-100 rounded-lg px-2 py-1 font-bold text-right transition-all cursor-pointer shadow-3xs"
                    >
                      {decision}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSave}
                className="bg-amber-500 hover:bg-amber-600 text-purple-950 text-xs font-black py-3 px-6 rounded-2xl shadow-md transition-all cursor-pointer flex-1 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ في السحابة السليمة ☁️</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setActiveEntry(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black py-3 px-5 rounded-2xl transition-all cursor-pointer border border-slate-200"
              >
                إلغاء
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

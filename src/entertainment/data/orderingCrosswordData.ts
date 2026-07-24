// Data for the ordering (bible_order) and crossword solo games, ported
// from the source EntertainmentDashboard (defined inline there).

export interface OrderItem { id: string; name: string; order: number; }

export const BIBLE_ORDER_SETS: OrderItem[][] = [
  [
    { id: 'bo1_1', name: "🕊️ طوفان نوح وإرسال الغراب والحمامة لرؤية جفاف الأرض", order: 1 },
    { id: 'bo1_2', name: "🕯️ تسلّم موسى لوحي الشريعة والوصايا العشر على جبل سيناء", order: 2 },
    { id: 'bo1_3', name: "👑 مسح داود النبي ملكاً على بيت إسرائيل بيد صموئيل", order: 3 },
    { id: 'bo1_4', name: "💒 ميلاد مخلصنا الصالح يسوع المسيح في مغارة بيت لحم", order: 4 },
  ],
  [
    { id: 'bo2_1', name: "🛡️ نجاة دانيال النبي من جب الأسود الجائعة في بابل", order: 1 },
    { id: 'bo2_2', name: "🗺️ بشارة الملاك غبريال لزكريا الكاهن بميلاد يوحنا المعمدان", order: 2 },
    { id: 'bo2_3', name: "🌊 معمودية السيد المسيح له المجد في نهر الأردن بيد يوحنا", order: 3 },
    { id: 'bo2_4', name: "⛪ كتابة القديس يوحنا لسفر الرؤيا في جزيرة بطمس", order: 4 },
  ]
];

export interface CrosswordClue { clue: string; answer: string; }

export const CROSSWORD_CLUES: CrosswordClue[] = [
  { clue: "أول أسفار العهد القديم وتاريخ الخليقة الأولى", answer: "تكوين" },
  { clue: "أول ملوك شعب بني إسرائيل وممسوح بالدهن المقدس", answer: "شاول" },
  { clue: "النبي كليم الله العظيم الذي قاد الشعب في البرية", answer: "موسى" },
  { clue: "الفادي المخلص الصالح رئيس الكنيسة ورئيس الإيمان", answer: "يسوع" },
  { clue: "رسول الأمم الكارز بالنعمة والمكتوب في رسائل بليغة", answer: "بولس" }
];

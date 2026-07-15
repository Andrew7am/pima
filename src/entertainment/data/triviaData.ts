// Standalone trivia dataset — imported from the earlier standalone
// prototype and trimmed to just the base questions + Bible data we
// need for phase 1 (solo trivia). The prototype also generated random
// "how many chapters" / "which letter" / "which tribe" / "what does
// this name mean" questions at runtime from BIBLE_BOOKS_CHAPTERS,
// PAUL_LETTERS, CHARACTER_TRIBES and NAME_MEANINGS — kept those tables
// exported so we can plug the same generator back in when we need
// more variety, but the game only reads BASE_TRIVIA_QUESTIONS today.

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

export interface BookChapterData {
  name: string;
  chapters: number;
  testament: "العهد القديم" | "العهد الجديد";
}

export interface NameMeaningData {
  name: string;
  meaning: string;
}

export interface CharacterTribeData {
  name: string;
  tribe: string;
}

export const BASE_TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    question: "كم عدد الأسفار القانونية في العهد القديم (حسب الترجمة السبعينية التقليدية بما فيها الأسفار القانونية الثانية)؟",
    options: ["٣٩ سفراً", "٤٦ سفراً", "٢٧ سفراً", "٥٠ سفراً"],
    correctIdx: 1,
    explanation: "يحتوي العهد القديم في الكنيسة الأرثوذكسية على ٤٦ سفراً تشمل الأسفار القانونية الثانية."
  },
  {
    question: "من هو النبي الذي صعد إلى السماء في مركبة نارية وفرسان ناريين أمام تلميذه أليشع؟",
    options: ["إشعياء النبي", "أرميا النبي", "إيليا النبي", "موسى النبي"],
    correctIdx: 2,
    explanation: "صعد إيليا النبي إلى السماء في عاصفة ومركبة نارية في ملوك الثاني ٢."
  },
  {
    question: "ما هو اسم الجبل الذي تجلى عليه السيد المسيح أمام تلاميذه بطرس ويعقوب ويوحنا؟",
    options: ["جبل الزيتون", "جبل طابور", "جبل سيناء", "جبل جرزيم"],
    correctIdx: 1,
    explanation: "بحسب التقليد الكنسي الشريف، تجلي السيد المسيح حدث على جبل طابور."
  },
  {
    question: "من هي المرأة التي قال عنها يسوع أنها اختارت النصيب الصالح الذي لن ينزع منها؟",
    options: ["مريم أخت لعازر", "مرثا أختها", "مريم المجدلية", "السامرية"],
    correctIdx: 0,
    explanation: "قال الرب لمرثا: 'ولكن الحاجة إلى واحد. فاختارت مريم النصيب الصالح الذي لن ينزع منها' (لوقا ١٠: ٤٢)."
  },
  {
    question: "ما هي المدينة التي أسقط يشوع بن نون أسوارها بعد الدوران حولها سبعة أيام مع الكهنة والأبواق؟",
    options: ["أورشليم", "نينوى", "أريحا", "سامرة"],
    correctIdx: 2,
    explanation: "سقطت أسوار أريحا بعد الدوران حولها سبعة أيام وصراخ الشعب وسماع الأبواق (يشوع ٦)."
  },
  {
    question: "ما هو أطول سفر في أسفار الكتاب المقدس بأكمله من حيث عدد الإصحاحات؟",
    options: ["سفر إشعياء", "سفر المزامير", "سفر التكوين", "سفر أرميا"],
    correctIdx: 1,
    explanation: "سفر المزامير هو أطول أسفار الكتاب المقدس، حيث يحتوي على ١٥٠ مزموراً (أو ١٥١ حسب الترجمة السبعينية التقليدية)."
  },
  {
    question: "كم عدد المجامع المسكونية الثلاثة الأولى التي تعترف بها الكنيسة القبطية الأرثوذكسية؟",
    options: ["٣ مجامع", "٤ مجامع", "٧ مجامع", "٢ مجمعين"],
    correctIdx: 0,
    explanation: "تعترف الكنيسة القبطية الأرثوذكسية بثلاثة مجامع مسكونية فقط هي: مجمع نيقية (٣٢٥م)، مجمع القسطنطينية (٣٨١م)، ومجمع أفسس (٤٣١م)."
  },
  {
    question: "من هو التلميذ الذي لم يصدق قيامة الرب يسوع في البداية حتى رأى ولمس آثار المسامير وجنبه؟",
    options: ["يهوذا الإسخريوطي", "فيلبس", "توما الرسول", "متى العشار"],
    correctIdx: 2,
    explanation: "توما الرسول شك في القيامة في البداية حتى ظهر له الرب يسوع وقال له: 'هات إصبعك إلى هنا وأبصر يدي، وهات يدك وضعها في جنبي، ولا تكن غير مؤمن بل مؤمناً' (يوحنا ٢٠: ٢٧)."
  },
  {
    question: "من هو أول بطريرك (بابا) لكرسي الإسكندرية ومؤسس الكنيسة القبطية الأرثوذكسية في مصر ومؤلف أحد الأناجيل؟",
    options: ["القديس أثناسيوس الرسولي", "مارمرقس الرسول", "القديس كيرلس الكبير", "القديس أنطونيوس الكبير"],
    correctIdx: 1,
    explanation: "مارمرقس الرسول كاروز الديار المصرية هو كاتب إنجيل مرقس وأول بطريرك لكرسي الإسكندرية القبطي الأرثوذكسي."
  },
  {
    question: "ما هي المعجزة الأولى التي صنعها السيد المسيح في بداية خدمته الجهارية وبطلب من أمه العذراء مريم؟",
    options: ["إقامة لعازر من الموت", "شفاء المولود أعمى", "تحويل الماء خمراً في قانا الجليل", "إشباع الجموع بالخمس خبزات"],
    correctIdx: 2,
    explanation: "كانت المعجزة الأولى هي تحويل الماء إلى خمر في عرس قانا الجليل كما ورد في إنجيل يوحنا الإصحاح الثاني."
  },
  {
    question: "من هو أول شهيد في المسيحية رُجم بالحجارة وهو يصلي لأجل راجميه قائلاً 'يا رب لا تقم لهم هذه الخطية'؟",
    options: ["القديس يعقوب الرسول", "القديس إستفانوس رئيس الشمامسة", "مارجرجس البطل", "القديس أندراوس الرسول"],
    correctIdx: 1,
    explanation: "استشهد القديس إستفانوس رجمًا بالحجارة خارج أسوار أورشليم، وكان شاول (بولس) راضياً بموته وحافظاً لثياب راجميه (أعمال الرسل ٧)."
  },
  {
    question: "كم عدد التلاميذ (الرسل) الذين اختارهم الرب يسوع وأرسلهم اثنين اثنين للكرز والبشارة قبل صلبه؟",
    options: ["٥٠ رسولاً", "٧٠ رسولاً", "١٢٠ رسولاً", "٣٠ رسولاً"],
    correctIdx: 1,
    explanation: "عين الرب سبعين رسولاً آخرين أيضاً وأرسلهم اثنين اثنين أمام وجهه إلى كل مدينة وموضع (لوقا ١٠: ١)."
  },
  {
    question: "من هو أول بطريرك من رهبان دير القديس أنطونيوس، وقاد الكنيسة في ظروف دقيقة واهتم بالتعليم والطباعة؟",
    options: ["البابا كيرلس الرابع (أبو الإصلاح)", "البابا كيرلس الخامس", "البابا كيرلس السادس", "البابا شنودة الثالث"],
    correctIdx: 0,
    explanation: "البابا كيرلس الرابع البطريرك الـ١١٠ لُقب بـ 'أبو الإصلاح' نظراً لإنجازاته الكبرى في تأسيس المدارس واستيراد أول مطبعة كنسية وتعليم البنات."
  },
  {
    question: "في أي سفر من أسفار العهد الجديد وردت الآية الشهيرة: 'لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ'؟",
    options: ["إنجيل متى", "رسالة رومية", "إنجيل يوحنا", "رسالة أفسس"],
    correctIdx: 2,
    explanation: "وردت هذه الآية العظيمة في إنجيل يوحنا الإصحاح الثالث والآية ١٦ (يوحنا ٣: ١٦)."
  },
  {
    question: "من هي القديسة المصرية العظيمة التي تسمى بـ 'أم الرهبنة النسائية' والتي عاشت مع أخيها القديس جرجس وتأسست باسمها أديرة راهبات؟",
    options: ["القديسة دميانة", "القديسة هيلانة", "القديسة فيبى", "القديسة كاترين"],
    correctIdx: 0,
    explanation: "القديسة دميانة هي شفيعة الرهبنة النسائية في مصر، والتي استشهدت مع الأربعين عذراء دفاعاً عن الإيمان المستقيم."
  },
  {
    question: "كم عدد الأعياد السيدية الكبرى في الكنيسة القبطية الأرثوذكسية؟",
    options: ["٧ أعياد", "٥ أعياد", "٩ أعياد", "١٢ عيداً"],
    correctIdx: 0,
    explanation: "تحفّل الكنيسة بـ ٧ أعياد سيدية كبرى (البشارة، الميلاد، الغطاس، الشعانين، القيامة، الصعود، العنصرة) و٧ أعياد سيدية صغرى."
  }
];

export const BIBLE_BOOKS_CHAPTERS: BookChapterData[] = [
  { name: "التكوين", chapters: 50, testament: "العهد القديم" },
  { name: "الخروج", chapters: 40, testament: "العهد القديم" },
  { name: "اللاويين", chapters: 27, testament: "العهد القديم" },
  { name: "العدد", chapters: 36, testament: "العهد القديم" },
  { name: "التثنية", chapters: 34, testament: "العهد القديم" },
  { name: "يشوع", chapters: 24, testament: "العهد القديم" },
  { name: "القضاة", chapters: 21, testament: "العهد القديم" },
  { name: "راعوث", chapters: 4, testament: "العهد القديم" },
  { name: "صموئيل الأول", chapters: 31, testament: "العهد القديم" },
  { name: "صموئيل الثاني", chapters: 24, testament: "العهد القديم" },
  { name: "الملوك الأول", chapters: 22, testament: "العهد القديم" },
  { name: "الملوك الثاني", chapters: 25, testament: "العهد القديم" },
  { name: "أخبار الأيام الأول", chapters: 29, testament: "العهد القديم" },
  { name: "أخبار الأيام الثاني", chapters: 36, testament: "العهد القديم" },
  { name: "عزرا", chapters: 10, testament: "العهد القديم" },
  { name: "نحميا", chapters: 13, testament: "العهد القديم" },
  { name: "أستير", chapters: 10, testament: "العهد القديم" },
  { name: "أيوب", chapters: 42, testament: "العهد القديم" },
  { name: "المزامير", chapters: 150, testament: "العهد القديم" },
  { name: "الأمثال", chapters: 31, testament: "العهد القديم" },
  { name: "الجامعة", chapters: 12, testament: "العهد القديم" },
  { name: "نشيد الأنشاد", chapters: 8, testament: "العهد القديم" },
  { name: "إشعياء", chapters: 66, testament: "العهد القديم" },
  { name: "أرميا", chapters: 52, testament: "العهد القديم" },
  { name: "مراثي أرميا", chapters: 5, testament: "العهد القديم" },
  { name: "حزقيال", chapters: 48, testament: "العهد القديم" },
  { name: "دانيال", chapters: 14, testament: "العهد القديم" },
  { name: "هوشع", chapters: 14, testament: "العهد القديم" },
  { name: "يوئيل", chapters: 3, testament: "العهد القديم" },
  { name: "عاموس", chapters: 9, testament: "العهد القديم" },
  { name: "عوبديا", chapters: 1, testament: "العهد القديم" },
  { name: "يونان", chapters: 4, testament: "العهد القديم" },
  { name: "ميخا", chapters: 7, testament: "العهد القديم" },
  { name: "ناحوم", chapters: 3, testament: "العهد القديم" },
  { name: "حبقوق", chapters: 3, testament: "العهد القديم" },
  { name: "صفنيا", chapters: 3, testament: "العهد القديم" },
  { name: "حجي", chapters: 2, testament: "العهد القديم" },
  { name: "زكريا", chapters: 14, testament: "العهد القديم" },
  { name: "ملاخي", chapters: 4, testament: "العهد القديم" },
  { name: "متى", chapters: 28, testament: "العهد الجديد" },
  { name: "مرقس", chapters: 16, testament: "العهد الجديد" },
  { name: "لوقا", chapters: 24, testament: "العهد الجديد" },
  { name: "يوحنا", chapters: 21, testament: "العهد الجديد" },
  { name: "أعمال الرسل", chapters: 28, testament: "العهد الجديد" },
  { name: "رومية", chapters: 16, testament: "العهد الجديد" },
  { name: "كورنثوس الأولى", chapters: 16, testament: "العهد الجديد" },
  { name: "كورنثوس الثانية", chapters: 13, testament: "العهد الجديد" },
  { name: "غلاطية", chapters: 6, testament: "العهد الجديد" },
  { name: "أفسس", chapters: 6, testament: "العهد الجديد" },
  { name: "فيلبي", chapters: 4, testament: "العهد الجديد" },
  { name: "كولوسي", chapters: 4, testament: "العهد الجديد" },
  { name: "تسالونيكي الأولى", chapters: 5, testament: "العهد الجديد" },
  { name: "تسالونيكي الثانية", chapters: 3, testament: "العهد الجديد" },
  { name: "تيموثاوس الأولى", chapters: 6, testament: "العهد الجديد" },
  { name: "تيموثاوس الثانية", chapters: 4, testament: "العهد الجديد" },
  { name: "تيطس", chapters: 3, testament: "العهد الجديد" },
  { name: "فليمون", chapters: 1, testament: "العهد الجديد" },
  { name: "العبرانيين", chapters: 13, testament: "العهد الجديد" },
  { name: "يعقوب", chapters: 5, testament: "العهد الجديد" },
  { name: "بطرس الأولى", chapters: 5, testament: "العهد الجديد" },
  { name: "بطرس الثانية", chapters: 3, testament: "العهد الجديد" },
  { name: "يوحنا الأولى", chapters: 5, testament: "العهد الجديد" },
  { name: "يوحنا الثانية", chapters: 1, testament: "العهد الجديد" },
  { name: "يوحنا الثالثة", chapters: 1, testament: "العهد الجديد" },
  { name: "يهوذا", chapters: 1, testament: "العهد الجديد" },
  { name: "الرؤيا", chapters: 22, testament: "العهد الجديد" }
];

export const PAUL_LETTERS: string[] = [
  "رومية", "كورنثوس الأولى", "كورنثوس الثانية", "غلاطية", "أفسس", "فيلبي", 
  "كولوسي", "تسالونيكي الأولى", "تسالونيكي الثانية", "تيموثاوس الأولى", 
  "تيموثاوس الثانية", "تيطس", "فليمون", "العبرانيين"
];

export const CHARACTER_TRIBES: CharacterTribeData[] = [
  { name: "موسى النبي", tribe: "سبط لاوي" },
  { name: "هارون الكاهن", tribe: "سبط لاوي" },
  { name: "داود الملك", tribe: "سبط يهوذا" },
  { name: "شاول الملك", tribe: "سبط بنيامين" },
  { name: "بولس الرسول", tribe: "سبط بنيامين" },
  { name: "يشوع بن نون", tribe: "سبط أفرايم" },
  { name: "جدعون القاضي", tribe: "سبط منسى" }
];

export const NAME_MEANINGS: NameMeaningData[] = [
  { name: "إبراهيم", meaning: "أب لجمهور كثير" },
  { name: "سارة", meaning: "أميرة" },
  { name: "إسحق", meaning: "يضحك" },
  { name: "يعقوب", meaning: "يعقب أو يمسك العقب" },
  { name: "موسى", meaning: "المنتشل من الماء" },
  { name: "يشوع", meaning: "الرب يخلص" },
  { name: "صموئيل", meaning: "سألته من الرب" },
  { name: "داود", meaning: "محبوب" },
  { name: "سليمان", meaning: "رجل سلام" },
  { name: "إيليا", meaning: "إلهي هو الرب" },
  { name: "أليشع", meaning: "الله خلاصي" },
  { name: "إشعياء", meaning: "خلاص الرب" },
  { name: "أرميا", meaning: "الرب يؤسس أو يرفع" },
  { name: "حزقيال", meaning: "الله يقوي" },
  { name: "دانيال", meaning: "الله قاضي" },
  { name: "هوشع", meaning: "خلاص" },
  { name: "يوحنا", meaning: "الله حنان" },
  { name: "بطرس", meaning: "صخرة" },
  { name: "توما", meaning: "توأم" },
  { name: "مرقس", meaning: "مطرقة" },
  { name: "لوقا", meaning: "حامل النور" },
  { name: "متى", meaning: "عطية الله" },
  { name: "برنابا", meaning: "ابن الوعظ أو العزاء" },
  { name: "تيموثاوس", meaning: "عابد الله" }
];

import { TRIVIA_QUESTIONS, WHO_AM_I_QUESTIONS, HYMN_QUESTIONS } from "./entertainmentData";
import { RAW_VERSES } from './data/versesData';

export interface SmartQuestion {
  id: string;
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  category: "الكتاب المقدس" | "اللاهوت والعقيدة" | "الألحان والقبطي" | "تاريخ الكنيسة والطقوس" | "القديسون والشخصيات";
  difficulty: "سهل" | "متوسط" | "صعب";
}

// Global runtime pool of questions (initialized on import)
let RUNTIME_QUESTION_POOL: SmartQuestion[] = [];

// Helper to calculate a unique ID for static questions
const generateHashId = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `static_${Math.abs(hash).toString(36)}`;
};

/**
 * Shuffles the options of a multiple choice question and updates correctIdx.
 */
export const shuffleQuestionOptions = (q: SmartQuestion): SmartQuestion => {
  const originalCorrectOption = q.options[q.correctIdx];
  const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
  const newCorrectIdx = shuffledOptions.indexOf(originalCorrectOption);
  return {
    ...q,
    options: shuffledOptions,
    correctIdx: newCorrectIdx >= 0 ? newCorrectIdx : 0
  };
};

/**
 * Initializes the runtime question pool from static arrays with programmatically assigned metadata.
 */
export const initializeQuestionPool = (): SmartQuestion[] => {
  if (RUNTIME_QUESTION_POOL.length > 0) {
    return RUNTIME_QUESTION_POOL;
  }

  const pool: SmartQuestion[] = [];

  // 1. Process TRIVIA_QUESTIONS
  TRIVIA_QUESTIONS.forEach((t) => {
    const id = generateHashId(t.question);
    
    // Categorization
    let category: SmartQuestion["category"] = "الكتاب المقدس";
    if (t.question.includes("مجمع") || t.question.includes("مجمعين") || t.question.includes("بطريرك") || t.question.includes("دير") || t.question.includes("بابا") || t.question.includes("طقس") || t.question.includes("كنيسة")) {
      category = "تاريخ الكنيسة والطقوس";
    } else if (t.question.includes("قديس") || t.question.includes("شهيد") || t.question.includes("مار")) {
      category = "القديسون والشخصيات";
    } else if (t.question.includes("لاهوت") || t.question.includes("عقيدة") || t.question.includes("إيمان")) {
      category = "اللاهوت والعقيدة";
    } else if (t.question.includes("لحن") || t.question.includes("تسبحة") || t.question.includes("اللغة القبطية")) {
      category = "الألحان والقبطي";
    }

    // Difficulty
    let difficulty: SmartQuestion["difficulty"] = "متوسط";
    if (t.question.includes("إصحاح") || t.question.includes("معنى اسم") || t.question.includes("سبط")) {
      difficulty = "صعب";
    } else if (t.question.includes("أول شهيد") || t.question.includes("المدينة التي أسقط") || t.question.includes("أطول سفر")) {
      difficulty = "سهل";
    }

    pool.push({
      id,
      question: t.question,
      options: t.options,
      correctIdx: t.correctIdx,
      explanation: t.explanation || "",
      category,
      difficulty
    });
  });

  // 2. Process WHO_AM_I_QUESTIONS
  WHO_AM_I_QUESTIONS.forEach((w) => {
    const cluesText = w.clues.join(" | ");
    const id = generateHashId(cluesText);
    const correctIdx = w.options.indexOf(w.correctAnswer);

    pool.push({
      id,
      question: `من أكون؟ خمن الشخصية من القرائن:\n` + w.clues.map((c) => `• ${c}`).join("\n"),
      options: w.options,
      correctIdx: correctIdx >= 0 ? correctIdx : 0,
      explanation: w.explanation || "",
      category: "القديسون والشخصيات",
      difficulty: "متوسط"
    });
  });

  // 3. Process HYMN_QUESTIONS
  HYMN_QUESTIONS.forEach((h) => {
    const id = generateHashId(h.question);

    let category: SmartQuestion["category"] = "الألحان والقبطي";
    let difficulty: SmartQuestion["difficulty"] = "متوسط";

    if (h.question.includes("معنى الكلمة")) {
      difficulty = "صعب";
    } else if (h.question.includes("أليلويا") || h.question.includes("كيرياليسون")) {
      difficulty = "سهل";
    }

    pool.push({
      id,
      question: h.question,
      options: h.options,
      correctIdx: h.correctIdx,
      explanation: h.explanation || "",
      category,
      difficulty
    });
  });

  // 4. Process RAW_VERSES
  RAW_VERSES.forEach((v) => {
    const id = generateHashId(v.verse);

    // Dynamic choice generation for verses
    const wrongWords = RAW_VERSES.filter((rv) => rv.word !== v.word)
      .map((rv) => rv.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [v.word, ...wrongWords].sort(() => Math.random() - 0.5);
    const correctIdx = options.indexOf(v.word);

    let difficulty: SmartQuestion["difficulty"] = "متوسط";
    if (v.verse.includes("يوحنا ٣:١٦") || v.verse.includes("مزمور ٢٣:١") || v.verse.includes("١ يوحنا ٤:١٦")) {
      difficulty = "سهل";
    } else if (v.verse.includes("ملاخي") || v.verse.includes("تثنية") || v.verse.includes("أمثال")) {
      difficulty = "صعب";
    }

    pool.push({
      id,
      question: `أكمل الآية الروحية:\n"${v.verse}"`,
      options,
      correctIdx: correctIdx >= 0 ? correctIdx : 0,
      explanation: v.explanation || "",
      category: "الكتاب المقدس",
      difficulty
    });
  });

  RUNTIME_QUESTION_POOL = pool;
  return RUNTIME_QUESTION_POOL;
};

/**
 * Gets the current count of questions in the runtime pool by category
 */
export const getPoolStats = () => {
  const pool = initializeQuestionPool();
  const stats = {
    total: pool.length,
    byCategory: {} as Record<string, number>,
    byDifficulty: {} as Record<string, number>
  };

  pool.forEach((q) => {
    stats.byCategory[q.category] = (stats.byCategory[q.category] || 0) + 1;
    stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] || 0) + 1;
  });

  return stats;
};

/**
 * Dynamically appends AI generated questions to the pool
 */
export const appendQuestionsToPool = (questions: SmartQuestion[]) => {
  const pool = initializeQuestionPool();
  const existingIds = new Set(pool.map((q) => q.id));
  
  questions.forEach((q) => {
    if (!existingIds.has(q.id)) {
      pool.push(q);
    }
  });
  RUNTIME_QUESTION_POOL = pool;
};

/**
 * Highly customized, smart selector that complies with all requested constraints.
 */
export const getSmartQuestionRound = (
  gameType: "trivia" | "speed" | "timerush" | "auction" | "whoami" | "fillverse",
  limit = 10,
  playedIds: string[] = [],
  playerHistoryIds: string[] = []
): SmartQuestion[] => {
  const allPool = initializeQuestionPool();
  
  // Combine filters to avoid repetition in session and player history
  const excludedIds = new Set([...playedIds, ...playerHistoryIds]);
  
  let candidates = allPool.filter((q) => !excludedIds.has(q.id));
  
  // Specific Game Type filters to keep matches themed correctly if desired
  if (gameType === "whoami") {
    candidates = candidates.filter((q) => q.category === "القديسون والشخصيات" || q.question.includes("من أكون"));
  } else if (gameType === "fillverse") {
    candidates = candidates.filter((q) => q.question.includes("أكمل الآية"));
  } else if (gameType === "trivia" || gameType === "speed" || gameType === "timerush" || gameType === "auction") {
    candidates = candidates.filter((q) => !q.question.includes("من أكون") && !q.question.includes("أكمل الآية"));
  }

  // Fallback: If we ran out of questions due to strict filters, reset filter to keep game going safely
  if (candidates.length < limit) {
    if (playedIds.length > 0) {
      // Try resetting room session filter first
      const softExcluded = new Set([...playerHistoryIds]);
      candidates = allPool.filter((q) => !softExcluded.has(q.id));
    }
    
    // If still too small, reset both completely
    if (candidates.length < limit) {
      candidates = allPool;
    }
  }

  // Shuffle candidates initially to ensure "كل لعبة تبدأ بأسئلة مختلفة"
  candidates = candidates.sort(() => Math.random() - 0.5);

  // Group by difficulty
  const easy = candidates.filter((q) => q.difficulty === "سهل");
  const medium = candidates.filter((q) => q.difficulty === "متوسط");
  const hard = candidates.filter((q) => q.difficulty === "صعب");

  // Determine difficulty distribution (e.g. 30% Easy, 40% Medium, 30% Hard)
  const targetEasyCount = Math.max(1, Math.round(limit * 0.3));
  const targetHardCount = Math.max(1, Math.round(limit * 0.3));
  const targetMediumCount = limit - targetEasyCount - targetHardCount;

  const selected: SmartQuestion[] = [];

  // Helper to draw from a list safely
  const draw = (list: SmartQuestion[], count: number) => {
    let drawn = 0;
    for (let i = 0; i < list.length && drawn < count; i++) {
      selected.push(list[i]);
      drawn++;
    }
    return drawn;
  };

  // Draw according to target distribution
  const easyDrawn = draw(easy, targetEasyCount);
  const hardDrawn = draw(hard, targetHardCount);
  const mediumDrawn = draw(medium, targetMediumCount + (targetEasyCount - easyDrawn) + (targetHardCount - hardDrawn));

  // If we still need more questions, draw remaining from all candidates
  if (selected.length < limit) {
    const remainingNeeded = limit - selected.length;
    const currentIds = new Set(selected.map((s) => s.id));
    const extraCandidates = candidates.filter((c) => !currentIds.has(c.id));
    draw(extraCandidates, remainingNeeded);
  }

  // Balance categories and shuffle choice order for each question!
  return selected
    .sort(() => Math.random() - 0.5) // Shuffle the final round order
    .map((q) => shuffleQuestionOptions(q)); // Shuffle option orders and recalculate correctIdx!
};

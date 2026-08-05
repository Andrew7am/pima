import { HYMN_SEASONS, MIDNIGHT_PRAISE_HOSES, LITURGICAL_BOOKS } from './hymnsData';
import { CROSSWORD_CLUES, BIBLE_ORDER_SETS } from './orderingCrosswordData';
import { CHAR_GUESS_QUESTIONS, VERSE_TEST_QUESTIONS, INTERPRET_CHALLENGE_QUESTIONS } from './themedQuestions';

/**
 * More questions, built from data the project already curated.
 *
 * Not written by me. Every question below is a rephrasing of a pair that
 * already exists in this folder — a hymn and its season, a book and its
 * purpose, a clue and its answer — so the fact being asked about was decided
 * by whoever wrote the data, not by whatever a model believes about Coptic
 * liturgy. Nothing here invents a doctrine, a date or a name.
 *
 * Six sources were sitting unused: HYMN_SEASONS, MIDNIGHT_PRAISE_HOSES,
 * LITURGICAL_BOOKS, CROSSWORD_CLUES, BIBLE_ORDER_SETS, and the three
 * ready-made sets in themedQuestions that nothing imported.
 *
 * The wrong answers are drawn from the same column of other rows, which is
 * why every value in each source has to be distinct — otherwise a distractor
 * could quietly be correct too. That is asserted in the tests rather than
 * assumed.
 */

export interface DerivedQuestion {
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
  category: 'الكتاب المقدس' | 'اللاهوت والعقيدة' | 'الألحان والقبطي' | 'تاريخ الكنيسة والطقوس' | 'القديسون والشخصيات';
  difficulty: 'سهل' | 'متوسط' | 'صعب';
}

function pickDistractors(all: string[], correct: string, n = 3): string[] {
  const others = all.filter((v) => v !== correct);
  // Deterministic order in, shuffled once here — the pool shuffles again per
  // round, and questionPoolEngine re-shuffles the options themselves.
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, n);
}

function mcq(
  question: string,
  correct: string,
  allValues: string[],
  explanation: string,
  category: DerivedQuestion['category'],
  difficulty: DerivedQuestion['difficulty'] = 'متوسط',
): DerivedQuestion | null {
  const distractors = pickDistractors(allValues, correct);
  // Fewer than two wrong answers is a coin flip, not a question.
  if (distractors.length < 2) return null;
  const options = [correct, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { question, options, correctIdx: options.indexOf(correct), explanation, category, difficulty };
}

export function buildDerivedQuestions(): DerivedQuestion[] {
  const out: DerivedQuestion[] = [];
  const push = (q: DerivedQuestion | null) => { if (q) out.push(q); };

  // A hymn and when it is sung.
  const seasons = HYMN_SEASONS.map((h) => h.season);
  HYMN_SEASONS.forEach((h) => push(mcq(
    `في أي مناسبة يُرتَّل "${h.hymn}"؟`,
    h.season, seasons,
    `${h.hymn} — ${h.season}.`,
    'الألحان والقبطي',
  )));

  // The four hoses of the midnight praise.
  const topics = MIDNIGHT_PRAISE_HOSES.map((x) => x.topic);
  MIDNIGHT_PRAISE_HOSES.forEach((x) => push(mcq(
    `ما موضوع "${x.name}" في تسبحة نصف الليل؟`,
    x.topic, topics,
    `${x.name}: ${x.topic}`,
    'الألحان والقبطي', 'صعب',
  )));

  // What each liturgical book contains.
  const purposes = LITURGICAL_BOOKS.map((b) => b.purpose);
  LITURGICAL_BOOKS.forEach((b) => push(mcq(
    `ماذا يضم كتاب "${b.book}"؟`,
    b.purpose, purposes,
    `${b.book}: ${b.purpose}`,
    'تاريخ الكنيسة والطقوس',
  )));

  // The crossword clues are already questions with one answer each.
  const answers = CROSSWORD_CLUES.map((c) => c.answer);
  CROSSWORD_CLUES.forEach((c) => push(mcq(
    `${c.clue}؟`,
    c.answer, answers,
    `الإجابة: ${c.answer}.`,
    'الكتاب المقدس', 'سهل',
  )));

  // Which of two events came first — the sets carry the order.
  BIBLE_ORDER_SETS.forEach((set) => {
    const sorted = [...set].sort((a, b) => a.order - b.order);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const earlier = sorted[i], later = sorted[j];
        const options = Math.random() < 0.5
          ? [earlier.name, later.name]
          : [later.name, earlier.name];
        out.push({
          // The pair is IN the text on purpose. questionPoolEngine dedupes
          // derived questions by question text, and every one of these used to
          // read the same bare sentence — so eleven of the twelve were built
          // and then silently thrown away, and the app only ever asked one.
          question: `أي الحدثين حدث أولاً؟ — ${options[0]} أم ${options[1]}؟`,
          options,
          correctIdx: options.indexOf(earlier.name),
          explanation: `${earlier.name} — ثم ${later.name}.`,
          category: 'الكتاب المقدس',
          difficulty: 'متوسط',
        });
      }
    }
  });

  // Three sets written as questions already, which nothing imported.
  [...CHAR_GUESS_QUESTIONS, ...VERSE_TEST_QUESTIONS, ...INTERPRET_CHALLENGE_QUESTIONS].forEach((q) => {
    if (!q || !Array.isArray(q.options) || q.options.length < 2) return;
    if (typeof q.correctIdx !== 'number' || q.correctIdx < 0 || q.correctIdx >= q.options.length) return;
    out.push({
      question: q.question,
      options: q.options,
      correctIdx: q.correctIdx,
      explanation: q.explanation || '',
      category: 'الكتاب المقدس',
      difficulty: 'متوسط',
    });
  });

  return out;
}

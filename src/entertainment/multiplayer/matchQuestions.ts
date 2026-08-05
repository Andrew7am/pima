import type { GameMode, RoomQuestion, MatchStageId } from '../multiplayer';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import { RAW_VERSES } from '../data/versesData';
import { RAW_CHARACTERS } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';
import { initializeQuestionPool, getSmartQuestionRound } from '../questionPoolEngine';
import { pickUnseen } from '../questionHistory';

/**
 * The questions a live match is played on.
 *
 * Lifted out of MultiplayerLobby so the random-match screen can start a real
 * match too. Both entry points have to build the same shape — the server
 * checks the answer against `correctIdx` in submit_answer, so a second,
 * slightly different builder would be a second way to get that wrong.
 *
 * Drawn from questionPoolEngine, which the app already builds and which
 * already carries 449 questions across five categories with a difficulty
 * spread and repeat-avoidance. A trivia match used to slice five off
 * BASE_TRIVIA_QUESTIONS — a hand-written list of SIXTEEN — so four games saw
 * the whole thing. The literals below stay as a floor: if a filter ever comes
 * back short, a match still starts rather than failing on the RPC's
 * three-question minimum.
 */
export const MATCH_LENGTH = 5;

/** The category the pool files hymn and Coptic-language questions under. */
const HYMN_CATEGORY = 'الألحان والقبطي';

/**
 * Questions for a random match — three stages of two, in a fixed order.
 *
 * The lobby's modes are a choice the player made, so those stay themed and
 * unstaged. A «مباراة عشوائية» is not a choice: it used to be five questions
 * shuffled out of the whole pool, which meant the variety was real but the
 * player had no way to see it — a «من أنا؟» clue and a fill-in-the-verse
 * looked the same and arrived back to back.
 *
 * Both players read the same `questions` array off the room, so the stage
 * boundaries land on the same index for both of them without any extra
 * syncing.
 *
 * The room is still created under the 'trivia' game mode, because that string
 * is the matchmaking queue key — splitting random searchers across four
 * queues would leave people waiting alone.
 */
export function buildRandomMatchQuestions(): RoomQuestion[] {
  const out: RoomQuestion[] = [];
  for (const stage of MATCH_STAGES) {
    const built = STAGE_BUILDERS[stage.id](QUESTIONS_PER_STAGE).map((q) => ({ ...q, stage: stage.id }));
    out.push(...built);
  }
  // A source that comes up short must not shorten the match: both players
  // have to answer every question before finalize_match will settle, and the
  // RPCs reject anything under three. Top up from the general pool, which is
  // the last stage, so the stages stay contiguous.
  if (out.length < RANDOM_MATCH_LENGTH) {
    const missing = RANDOM_MATCH_LENGTH - out.length;
    out.push(...biblePoolQuestions(missing).map((q) => ({ ...q, stage: 'bible' as const })));
  }
  return out;
}

/**
 * The stages a random match walks through, in order.
 *
 * A match used to be five questions drawn from every category at once. The
 * variety was real but invisible — a «من أنا؟» clue and a fill-in-the-verse
 * arrived looking identical, one after another, so the whole thing read as
 * one flat quiz. Grouping them into named stages is the same content with
 * somewhere to stand.
 *
 * Order is deliberate: the clue-based stage opens because it is the easiest
 * to grasp cold, and the general pool closes because it is the widest.
 */
export const MATCH_STAGES: MatchStage[] = [
  {
    id: 'whoami',
    label: 'من أنا؟',
    hint: 'تلميح عن شخصية من الكتاب — اختار مين',
    accent: 'amber',
  },
  {
    id: 'fillverse',
    label: 'كمل الآية',
    hint: 'آية ناقصة كلمة — اختار الكلمة الصح',
    accent: 'emerald',
  },
  {
    id: 'bible',
    label: 'معلومات كتابية',
    hint: 'أسئلة عامة من الكتاب والقديسين والطقس',
    accent: 'sky',
  },
];

export interface MatchStage {
  id: MatchStageId;
  label: string;
  hint: string;
  /** Tailwind colour family; the match screen builds its classes from this. */
  accent: 'amber' | 'emerald' | 'sky';
}

export const QUESTIONS_PER_STAGE = 2;
export const RANDOM_MATCH_LENGTH = MATCH_STAGES.length * QUESTIONS_PER_STAGE;

/** Where a stage's questions come from. */
const STAGE_BUILDERS: Record<MatchStageId, (n: number) => RoomQuestion[]> = {
  whoami: whoAmIQuestions,
  fillverse: fillVerseQuestions,
  bible: biblePoolQuestions,
};

/** Look up the stage a question index sits in, for the match screen. */
export function stageOf(questions: RoomQuestion[], idx: number): MatchStage | null {
  const id = questions[idx]?.stage;
  return id ? MATCH_STAGES.find((s) => s.id === id) ?? null : null;
}

/** True when `idx` is the first question of its stage — where a banner goes. */
export function startsStage(questions: RoomQuestion[], idx: number): boolean {
  const here = questions[idx]?.stage;
  if (!here) return false;
  return idx === 0 || questions[idx - 1]?.stage !== here;
}

function whoAmIQuestions(n: number): RoomQuestion[] {
  const pool = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT];
  const names = pool.map((c) => c.name);
  // Keyed on the clue, because the clue is what becomes the question text —
  // and the question text is the only identity a played match can report back.
  return pickUnseen(pool, (c) => c.clues[0], n).map((c) => {
    const distractors = shuffle(names.filter((x) => x !== c.name)).slice(0, 3);
    const options = shuffle([c.name, ...distractors]);
    // First clue only — in a race, revealing more to one side is not fair.
    return { question: c.clues[0], options, correctIdx: options.indexOf(c.name), explanation: c.explanation };
  });
}

function fillVerseQuestions(n: number): RoomQuestion[] {
  const allWords = Array.from(new Set(RAW_VERSES.map((v) => v.word)));
  return pickUnseen(RAW_VERSES, (v) => v.verse, n).map((v) => {
    const distractors = shuffle(allWords.filter((w) => w !== v.word)).slice(0, 3);
    const options = shuffle([v.word, ...distractors]);
    return { question: v.verse, options, correctIdx: options.indexOf(v.word), explanation: v.explanation };
  });
}

function biblePoolQuestions(n: number): RoomQuestion[] {
  return pickUnseen(initializeQuestionPool(), (q) => q.question, n).map(toRoomQuestion);
}

/** SmartQuestion carries extra fields; a room only needs these four. */
type PoolQuestion = { question: string; options: string[]; correctIdx: number; explanation?: string };
const toRoomQuestion = (q: PoolQuestion): RoomQuestion => ({
  question: q.question,
  options: q.options,
  correctIdx: q.correctIdx,
  explanation: q.explanation,
});

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Build the same shape of question the solo games consume, so both
// sides render the same widget. correctIdx MUST be included — the
// server checks against it in submit_answer.
export function buildQuestions(mode: GameMode): RoomQuestion[] {
  if (mode === 'trivia') {
    const round = getSmartQuestionRound('trivia', MATCH_LENGTH).map(toRoomQuestion);
    if (round.length >= MATCH_LENGTH) return round;
    return shuffle(BASE_TRIVIA_QUESTIONS).slice(0, MATCH_LENGTH);
  }
  if (mode === 'hymns') {
    // The engine has no 'hymns' game type, but it does file these under a
    // category — 112 of them, against the 60 in the literal.
    const hymns = initializeQuestionPool().filter((q) => q.category === HYMN_CATEGORY);
    if (hymns.length >= MATCH_LENGTH) {
      return shuffle(hymns).slice(0, MATCH_LENGTH).map(toRoomQuestion);
    }
    return shuffle(BASE_HYMN_QUESTIONS).slice(0, MATCH_LENGTH);
  }
  if (mode === 'whoami') {
    const round = getSmartQuestionRound('whoami', MATCH_LENGTH).map(toRoomQuestion);
    if (round.length >= MATCH_LENGTH) return round;
  }
  if (mode === 'fillverse') {
    const allWords = Array.from(new Set(RAW_VERSES.map((v) => v.word)));
    return shuffle(RAW_VERSES).slice(0, MATCH_LENGTH).map((v) => {
      const distractors = shuffle(allWords.filter((w) => w !== v.word)).slice(0, 3);
      const options = shuffle([v.word, ...distractors]);
      return {
        question: v.verse, options, correctIdx: options.indexOf(v.word),
        explanation: v.explanation,
      };
    });
  }
  // whoami — reuse OT+NT characters, first clue only in multiplayer (fair)
  const pool = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT];
  const names = pool.map((c) => c.name);
  return shuffle(pool).slice(0, MATCH_LENGTH).map((c) => {
    const distractors = shuffle(names.filter((n) => n !== c.name)).slice(0, 3);
    const options = shuffle([c.name, ...distractors]);
    return {
      question: c.clues[0], options, correctIdx: options.indexOf(c.name),
      explanation: c.explanation,
    };
  });
}

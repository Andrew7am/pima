import type { GameMode, RoomQuestion } from '../multiplayer';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import { RAW_VERSES } from '../data/versesData';
import { RAW_CHARACTERS } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';
import { initializeQuestionPool, getSmartQuestionRound } from '../questionPoolEngine';

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

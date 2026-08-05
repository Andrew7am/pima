import type { GameMode, RoomQuestion, MatchStageId } from '../multiplayer';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import { RAW_VERSES } from '../data/versesData';
import { RAW_CHARACTERS } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';
import { initializeQuestionPool, getSmartQuestionRound } from '../questionPoolEngine';
import { pickUnseen } from '../questionHistory';
import { drawMatchRounds, QUESTIONS_PER_ROUND, type MatchRound } from './rounds';

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
  const rounds = drawMatchRounds();
  const out: RoomQuestion[] = [];

  // Questions already dealt THIS match. Most rounds draw from the same
  // general pool — Speed, Lightning, Survival, Memory and Knowledge all do —
  // and each round asks for its questions separately, so without this a match
  // could ask the same question in two different rounds. The seen-history
  // cannot cover it: that is only written once a match is played.
  const dealt = new Set<string>();
  for (const round of rounds) {
    const built = questionsForRound(round, QUESTIONS_PER_ROUND, dealt)
      .map((q) => ({ ...q, stage: round.id, multiplier: round.multiplier }));
    for (const q of built) dealt.add(q.question);
    out.push(...built);
  }

  // A source that comes up short must not shorten the match: both players
  // have to answer every question before finalize_match will settle, and the
  // RPCs reject anything under three. Top up from the general pool and tag it
  // as part of the final round, so the rounds stay contiguous.
  const wanted = rounds.length * QUESTIONS_PER_ROUND;
  if (out.length < wanted) {
    const last = rounds[rounds.length - 1];
    out.push(...biblePoolQuestions(wanted - out.length, dealt)
      .map((q) => ({ ...q, stage: last.id, multiplier: last.multiplier })));
  }
  return out;
}

/**
 * Where a round's questions come from.
 *
 * Most rounds are a RULE rather than a source — Speed, Lightning, Survival,
 * Memory and Golden all ask general questions and differ in the clock, the
 * scoring and the presentation. Only three rounds have a source of their own,
 * and each of those is data the project already had.
 *
 * Golden asks for the hardest questions the pool can offer, which is a real
 * property of the pool (`difficulty`) rather than a label invented here.
 */
function questionsForRound(round: MatchRound, n: number, exclude: Set<string>): RoomQuestion[] {
  if (round.id === 'whoami') return whoAmIQuestions(n, exclude);
  if (round.id === 'fillverse') return fillVerseQuestions(n, exclude);
  if (round.id === 'golden') return hardestPoolQuestions(n, exclude);
  return biblePoolQuestions(n, exclude);
}

/**
 * The pool grades its own questions, so «أصعب الأسئلة» is a filter and not a
 * claim. Falls back to the whole pool if the hard slice ever runs dry against
 * this player's history, because a short round cannot be finalised.
 */
function hardestPoolQuestions(n: number, exclude: Set<string> = new Set()): RoomQuestion[] {
  const hard = initializeQuestionPool().filter((q) => q.difficulty === 'صعب' && !exclude.has(q.question));
  const picked = pickUnseen(hard, (q) => q.question, n);
  if (picked.length >= n) return picked.map(toRoomQuestion);
  const taken = new Set([...exclude, ...picked.map((q) => q.question)]);
  return [...picked.map(toRoomQuestion), ...biblePoolQuestions(n - picked.length, taken)];
}

function whoAmIQuestions(n: number, exclude: Set<string> = new Set()): RoomQuestion[] {
  const pool = [...RAW_CHARACTERS, ...RAW_CHARACTERS_NT].filter((c) => !exclude.has(c.clues[0]));
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

function fillVerseQuestions(n: number, exclude: Set<string> = new Set()): RoomQuestion[] {
  const allWords = Array.from(new Set(RAW_VERSES.map((v) => v.word)));
  const verses = RAW_VERSES.filter((v) => !exclude.has(v.verse));
  return pickUnseen(verses, (v) => v.verse, n).map((v) => {
    const distractors = shuffle(allWords.filter((w) => w !== v.word)).slice(0, 3);
    const options = shuffle([v.word, ...distractors]);
    return { question: v.verse, options, correctIdx: options.indexOf(v.word), explanation: v.explanation };
  });
}

function biblePoolQuestions(n: number, exclude: Set<string> = new Set()): RoomQuestion[] {
  const pool = initializeQuestionPool().filter((q) => !exclude.has(q.question));
  return pickUnseen(pool, (q) => q.question, n).map(toRoomQuestion);
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

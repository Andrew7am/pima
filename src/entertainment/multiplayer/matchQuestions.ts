import type { GameMode, RoomQuestion } from '../multiplayer';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import { RAW_VERSES } from '../data/versesData';
import { RAW_CHARACTERS } from '../data/whoAmIData';
import { RAW_CHARACTERS_NT } from '../data/whoAmIData_NT';

/**
 * The questions a live match is played on.
 *
 * Lifted out of MultiplayerLobby so the random-match screen can start a real
 * match too. Both entry points have to build the same shape — the server
 * checks the answer against `correctIdx` in submit_answer, so a second,
 * slightly different builder would be a second way to get that wrong.
 */
export const MATCH_LENGTH = 5;

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
    return shuffle(BASE_TRIVIA_QUESTIONS).slice(0, MATCH_LENGTH);
  }
  if (mode === 'hymns') {
    return shuffle(BASE_HYMN_QUESTIONS).slice(0, MATCH_LENGTH);
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

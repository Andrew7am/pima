// Local (device-side) question store for the interactive rooms.
//
// The upstream entertainment source backed this with Firestore. The rooms
// here run entirely on the host's device (no networked multiplayer), so we
// keep the SAME public surface but serve questions from the local Coptic pool
// and remember "played" ids in localStorage. The weighted smart-round
// algorithm below is ported verbatim so round composition is identical.
import {
  initializeQuestionPool,
  SmartQuestion,
  shuffleQuestionOptions,
} from '../entertainment/questionPoolEngine';

export interface DbQuestion extends SmartQuestion {
  lastUsedAt: number | null;
  usageCount: number;
}

const PLAYED_KEY = (userId: string) => `pima_played_questions_${userId}`;

function readPlayed(userId: string): string[] {
  try {
    const raw = localStorage.getItem(PLAYED_KEY(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writePlayed(userId: string, ids: string[]) {
  try {
    // Cap history so the key can't grow without bound.
    localStorage.setItem(PLAYED_KEY(userId), JSON.stringify(ids.slice(-2000)));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/** Returns the full local Coptic question pool as DbQuestions. */
export async function getQuestionsFromFirestore(): Promise<DbQuestion[]> {
  return initializeQuestionPool().map((q) => ({
    ...q,
    lastUsedAt: null,
    usageCount: 0,
  }));
}

/** Records that a user has played a specific question (localStorage). */
export async function trackQuestionPlayed(userId: string, questionId: string): Promise<void> {
  if (!userId || !questionId) return;
  const played = readPlayed(userId);
  if (!played.includes(questionId)) {
    played.push(questionId);
    writePlayed(userId, played);
  }
}

/** All played question ids for a user (localStorage). */
export async function getPlayedQuestionIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  return readPlayed(userId);
}

/**
 * AI-generated questions have no cloud store to persist to in this build.
 * Kept as a no-op so callers stay unchanged.
 */
export async function saveAIQuestionsToFirestore(_questions: SmartQuestion[]): Promise<void> {
  /* no remote store in the device-only rooms build */
}

/**
 * Random Weighted Selection Algorithm (ported verbatim).
 * Weights each candidate by:
 *   1. usageCount: lower count -> higher probability (weight = 1 / (usageCount + 1))
 *   2. played/unplayed status: unplayed gets full weight, recently played gets minimal weight
 */
export function getWeightedSmartRound(
  allQuestions: DbQuestion[],
  gameType: 'trivia' | 'speed' | 'timerush' | 'auction' | 'whoami' | 'fillverse',
  limitNum = 10,
  roomSessionPlayedIds: string[] = [],
  userPlayedIds: string[] = []
): SmartQuestion[] {
  const roomSessionSet = new Set(roomSessionPlayedIds);
  const userPlayedSet = new Set(userPlayedIds);

  let candidates = allQuestions;
  if (gameType === 'whoami') {
    candidates = candidates.filter((q) => q.category === 'القديسون والشخصيات' || q.question.includes('من أكون'));
  } else if (gameType === 'fillverse') {
    candidates = candidates.filter((q) => q.question.includes('أكمل الآية'));
  } else {
    candidates = candidates.filter((q) => !q.question.includes('من أكون') && !q.question.includes('أكمل الآية'));
  }

  let filteredCandidates = candidates.filter((q) => !roomSessionSet.has(q.id) && !userPlayedSet.has(q.id));
  if (filteredCandidates.length < limitNum) {
    filteredCandidates = candidates.filter((q) => !roomSessionSet.has(q.id));
  }
  if (filteredCandidates.length < limitNum) {
    filteredCandidates = candidates;
  }

  const randomizedCandidates = [...filteredCandidates].sort(() => Math.random() - 0.5);

  const easy = randomizedCandidates.filter((q) => q.difficulty === 'سهل');
  const medium = randomizedCandidates.filter((q) => q.difficulty === 'متوسط');
  const hard = randomizedCandidates.filter((q) => q.difficulty === 'صعب');

  const targetEasyCount = Math.max(1, Math.round(limitNum * 0.3));
  const targetHardCount = Math.max(1, Math.round(limitNum * 0.3));
  const targetMediumCount = limitNum - targetEasyCount - targetHardCount;

  const selectedQuestions: SmartQuestion[] = [];

  const selectWeighted = (pool: DbQuestion[], countNeeded: number) => {
    if (pool.length === 0 || countNeeded <= 0) return;

    const chosenLocalIds = new Set<string>();
    let selectedCount = 0;

    while (selectedCount < countNeeded && chosenLocalIds.size < pool.length) {
      const remainingPool = pool.filter((q) => !chosenLocalIds.has(q.id));
      if (remainingPool.length === 0) break;

      const weights = remainingPool.map((q) => {
        let w = 1.0 / (q.usageCount + 1);
        if (roomSessionSet.has(q.id)) w *= 0.05;
        if (userPlayedSet.has(q.id)) w *= 0.1;
        return { question: q, weight: w };
      });

      const sumOfWeights = weights.reduce((acc, curr) => acc + curr.weight, 0);
      if (sumOfWeights <= 0) {
        const idx = Math.floor(Math.random() * remainingPool.length);
        const item = remainingPool[idx];
        selectedQuestions.push(item);
        chosenLocalIds.add(item.id);
        selectedCount++;
        continue;
      }

      const randomValue = Math.random() * sumOfWeights;
      let runningSum = 0;
      let selectedItem = remainingPool[0];

      for (const wObj of weights) {
        runningSum += wObj.weight;
        if (runningSum >= randomValue) {
          selectedItem = wObj.question;
          break;
        }
      }

      selectedQuestions.push(selectedItem);
      chosenLocalIds.add(selectedItem.id);
      selectedCount++;
    }
  };

  selectWeighted(easy, targetEasyCount);
  selectWeighted(hard, targetHardCount);
  selectWeighted(medium, targetMediumCount);

  if (selectedQuestions.length < limitNum) {
    const currentIds = new Set(selectedQuestions.map((s) => s.id));
    const extraPool = randomizedCandidates.filter((c) => !currentIds.has(c.id));
    const needed = limitNum - selectedQuestions.length;
    selectWeighted(extraPool, needed);
  }

  return selectedQuestions.sort(() => Math.random() - 0.5).map((q) => shuffleQuestionOptions(q));
}

import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { User } from '../../types';
import { RAW_VERSES } from '../data/versesData';
import MCQGame, { MCQQuestion } from './MCQGame';

interface FillVerseGameProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Convert RAW_VERSES (each has a "verse with ___ blank" and the
// correct word) into 4-option MCQ questions by pulling three
// distractors from other verses' correct words. Same MCQ shell as
// Trivia/Hymns after that.
function buildQuestions(): MCQQuestion[] {
  const allWords = Array.from(new Set(RAW_VERSES.map((v) => v.word)));
  return RAW_VERSES.map((v) => {
    const distractors = shuffle(allWords.filter((w) => w !== v.word)).slice(0, 3);
    const options = shuffle([v.word, ...distractors]);
    return {
      question: v.verse,
      options,
      correctIdx: options.indexOf(v.word),
      explanation: v.explanation,
    };
  });
}

export default function FillVerseGame({ currentUser, onBack, onUserUpdated }: FillVerseGameProps) {
  // Regenerate once per mount so re-playing shuffles distractors too
  const pool = useMemo(() => buildQuestions(), []);
  return (
    <MCQGame
      currentUser={currentUser}
      onBack={onBack}
      onUserUpdated={onUserUpdated}
      title="أكمل الآية"
      icon={<FileText className="w-4 h-4" />}
      pool={pool}
      rewardDescription={(s, t) => `أكمل الآية — ${s}/${t} إجابات صحيحة`}
    />
  );
}

import React from 'react';
import { BookOpen } from 'lucide-react';
import { User } from '../../types';
import { BASE_TRIVIA_QUESTIONS } from '../data/triviaData';
import MCQGame from './MCQGame';

interface TriviaGameProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

// Solo biblical trivia — thin wrapper over MCQGame that plugs in the
// trivia question pool and a game-specific title/description.
export default function TriviaGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: TriviaGameProps) {
  return (
    <MCQGame
      currentUser={currentUser}
      onBack={onBack}
      onUserUpdated={onUserUpdated}
      onAchievementsUnlocked={onAchievementsUnlocked}
      title="أسئلة كتابية"
      icon={<BookOpen className="w-4 h-4" />}
      pool={BASE_TRIVIA_QUESTIONS}
      rewardDescription={(s, t) => `أسئلة كتابية — ${s}/${t} إجابات صحيحة`}
    />
  );
}

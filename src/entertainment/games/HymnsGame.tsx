import React from 'react';
import { Music } from 'lucide-react';
import { User } from '../../types';
import { BASE_HYMN_QUESTIONS } from '../data/hymnsData';
import MCQGame from './MCQGame';

interface HymnsGameProps {
  currentUser: User;
  onBack: () => void;
  onUserUpdated: (patch: Partial<User>) => void;
  onAchievementsUnlocked?: (ids: string[]) => void;
}

export default function HymnsGame({ currentUser, onBack, onUserUpdated, onAchievementsUnlocked }: HymnsGameProps) {
  return (
    <MCQGame
      currentUser={currentUser}
      onBack={onBack}
      onUserUpdated={onUserUpdated}
      onAchievementsUnlocked={onAchievementsUnlocked}
      title="ألحان قبطية"
      icon={<Music className="w-4 h-4" />}
      pool={BASE_HYMN_QUESTIONS}
      rewardDescription={(s, t) => `ألحان قبطية — ${s}/${t} إجابات صحيحة`}
    />
  );
}

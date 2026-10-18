import React, { useState } from 'react';
import { Bell, Sparkles, X, Play } from 'lucide-react';
import { PersonalityStyle } from '../types';

interface ProactiveBannerProps {
  personality: PersonalityStyle;
  onTriggerCheckIn: (customText?: string) => void;
}

export const ProactiveBanner: React.FC<ProactiveBannerProps> = ({
  personality,
  onTriggerCheckIn
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  if (isDismissed) return null;

  const getSampleFollowUp = () => {
    if (personality === 'STRICT') {
      return '"You said you\'d complete the Python exercises yesterday. Did you finish them, or does our plan need adjusting?"';
    } else if (personality === 'BUBBLY') {
      return '"Hellooo! 👀 Quick progress check! Did today\'s Python mission happen or are we pretending it didn\'t exist? 😂"';
    } else {
      return '"Hey! Just checking in 😊 Did you get around to today\'s Python task?"';
    }
  };

  return (
    <div className="bg-slate-900/90 border-b border-blue-500/30 px-4 py-2.5 text-xs text-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
          <Bell className="w-4 h-4 animate-bounce" />
        </div>
        <div>
          <span className="font-bold text-white">Proactive Check-In Simulator: </span>
          <span className="text-slate-300 hidden md:inline">Test how your mentor proactively follows up based on your active personality style ({personality}): </span>
          <span className="text-blue-300 italic">{getSampleFollowUp()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onTriggerCheckIn()}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Simulate Check-In</span>
        </button>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { MessageSquare, CheckSquare, User, Award, Compass } from 'lucide-react';
import { ActiveTab, MentorId, PersonalityStyle } from '../types';
import { MENTORS } from '../data/mentors';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  mentorId: MentorId;
  personality: PersonalityStyle;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  mentorId,
  personality
}) => {
  const mentor = MENTORS[mentorId];

  // Section 36 spec: Primary navigation is Inbox, Today, Profile (Optional: Progress)
  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'MENTOR', label: 'Inbox', icon: MessageSquare },
    { id: 'TODAY', label: 'Today', icon: CheckSquare },
    { id: 'PROGRESS', label: 'Progress', icon: Award },
    { id: 'PROFILE', label: 'Profile', icon: User }
  ];

  return (
    <>
      {/* Top App Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base tracking-tight flex items-center gap-1.5">
              Mentor Broski <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-broski-yellow text-slate-900 font-bold">AI</span>
            </h1>
          </div>
        </div>

        {/* Primary Desktop Nav Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Mentor Social Tag */}
        <div 
          onClick={() => onTabChange('MENTOR')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:border-blue-300 cursor-pointer transition-colors"
        >
          <img src={mentor.avatar} alt={mentor.name} className="w-5 h-5 rounded-full object-cover" />
          <span className="text-xs font-bold text-slate-800 hidden sm:inline">{mentor.name}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold">
            {personality}
          </span>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Inbox, Today, Progress, Profile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-2xl backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

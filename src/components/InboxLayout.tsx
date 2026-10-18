import React, { useState } from 'react';
import { 
  MessageSquare, 
  Sparkles, 
  LogOut, 
  ChevronLeft, 
  User, 
  SlidersHorizontal,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { MentorId, PersonalityStyle, UserProfile } from '../types';
import { MENTORS, PERSONALITIES } from '../data/mentors';
import { ChatInterface } from './ChatInterface';
import { UpgradeModal } from './UpgradeModal';

interface InboxLayoutProps {
  user: UserProfile;
  selectedMentorId: MentorId;
  personality: PersonalityStyle;
  onSelectMentor: (mentorId: MentorId) => void;
  onChangePersonality: () => void;
  onSignOut: () => void;
}

export const InboxLayout: React.FC<InboxLayoutProps> = ({
  user,
  selectedMentorId,
  personality,
  onSelectMentor,
  onChangePersonality,
  onSignOut
}) => {
  // Mobile responsive view toggle: 'LIST' or 'CHAT'
  const [mobileView, setMobileView] = useState<'LIST' | 'CHAT'>('CHAT');
  const [lockedModalMentor, setLockedModalMentor] = useState<MentorId | null>(null);

  const allMentorIds: MentorId[] = ['AARYA', 'ALEX', 'LUCY'];
  const mentorIds: MentorId[] = selectedMentorId
    ? [selectedMentorId, ...allMentorIds.filter(id => id !== selectedMentorId)]
    : allMentorIds;

  const handleMentorClick = (id: MentorId) => {
    if (selectedMentorId && selectedMentorId !== id) {
      // Show upgrade modal for locked mentors without navigating
      setLockedModalMentor(id);
    } else {
      onSelectMentor(id);
      setMobileView('CHAT');
    }
  };

  const activeMentor = MENTORS[selectedMentorId];

  return (
    <div className="h-screen w-full flex flex-col bg-white text-slate-900 overflow-hidden font-sans">
      {/* Top Application Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Mobile Back to Inbox Button when in chat mode */}
          {mobileView === 'CHAT' && (
            <button 
              onClick={() => setMobileView('LIST')}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center gap-1 text-xs font-bold min-h-[44px] min-w-[44px]"
              aria-label="Back to Messages"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Messages</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-broski-yellow font-black text-sm shadow-md">
              MB
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-base tracking-tight flex items-center gap-1.5">
                Mentor Broski <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-broski-yellow text-slate-900 font-bold">Inbox</span>
              </h1>
            </div>
          </div>
        </div>

        {/* User Session Bar & Header Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold text-slate-800">{user.name}</span>
          </div>

          <button
            onClick={onChangePersonality}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition-colors flex items-center gap-1.5 min-h-[44px]"
            title="Change Mentor Tone"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tone: {PERSONALITIES[personality].title}</span>
          </button>

          <button
            onClick={onSignOut}
            className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Two-Column Social Inbox Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Column Sidebar: Mentor Conversations List */}
        <div 
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 transition-all ${
            mobileView === 'CHAT' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Messages
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Your active career mentor DM conversations
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {mentorIds.map((id) => {
              const mentor = MENTORS[id];
              const isActive = selectedMentorId === id;
              const isLocked = selectedMentorId !== id;

              const previewMessage = id === 'AARYA'
                ? "Let's figure out what you actually want to build with AI."
                : id === 'ALEX'
                ? "Curious how systems break? Let's start there."
                : "Let's turn your data questions into a career.";

              return (
                <div
                  key={id}
                  onClick={() => handleMentorClick(id)}
                  className={`p-4 cursor-pointer transition-all flex items-start gap-3.5 relative hover:bg-slate-50 min-h-[64px] ${
                    isActive ? 'bg-slate-50 border-l-4 border-l-slate-900' : ''
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <img 
                      src={mentor.avatar} 
                      alt={mentor.name} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-xs" 
                    />
                    <span 
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        isLocked ? 'bg-slate-400' : 'bg-emerald-500'
                      }`} 
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`text-sm font-extrabold truncate ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                          {mentor.name}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold shrink-0">
                          {mentor.subjectBadge}
                        </span>
                      </div>

                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold shrink-0">
                          ● Active
                        </span>
                      )}

                      {isLocked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-extrabold shrink-0 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 truncate line-clamp-1 font-medium">
                      {previewMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
            <button
              onClick={() => onSelectMentor(selectedMentorId)}
              className="text-xs font-bold text-slate-900 hover:text-slate-700 flex items-center justify-center gap-1.5 mx-auto min-h-[44px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-900" />
              <span>Explore All Mentor Profiles</span>
            </button>
          </div>
        </div>

        {/* Right Main Area: Active DM Chat Interface */}
        <div 
          className={`flex-1 flex flex-col bg-white overflow-hidden ${
            mobileView === 'LIST' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ChatInterface
            user={user}
            mentorId={selectedMentorId}
            personality={personality}
            onChangeMentor={() => setMobileView('LIST')}
            onChangePersonality={onChangePersonality}
          />
        </div>
      </div>

      {/* Upgrade Modal for Locked Mentors */}
      <UpgradeModal
        isOpen={Boolean(lockedModalMentor)}
        onClose={() => setLockedModalMentor(null)}
        mentor={lockedModalMentor ? MENTORS[lockedModalMentor] : null}
      />
    </div>
  );
};

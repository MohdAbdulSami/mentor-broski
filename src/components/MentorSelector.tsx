import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Lock, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import { MentorId } from '../types';
import { MENTORS } from '../data/mentors';
import { UpgradeModal } from './UpgradeModal';

interface MentorSelectorProps {
  onSelectMentor: (mentorId: MentorId) => void;
  selectedMentorId?: MentorId | null;
}

export const MentorSelector: React.FC<MentorSelectorProps> = ({ onSelectMentor, selectedMentorId }) => {
  const [lockedModalMentor, setLockedModalMentor] = useState<MentorId | null>(null);

  const mentorsList: MentorId[] = ['AARYA', 'ALEX', 'LUCY'];

  const handleMentorClick = (id: MentorId) => {
    // If user already has an active mentor set and clicks a different one, show upgrade modal:
    if (selectedMentorId && selectedMentorId !== id) {
      setLockedModalMentor(id);
    } else {
      onSelectMentor(id);
    }
  };

  const conversationPreviews: Record<MentorId, string> = {
    AARYA: "Aarya: \"Let's figure out what you actually want to build with AI.\"",
    ALEX: "Alex: \"Curious how systems break? Let's start there.\"",
    LUCY: "Lucy: \"Let's turn your data questions into a career you can actually build.\""
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-12 px-4 md:px-6 relative overflow-hidden">
      {/* Background Subtle Blob */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-broski-yellow/20 rounded-full blur-3xl pointer-events-none animate-ambient-blob" />

      <div className="max-w-6xl mx-auto w-full space-y-10 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
            Step 1 of 2 • Select Your Mentor
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            Who do you want in your corner?
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm leading-relaxed font-medium">
            Pick one mentor to start with. You can unlock the others anytime with Mentor Broski Plus.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {mentorsList.map((id) => {
            const mentor = MENTORS[id];
            const isActive = selectedMentorId ? selectedMentorId === id : false;
            const isLocked = selectedMentorId ? selectedMentorId !== id : false;

            return (
              <motion.div
                key={id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                onClick={() => handleMentorClick(id)}
                className={`social-card rounded-2xl p-6 md:p-7 cursor-pointer flex flex-col justify-between group relative overflow-hidden transition-all ${
                  isActive
                    ? 'border-2 border-slate-900 bg-broski-yellow/10 shadow-lg'
                    : isLocked
                    ? 'opacity-85 hover:border-slate-300'
                    : 'hover:border-slate-400 bg-white'
                }`}
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="relative">
                      <img
                        src={mentor.avatar}
                        alt={mentor.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 shadow-md"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                          isLocked ? 'bg-slate-400' : 'bg-emerald-500'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                        {mentor.subjectBadge}
                      </span>
                      {isActive && (
                        <motion.span 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-broski-yellow text-slate-900 font-black border border-slate-900 flex items-center gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 text-slate-900" />
                          Your Mentor
                        </motion.span>
                      )}
                      {isLocked && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-300 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-500" />
                          Locked
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
                      <span>{mentor.name}</span>
                      {isLocked && <Lock className="w-4 h-4 text-slate-400" />}
                    </h3>
                    
                    {/* Conversation-style preview (Req 3) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-800 font-bold italic leading-relaxed">
                        {conversationPreviews[id]}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {mentor.bio}
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
                      Expertise
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {mentor.expertiseList.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 font-medium">
                          <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMentorClick(id);
                  }}
                  className={`mt-8 w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                    isActive
                      ? 'btn-broski-primary border border-slate-900'
                      : isLocked
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'btn-broski-primary'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-4 h-4 text-slate-600" />
                      <span>Unlock with Plus</span>
                    </>
                  ) : isActive ? (
                    <>
                      <span>● Active Mentor</span>
                    </>
                  ) : (
                    <>
                      <span>Select {mentor.name}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
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

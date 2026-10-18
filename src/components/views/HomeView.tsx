import React from 'react';
import { MessageSquare, ArrowRight, Target, BookOpen } from 'lucide-react';
import { MentorId, PersonalityStyle, UserProfile, UserMemory, RoadmapPlan } from '../../types';
import { MENTORS, PERSONALITIES } from '../../data/mentors';

interface HomeViewProps {
  user: UserProfile;
  mentorId: MentorId;
  personality: PersonalityStyle;
  memory: UserMemory;
  roadmap: RoadmapPlan;
  latestMentorMessage?: string;
  onNavigateTab: (tab: 'MENTOR' | 'ROADMAP' | 'TODAY' | 'PROGRESS') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  mentorId,
  personality,
  memory,
  roadmap,
  latestMentorMessage,
  onNavigateTab
}) => {
  const mentor = MENTORS[mentorId];
  const pers = PERSONALITIES[personality];

  const todayTask = roadmap.stages[0]?.tasks.find(t => t.day === roadmap.currentDay) || roadmap.stages[0]?.tasks[0];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn pb-24 md:pb-12 text-slate-900">
      {/* Welcome Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Welcome back, {user.name} 👋</h1>
          <p className="text-xs text-slate-600 mt-1">Here is your ongoing mentorship summary with {mentor.name}.</p>
        </div>

        <button
          onClick={() => onNavigateTab('MENTOR')}
          className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Talk to {mentor.name}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Mentor Social Card */}
        <div className="md:col-span-6 social-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={mentor.avatar} alt={mentor.name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shadow-xs" />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{mentor.name}</h3>
                <span className="text-xs text-pink-600 font-semibold">{pers.title} Tone</span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              ● Active Mentor
            </span>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{mentor.name}'s Latest Message</span>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic leading-relaxed">
              "{latestMentorMessage || mentor.initialGreetings[personality].split('\n\n')[0]}"
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('MENTOR')}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Open Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Goal Card */}
        <div className="md:col-span-6 social-card rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Current Goal</h3>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold block">Target Role</span>
              <p className="text-base font-bold text-slate-900 mt-0.5">{memory.careerGoal || 'Land an Entry Role / Internship'}</p>
              <p className="text-xs text-blue-600 font-medium mt-1">{memory.academicSituation || 'Student'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Study Window</span>
              <p className="text-xs font-semibold text-slate-800 mt-0.5">{memory.preferredLearningWindow || 'Evening (7 PM)'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Milestones Logged</span>
              <p className="text-xs font-semibold text-emerald-600 mt-0.5">{memory.completedMilestones?.length || 0} completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S FOCUS PREVIEW */}
      <div className="social-card p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Today's Focus</h3>
              <p className="text-xs text-slate-500">Day {roadmap.currentDay} of 30</p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('TODAY')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>Open Today's Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayTask ? (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block mb-1">Focus Task</span>
              <p className="font-bold text-slate-900 text-sm">{todayTask.title}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block mb-1">Goal</span>
              <p className="text-slate-700">{todayTask.goal}</p>
            </div>
            <div className="flex flex-col justify-between">
              <span className="text-slate-500 font-semibold block mb-1">Estimated Time</span>
              <p className="font-bold text-blue-600">{todayTask.estimatedMinutes} minutes</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No tasks set for today yet.</p>
        )}
      </div>
    </div>
  );
};

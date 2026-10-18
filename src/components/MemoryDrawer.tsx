import React from 'react';
import { X, Brain, User, Target, Award, Clock, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import { UserMemory } from '../types';

interface MemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  memory: UserMemory;
  onClearMemory: () => void;
}

export const MemoryDrawer: React.FC<MemoryDrawerProps> = ({
  isOpen,
  onClose,
  memory,
  onClearMemory
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#0B0F19] border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Mentor Memory Engine</h3>
              <p className="text-[11px] text-slate-400">What your AI mentor remembers about you</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
            💡 Your mentor continuously listens during conversations and remembers context so you never have to repeat your goals, schedule, or skill background.
          </div>

          {/* Academic & Background */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Academic Situation
            </span>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-sm font-semibold text-white">
              {memory.academicSituation || 'Not specified yet'}
            </div>
          </div>

          {/* Target Role & Goals */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" /> Target Career Goal
            </span>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-sm font-semibold text-white">
              {memory.careerGoal || 'Exploring career options'}
            </div>
          </div>

          {/* Preferred Study Window */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Preferred Study Schedule
            </span>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-200">
              {memory.preferredLearningWindow || 'Flexibly throughout the day'}
            </div>
          </div>

          {/* Current Skills Identified */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-cyan-400" /> Extracted Skills & Tools
            </span>
            <div className="flex flex-wrap gap-1.5">
              {memory.currentSkills && memory.currentSkills.length > 0 ? (
                memory.currentSkills.map((skill, idx) => (
                  <span key={idx} className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">No skills tagged yet (mention Python, SQL, Linux, etc.)</span>
              )}
            </div>
          </div>

          {/* Current Obstacles */}
          {memory.currentObstacles && (
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Current Obstacle / Bottleneck
              </span>
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs text-amber-300">
                {memory.currentObstacles}
              </div>
            </div>
          )}

          {/* Completed Milestones */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Completed Milestones
            </span>
            <div className="space-y-1.5">
              {memory.completedMilestones && memory.completedMilestones.length > 0 ? (
                memory.completedMilestones.map((m, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{m}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic">No completed milestones logged yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Last updated: {new Date(memory.lastUpdated).toLocaleTimeString()}</span>
          <button
            onClick={onClearMemory}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};

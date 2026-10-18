import React from 'react';
import { Award, CheckCircle, Target, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { UserMemory, RoadmapPlan } from '../../types';

interface ProgressViewProps {
  memory: UserMemory;
  roadmap: RoadmapPlan;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ memory, roadmap }) => {
  const completedTasksCount = roadmap.stages.reduce((acc, stage) => {
    return acc + stage.tasks.filter(t => t.completed).length;
  }, 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn pb-24 md:pb-12">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Your Career Progress</h1>
        <p className="text-xs text-slate-400 mt-1">Simple, human-readable metrics tracking real execution—not vanity badges.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Days Active</span>
          <p className="text-3xl font-extrabold text-white">8</p>
          <span className="text-[11px] text-blue-400 font-medium">Consistent daily check-ins</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Tasks Completed</span>
          <p className="text-3xl font-extrabold text-emerald-400">{completedTasksCount}</p>
          <span className="text-[11px] text-slate-400">Out of {roadmap.stages[0]?.tasks.length || 2} initial tasks</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Current Phase</span>
          <p className="text-lg font-bold text-indigo-400 line-clamp-1">Phase 1</p>
          <span className="text-[11px] text-slate-400">Foundations & CLI Setup</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Milestones Logged</span>
          <p className="text-3xl font-extrabold text-cyan-400">{memory.completedMilestones?.length || 0}</p>
          <span className="text-[11px] text-slate-400">Verified by mentor</span>
        </div>
      </div>

      {/* Recent Achievements & Areas Needing Attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" /> Recent Achievements
          </h3>
          <div className="space-y-2">
            {memory.completedMilestones && memory.completedMilestones.length > 0 ? (
              memory.completedMilestones.map((milestone, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{milestone}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No achievements logged yet. Complete today's focus item!</p>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Areas Needing Attention
          </h3>
          <div className="space-y-2 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-amber-300 space-y-1">
              <span className="font-bold text-white block">Project Execution</span>
              <p className="text-[11px] text-slate-300">
                {memory.currentObstacles || 'Ensure you write working code locally rather than watching tutorials passively.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

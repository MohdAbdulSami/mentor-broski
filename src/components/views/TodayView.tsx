import React from 'react';
import { CheckSquare, Square, BookOpen, Layers, Target, Clock, ExternalLink, Sparkles, Award } from 'lucide-react';
import { RoadmapPlan, ActionItem } from '../../types';

interface TodayViewProps {
  roadmap: RoadmapPlan;
  onToggleTask: (taskId: string) => void;
  onAskMentorAboutTask: (task: ActionItem) => void;
  onTakeQuiz?: (task: ActionItem) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  roadmap,
  onToggleTask,
  onAskMentorAboutTask,
  onTakeQuiz
}) => {
  const allTasks = roadmap.stages.flatMap(s => s.tasks);
  const todayTask = allTasks.find(t => t.day === roadmap.currentDay) || allTasks[0];

  if (!todayTask) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-4 my-12">
        <h2 className="text-xl font-bold text-white">No active task scheduled for today.</h2>
        <p className="text-xs text-slate-400">Consult your mentor in DM chat to generate today's focus item.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">Daily Focus</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">TODAY'S MISSION</h1>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Est. {todayTask.estimatedMinutes} mins
        </span>
      </div>

      {/* Main Focus Card */}
      <div className="glass-panel p-6 md:p-8 rounded-2xl border-2 border-blue-500/50 shadow-2xl space-y-6 bg-gradient-to-b from-blue-950/30 to-slate-900">
        <div>
          <span className="text-xs font-mono text-slate-400 uppercase">Day {todayTask.day} Task</span>
          <h2 className="text-2xl font-bold text-white mt-1">{todayTask.title}</h2>
          <p className="text-xs text-slate-300 mt-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <span className="font-bold text-blue-400">Core Goal: </span>
            {todayTask.goal}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Learn Card */}
          <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <BookOpen className="w-4 h-4" />
              <span>1. Learn Concept</span>
            </div>
            <p className="text-xs text-slate-200">{todayTask.learnTopic}</p>
            {todayTask.recommendedResources.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 font-bold">Recommended Resource</span>
                {todayTask.recommendedResources.slice(0, 1).map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs text-blue-400 font-semibold flex items-center justify-between"
                  >
                    <span>{res.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Practice Card */}
          <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Layers className="w-4 h-4" />
              <span>2. Practice Exercises</span>
            </div>
            <p className="text-xs text-slate-200">{todayTask.practiceTask}</p>
          </div>
        </div>

        {/* Build Project Card */}
        <div className="bg-slate-900/90 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Target className="w-4 h-4" />
            <span>3. Build Project</span>
          </div>
          <p className="text-xs text-slate-200 font-medium">{todayTask.buildProject}</p>
        </div>

        {/* Success Condition */}
        <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 text-xs space-y-1">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <Award className="w-4 h-4" /> Success Condition
          </span>
          <p className="text-slate-200">
            {todayTask.successCondition || 'Explain the concept in your own words and write 3 working code examples.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <button
            onClick={() => onToggleTask(todayTask.id)}
            className={`w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              todayTask.completed
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
            }`}
          >
            {todayTask.completed ? (
              <>
                <CheckSquare className="w-5 h-5" />
                <span>Marked Complete!</span>
              </>
            ) : (
              <>
                <Square className="w-5 h-5" />
                <span>Mark Today's Task Complete</span>
              </>
            )}
          </button>

          {onTakeQuiz && (
            <button
              onClick={() => onTakeQuiz(todayTask)}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-broski-yellow text-slate-900 text-xs font-black transition-colors flex items-center justify-center gap-2 border border-slate-900 shadow-md cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Take Knowledge Check Quiz</span>
            </button>
          )}

          <button
            onClick={() => onAskMentorAboutTask(todayTask)}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Discuss Task with Mentor</span>
          </button>
        </div>
      </div>
    </div>
  );
};

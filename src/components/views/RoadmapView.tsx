import React from 'react';
import { Calendar, CheckSquare, Square, Clock, Sparkles, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { RoadmapPlan, ActionItem, MentorDomain } from '../../types';

interface RoadmapViewProps {
  roadmap: RoadmapPlan | null;
  domain: MentorDomain;
  onToggleTask: (taskId: string) => void;
  onRequestRoadmap: () => void;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({
  roadmap,
  domain,
  onToggleTask,
  onRequestRoadmap
}) => {
  if (!roadmap) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-6 my-12 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">No Roadmap Created Yet</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          "You don't need a roadmap on day one. When you're ready for structure, your mentor can turn your conversation into a practical 30-day plan."
        </p>
        <button
          onClick={onRequestRoadmap}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Request 30-Day Roadmap from Mentor</span>
        </button>
      </div>
    );
  }

  const longTermStages = domain === 'AI_ML'
    ? ['Python Foundations', 'Math & Statistics', 'ML Fundamentals', 'PyTorch Projects', 'Deep Learning', 'Portfolio', 'Internship Prep']
    : domain === 'CYBERSECURITY'
    ? ['Linux CLI & Bash', 'Networking & Protocols', 'Ethical Hacking', 'OWASP Web Security', 'CTFs & Labs', 'Certs', 'Security Roles']
    : ['SQL Mastery', 'Python Pandas', 'Statistics & EDA', 'Power BI / Tableau', 'Data Projects', 'Portfolio', 'Analyst Prep'];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn pb-24 md:pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">{roadmap.title}</h1>
          <p className="text-xs text-blue-400 font-medium">Living 30-Day Roadmap • Day {roadmap.currentDay} of 30</p>
        </div>
      </div>

      {/* Long-Term Direction Pipeline */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Long-Term Direction Overview</span>
        <div className="flex flex-wrap items-center gap-2">
          {longTermStages.map((stage, idx) => (
            <React.Fragment key={idx}>
              <span className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${
                idx === 0
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {stage}
              </span>
              {idx < longTermStages.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Detailed Stages Breakdown */}
      <div className="space-y-6">
        <h3 className="text-base font-extrabold text-white">Current Phase & Daily Action Items</h3>

        {roadmap.stages.map((stage) => (
          <div key={stage.stageNumber} className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-base">{stage.stageTitle}</h4>
                <p className="text-xs text-slate-400">{stage.description}</p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                {stage.durationDays} Days
              </span>
            </div>

            <div className="space-y-3">
              {stage.tasks.map((task) => {
                const isToday = task.day === roadmap.currentDay;
                const isPast = task.day < roadmap.currentDay || (isToday && task.completed);
                const isFuture = task.day > roadmap.currentDay;

                if (isFuture) {
                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/60 text-slate-500 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-600 font-bold">Day {task.day}</span>
                            <h5 className="text-sm font-semibold text-slate-500">{task.title}</h5>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">Locked • Unlocks after Day {roadmap.currentDay}</p>
                        </div>
                      </div>

                      <span className="text-xs text-slate-600 font-mono shrink-0 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {task.estimatedMinutes} mins
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      task.completed
                        ? 'bg-slate-900/40 border-slate-800 text-slate-500'
                        : isToday
                        ? 'bg-blue-950/30 border-blue-500/50 text-white shadow-md'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isToday ? (
                        <button
                          onClick={() => onToggleTask(task.id)}
                          className="mt-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500" />
                          )}
                        </button>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-blue-400 font-bold">Day {task.day}</span>
                          <h5 className={`text-sm font-bold ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                            {task.title}
                          </h5>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{task.goal}</p>
                      </div>
                    </div>

                    <span className="text-xs text-blue-400 font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {task.estimatedMinutes} mins
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

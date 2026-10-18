import React, { useState } from 'react';
import { X, Calendar, CheckSquare, Square, Clock, ExternalLink, Sparkles, BookOpen, Layers, Target, Award, PlusCircle, HelpCircle, Lock, CheckCircle2, ArrowRight, Bell, BellOff } from 'lucide-react';
import { RoadmapPlan, ActionItem } from '../types';
import { QuizModal } from './QuizModal';
import { ActivityTracker } from '../services/activityTracker';

interface RoadmapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roadmap: RoadmapPlan;
  userId: string;
  roadmapId?: string;
  domain?: string;
  onToggleTask: (taskId: string) => void;
  onAskMentorAboutTask: (task: ActionItem) => void;
  onExtendRoadmap?: (totalDays: number) => void;
  onQuizCompleted?: (result: any, dayNumber: number, topic: string) => void;
  onProgressionChoice?: (choice: 'CONTINUE_NOW' | 'TOMORROW', dayNumber: number) => Promise<void>;
}

export const RoadmapDrawer: React.FC<RoadmapDrawerProps> = ({
  isOpen,
  onClose,
  roadmap,
  userId,
  roadmapId = 'temp_roadmap',
  domain,
  onToggleTask,
  onAskMentorAboutTask,
  onExtendRoadmap,
  onQuizCompleted,
  onProgressionChoice
}) => {
  const [activeQuizTask, setActiveQuizTask] = useState<ActionItem | null>(null);
  const [reviewQuizTask, setReviewQuizTask] = useState<{ day: number; topic: string } | null>(null);
  const [showReviewSelector, setShowReviewSelector] = useState<boolean>(false);
  const [progressionLoading, setProgressionLoading] = useState<boolean>(false);
  const [snoozeFeedback, setSnoozeFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const allTasks = roadmap.stages.flatMap(s => s.tasks);
  const todayTask = allTasks.find(t => t.day === roadmap.currentDay);

  const handleCompleteAndLaunchQuiz = (task: ActionItem) => {
    ActivityTracker.recordMissionEngagement(roadmapId, task.day, task.title).catch(() => {});
    onToggleTask(task.id);
    setActiveQuizTask(task);
  };

  const handleLaunchQuiz = (task: ActionItem) => {
    ActivityTracker.recordMissionEngagement(roadmapId, task.day, task.title).catch(() => {});
    setActiveQuizTask(task);
  };

  const handleSnoozeAccountability = async (task: ActionItem) => {
    const success = await ActivityTracker.snoozeMissionReminders(roadmapId, task.day, 60);
    if (success) {
      setSnoozeFeedback('Accountability paused for 1 hour');
      setTimeout(() => setSnoozeFeedback(null), 4000);
    }
  };

  const totalStagesDays = roadmap.stages.reduce((sum, s) => sum + (s.durationDays || 10), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="w-full max-w-2xl bg-[#0B0F19] border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg">{roadmap.title}</h3>
              <p className="text-xs text-blue-400 font-medium">
                Living {totalStagesDays}-Day Roadmap • Current: Day {roadmap.currentDay} of {totalStagesDays}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Minimal Quiz Review Button */}
            <button
              onClick={() => setShowReviewSelector(!showReviewSelector)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Review past quizzes by day"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Review Quizzes</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quiz Review Day Selector Dropdown Panel */}
          {showReviewSelector && (
            <div className="bg-slate-900/95 p-4 rounded-2xl border border-amber-500/40 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Select Day Quiz to Review
                </span>
                <button
                  onClick={() => setShowReviewSelector(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                {allTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setReviewQuizTask({ day: t.day, topic: t.learnTopic || t.title });
                      setShowReviewSelector(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      t.completed
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Day {t.day}</span>
                    {t.completed && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TODAY'S FEATURED ACTION ITEM OR RECOVERABLE ERROR */}
          {todayTask ? (
            <div className="glass-panel p-6 rounded-2xl border-2 border-blue-500/60 shadow-xl space-y-6 relative overflow-hidden bg-gradient-to-b from-blue-950/40 to-slate-900/80">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-blue-500 text-white font-extrabold text-xs tracking-wider uppercase shadow-md">
                  TODAY'S MISSION (DAY {todayTask.day})
                </span>
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  {todayTask.estimatedMinutes} mins max
                </span>
              </div>

              <div>
                <h4 className="text-xl font-bold text-white mb-2">{todayTask.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="font-semibold text-blue-400">Core Goal: </span>
                  {todayTask.goal}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="font-bold text-blue-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" /> Concept to Learn
                  </span>
                  <p className="text-slate-300">{todayTask.learnTopic}</p>
                </div>

                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="font-bold text-indigo-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> Hands-On Practice
                  </span>
                  <p className="text-slate-300">{todayTask.practiceTask}</p>
                </div>
              </div>

              <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs">
                  <Target className="w-3.5 h-3.5" /> Project to Build
                </span>
                <p className="text-xs text-slate-200 font-medium">{todayTask.buildProject}</p>
              </div>

              {/* Recommended Documentation & Hands-On Resources */}
              {todayTask.recommendedResources && todayTask.recommendedResources.length > 0 && (
                <div className="bg-slate-900/90 p-4 rounded-xl border border-blue-500/30 space-y-2.5">
                  <span className="font-bold text-blue-400 flex items-center gap-1 text-xs uppercase tracking-wide">
                    <ExternalLink className="w-3.5 h-3.5" /> Curated Learning Resources
                  </span>
                  <div className="space-y-2">
                    {todayTask.recommendedResources.map((res, rIdx) => (
                      <a
                        key={rIdx}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-950 transition-all text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                            <span>{res.title}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold uppercase">
                              {res.type || 'Resource'}
                            </span>
                          </div>
                          {res.description && (
                            <p className="text-[11px] text-slate-400 leading-snug">{res.description}</p>
                          )}
                          {res.whyRecommended && (
                            <p className="text-[10px] text-emerald-400/90 italic font-medium">Why: {res.whyRecommended}</p>
                          )}
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Mission Completion & Action Panel */}
              <div className="space-y-4 pt-2">
                {todayTask.completed ? (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Day {todayTask.day} Mission Completed!</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Great execution. Your learning requirements for today are complete. What would you like to do next?
                    </p>

                    {/* Explicit Progression Decision (Objective 7) */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <button
                        disabled={progressionLoading}
                        onClick={async () => {
                          if (onProgressionChoice) {
                            setProgressionLoading(true);
                            try {
                              await onProgressionChoice('CONTINUE_NOW', todayTask.day);
                            } finally {
                              setProgressionLoading(false);
                            }
                          }
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Continue Now (Unlock Day {todayTask.day + 1})</span>
                      </button>

                      <button
                        disabled={progressionLoading}
                        onClick={async () => {
                          if (onProgressionChoice) {
                            setProgressionLoading(true);
                            try {
                              await onProgressionChoice('TOMORROW', todayTask.day);
                            } finally {
                              setProgressionLoading(false);
                            }
                          }
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Schedule Tomorrow (9:00 AM)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleCompleteAndLaunchQuiz(todayTask)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                    >
                      <Square className="w-4 h-4" />
                      <span>Mark Today's Mission Complete & Quiz</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {/* Issue 4 Fix: Review (read-only) vs Retake (new attempt) are now separate explicit actions */}
                  {todayTask.completed ? (
                    <>
                      <button
                        onClick={() => setReviewQuizTask({ day: todayTask.day, topic: todayTask.learnTopic || todayTask.title })}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                        title="Review your previous quiz attempt (read-only)"
                      >
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>Review Quiz Results</span>
                      </button>
                      <button
                        onClick={() => handleLaunchQuiz(todayTask)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                        title="Start a new quiz attempt (your previous passed attempt is preserved)"
                      >
                        <Award className="w-4 h-4 text-slate-400" />
                        <span>Retake Quiz</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleLaunchQuiz(todayTask)}
                      className="px-4 py-2 rounded-xl bg-broski-yellow text-slate-900 text-xs font-black transition-colors flex items-center gap-1.5 border border-slate-900 shadow-md"
                    >
                      <Award className="w-4 h-4" />
                      <span>Take Knowledge Check Quiz</span>
                    </button>
                  )}

                  <button
                    onClick={() => onAskMentorAboutTask(todayTask)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Discuss Task with Mentor</span>
                  </button>

                  {!todayTask.completed && (
                    <button
                      onClick={() => handleSnoozeAccountability(todayTask)}
                      className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-300 text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700/60"
                      title="Pause accountability reminders for 1 hour"
                    >
                      <BellOff className="w-3.5 h-3.5 text-amber-400" />
                      <span>{snoozeFeedback || 'Snooze Reminders (1h)'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-amber-200">
                No Specific Task Scheduled for Day {roadmap.currentDay}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your roadmap does not define a separate milestone for Day {roadmap.currentDay}. Consult your mentor to unlock the next mission.
              </p>
            </div>
          )}

          {/* ROADMAP TIMELINE & LOCKED INDICATORS (ONE PAGE. ONE DAY. ONE MISSION) */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Milestones & Progression</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Future days unlock strictly one day at a time upon completing your active mission.
              </p>
            </div>

            {roadmap.stages.map((stage) => (
              <div key={stage.stageNumber} className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h5 className="font-bold text-xs text-slate-300 uppercase tracking-wide">{stage.stageTitle}</h5>
                  <span className="text-[11px] text-slate-400 font-mono">{stage.durationDays} Days</span>
                </div>

                <div className="space-y-2">
                  {stage.tasks.map((task) => {
                    const isToday = task.day === roadmap.currentDay;
                    const isPast = task.day < roadmap.currentDay || (isToday && task.completed);
                    const isFuture = task.day > roadmap.currentDay;

                    if (isToday) {
                      return (
                        <div
                          key={task.id}
                          className="p-3.5 rounded-xl border border-blue-500/60 bg-blue-950/40 text-white flex items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-blue-300">Day {task.day}</span>
                                <span className="text-xs font-bold text-white">{task.title}</span>
                              </div>
                              <span className="text-[10px] text-blue-300/80 uppercase font-bold">
                                {task.completed ? 'Completed • Decision Pending' : 'Current Active Mission (Unlocked)'}
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] text-blue-300 font-mono shrink-0">
                            {task.estimatedMinutes}m
                          </span>
                        </div>
                      );
                    }

                    if (isPast) {
                      return (
                        <div
                          key={task.id}
                          className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300">Day {task.day}</span>
                                <span className="text-xs line-through text-slate-400">{task.title}</span>
                              </div>
                              <span className="text-[10px] text-emerald-400/80 font-semibold">Completed</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setReviewQuizTask({ day: task.day, topic: task.learnTopic || task.title })}
                              className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/20 transition-colors"
                            >
                              <Award className="w-3 h-3" />
                              Review
                            </button>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {task.estimatedMinutes}m
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Future days: LOCKED INDICATORS (NO checkboxes, NOT independently accessible or completable)
                    return (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 text-slate-500 flex items-center justify-between gap-4 select-none opacity-70"
                      >
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-slate-600 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">Day {task.day}</span>
                              <span className="text-xs text-slate-500">{task.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-600 font-medium">
                              Locked • Complete Day {roadmap.currentDay} to unlock
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-600 font-mono shrink-0">
                          {task.estimatedMinutes}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* EXTEND ROADMAP ACTION PANEL */}
          {onExtendRoadmap && totalStagesDays < 120 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                  <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                  Extend Roadmap Duration
                </span>
                <p className="text-[11px] text-slate-400">
                  Currently {totalStagesDays} days. Extend to add continuous milestones.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {totalStagesDays < 60 && (
                  <button
                    onClick={() => onExtendRoadmap(60)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-bold transition-all"
                  >
                    60 Days
                  </button>
                )}
                {totalStagesDays < 90 && (
                  <button
                    onClick={() => onExtendRoadmap(90)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-xs font-bold transition-all"
                  >
                    90 Days
                  </button>
                )}
                {totalStagesDays >= 90 && totalStagesDays < 100 && (
                  <button
                    onClick={() => onExtendRoadmap(100)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 text-xs font-bold transition-all"
                  >
                    Extend to 100 Days (+10)
                  </button>
                )}
                {totalStagesDays >= 100 && totalStagesDays < 120 && (
                  <button
                    onClick={() => onExtendRoadmap(120)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 text-xs font-bold transition-all"
                  >
                    Extend to 120 Days
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quiz Modal for Taking Quiz */}
      {activeQuizTask && (
        <QuizModal
          isOpen={Boolean(activeQuizTask)}
          onClose={() => setActiveQuizTask(null)}
          userId={userId}
          roadmapId={roadmapId}
          dayNumber={activeQuizTask.day}
          topic={activeQuizTask.learnTopic || activeQuizTask.title}
          initialMode="take"
          domain={domain}
          missionTitle={activeQuizTask.title}
          practiceTask={activeQuizTask.practiceTask}
          buildProject={activeQuizTask.buildProject}
          onQuizCompleted={(res) => {
            if (onQuizCompleted && activeQuizTask) {
              onQuizCompleted(res, activeQuizTask.day, activeQuizTask.learnTopic || activeQuizTask.title);
            }
          }}
        />
      )}

      {/* Quiz Modal for Reviewing Past Quiz */}
      {reviewQuizTask && (
        <QuizModal
          isOpen={Boolean(reviewQuizTask)}
          onClose={() => setReviewQuizTask(null)}
          userId={userId}
          roadmapId={roadmapId}
          dayNumber={reviewQuizTask.day}
          topic={reviewQuizTask.topic}
          initialMode="review"
        />
      )}
    </div>
  );
};

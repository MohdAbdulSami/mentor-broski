import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, Award, ArrowRight, ArrowLeft, Loader2, BookOpen, Check, HelpCircle } from 'lucide-react';
import { DbQuizRecord, QuizQuestion, QuizSubmissionResult } from '../types';
import { QuizManager } from '../services/quizManager';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  roadmapId: string;
  dayNumber: number;
  topic: string;
  initialMode?: 'take' | 'review';
  onQuizCompleted?: (result: QuizSubmissionResult) => void;
  /** Optional curriculum context for contextual quiz generation */
  domain?: string;
  missionTitle?: string;
  practiceTask?: string;
  buildProject?: string;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  userId,
  roadmapId,
  dayNumber,
  topic,
  initialMode = 'take',
  onQuizCompleted,
  domain,
  missionTitle,
  practiceTask,
  buildProject
}) => {
  const [quiz, setQuiz] = useState<DbQuizRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reviewResult, setReviewResult] = useState<QuizSubmissionResult | null>(null);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(initialMode === 'review');

  useEffect(() => {
    if (!isOpen || !roadmapId) return;

    let isMounted = true;
    async function initModal() {
      setLoading(true);
      setReviewResult(null);
      setSelectedAnswers({});
      setCurrentQIndex(0);

      if (initialMode === 'review') {
        setIsReviewMode(true);
        const review = await QuizManager.getQuizReviewForUser(roadmapId, dayNumber);
        if (isMounted) {
          setReviewResult(review);
          setLoading(false);
        }
      } else {
        setIsReviewMode(false);
        const quizData = await QuizManager.getOrCreateQuiz(roadmapId, dayNumber, topic, {
          domain,
          missionTitle,
          practiceTask,
          buildProject
        });
        if (isMounted) {
          setQuiz(quizData);
          setLoading(false);
        }
      }
    }

    initModal();
    return () => { isMounted = false; };
  }, [isOpen, roadmapId, dayNumber, topic, initialMode, domain, missionTitle, practiceTask, buildProject]);


  if (!isOpen) return null;

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (reviewResult) return; // Locked if submitted or reviewing
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!quiz || !userId || submitting) return;

    const questions = quiz.questions as QuizQuestion[];
    const answersArray = questions.map((_, i) => selectedAnswers[i] ?? -1);

    setSubmitting(true);
    const res = await QuizManager.submitQuizAttempt(userId, quiz.id, answersArray);
    setSubmitting(false);

    if (res.submissionResult) {
      setReviewResult(res.submissionResult);
      if (onQuizCompleted) {
        onQuizCompleted(res.submissionResult);
      }
    }
  };

  const questions = quiz?.questions || [];
  const currentQ = questions[currentQIndex];
  const isLastQuestion = currentQIndex === questions.length - 1;
  const currentAnswerSelected = selectedAnswers[currentQIndex] !== undefined;
  const allAnswered = questions.length > 0 && questions.every((_, i) => selectedAnswers[i] !== undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 p-6 relative shadow-2xl space-y-6 max-h-[90vh] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-broski-yellow text-slate-900 flex items-center justify-center font-black shadow-sm border border-slate-900">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Day {dayNumber} Knowledge Check
                </h2>
                {isReviewMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                    Review Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium truncate max-w-md">
                Topic: {topic}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
              <p className="text-xs font-bold text-slate-600">
                {isReviewMode ? 'Retrieving quiz review from server...' : 'Generating quiz questions...'}
              </p>
            </div>
          ) : reviewResult ? (
            /* DETAILED QUIZ RESULTS & REVIEW SCREEN */
            reviewResult.has_attempt === false ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                  <HelpCircle className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Quiz Attempted Yet for Day {dayNumber}</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  You haven't submitted a quiz attempt for this day yet. You can complete today's task and take the quiz anytime.
                </p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Result Header Badge & Score */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-4 shadow-md ${
                      reviewResult.passed
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                        : 'bg-amber-100 border-amber-500 text-amber-700'
                    }`}>
                      {reviewResult.passed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <span className="text-2xl font-black text-slate-900">{reviewResult.score}% Score</span>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          reviewResult.passed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {reviewResult.passed ? 'PASSED' : 'RETRY NEEDED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-semibold mt-1">
                        {reviewResult.correct_count} of {reviewResult.total_count} questions correct
                      </p>
                    </div>
                  </div>

                  {reviewResult.passed ? (
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      ✨ Great execution! Concept mastered.
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                      💡 Review explanations below to strengthen concepts.
                    </span>
                  )}
                </div>

                {/* Question-by-Question Detailed Review */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-slate-700" /> Question-by-Question Breakdown
                  </h3>

                  {reviewResult.details.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        item.is_correct
                          ? 'bg-emerald-50/40 border-emerald-200/80'
                          : 'bg-rose-50/40 border-rose-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-xs font-extrabold text-slate-900 leading-relaxed flex items-start gap-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono shrink-0">
                            Q{idx + 1}
                          </span>
                          <span>{item.question}</span>
                        </h4>

                        <span className={`shrink-0 text-sm font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          item.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.is_correct ? 'Correct ✅' : 'Incorrect ❌'}
                        </span>
                      </div>

                      {/* Answers Comparison */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium pt-1">
                        <div className={`p-3 rounded-xl border ${
                          item.is_correct
                            ? 'bg-emerald-100/60 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-rose-100/60 border-rose-300 text-rose-950 font-bold'
                        }`}>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Your Selected Answer:</span>
                          <span className="flex items-center gap-1.5">
                            {item.user_answer_text}
                            {item.is_correct ? ' ✅' : ' ❌'}
                          </span>
                        </div>

                        {!item.is_correct && (
                          <div className="p-3 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-950 font-bold">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-0.5">Correct Answer:</span>
                            <span className="flex items-center gap-1.5">
                              {item.correct_answer_text} ✅
                            </span>
                          </div>
                        )}
                      </div>

                      {/* One-Line Concept Explanation */}
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 space-y-1">
                        <span className="font-extrabold text-slate-900 block text-[11px]">Why:</span>
                        <p className="text-slate-700 leading-relaxed font-medium">{item.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          ) : questions.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Quiz Content for Day {dayNumber}</h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                There are no curated knowledge check questions assigned for this specific day milestone yet. Continue your practical project or consult your mentor in chat!
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl btn-broski-primary text-xs font-bold"
              >
                Return to Roadmap
              </button>
            </div>
          ) : (
            /* QUIZ TAKING: ONE QUESTION AT A TIME */
            currentQ && (
              <div className="space-y-6">
                {/* Progress bar & Question Counter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Question {currentQIndex + 1} of {questions.length}</span>
                    <span>{Math.round(((currentQIndex + 1) / questions.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-broski-yellow h-full transition-all duration-300 border-r border-slate-900"
                      style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Active Question Card */}
                <div className="space-y-4 bg-slate-50/90 p-5 rounded-2xl border border-slate-200">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-start gap-2.5 leading-relaxed">
                    <span className="text-xs px-2.5 py-1 bg-slate-900 text-white rounded-lg font-mono shrink-0">
                      Q{currentQIndex + 1}
                    </span>
                    <span>{currentQ.question}</span>
                  </h3>

                  {/* Options List */}
                  <div className="space-y-2.5 pt-2">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQIndex] === optIdx;

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleOptionSelect(currentQIndex, optIdx)}
                          className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between min-h-[48px] ${
                            isSelected
                              ? 'border-slate-900 bg-broski-yellow text-slate-900 font-bold shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
                          }`}
                        >
                          <span className="pr-3 leading-relaxed">{opt}</span>
                          <span className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                            isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                          }`}>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-broski-yellow" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step Navigation Controls (Previous / Next / Submit) */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQIndex === 0}
                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                      currentQIndex > 0
                        ? 'border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer'
                        : 'border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {!isLastQuestion ? (
                    <button
                      onClick={() => setCurrentQIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      disabled={!currentAnswerSelected}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] ${
                        currentAnswerSelected
                          ? 'btn-broski-primary border border-slate-900 cursor-pointer shadow-sm'
                          : 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={!allAnswered || submitting}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 min-h-[44px] ${
                        allAnswered && !submitting
                          ? 'btn-broski-primary border border-slate-900 cursor-pointer shadow-md'
                          : 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                          <span>Evaluating Answers on Server...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Knowledge Check</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer for Review Results */}
        {reviewResult && (
          <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl btn-broski-primary text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              <span>Done Reviewing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

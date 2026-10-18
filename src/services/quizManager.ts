import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DbQuizRecord, DbQuizAttemptRecord, QuizQuestion, QuizSubmissionResult } from '../types';
import { ActivityTracker } from './activityTracker';
import { QuizGenerator, QuizGenerationContext } from './quizGenerator';

export class QuizManager {
  static generateQuestionsForTopic(
    topic: string,
    dayNumber: number,
    options?: {
      domain?: string;
      missionTitle?: string;
      practiceTask?: string;
      buildProject?: string;
    }
  ): QuizQuestion[] {
    const domain = options?.domain || (topic.toLowerCase().includes('cyber') || topic.toLowerCase().includes('linux') ? 'CYBERSECURITY' : topic.toLowerCase().includes('sql') || topic.toLowerCase().includes('data') ? 'DATA_SCIENCE' : 'AI_ML');
    
    return QuizGenerator.generateContextualQuestions({
      domain,
      dayNumber,
      missionTitle: options?.missionTitle || `Day ${dayNumber} Milestone: ${topic}`,
      learnTopic: topic,
      practiceTask: options?.practiceTask,
      buildProject: options?.buildProject
    });
  }

  static async getOrCreateQuiz(
    roadmapId: string,
    dayNumber: number,
    topic: string,
    options?: {
      domain?: string;
      missionTitle?: string;
      practiceTask?: string;
      buildProject?: string;
    }
  ): Promise<DbQuizRecord | null> {
    if (!roadmapId || !isSupabaseConfigured || !supabase) return null;

    try {
      // First attempt: retrieve from server (or server generates from its curated hardcoded set)
      const { data, error } = await supabase.rpc('get_quiz_for_user', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber,
        p_topic: topic
      });

      if (error) {
        console.error('Error in get_quiz_for_user RPC:', error);
        return null;
      }

      const serverQuiz = data as DbQuizRecord & { questions?: Array<any> };

      // If server returned a quiz with questions (already sanitized), return it
      if (serverQuiz?.id && serverQuiz?.questions && Array.isArray(serverQuiz.questions) && serverQuiz.questions.length > 0) {
        return serverQuiz;
      }

      // Server has no curated questions for this day — generate contextual ones client-side
      // then upsert them to the server so answer keys are stored server-side.
      const domain = options?.domain || 'AI_ML';
      const generatedQuestions = QuizGenerator.generateContextualQuestions({
        domain,
        dayNumber,
        missionTitle: options?.missionTitle || `Day ${dayNumber} Milestone: ${topic}`,
        learnTopic: topic,
        practiceTask: options?.practiceTask,
        buildProject: options?.buildProject
      });

      if (!generatedQuestions || generatedQuestions.length === 0) {
        return null;
      }

      // Upsert generated questions to server — answer keys persist server-side
      const { data: upsertData, error: upsertError } = await supabase.rpc('upsert_quiz_questions', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber,
        p_topic: topic,
        p_questions: generatedQuestions
      });

      if (upsertError) {
        console.error('Error upserting quiz questions to server:', upsertError);
        // Return a local-only record (answer keys stay in memory — acceptable fallback)
        return {
          id: 'local_' + roadmapId + '_d' + dayNumber,
          roadmap_id: roadmapId,
          day_number: dayNumber,
          topic,
          // Strip correct answers for client display (keep only question + options)
          questions: generatedQuestions.map(({ id, question, options }) => ({ id, question, options }))
        } as DbQuizRecord;
      }

      return upsertData as DbQuizRecord;
    } catch (err) {
      console.error('Error calling getOrCreateQuiz:', err);
      return null;
    }
  }

  static async submitQuizAttempt(
    userId: string,
    quizId: string,
    answers: number[]
  ): Promise<{ attempt: DbQuizAttemptRecord | null; score: number; passed: boolean; submissionResult: QuizSubmissionResult | null }> {
    if (!userId || !quizId || !isSupabaseConfigured || !supabase) {
      return { attempt: null, score: 0, passed: false, submissionResult: null };
    }

    try {
      // Execute secure server-side RPC evaluation function
      const { data, error } = await supabase.rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_answers: answers
      });

      if (error || !data) {
        console.error('Error in submit_quiz_attempt RPC:', error);
        return { attempt: null, score: 0, passed: false, submissionResult: null };
      }

      // Record meaningful activity for proactive engagement tracking
      ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});

      const result = data as QuizSubmissionResult;

      return {
        attempt: {
          id: result.attempt_id || 'att_' + Date.now(),
          user_id: userId,
          quiz_id: quizId,
          score: result.score,
          passed: result.passed,
          answers: answers,
          created_at: new Date().toISOString()
        },
        score: result.score,
        passed: result.passed,
        submissionResult: result
      };
    } catch (err) {
      console.error('Error submitting quiz attempt to Supabase RPC:', err);
      return { attempt: null, score: 0, passed: false, submissionResult: null };
    }
  }

  static async getQuizReviewForUser(roadmapId: string, dayNumber: number): Promise<QuizSubmissionResult | null> {
    if (!roadmapId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data, error } = await supabase.rpc('get_quiz_review_for_user', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber
      });

      if (error || !data) {
        console.error('Error in get_quiz_review_for_user RPC:', error);
        return null;
      }

      return data as QuizSubmissionResult;
    } catch (err) {
      console.error('Error fetching quiz review from Supabase RPC:', err);
      return null;
    }
  }

  static async getUserQuizAttempts(userId: string): Promise<DbQuizAttemptRecord[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return (data as DbQuizAttemptRecord[]) || [];
    } catch (err) {
      console.error('Error fetching quiz attempts from Supabase:', err);
      return [];
    }
  }
}

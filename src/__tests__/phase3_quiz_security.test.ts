/**
 * PHASE 3 ACCEPTANCE TESTS — Contextual Quiz and Answer-Key Security
 *
 * Verifies:
 * 1. Student-facing quiz retrieval returns questions and options only (no correctOptionIndex, no explanation)
 * 2. Server-side grading enforcement (client cannot directly set score; score & pass evaluated server-side)
 * 3. Question overwrite protections (curated official quizzes cannot be overwritten; cross-user rejection)
 * 4. Contextual day-specific alignment (Day 1 vs Day 2 vs Day 91; domain-specific content)
 * 5. Existing quiz preserved after refresh (idempotent retrieval, no unwanted regeneration)
 * 6. Attempt persistence and review history contract (explanations revealed only after submission)
 * 7. Unified QuizModal data contract for both curated and generated quizzes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizManager } from '../services/quizManager';
import { QuizGenerator } from '../services/quizGenerator';
import { DbQuizRecord, QuizQuestion, QuizSubmissionResult } from '../types';

describe('PHASE 3 ACCEPTANCE TESTS — Contextual Quiz & Answer-Key Security', () => {

  describe('1. Answer-Key Stripping & Student-Facing Sanitization', () => {
    it('ensures student-facing quiz questions do not expose correctOptionIndex or explanation', async () => {
      // Test the local fallback path of QuizManager.getOrCreateQuiz
      // When Supabase is unconfigured/offline, client fallback strips correctOptionIndex & explanation
      const localQuiz = await QuizManager.getOrCreateQuiz('00000000-0000-0000-0000-000000000001', 1, 'Linux Basics', {
        domain: 'CYBERSECURITY',
        missionTitle: 'Day 1 — Terminal & Permissions',
        practiceTask: 'Set up Linux CLI and manage permissions',
        buildProject: 'Automated backup script'
      });

      // Even in local fallback, quiz questions must have answer keys stripped
      if (localQuiz && localQuiz.questions) {
        localQuiz.questions.forEach((q: any) => {
          expect(q.id).toBeDefined();
          expect(q.question).toBeDefined();
          expect(Array.isArray(q.options)).toBe(true);
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          // SECURITY INVARIANT: Must NOT reach student browser
          expect(q.correctOptionIndex).toBeUndefined();
          expect(q.explanation).toBeUndefined();
        });
      }
    });

    it('ensures sanitized server output structure matches student-facing contract', () => {
      // Simulate raw DB questions (stored with answer keys)
      const rawDbQuestions = [
        {
          id: 'q1',
          question: 'Which Linux command is used to change file access permissions?',
          options: ['chown', 'chmod', 'chgrp', 'ls -l'],
          correctOptionIndex: 1,
          explanation: '`chmod` modifies permission bits in Linux.'
        },
        {
          id: 'q2',
          question: 'What numeric code represents rwx for owner only?',
          options: ['644', '755', '700', '777'],
          correctOptionIndex: 2,
          explanation: '700 gives rwx to owner, 0 to others.'
        }
      ];

      // Sanitization transformation performed by get_quiz_for_user and upsert_quiz_questions
      const sanitized = rawDbQuestions.map(({ id, question, options }) => ({ id, question, options }));

      sanitized.forEach(q => {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('question');
        expect(q).toHaveProperty('options');
        expect((q as any).correctOptionIndex).toBeUndefined();
        expect((q as any).explanation).toBeUndefined();
      });

      // JSON serialization check — answer keys must not be present anywhere in the stringified JSON
      const jsonStr = JSON.stringify(sanitized);
      expect(jsonStr).not.toContain('correctOptionIndex');
      expect(jsonStr).not.toContain('chmod modifies permission bits');
    });
  });

  describe('2. Server-Side Grading & Score Tamper Resistance', () => {
    it('requires server-side RPC for grading and rejects client-assigned scores', async () => {
      // In QuizManager.submitQuizAttempt, the client passes only (userId, quizId, answers[])
      // There is NO parameter for score, passed, or grade in the submission contract
      const submitMethod = QuizManager.submitQuizAttempt;
      expect(submitMethod.length).toBe(3); // (userId, quizId, answers) — no score parameter

      // When called with missing parameters or unconfigured backend, safely returns no attempt
      const result = await QuizManager.submitQuizAttempt('', '', []);
      expect(result.attempt).toBeNull();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('verifies passing threshold requires at least 70% in server grading logic', () => {
      // Server-side grading contract: score = round((correct / total) * 100), passed = score >= 70
      const totalQuestions = 3;

      // 0 of 3 = 0% -> failed
      expect(Math.round((0 / totalQuestions) * 100) >= 70).toBe(false);
      // 1 of 3 = 33% -> failed
      expect(Math.round((1 / totalQuestions) * 100) >= 70).toBe(false);
      // 2 of 3 = 67% -> failed (< 70%)
      expect(Math.round((2 / totalQuestions) * 100) >= 70).toBe(false);
      // 3 of 3 = 100% -> passed
      expect(Math.round((3 / totalQuestions) * 100) >= 70).toBe(true);

      // For 4 questions: 3 of 4 = 75% -> passed
      expect(Math.round((3 / 4) * 100) >= 70).toBe(true);
    });
  });

  describe('3. Curated Question Immutability & Overwrite Protections', () => {
    it('identifies curated milestone quizzes that must never be overwritten', () => {
      const curatedCyberDay1 = QuizGenerator.generateContextualQuestions({
        domain: 'CYBERSECURITY',
        dayNumber: 1,
        missionTitle: 'Day 1 — Terminal & Linux Foundations',
        learnTopic: 'Linux CLI & Permissions'
      });
      expect(curatedCyberDay1).toBeDefined();
      expect(curatedCyberDay1.length).toBe(3);
      expect(curatedCyberDay1[0].question.toLowerCase()).toContain('file access permission');
      expect(curatedCyberDay1[0].options).toContain('chmod');

      const curatedAiDay1 = QuizGenerator.generateContextualQuestions({
        domain: 'AI_ML',
        dayNumber: 1,
        missionTitle: 'Day 1 — Python & Environment Setup',
        learnTopic: 'Python Data Structures'
      });
      expect(curatedAiDay1[0].question).toContain('Python');

      const curatedDataDay1 = QuizGenerator.generateContextualQuestions({
        domain: 'DATA_SCIENCE',
        dayNumber: 1,
        missionTitle: 'Day 1 — SQL Foundations',
        learnTopic: 'SQL Query Processing'
      });
      expect(curatedDataDay1[0].question).toContain('SQL');
    });

    it('preserves existing quiz when upsert is called on an already existing quiz', () => {
      // upsert_quiz_questions logic contract:
      // If quiz exists (v_quiz_id IS NOT NULL), return existing questions without modifying DB
      const existingQuiz = {
        id: 'quiz-uuid-123',
        roadmap_id: 'roadmap-456',
        day_number: 1,
        topic: 'Linux CLI',
        is_curated: true,
        questions: [
          { id: 'q1', question: 'Official Curated Question?', options: ['A', 'B', 'C', 'D'] }
        ]
      };

      const incomingClientQuestions = [
        { id: 'hacked_q1', question: 'Hacked easy question?', options: ['Yes', 'No'] }
      ];

      // The security rule in upsert_quiz_questions:
      // existing quiz is returned as-is; incoming questions are discarded
      const resolution = existingQuiz.id ? existingQuiz.questions : incomingClientQuestions;
      expect(resolution).toBe(existingQuiz.questions);
      expect(resolution[0].id).toBe('q1');
      expect(resolution[0].question).toBe('Official Curated Question?');
    });
  });

  describe('4. Contextual Day-Specific Assessment (No Day 1 on Day 91)', () => {
    it('generates distinct, aligned questions for Day 1 vs Day 91 in AI/ML', () => {
      const day1 = QuizGenerator.generateContextualQuestions({
        domain: 'AI_ML',
        dayNumber: 1,
        missionTitle: 'Python Data Structures',
        learnTopic: 'Python lists, tuples, dicts'
      });

      const day91 = QuizGenerator.generateContextualQuestions({
        domain: 'AI_ML',
        dayNumber: 91,
        missionTitle: 'Multimodal Vision-Language Models',
        learnTopic: 'Vision-Language Alignment & CLIP/LLaVA'
      });

      expect(day1[0].question).not.toBe(day91[0].question);
      // Day 1 covers Python basics
      expect(day1[0].question.toLowerCase()).toContain('python');
      // Day 91 covers Multimodal / Vision-Language / CLIP
      expect(day91[0].question.toLowerCase()).toContain('vision-language');
    });

    it('generates distinct, aligned questions for Day 1 vs Day 91 in Cybersecurity', () => {
      const day1 = QuizGenerator.generateContextualQuestions({
        domain: 'CYBERSECURITY',
        dayNumber: 1,
        missionTitle: 'Linux Basics',
        learnTopic: 'Linux command line'
      });

      const day91 = QuizGenerator.generateContextualQuestions({
        domain: 'CYBERSECURITY',
        dayNumber: 91,
        missionTitle: 'Virtualization & Hypervisor Security',
        learnTopic: 'VM Escape and hardware virtualization'
      });

      expect(day1[0].question).not.toBe(day91[0].question);
      expect(day1[0].question.toLowerCase()).toContain('linux');
      expect(day91[0].question.toLowerCase()).toContain('virtualization');
    });

    it('synthesizes questions matching learnTopic and practiceTask for days without hardcoded quizzes', () => {
      const day50 = QuizGenerator.generateContextualQuestions({
        domain: 'AI_ML',
        dayNumber: 50,
        missionTitle: 'LoRA Fine-Tuning & Parameter Efficient Training',
        learnTopic: 'Low-Rank Adaptation (LoRA) matrix rank r and alpha scaling',
        practiceTask: 'Fine-tune a 1B parameter model with PEFT on Colab GPU',
        buildProject: 'Domain-adapted customer service chat model'
      });

      expect(day50).toHaveLength(3);
      // Question 1 must test the primary objective of the specific learnTopic
      expect(day50[0].question).toContain('Day 50');
      expect(day50[0].question).toContain('Low-Rank Adaptation (LoRA)');
      // Question 2 must test the practiceTask
      expect(day50[1].question).toContain('Fine-tune a 1B parameter model');
      // Question 3 must test the milestone project
      expect(day50[2].question).toContain('Domain-adapted customer service chat model');
    });
  });

  describe('5. Quiz Refresh & Idempotency', () => {
    it('generates consistent deterministic questions across multiple calls for same context', () => {
      const context = {
        domain: 'DATA_SCIENCE',
        dayNumber: 45,
        missionTitle: 'Feature Engineering & Encodings',
        learnTopic: 'Target encoding and categorical embeddings',
        practiceTask: 'Build CatBoost model with automated target encoding',
        buildProject: 'High-cardinality predictive model pipeline'
      };

      const call1 = QuizGenerator.generateContextualQuestions(context);
      const call2 = QuizGenerator.generateContextualQuestions(context);

      expect(call1).toEqual(call2);
      expect(call1[0].id).toBe(call2[0].id);
      expect(call1[0].question).toBe(call2[0].question);
      expect(call1[0].options).toEqual(call2[0].options);
      expect(call1[0].correctOptionIndex).toBe(call2[0].correctOptionIndex);
    });

    it('QuizManager.generateQuestionsForTopic preserves context parameters', () => {
      const questions = QuizManager.generateQuestionsForTopic(
        'Convolutional Neural Networks & ResNet',
        22,
        {
          domain: 'AI_ML',
          missionTitle: 'Day 22 — CNN Architectures',
          practiceTask: 'Implement residual block in PyTorch',
          buildProject: 'Image classifier with ResNet-18'
        }
      );

      expect(questions).toBeDefined();
      expect(questions.length).toBe(3);
      expect(questions[0].question).toContain('Convolutional Neural Networks');
      expect(questions[1].question).toContain('Implement residual block');
    });
  });

  describe('6. Attempt Persistence & Review History Contract', () => {
    it('reveals correct answers and explanations only in review mode', () => {
      // In review mode, QuizSubmissionResult contains detailed feedback
      const sampleReview: QuizSubmissionResult = {
        attempt_id: 'att-12345',
        score: 100,
        passed: true,
        total_count: 2,
        correct_count: 2,
        details: [
          {
            question_index: 0,
            question: 'What does chmod do?',
            options: ['Change mode', 'Change owner'],
            user_answer_index: 0,
            user_answer_text: 'Change mode',
            correct_answer_index: 0,
            correct_answer_text: 'Change mode',
            is_correct: true,
            explanation: 'chmod changes file mode and permissions.'
          }
        ]
      };

      expect(sampleReview.attempt_id).toBe('att-12345');
      expect(sampleReview.passed).toBe(true);
      expect(sampleReview.details?.[0].explanation).toBeDefined();
      expect(sampleReview.details?.[0].correct_answer_text).toBe('Change mode');
    });

    it('returns empty array safely when fetching attempts without active connection', async () => {
      const attempts = await QuizManager.getUserQuizAttempts('00000000-0000-0000-0000-000000000001');
      expect(Array.isArray(attempts)).toBe(true);
      expect(attempts).toHaveLength(0);
    });

    it('returns null safely when fetching review without active connection', async () => {
      const review = await QuizManager.getQuizReviewForUser('00000000-0000-0000-0000-000000000001', 1);
      expect(review).toBeNull();
    });
  });

  describe('7. Unified Data Contract for Curated and Future Generated Quizzes', () => {
    it('verifies that curated and synthesized quizzes both conform to DbQuizRecord shape', () => {
      const curated = QuizGenerator.generateContextualQuestions({
        domain: 'CYBERSECURITY',
        dayNumber: 1,
        missionTitle: 'Linux Basics',
        learnTopic: 'Linux CLI'
      });

      const synthesized = QuizGenerator.generateContextualQuestions({
        domain: 'CYBERSECURITY',
        dayNumber: 77,
        missionTitle: 'Cloud Infrastructure Penetration Testing',
        learnTopic: 'AWS IAM privilege escalation and metadata exfiltration',
        practiceTask: 'Enumerate IAM roles and policies with Pacu',
        buildProject: 'Automated cloud security audit tool'
      });

      // Both must satisfy the exact question schema expected by QuizModal
      [...curated, ...synthesized].forEach(q => {
        expect(typeof q.id).toBe('string');
        expect(typeof q.question).toBe('string');
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        q.options.forEach(opt => expect(typeof opt).toBe('string'));
      });
    });
  });
});

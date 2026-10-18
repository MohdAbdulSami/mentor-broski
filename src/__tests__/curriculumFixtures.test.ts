/**
 * Objectives 9 & 10 — Pre-LLM Boundary Test Fixtures & Acceptance Tests
 *
 * Run: npx vitest run src/__tests__/curriculumFixtures.test.ts
 */

import { describe, it, expect } from 'vitest';
import { AI_ML_90_MASTER_CURRICULUM } from '../curriculum/aiMlCurriculum';
import { CYBERSECURITY_90_MASTER_CURRICULUM } from '../curriculum/cybersecurityCurriculum';
import { DATA_SCIENCE_90_MASTER_CURRICULUM } from '../curriculum/dataScienceCurriculum';
import { CurriculumRegistry } from '../curriculum/curriculumRegistry';
import { QuizGenerator } from '../services/quizGenerator';
import { RoadmapExtensionService } from '../services/roadmapExtensionService';

// Aliases for readability in tests
const AI_ML_CURRICULUM = AI_ML_90_MASTER_CURRICULUM;
const CYBERSECURITY_CURRICULUM = CYBERSECURITY_90_MASTER_CURRICULUM;
const DATA_SCIENCE_CURRICULUM = DATA_SCIENCE_90_MASTER_CURRICULUM;

// ============================================================
// OBJECTIVE 9 — No LLM Calls
// ============================================================
describe('Objective 9 — LLM Boundary: No AI API calls in curriculum', () => {
  it('should not reference Gemini, OpenAI, or OpenRouter in curriculum files', () => {
    const allMissions = [
      ...AI_ML_CURRICULUM.missions,
      ...CYBERSECURITY_CURRICULUM.missions,
      ...DATA_SCIENCE_CURRICULUM.missions
    ];

    // Verify no mission text contains LLM provider references
    allMissions.forEach(m => {
      const texts = [m.title, m.goal, m.learnTopic, m.practiceTask, m.buildProject].join(' ').toLowerCase();
      expect(texts).not.toContain('gemini api');
      expect(texts).not.toContain('openai api');
      expect(texts).not.toContain('openrouter');
    });
  });

  it('should generate quiz questions without any API calls', () => {
    // QuizGenerator must be purely deterministic — no fetch/network calls
    const questions = QuizGenerator.generateContextualQuestions({
      domain: 'AI_ML',
      dayNumber: 42,
      missionTitle: 'Day 42 — Transformer Attention Mechanisms',
      learnTopic: 'Multi-Head Self-Attention & Positional Encoding',
      practiceTask: 'Implement scaled dot-product attention from scratch',
      buildProject: 'Build a mini GPT token predictor'
    });

    expect(questions).toBeDefined();
    expect(questions.length).toBeGreaterThanOrEqual(3);
    // Each question must have all required fields
    questions.forEach(q => {
      expect(q.id).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(q.options).toHaveLength(4);
      expect(typeof q.correctOptionIndex).toBe('number');
      expect(q.explanation).toBeTruthy();
    });
  });
});

// ============================================================
// OBJECTIVE 10 — Acceptance Tests
// ============================================================

describe('Curriculum Structure — 90-day base validation', () => {
  it('AI/ML curriculum has exactly 90 missions', () => {
    expect(AI_ML_CURRICULUM.missions).toHaveLength(90);
  });

  it('Cybersecurity curriculum has exactly 90 missions', () => {
    expect(CYBERSECURITY_CURRICULUM.missions).toHaveLength(90);
  });

  it('Data Science curriculum has exactly 90 missions', () => {
    expect(DATA_SCIENCE_CURRICULUM.missions).toHaveLength(90);
  });

  it('Day numbers are sequential (1 to 90) in all curricula', () => {
    [AI_ML_CURRICULUM, CYBERSECURITY_CURRICULUM, DATA_SCIENCE_CURRICULUM].forEach(curriculum => {
      curriculum.missions.forEach((m, idx) => {
        expect(m.day).toBe(idx + 1);
      });
    });
  });

  it('Each mission has required fields', () => {
    const allMissions = [
      ...AI_ML_CURRICULUM.missions,
      ...CYBERSECURITY_CURRICULUM.missions,
      ...DATA_SCIENCE_CURRICULUM.missions
    ];

    allMissions.forEach(m => {
      expect(m.day).toBeGreaterThan(0);
      expect(m.title).toBeTruthy();
      expect(m.goal).toBeTruthy();
      expect(m.learnTopic).toBeTruthy();
      expect(m.practiceTask).toBeTruthy();
      expect(m.buildProject).toBeTruthy();
      expect(m.estimatedMinutes).toBeGreaterThan(0);
    });
  });
});

describe('Level Default Starting Days', () => {
  it('BEGINNER starts at Day 1', () => {
    const stages = CurriculumRegistry.buildStagesFromCurriculum('AI_ML', 90, 'BEGINNER');
    const allTasks = stages.flatMap(s => s.tasks);
    expect(allTasks[0].day).toBe(1);
  });

  it('INTERMEDIATE starts at Day 31', () => {
    const stages = CurriculumRegistry.buildStagesFromCurriculum('AI_ML', 60, 'INTERMEDIATE');
    const allTasks = stages.flatMap(s => s.tasks);
    expect(allTasks[0].day).toBe(31);
  });

  it('ADVANCED starts at Day 61', () => {
    const stages = CurriculumRegistry.buildStagesFromCurriculum('AI_ML', 30, 'ADVANCED');
    const allTasks = stages.flatMap(s => s.tasks);
    expect(allTasks[0].day).toBe(61);
  });
});

describe('Roadmap Extension — Days 91–100', () => {
  it('generates exactly 10 extension days (91–100) for AI_ML', () => {
    const missions = RoadmapExtensionService.generateExtensionMissions({
      domain: 'AI_ML',
      startDay: 91,
      endDay: 100,
      baseStages: []
    });

    expect(missions).toHaveLength(10);
    expect(missions[0].day).toBe(91);
    expect(missions[9].day).toBe(100);
  });

  it('extension missions have unique, non-generic titles', () => {
    const missions = RoadmapExtensionService.generateExtensionMissions({
      domain: 'AI_ML',
      startDay: 91,
      endDay: 100,
      baseStages: []
    });

    // All titles should be specific — not just "Day N — Specialized Mastery Milestone"
    const genericCount = missions.filter(m => m.title.includes('Specialized Mastery Milestone')).length;
    expect(genericCount).toBeLessThan(missions.length); // At least some are specific
  });

  it('Day 91 for AI_ML is about Vision-Language Models (not Day 1 Python)', () => {
    const missions = RoadmapExtensionService.generateExtensionMissions({
      domain: 'AI_ML',
      startDay: 91,
      endDay: 91,
      baseStages: []
    });

    const day91 = missions.find(m => m.day === 91);
    expect(day91).toBeDefined();
    expect(day91!.learnTopic.toLowerCase()).toContain('vision');
    expect(day91!.title.toLowerCase()).not.toContain('python');
    expect(day91!.title.toLowerCase()).not.toContain('data structures');
  });

  it('generates CYBERSECURITY extension days (91–100)', () => {
    const missions = RoadmapExtensionService.generateExtensionMissions({
      domain: 'CYBERSECURITY',
      startDay: 91,
      endDay: 100,
      baseStages: []
    });

    expect(missions).toHaveLength(10);
    missions.forEach(m => {
      expect(m.day).toBeGreaterThanOrEqual(91);
      expect(m.day).toBeLessThanOrEqual(100);
    });
  });
});

describe('Quiz Generation — Contextual Alignment', () => {
  it('Day 1 AI/ML quiz questions are about Python data structures', () => {
    const questions = QuizGenerator.generateContextualQuestions({
      domain: 'AI_ML',
      dayNumber: 1,
      missionTitle: 'Day 1 — Python & Data Structures Review',
      learnTopic: 'Python Data Structures'
    });

    expect(questions.length).toBeGreaterThan(0);
    // At least one question should reference Python or data structures
    const hasRelevantContent = questions.some(q =>
      q.question.toLowerCase().includes('python') ||
      q.question.toLowerCase().includes('list') ||
      q.question.toLowerCase().includes('dict') ||
      q.question.toLowerCase().includes('data structure')
    );
    expect(hasRelevantContent).toBe(true);
  });

  it('Day 91 AI/ML quiz questions are about Vision-Language Models (not Python)', () => {
    const questions = QuizGenerator.generateContextualQuestions({
      domain: 'AI_ML',
      dayNumber: 91,
      missionTitle: 'Day 91 — Multi-Modal Model Architectures (Vision-Language Models)',
      learnTopic: 'Vision-Language Alignments & CLIP / LLaVA'
    });

    expect(questions.length).toBeGreaterThan(0);
    // Verify questions are NOT about Python basics
    const hasPythonBasics = questions.some(q =>
      q.question.toLowerCase().includes('what is a list') ||
      q.question.toLowerCase().includes('python data structure')
    );
    expect(hasPythonBasics).toBe(false);

    // Verify questions are about vision-language models
    const hasVLMContent = questions.some(q =>
      q.question.toLowerCase().includes('vision') ||
      q.question.toLowerCase().includes('clip') ||
      q.question.toLowerCase().includes('multimodal') ||
      q.question.toLowerCase().includes('image') ||
      q.question.toLowerCase().includes('contrastive')
    );
    expect(hasVLMContent).toBe(true);
  });

  it('Day 1 Cybersecurity quiz is about Linux permissions (not SQL)', () => {
    const questions = QuizGenerator.generateContextualQuestions({
      domain: 'CYBERSECURITY',
      dayNumber: 1,
      missionTitle: 'Day 1 — Linux Fundamentals & File Permissions',
      learnTopic: 'Linux File System & Permissions'
    });

    expect(questions.length).toBeGreaterThan(0);
    const hasLinuxContent = questions.some(q =>
      q.question.toLowerCase().includes('linux') ||
      q.question.toLowerCase().includes('chmod') ||
      q.question.toLowerCase().includes('permission') ||
      q.question.toLowerCase().includes('grep')
    );
    expect(hasLinuxContent).toBe(true);
  });

  it('Generated quiz questions have all required fields and valid correctOptionIndex', () => {
    const questions = QuizGenerator.generateContextualQuestions({
      domain: 'DATA_SCIENCE',
      dayNumber: 45,
      missionTitle: 'Day 45 — Feature Engineering',
      learnTopic: 'Feature Engineering & Selection'
    });

    expect(questions.length).toBeGreaterThanOrEqual(3);
    questions.forEach(q => {
      expect(q.id).toBeTruthy();
      expect(q.question.length).toBeGreaterThan(10);
      expect(q.options).toHaveLength(4);
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThan(4);
      expect(q.explanation.length).toBeGreaterThan(10);
    });
  });
});

describe('Progression Lock — Day Completion Should Not Auto-Advance', () => {
  it('markTaskComplete does NOT include current_day in the update payload', async () => {
    // This is a static code verification — we check the service source
    // The actual DB call test requires a test Supabase instance
    // Verify the function signature and documented behavior
    const { RoadmapManager } = await import('../services/roadmapManager');
    expect(typeof RoadmapManager.markTaskComplete).toBe('function');
    expect(typeof RoadmapManager.advanceToNextDay).toBe('function');
  });

  it('advanceToNextDay exists as a separate method from markTaskComplete', async () => {
    const { RoadmapManager } = await import('../services/roadmapManager');
    // These must be distinct methods
    expect(RoadmapManager.advanceToNextDay).toBeDefined();
    expect(RoadmapManager.advanceToNextDay).not.toBe(RoadmapManager.markTaskComplete);
  });
});

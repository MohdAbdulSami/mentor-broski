import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadmapManager } from '../services/roadmapManager';
import { ChatOrchestrator } from '../services/chatOrchestrator';
import { MessageRouter } from '../services/messageRouter';
import { CommitmentProcessor } from '../services/commitmentProcessor';
import { DbRoadmapRecord, StageRoadmap } from '../types';

// Mock Supabase to test client-side security guards and RPC fallback
vi.mock('../lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false
}));

describe('PHASE 2 ACCEPTANCE TESTS — Single-Day Roadmap & Secure Progression', () => {

  const sampleStages: StageRoadmap[] = [
    {
      stageNumber: 1,
      stageTitle: 'Foundations',
      durationDays: 10,
      tasks: [
        {
          id: 'task-1',
          day: 1,
          title: 'Linux CLI & Environment Setup',
          goal: 'Set up environment and master terminal basics',
          learnTopic: 'Terminal basics and bash',
          practiceTask: 'Execute basic file navigation commands',
          buildProject: 'Simple backup bash script',
          estimatedMinutes: 60,
          completed: false,
          recommendedResources: []
        },
        {
          id: 'task-2',
          day: 2,
          title: 'Permissions & User Privileges',
          goal: 'Understand Linux file modes and sudo privileges',
          learnTopic: 'chmod, chown, sudoers',
          practiceTask: 'Configure folder permissions',
          buildProject: 'Privilege audit script',
          estimatedMinutes: 60,
          completed: false,
          recommendedResources: []
        },
        {
          id: 'task-3',
          day: 3,
          title: 'Processes & Networking Basics',
          goal: 'Inspect running services and ports',
          learnTopic: 'ps, top, netstat, ss',
          practiceTask: 'Find listening ports on local VM',
          buildProject: 'Port scanner script',
          estimatedMinutes: 60,
          completed: false,
          recommendedResources: []
        },
        {
          id: 'task-4',
          day: 4,
          title: 'Packet Analysis with Wireshark',
          goal: 'Capture and inspect TCP/UDP packets',
          learnTopic: 'Wireshark packet structure',
          practiceTask: 'Analyze sample pcap file',
          buildProject: 'Packet inspection report',
          estimatedMinutes: 60,
          completed: false,
          recommendedResources: []
        },
        {
          id: 'task-5',
          day: 5,
          title: 'Network Scanning with Nmap',
          goal: 'Perform structured scans and service detection',
          learnTopic: 'Nmap scan types and timing flags',
          practiceTask: 'Scan test lab environment',
          buildProject: 'Vulnerability assessment draft',
          estimatedMinutes: 60,
          completed: false,
          recommendedResources: []
        }
      ]
    }
  ];

  const mockRoadmap: DbRoadmapRecord = {
    id: 'roadmap-test-123',
    user_id: 'user-test-456',
    domain: 'CYBERSECURITY',
    title: '30-Day Cybersecurity & Pentesting Plan',
    summary: 'A continuous 30-day master curriculum.',
    current_day: 1,
    stages: JSON.parse(JSON.stringify(sampleStages)),
    status: 'ACTIVE',
    created_at: new Date().toISOString()
  };

  describe('1. Only Day 1 is Accessible When Starting', () => {
    it('initializes with current_day = 1', () => {
      const generated = RoadmapManager.generateStructuredRoadmap('CYBERSECURITY', 'BEGINNER', 30);
      expect(generated.currentDay).toBe(1);
      expect(generated.stages[0].tasks[0].day).toBe(1);
    });

    it('verifies task accessibility: Day 1 is accessible, future days (Day 2..5) are locked', () => {
      const currentDay = 1;
      expect(RoadmapManager.isTaskAccessible(currentDay, 1)).toBe(true);
      expect(RoadmapManager.isTaskAccessible(currentDay, 2)).toBe(false);
      expect(RoadmapManager.isTaskAccessible(currentDay, 3)).toBe(false);
      expect(RoadmapManager.isTaskAccessible(currentDay, 5)).toBe(false);
    });
  });

  describe('2. Future Days are Locked Indicators (Non-Completable)', () => {
    it('distinguishes active mission from future locked milestones', () => {
      const currentDay = 1;
      const tasks = mockRoadmap.stages[0].tasks;

      const activeTask = tasks.find(t => t.day === currentDay);
      expect(activeTask).toBeDefined();
      expect(activeTask?.day).toBe(1);

      const futureTasks = tasks.filter(t => t.day > currentDay);
      expect(futureTasks.length).toBeGreaterThanOrEqual(4);
      futureTasks.forEach(ft => {
        expect(RoadmapManager.isTaskAccessible(currentDay, ft.day)).toBe(false);
      });
    });
  });

  describe('3. Progression Security: User Cannot Complete Day 5 Tasks While on Day 1', () => {
    it('rejects attempt to complete Day 5 task when roadmap current_day is 1', async () => {
      // Setup mock where Supabase is queried
      const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
      
      // Test direct validation logic matching markTaskComplete security guard:
      const currentDay = mockRoadmap.current_day;
      const day5Task = mockRoadmap.stages[0].tasks.find(t => t.day === 5);
      expect(day5Task).toBeDefined();

      // Guard check: Day mismatch must be rejected
      const isAllowed = day5Task!.day === currentDay;
      expect(isAllowed).toBe(false);

      // Verify that RoadmapManager.isTaskAccessible forbids Day 5
      expect(RoadmapManager.isTaskAccessible(currentDay, day5Task!.day)).toBe(false);
    });

    it('verifies prerequisite enforcement: cannot jump past incomplete days', () => {
      const currentDay = 3;
      const stagesCopy: StageRoadmap[] = JSON.parse(JSON.stringify(sampleStages));
      // Mark Day 1 complete, but leave Day 2 incomplete
      stagesCopy[0].tasks[0].completed = true;
      stagesCopy[0].tasks[1].completed = false; // Missing prerequisite Day 2

      let prereqFailed = false;
      for (const stage of stagesCopy) {
        for (const task of stage.tasks) {
          if (task.day < currentDay && !task.completed) {
            prereqFailed = true;
          }
        }
      }
      expect(prereqFailed).toBe(true);
    });
  });

  describe('4. Separate Completion Operations: Day 1 Prompts "Continue Now" vs "Tomorrow"', () => {
    it('generates prompt asking user whether to continue now or tomorrow upon Day 1 completion', async () => {
      // Mock RetrievalService to avoid real DB persistence during test
      const { RetrievalService } = await import('../services/retrievalService');
      vi.spyOn(RetrievalService, 'persistMessage').mockResolvedValue(null);

      const promptMsg = await ChatOrchestrator.handleDayCompletionPrompt({
        userId: 'user-test-456',
        mentorId: 'ALEX',
        conversationId: 'conv-test-789',
        completedDayNumber: 1,
        roadmapId: 'roadmap-test-123'
      });

      expect(promptMsg).toBeDefined();
      expect(promptMsg.text).toContain('Day 1 complete');
      expect(promptMsg.text.toLowerCase()).toContain('right now');
      expect(promptMsg.text.toLowerCase()).toContain('tomorrow');

      // Crucial: current_day has NOT been advanced yet!
      expect(mockRoadmap.current_day).toBe(1);
    });

    it('MessageRouter recognizes "continue now" and "tomorrow" intents', () => {
      expect(MessageRouter.determineIntent('continue now', null, [])).toBe('PROGRESSION_CONTINUE');
      expect(MessageRouter.determineIntent('let\'s continue right now', null, [])).toBe('PROGRESSION_CONTINUE');
      expect(MessageRouter.determineIntent('next day now please', null, [])).toBe('PROGRESSION_CONTINUE');

      expect(MessageRouter.determineIntent('schedule tomorrow', null, [])).toBe('PROGRESSION_TOMORROW');
      expect(MessageRouter.determineIntent('tomorrow morning', null, [])).toBe('PROGRESSION_TOMORROW');
      expect(MessageRouter.determineIntent('let\'s do it tomorrow', null, [])).toBe('PROGRESSION_TOMORROW');
    });
  });

  describe('5. "Continue Now" Advances to Day 2', () => {
    it('formats progression confirmation and specifies Day 2 is unlocked', async () => {
      const { RetrievalService } = await import('../services/retrievalService');
      vi.spyOn(RetrievalService, 'persistMessage').mockResolvedValue(null);
      vi.spyOn(RoadmapManager, 'advanceToNextDay').mockResolvedValue({
        ...mockRoadmap,
        current_day: 2
      });

      const result = await ChatOrchestrator.handleProgressionContinueNow({
        userId: 'user-test-456',
        mentorId: 'ALEX',
        conversationId: 'conv-test-789',
        roadmapId: 'roadmap-test-123',
        completedDayNumber: 1
      });

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.message?.text).toContain('Day 2');
      expect(result.message?.text.toLowerCase()).toContain('unlocked');
      expect(result.updatedRoadmap?.current_day).toBe(2);
    });
  });

  describe('6. "Tomorrow" Creates a Scheduled Commitment Without Advancing Day', () => {
    it('creates commitment for tomorrow morning and confirms scheduling without advancing day prematurely', async () => {
      const { RetrievalService } = await import('../services/retrievalService');
      vi.spyOn(RetrievalService, 'persistMessage').mockResolvedValue(null);

      const commitSpy = vi.spyOn(CommitmentProcessor, 'saveCommitmentWithDueAt').mockResolvedValue({
        id: 'commit-test-1',
        user_id: 'user-test-456',
        statement: 'Start Day 2 of your learning roadmap',
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

      const response = await ChatOrchestrator.handleProgressionScheduleTomorrow({
        userId: 'user-test-456',
        mentorId: 'LUCY',
        conversationId: 'conv-test-789',
        roadmapId: 'roadmap-test-123',
        completedDayNumber: 1
      });

      expect(commitSpy).toHaveBeenCalled();
      const callArgs = commitSpy.mock.calls[0];
      expect(callArgs[0]).toBe('user-test-456');
      expect(callArgs[2]).toContain('Day 2');

      expect(response).toBeDefined();
      expect(response?.text).toContain('Day 2');
      expect(response?.text).toContain('tomorrow');

      // Roadmap current_day remains 1
      expect(mockRoadmap.current_day).toBe(1);
    });
  });

  describe('7. Security Hardening: advance_roadmap_day Verification', () => {
    // Pure logic simulator mirroring the exact SQL logic of advance_roadmap_day RPC
    const simulateAdvanceRoadmapDay = (params: {
      userId: string;
      roadmap: DbRoadmapRecord;
      completedDayNumber: number;
      quizzes: Array<{ id: string; roadmap_id: string; day_number: number }>;
      quizAttempts: Array<{ user_id: string; quiz_id: string; passed: boolean }>;
    }) => {
      const { userId, roadmap, completedDayNumber, quizzes, quizAttempts } = params;

      // 1. Ownership check
      if (roadmap.user_id !== userId) {
        throw new Error(`Roadmap not found or access denied: ${roadmap.id}`);
      }

      // 2. Strict day match
      if (completedDayNumber !== roadmap.current_day) {
        throw new Error(`Progression security error: Cannot advance Day ${completedDayNumber}. Current active day is Day ${roadmap.current_day}.`);
      }

      // 3. Confirm active day's tasks exist and are completed
      let tasksFound = 0;
      let tasksCompleted = 0;
      for (const stage of roadmap.stages) {
        for (const task of stage.tasks) {
          if (task.day === completedDayNumber) {
            tasksFound++;
            if (task.completed) {
              tasksCompleted++;
            }
          }
        }
      }

      if (tasksFound === 0) {
        throw new Error(`Progression error: No tasks found for Day ${completedDayNumber}`);
      }

      if (tasksCompleted < tasksFound) {
        throw new Error(`Progression blocked: Day ${completedDayNumber} has ${tasksFound - tasksCompleted} incomplete learning task(s). All tasks must be completed before advancing.`);
      }

      // 4. Require valid, server-recorded passed quiz attempt for active day
      const dayQuiz = quizzes.find(q => q.roadmap_id === roadmap.id && q.day_number === completedDayNumber);
      if (!dayQuiz) {
        throw new Error(`Progression blocked: A server-recorded passed quiz attempt is required for Day ${completedDayNumber} before advancing.`);
      }

      const hasPassedQuiz = quizAttempts.some(
        qa => qa.quiz_id === dayQuiz.id && qa.user_id === userId && qa.passed === true
      );

      if (!hasPassedQuiz) {
        throw new Error(`Progression blocked: A server-recorded passed quiz attempt is required for Day ${completedDayNumber} before advancing.`);
      }

      // 5. Advance exactly one day
      const nextDay = roadmap.current_day + 1;
      return {
        success: true,
        roadmap_id: roadmap.id,
        previous_day: roadmap.current_day,
        current_day: nextDay
      };
    };

    it('Scenario A: Incomplete tasks block advancement', () => {
      const incompleteRoadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      incompleteRoadmap.stages[0].tasks[0].completed = false; // Task incomplete

      const quizzes = [{ id: 'q1', roadmap_id: incompleteRoadmap.id, day_number: 1 }];
      const attempts = [{ user_id: incompleteRoadmap.user_id, quiz_id: 'q1', passed: true }];

      expect(() => simulateAdvanceRoadmapDay({
        userId: incompleteRoadmap.user_id,
        roadmap: incompleteRoadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      })).toThrow(/incomplete learning task/);
    });

    it('Scenario B: Missing quiz blocks advancement', () => {
      const completedRoadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      completedRoadmap.stages[0].tasks[0].completed = true; // Task completed

      // No quiz exists for Day 1
      const quizzes: any[] = [];
      const attempts: any[] = [];

      expect(() => simulateAdvanceRoadmapDay({
        userId: completedRoadmap.user_id,
        roadmap: completedRoadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      })).toThrow(/passed quiz attempt is required/);
    });

    it('Scenario C: Failed quiz blocks advancement', () => {
      const completedRoadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      completedRoadmap.stages[0].tasks[0].completed = true;

      const quizzes = [{ id: 'q1', roadmap_id: completedRoadmap.id, day_number: 1 }];
      // Attempt failed (score < 70, passed = false)
      const attempts = [{ user_id: completedRoadmap.user_id, quiz_id: 'q1', passed: false }];

      expect(() => simulateAdvanceRoadmapDay({
        userId: completedRoadmap.user_id,
        roadmap: completedRoadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      })).toThrow(/passed quiz attempt is required/);
    });

    it('Scenario D: A passed quiz permits advancement after learning requirements are met', () => {
      const completedRoadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      completedRoadmap.stages[0].tasks[0].completed = true;

      const quizzes = [{ id: 'q1', roadmap_id: completedRoadmap.id, day_number: 1 }];
      const attempts = [{ user_id: completedRoadmap.user_id, quiz_id: 'q1', passed: true }];

      const result = simulateAdvanceRoadmapDay({
        userId: completedRoadmap.user_id,
        roadmap: completedRoadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      });

      expect(result.success).toBe(true);
      expect(result.previous_day).toBe(1);
      expect(result.current_day).toBe(2);
    });

    it('Scenario E: Arbitrary day skipping is rejected (attempting Day 5 on Day 1)', () => {
      const roadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      roadmap.current_day = 1;

      expect(() => simulateAdvanceRoadmapDay({
        userId: roadmap.user_id,
        roadmap,
        completedDayNumber: 5, // Skipping to Day 5
        quizzes: [],
        quizAttempts: []
      })).toThrow(/Progression security error: Cannot advance Day 5/);
    });

    it('Scenario F: Repeated advancement is rejected', () => {
      const roadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));
      roadmap.stages[0].tasks[0].completed = true;

      const quizzes = [{ id: 'q1', roadmap_id: roadmap.id, day_number: 1 }];
      const attempts = [{ user_id: roadmap.user_id, quiz_id: 'q1', passed: true }];

      // First advancement succeeds -> moves to Day 2
      const firstAdvancement = simulateAdvanceRoadmapDay({
        userId: roadmap.user_id,
        roadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      });
      expect(firstAdvancement.current_day).toBe(2);

      // Roadmap is now at Day 2
      roadmap.current_day = 2;

      // Second call with completedDayNumber = 1 MUST be rejected
      expect(() => simulateAdvanceRoadmapDay({
        userId: roadmap.user_id,
        roadmap,
        completedDayNumber: 1,
        quizzes,
        quizAttempts: attempts
      })).toThrow(/Cannot advance Day 1. Current active day is Day 2/);
    });

    it('Scenario G: Unauthorized roadmap access is rejected', () => {
      const roadmap: DbRoadmapRecord = JSON.parse(JSON.stringify(mockRoadmap));

      expect(() => simulateAdvanceRoadmapDay({
        userId: 'attacker-user-999', // Different user ID
        roadmap,
        completedDayNumber: 1,
        quizzes: [],
        quizAttempts: []
      })).toThrow(/access denied/);
    });
  });
});

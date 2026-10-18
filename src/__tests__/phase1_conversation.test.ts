import { describe, it, expect } from 'vitest';
import { OnboardingManager } from '../services/onboardingManager';
import { MessageRouter } from '../services/messageRouter';
import { CasualResponseHandler } from '../services/casualResponseHandler';
import { 
  DeterministicIntelligenceAdapter, 
  ActionDispatcher 
} from '../services/intelligenceAdapter';
import { LLMContextObject, UserProfile } from '../types';

describe('PHASE 1 ACCEPTANCE TESTS — Conversation Entry & LLM-Ready Foundation', () => {

  describe('1. Natural Initial Greeting', () => {
    it('initiates with warm natural greeting per mentor without demanding name or college', () => {
      const lucyGreeting = OnboardingManager.getNaturalOpeningGreeting('LUCY', 'FRIENDLY');
      expect(lucyGreeting).toContain("Hey! I'm Lucy");
      expect(lucyGreeting).toContain('How are you doing?');
      expect(lucyGreeting).not.toContain('what is your full name');
      expect(lucyGreeting).not.toContain('what are you studying');

      const alexGreeting = OnboardingManager.getNaturalOpeningGreeting('ALEX', 'STRICT');
      expect(alexGreeting).toContain("Welcome. I'm Alex");
      expect(alexGreeting).toContain('How are you doing today?');

      const aaryaGreeting = OnboardingManager.getNaturalOpeningGreeting('AARYA', 'BUBBLY');
      expect(aaryaGreeting).toContain("Hey hey! 🚀 I'm Aarya!");
      expect(aaryaGreeting).toContain('How are you doing today?');
    });
  });

  describe('2. "Hi" is NOT Interpreted as a Profile Answer', () => {
    it('routes "Hi" and "Hi Lucy" to CASUAL even when onboarding is active', () => {
      // In active onboarding step ASK_NAME
      const intentHi = MessageRouter.determineIntent('Hi', 'ASK_NAME', []);
      expect(intentHi).toBe('CASUAL');

      const intentHiLucy = MessageRouter.determineIntent('Hi Lucy!', 'ASK_NAME', []);
      expect(intentHiLucy).toBe('CASUAL');

      const intentHey = MessageRouter.determineIntent('Hey', 'GREETING_EXCHANGE', []);
      expect(intentHey).toBe('CASUAL');
    });

    it('rejects "Hi", "Hello", and small talk in ASK_NAME validation so they are never saved as names', () => {
      const validator = OnboardingManager.STEP_CONFIGS.ASK_NAME.parseAndValidate;

      expect(validator('hi').isValid).toBe(false);
      expect(validator('Hi Lucy').isValid).toBe(false);
      expect(validator('hello').isValid).toBe(false);
      expect(validator('hey').isValid).toBe(false);
      expect(validator('how are you').isValid).toBe(false);
      expect(validator('good').isValid).toBe(false);
      expect(validator('thanks').isValid).toBe(false);

      // Legitimate names must succeed
      const validNameResult = validator('Sarah Connor');
      expect(validNameResult.isValid).toBe(true);
      expect(validNameResult.parsedValue).toBe('Sarah Connor');

      const prefixedNameResult = validator('My name is Jordan Lee');
      expect(prefixedNameResult.isValid).toBe(true);
      expect(prefixedNameResult.parsedValue).toBe('Jordan Lee');
    });
  });

  describe('3. Reciprocal Question Handling ("How are you?")', () => {
    it('responds appropriately and reciprocally to "How are you?"', () => {
      const replyFriendly = CasualResponseHandler.generateResponse('How are you?', 'LUCY', 'FRIENDLY', 'Student');
      expect(replyFriendly).toContain("I'm doing good, thanks for asking!");
      expect(replyFriendly).toContain('How about you?');

      const replyStrict = CasualResponseHandler.generateResponse('How are you doing?', 'ALEX', 'STRICT', 'Student');
      expect(replyStrict).toContain('Doing well, ready to work');

      const replyBubbly = CasualResponseHandler.generateResponse("what's up", 'AARYA', 'BUBBLY', 'Student');
      expect(replyBubbly).toContain('Doing fantastic, thanks for asking!');
    });

    it('handles status replies like "Doing good" without forcing profiling questions', () => {
      const replyStatus = CasualResponseHandler.generateResponse('Doing good thanks!', 'LUCY', 'FRIENDLY', 'Student');
      expect(replyStatus).toContain('Glad to hear that!');
      expect(replyStatus).not.toContain('What is your full name');
    });
  });

  describe('4. Domain Awareness (Never Re-Ask Selected Domain)', () => {
    it('adapts career goal question to mentor domain (Alex -> Cybersecurity)', () => {
      const alexGoalQuestion = OnboardingManager.STEP_CONFIGS.ASK_GOAL.getQuestion('Alex', 'Student', 'ALEX');
      expect(alexGoalQuestion).toContain('cybersecurity');
      expect(alexGoalQuestion).toContain('SOC Analyst');
      expect(alexGoalQuestion).not.toContain('select your domain');

      const lucyGoalQuestion = OnboardingManager.STEP_CONFIGS.ASK_GOAL.getQuestion('Lucy', 'Student', 'LUCY');
      expect(lucyGoalQuestion).toContain('data analytics');
      expect(lucyGoalQuestion).toContain('Data Analyst');

      const aaryaGoalQuestion = OnboardingManager.STEP_CONFIGS.ASK_GOAL.getQuestion('Aarya', 'Student', 'AARYA');
      expect(aaryaGoalQuestion).toContain('AI & Machine Learning');
      expect(aaryaGoalQuestion).toContain('AI/ML Engineer');
    });
  });

  describe('5. Profile Awareness (Never Re-Ask Known Information)', () => {
    it('skips ASK_EXPERIENCE if experience level is already persisted', () => {
      const knownProfile: Partial<UserProfile> = {
        name: 'Jordan',
        experienceLevel: 'INTERMEDIATE'
      };
      const isKnown = OnboardingManager.STEP_CONFIGS.ASK_EXPERIENCE.isAlreadyKnown(knownProfile);
      expect(isKnown).toBe(true);
    });

    it('identifies unknown fields when not set', () => {
      const incompleteProfile: Partial<UserProfile> = {
        name: 'Student',
        experienceLevel: undefined
      };
      expect(OnboardingManager.STEP_CONFIGS.ASK_NAME.isAlreadyKnown(incompleteProfile)).toBe(false);
      expect(OnboardingManager.STEP_CONFIGS.ASK_EXPERIENCE.isAlreadyKnown(incompleteProfile)).toBe(false);
    });
  });

  describe('6. No Automatic Roadmap Generation', () => {
    it('does not route casual or small talk to ROADMAP_REQUEST', () => {
      expect(MessageRouter.determineIntent('Hi!', undefined, [])).toBe('CASUAL');
      expect(MessageRouter.determineIntent('How are you?', undefined, [])).toBe('CASUAL');
      expect(MessageRouter.determineIntent('Sounds good', undefined, [])).toBe('CASUAL');

      // Explicit roadmap request must still work
      expect(MessageRouter.determineIntent('Give me a 30-day roadmap', undefined, [])).toBe('ROADMAP_REQUEST');
      expect(MessageRouter.determineIntent('Can you share a study plan?', undefined, [])).toBe('ROADMAP_REQUEST');
    });
  });

  describe('7. Intelligence Adapter Contract (SIMULATED & Replaceable)', () => {
    it('generates structured response adhering to IIntelligenceAdapter', async () => {
      const adapter = new DeterministicIntelligenceAdapter();

      const mockContext: LLMContextObject = {
        userProfile: {
          fullName: 'Jordan',
          activeMentorId: 'AARYA',
          personality: 'FRIENDLY',
          experienceLevel: 'BEGINNER'
        },
        relevantMemories: [],
        activeCommitments: [],
        recentMessages: [],
        currentMessage: 'What is overfitting?',
        classificationSignals: ['NORMAL_CHAT']
      };

      const result = await adapter.generateResponse(mockContext);

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(20);
      expect(result.text).toContain('Overfitting');
      expect(result.simulated).toBe(true); // Honestly labeled as simulated
      expect(result.confidence).toBe(1.0);
    });

    it('validates proposed profile updates before execution via ActionDispatcher', () => {
      const validUpdate = ActionDispatcher.validateProfileUpdate({
        name: 'Jordan Smith',
        experienceLevel: 'ADVANCED'
      });
      expect(validUpdate.isValid).toBe(true);
      expect(validUpdate.sanitized?.full_name).toBe('Jordan Smith');
      expect(validUpdate.sanitized?.experience_level).toBe('ADVANCED');

      const invalidUpdate = ActionDispatcher.validateProfileUpdate({
        experienceLevel: 'SUPER_EXPERT' as any
      });
      expect(invalidUpdate.isValid).toBe(false);
      expect(invalidUpdate.errors?.length).toBeGreaterThan(0);
    });
  });
});

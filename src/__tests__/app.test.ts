import { describe, it, expect } from 'vitest';
import { CommitmentProcessor } from '../services/commitmentProcessor';
import { MessageRouter } from '../services/messageRouter';
import { MemoryExtractor } from '../services/memoryExtractor';
import { MemoryStore } from '../services/memoryStore';
import { OnboardingManager } from '../services/onboardingManager';
import { compileSystemPrompt } from '../services/aiMentor';

describe('Legacy Chat, Onboarding & Memory Suite', () => {
  it('TEST 1: Commitment extracted successfully via CommitmentProcessor', () => {
    const commitment = CommitmentProcessor.extractCommitment("I'll finish the Python project tonight.");
    expect(commitment).not.toBeNull();
    expect(commitment?.targetWindow).toBe('tonight');
  });

  it('TEST 2: Valid onboarding / profile response correctly identified', () => {
    const onboardingIntent = MessageRouter.determineIntent("I am studying Computer Science", "ASK_EDUCATION", []);
    expect(onboardingIntent).toBe('ONBOARDING_RESPONSE');
  });

  it('TEST 3: Technical question during onboarding correctly routed to NORMAL_CHAT without hijacking state', () => {
    const questionIntent = MessageRouter.determineIntent("Explain neural networks.", "ASK_GOAL", []);
    expect(questionIntent).toBe('NORMAL_CHAT');
  });

  it('TEST 4: Valid Goal Answer Routing', () => {
    const goalIntent = MessageRouter.determineIntent("I want to become an AI engineer.", "ASK_GOAL", []);
    expect(goalIntent).toBe('ONBOARDING_RESPONSE');
  });

  it('TEST 5: Questions correctly excluded from memory extraction', () => {
    const questionMemories = MemoryExtractor.extractFactsFromMessage("What is Python?");
    expect(questionMemories.length).toBe(0);
  });

  it('TEST 6: Durable learning preference extracted into memory fact', () => {
    const preferenceMemories = MemoryExtractor.extractFactsFromMessage("I learn better by building projects rather than theory");
    expect(preferenceMemories.length).toBeGreaterThan(0);
    expect(preferenceMemories[0].keyCategory).toBe('learning_style');
  });

  it('TEST 7: Onboarding state machine sequence validated', () => {
    const steps = OnboardingManager.STEPS_ORDER;
    expect(steps[0]).toBe('ONBOARDING_NOT_STARTED');
    expect(steps).toContain('GREETING_EXCHANGE');
    expect(steps).toContain('ASK_NAME');
    expect(steps[steps.length - 1]).toBe('ONBOARDING_COMPLETE');
  });

  it('TEST 8: System prompt compiled with domain & personality context', () => {
    const initialMem = MemoryStore.getMemory();
    const prompt = compileSystemPrompt('AARYA', 'STRICT', initialMem);
    expect(prompt).toContain('STRICT');
    expect(prompt).toContain('Aarya');
  });
});

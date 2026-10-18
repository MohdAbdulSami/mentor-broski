import { IntentType, OnboardingStep, DbCommitmentRecord } from '../types';
import { CasualResponseHandler } from './casualResponseHandler';

export class MessageRouter {
  static determineIntent(
    text: string,
    onboardingStep: OnboardingStep | undefined,
    activeCommitments: DbCommitmentRecord[]
  ): IntentType {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Priority 0: Progression choice after day completion — must intercept before commitment checks
    const continueNowPatterns = [
      'continue now', 'continue right now', 'start now', 'let\'s continue', "let's go", 'keep going',
      'proceed', 'yes now', 'yes, now', 'now please', 'right now', 'do it now', 'next day now',
      'yes continue', 'continue to day', 'unlock next', 'next mission', 'move on now'
    ];
    const tomorrowPatterns = [
      'schedule tomorrow', 'tomorrow', 'do it tomorrow', 'save for tomorrow', 'not now',
      'later', 'rest for today', 'wrap up', 'wrap it up', 'next session tomorrow',
      'tomorrow morning', 'schedule for tomorrow', 'continue tomorrow', 'next time'
    ];

    if (continueNowPatterns.some(p => lower.includes(p))) {
      return 'PROGRESSION_CONTINUE';
    }
    if (tomorrowPatterns.some(p => lower.includes(p))) {
      return 'PROGRESSION_TOMORROW';
    }

    // Priority 1: Commitment Interactions when user has an active commitment
    if (activeCommitments && activeCommitments.length > 0) {
      if (lower === 'done' || lower === "i'm done" || lower === 'finished' || lower === 'completed' || lower.startsWith('done with') || lower.includes('finished it') || lower.includes('completed it')) {
        return 'COMMITMENT_COMPLETION';
      }
      if (lower.includes('doing it now') || lower.includes('starting now') || lower.includes("i'm back") || lower.includes('working on it now')) {
        return 'COMMITMENT_ACKNOWLEDGEMENT';
      }
      if (lower.includes('remind me tomorrow') || lower.includes('reschedule') || lower.includes('snooze') || lower.includes('do it later')) {
        return 'COMMITMENT_SNOOZE';
      }
    }

    // Priority 2: Explicit Commitment Request
    if (lower.startsWith('remind me') || lower.includes("i'll finish by") || lower.includes('i promise to') || lower.includes('set a reminder')) {
      return 'COMMITMENT_REQUEST';
    }

    // Priority 3: Explicit Roadmap Request
    if (
      lower.includes('roadmap') ||
      lower.includes('study plan') ||
      lower.includes('learning path') ||
      lower.includes('30-day') ||
      lower.includes('60-day') ||
      lower.includes('90-day') ||
      (lower.includes('day 1') && lower.includes('day 30')) ||
      lower.includes('curriculum')
    ) {
      return 'ROADMAP_REQUEST';
    }

    // Priority 4: Quiz Request
    if (lower === 'quiz' || lower === 'take quiz' || lower.includes('knowledge check') || lower.includes('start quiz')) {
      return 'QUIZ_REQUEST';
    }

    // Priority 5: Casual small talk, greetings, and reciprocal questions.
    // CRITICAL: Must be evaluated BEFORE onboarding captures the input!
    // Greetings like "hi", "how are you?", "doing good" must NEVER be treated as onboarding answers!
    if (CasualResponseHandler.isCasualMessage(trimmed)) {
      return 'CASUAL';
    }

    // Priority 6: Technical or conceptual questions (always route to chat so mentor answers directly)
    const questionTriggers = ['what is', 'how to', 'how do i', 'can you', 'why does', 'difference between', 'tell me about', 'explain', 'what does', 'could you explain'];
    const isQuestion = trimmed.endsWith('?') || questionTriggers.some(q => lower.includes(q));
    if (isQuestion) {
      return 'NORMAL_CHAT';
    }

    // Priority 7: Explicit Profile Update statements (e.g., "my target role is X", "I am in 2nd year")
    if (lower.includes('1st year') || lower.includes('2nd year') || lower.includes('3rd year') || lower.includes('4th year') || lower.startsWith('my target role is')) {
      return 'PROFILE_UPDATE';
    }

    // Priority 8: Active Sequential Onboarding
    // If the user is in active onboarding and NOT in GREETING_EXCHANGE, and sent a non-question, non-casual response:
    const isOnboardingActive = Boolean(
      onboardingStep &&
      onboardingStep !== 'ONBOARDING_COMPLETE' &&
      onboardingStep !== 'ONBOARDING_NOT_STARTED' &&
      onboardingStep !== 'GREETING_EXCHANGE'
    );

    if (isOnboardingActive) {
      return 'ONBOARDING_RESPONSE';
    }

    // If in GREETING_EXCHANGE and user indicates readiness to begin onboarding ("start", "ready", "let's go")
    if (onboardingStep === 'GREETING_EXCHANGE') {
      const startTriggers = ['start', 'ready', 'begin', 'build my path', 'build a plan', 'lets go', "let's go", 'what next', "what's next", 'lets start', "let's start"];
      if (startTriggers.some(st => lower.includes(st))) {
        return 'ONBOARDING_RESPONSE';
      }
    }

    return 'NORMAL_CHAT';
  }
}

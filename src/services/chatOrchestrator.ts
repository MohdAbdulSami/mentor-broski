import { 
  MentorId, 
  MentorDomain, 
  PersonalityStyle, 
  UserProfile, 
  ChatMessage, 
  ResourceLink, 
  LLMContextObject,
  IntentType,
  DbRoadmapRecord
} from '../types';
import { MENTORS } from '../data/mentors';
import { MessageRouter } from './messageRouter';
import { CasualResponseHandler } from './casualResponseHandler';
import { OnboardingManager } from './onboardingManager';
import { MemoryExtractor } from './memoryExtractor';
import { CommitmentProcessor } from './commitmentProcessor';
import { ProfileUpdater } from './profileUpdater';
import { RoadmapManager } from './roadmapManager';
import { RetrievalService } from './retrievalService';
import { ContextBuilder } from './contextBuilder';
import { LLMResponseService } from './aiMentorStub';
import { ActionDispatcher } from './intelligenceAdapter';
import { ReminderScheduler } from './reminderScheduler';
import { ActivityTracker } from './activityTracker';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface OrchestrationParams {
  userId: string;
  mentorId: MentorId;
  personality: PersonalityStyle | null;
  userMessage: string;
  conversationId?: string | null;
  currentUserProfile?: UserProfile | null;
}

export interface OrchestrationResult {
  success: boolean;
  data?: {
    userMessageRecord: ChatMessage;
    mentorMessageRecord: ChatMessage;
    conversationId: string;
    llmContext: LLMContextObject;
    resources?: ResourceLink[];
    suggestPlanTrigger?: boolean;
    roadmapRecord?: DbRoadmapRecord | null;
    detectedIntent: IntentType;
  };
  error?: {
    code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_CONVERSATION' | 'DB_ERROR' | 'BAD_REQUEST';
    message: string;
  };
}

export class ChatOrchestrator {
  static async handleChatMessage(params: OrchestrationParams): Promise<OrchestrationResult> {
    const { userId, mentorId, personality, userMessage, conversationId: reqConvId, currentUserProfile } = params;

    // Step 1: Authenticate User
    if (!userId) {
      return {
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'User authentication is required to send messages.' }
      };
    }

    if (!userMessage || !userMessage.trim()) {
      return {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Message text cannot be empty.' }
      };
    }

    const mentor = MENTORS[mentorId] || MENTORS['AARYA'];
    const domain: MentorDomain = mentor.domain;

    try {
      // Step 2: Validate Conversation Ownership (Security Authorization)
      let conversationId = reqConvId || null;
      if (conversationId) {
        const isOwner = await RetrievalService.validateConversationOwnership(userId, conversationId);
        if (!isOwner) {
          return {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied: Conversation belongs to another user.' }
          };
        }
      } else {
        conversationId = await RetrievalService.getOrCreateConversation(userId, mentorId, personality);
      }

      if (!conversationId) {
        return {
          success: false,
          error: { code: 'DB_ERROR', message: 'Failed to create or validate conversation.' }
        };
      }

      // Step 3: Persist User Message Immediately and Record Meaningful User Activity
      const userMsgRecord = await RetrievalService.persistMessage(
        conversationId,
        userId,
        'user',
        userMessage
      ) || {
        id: 'msg_u_' + Date.now(),
        sender: 'user',
        text: userMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Server-side activity tracking for proactive engagement interval
      ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});

      // Step 4: Selective State & Context Retrieval
      const [retrievedProfile, memories, activeCommitments, roadmap, recentMessages] = await Promise.all([
        RetrievalService.getRelevantProfile(userId),
        RetrievalService.getRelevantMemories(userId),
        CommitmentProcessor.fetchActiveCommitments(userId),
        RoadmapManager.getCurrentRoadmap(userId, domain),
        RetrievalService.getRecentMessages(conversationId, 10)
      ]);

      const activeProfile = retrievedProfile || currentUserProfile || null;
      const isCompletedOnboarding = activeProfile?.onboardingCompleted || activeProfile?.onboardingStep === 'ONBOARDING_COMPLETE';

      // Step 5: Route Message Intent
      const intent = MessageRouter.determineIntent(userMessage, activeProfile?.onboardingStep, activeCommitments);

      // Step 6: Process Side-Effects based on Intent
      let replyText = '';
      let suggestPlan = false;
      let createdRoadmapRecord: DbRoadmapRecord | null = null;
      let resources: ResourceLink[] | undefined = undefined;

      // Intent Handler Router
      if (intent === 'PROGRESSION_CONTINUE') {
        // User chose to continue to the next day right now
        const activeRoadmapRecord = roadmap;
        if (activeRoadmapRecord) {
          const completedDay = (activeRoadmapRecord.current_day || 1);
          const nextDay = completedDay + 1;

          // Issue 2+3 Fix: Check result BEFORE composing success message.
          // The RPC advance_roadmap_day enforces all progression security checks (tasks + quiz).
          const updated = await RoadmapManager.advanceToNextDay(userId, activeRoadmapRecord.id, completedDay);

          if (updated) {
            // Advancement succeeded — cancel any pending Tomorrow commitment for this day transition
            if (isSupabaseConfigured && supabase) {
              await supabase
                .from('commitments')
                .update({ status: 'SUPERSEDED', next_reminder_at: null })
                .eq('user_id', userId)
                .or('status.eq.PENDING,status.eq.REMINDING')
                .ilike('action', `%Day ${nextDay}%`);
            }

            createdRoadmapRecord = updated;
            suggestPlan = true;

            if (personality === 'STRICT') {
              replyText = `Day ${nextDay} unlocked. Open your roadmap and begin immediately.`;
            } else if (personality === 'BUBBLY') {
              replyText = `Woohoo! Day ${nextDay} is now unlocked! 🚀 Open your roadmap and let's gooo! ✨`;
            } else {
              replyText = `Day ${nextDay} is now unlocked! 🎯 Open your roadmap to see today's mission. Let's keep the streak going!`;
            }
          } else {
            // Advancement was rejected by the backend — explain why without false success claim
            replyText = `I wasn't able to unlock Day ${nextDay} yet. The backend requires you to:\n\n• Mark Day ${completedDay}'s task as complete ✓\n• Pass the Day ${completedDay} knowledge check quiz (≥70%) ✓\n\nComplete both and try again — once they're done, Day ${nextDay} will unlock immediately!`;
          }
        } else {
          replyText = `I'd love to unlock the next day, but I couldn't find your active roadmap. Could you open the Roadmap panel and check your current progress?`;
        }
      } else if (intent === 'PROGRESSION_TOMORROW') {
        // User chose to schedule the next day for tomorrow
        const activeRoadmapRecord = roadmap;
        const nextDay = (activeRoadmapRecord?.current_day || 1) + 1;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);

        try {
          await CommitmentProcessor.saveCommitmentWithDueAt(
            userId,
            conversationId,
            `Start Day ${nextDay} of your learning roadmap`,
            `Day ${nextDay} learning session`,
            'tomorrow morning',
            tomorrow.toISOString()
          );
        } catch (e) {
          console.warn('Could not schedule tomorrow commitment:', e);
        }

        if (personality === 'STRICT') {
          replyText = `Good. Day ${nextDay} is scheduled for tomorrow. Your commitment is logged. Show up at the agreed time.`;
        } else if (personality === 'BUBBLY') {
          replyText = `Day ${nextDay} is all set for tomorrow! 📅 I've logged your commitment and I'll send a reminder! You've earned today's break — enjoy it! 🎉`;
        } else {
          replyText = `Perfect! I've scheduled Day ${nextDay} for tomorrow morning. 📅 You'll get a reminder so you don't lose momentum. Rest well — you've earned it!`;
        }

      } else if (intent === 'COMMITMENT_ACKNOWLEDGEMENT' && activeCommitments.length > 0) {
        const topCommitment = activeCommitments[0];
        await CommitmentProcessor.updateCommitmentStatus(userId, topCommitment.id, 'IN_PROGRESS');
        replyText = `Awesome! I've updated your commitment status for "${topCommitment.action || topCommitment.statement}" to IN PROGRESS. Good luck! 💪`;
      } else if (intent === 'COMMITMENT_COMPLETION' && activeCommitments.length > 0) {
        const topCommitment = activeCommitments[0];
        await CommitmentProcessor.updateCommitmentStatus(userId, topCommitment.id, 'COMPLETED');
        replyText = `🎉 Congratulations! I've marked your commitment "${topCommitment.action || topCommitment.statement}" as COMPLETED in your profile!`;
      } else if (intent === 'COMMITMENT_SNOOZE' && activeCommitments.length > 0) {
        const topCommitment = activeCommitments[0];
        await CommitmentProcessor.rescheduleCommitment(userId, topCommitment.id, userMessage);
        replyText = `Got it. I've rescheduled your reminder for "${topCommitment.action || topCommitment.statement}". Don't let procrastination win next time!`;
      } else if (intent === 'COMMITMENT_REQUEST') {
        const newCommitment = await CommitmentProcessor.saveCommitment(userId, conversationId, userMessage, userMsgRecord?.id);
        if (newCommitment && newCommitment.id) {
          const shortId = newCommitment.id.slice(0, 8);
          replyText = `Noted! I've logged your commitment #${shortId} for "${newCommitment.action || newCommitment.statement}" (Due: ${newCommitment.target_window || 'soon'}). I will follow up with you.`;
        } else {
          replyText = `I couldn't set that reminder right now. Please try again with a specific task and time window.`;
        }
      } else if (intent === 'ROADMAP_REQUEST') {
        suggestPlan = true;
        const msgLower = userMessage.toLowerCase();

        // 1. Extract requested domain
        let reqDomain: MentorDomain = domain;
        if (msgLower.includes('cyber') || msgLower.includes('security') || msgLower.includes('pentest')) {
          reqDomain = 'CYBERSECURITY';
        } else if (msgLower.includes('ai') || msgLower.includes('machine learning') || msgLower.includes('ml')) {
          reqDomain = 'AI_ML';
        } else if (msgLower.includes('data science') || msgLower.includes('analytics') || msgLower.includes('sql')) {
          reqDomain = 'DATA_SCIENCE';
        }

        // 2. Extract requested duration
        let reqDuration = 30;
        if (msgLower.includes('90') || msgLower.includes('90-day') || msgLower.includes('90 days') || msgLower.includes('3 months')) {
          reqDuration = 90;
        } else if (msgLower.includes('60') || msgLower.includes('60-day') || msgLower.includes('60 days') || msgLower.includes('2 months')) {
          reqDuration = 60;
        }

        // Priority Resolution:
        // 1. Explicit user request (e.g. "90 days", "advanced", "nlp")
        // 2. Persisted profile (e.g. activeProfile.experienceLevel, activeProfile.interests)
        // 3. System default (BEGINNER, 30 days, GENERAL)

        // Level resolution
        let resolvedLevel = 'BEGINNER';
        if (msgLower.includes('advanced') || msgLower.includes('expert')) {
          resolvedLevel = 'ADVANCED';
        } else if (msgLower.includes('intermediate') || msgLower.includes('mid-level')) {
          resolvedLevel = 'INTERMEDIATE';
        } else if (msgLower.includes('beginner') || msgLower.includes('novice')) {
          resolvedLevel = 'BEGINNER';
        } else if (activeProfile?.experienceLevel && activeProfile.experienceLevel !== 'NOT_SURE') {
          resolvedLevel = activeProfile.experienceLevel.toUpperCase();
        }

        // Duration resolution (defaults to 30, supports 60, 90, 100, 120, etc.)
        let resolvedDuration = 30;
        const durMatch = msgLower.match(/(\d{2,3})\s*(?:-|\s)?day/);
        if (durMatch && durMatch[1]) {
          resolvedDuration = parseInt(durMatch[1], 10);
        } else if (msgLower.includes('3 months') || msgLower.includes('90')) {
          resolvedDuration = 90;
        } else if (msgLower.includes('2 months') || msgLower.includes('60')) {
          resolvedDuration = 60;
        } else if (msgLower.includes('1 month') || msgLower.includes('30')) {
          resolvedDuration = 30;
        }

        // Focus resolution
        let resolvedFocus = 'GENERAL';
        if (msgLower.includes('computer vision') || msgLower.includes('cv')) {
          resolvedFocus = 'COMPUTER_VISION';
        } else if (msgLower.includes('nlp') || msgLower.includes('llm') || msgLower.includes('transformers')) {
          resolvedFocus = 'NLP';
        } else if (msgLower.includes('pentest') || msgLower.includes('ethical hacking')) {
          resolvedFocus = 'PENTESTING';
        }

        // Explicit start day detection (e.g. "start at day 31", "from day 1", "refresher")
        let explicitStartDay: number | undefined = undefined;
        const startDayMatch = msgLower.match(/(?:start|begin|from)\s+(?:at\s+)?day\s+(\d{1,3})/);
        if (startDayMatch && startDayMatch[1]) {
          explicitStartDay = parseInt(startDayMatch[1], 10);
        } else if (msgLower.includes('refresher') || msgLower.includes('start from beginning') || msgLower.includes('start from scratch')) {
          explicitStartDay = 1;
        }

        // Resolve roadmap via 3-way resolver (RETRIEVE, EXTEND, GENERATE)
        const { RoadmapResolver } = await import('./roadmapResolver');
        const resolution = await RoadmapResolver.resolveRoadmap({
          userId,
          domain: reqDomain,
          requestedLevel: resolvedLevel,
          requestedDuration: resolvedDuration,
          requestedFocus: resolvedFocus,
          explicitStartDay
        });

        const activeRoadmap = resolution.roadmap;

        if (activeRoadmap) {
          createdRoadmapRecord = activeRoadmap;
          const extensionNote = resolution.mode === 'EXTEND' 
            ? ` (Extended with ${resolution.extendedDaysCount} specialized days beyond Day ${resolution.baseDaysCount})`
            : '';
          replyText = `I've prepared your continuous **${activeRoadmap.title}** (${resolvedLevel} • ${resolvedDuration} Days • Starting Day ${activeRoadmap.current_day || 1})${extensionNote}. Click the "Roadmap" button in the header to view your mission!`;
        } else {
          suggestPlan = false;
          const normalizedKey = RoadmapManager.normalizeKey(reqDomain, resolvedLevel, resolvedDuration, resolvedFocus);
          replyText = `The requested roadmap configuration (${normalizedKey}) could not be initialized right now. Please choose an available roadmap (e.g. 30, 60, 90, or 100 days for ${reqDomain}) or let me know if you would like me to set up a standard plan.`;
        }
      } else if (intent === 'ONBOARDING_RESPONSE' && !isCompletedOnboarding) {
        // Execute sequential onboarding state machine
        const onboardingResult = await OnboardingManager.processOnboardingResponse({
          userId,
          conversationId,
          mentorId,
          userMessage,
          currentProfile: activeProfile
        });
        replyText = onboardingResult.mentorReply;
      } else if (intent === 'CASUAL') {
        replyText = CasualResponseHandler.generateResponse(
          userMessage,
          mentorId,
          personality,
          activeProfile?.name || 'Student'
        );

        // Issue 1 Fix: If user is still in GREETING_EXCHANGE, a casual reply (e.g. "I'm fine")
        // means they've answered the greeting. Advance state to first profiling step and append
        // the opening profiling question so we don't stay stuck and repeat the greeting.
        if (
          activeProfile?.onboardingStep === 'GREETING_EXCHANGE' ||
          activeProfile?.onboardingStep === 'ONBOARDING_NOT_STARTED' ||
          !activeProfile?.onboardingStep
        ) {
          const firstUnfinished = OnboardingManager.STEPS_ORDER.find(stepKey => {
            if (stepKey === 'ONBOARDING_NOT_STARTED' || stepKey === 'GREETING_EXCHANGE' || stepKey === 'ONBOARDING_COMPLETE') return false;
            const config = OnboardingManager.STEP_CONFIGS[stepKey];
            return config && !config.isAlreadyKnown(activeProfile);
          }) || 'ASK_NAME';

          const firstConfig = OnboardingManager.STEP_CONFIGS[firstUnfinished];
          if (firstConfig) {
            const mentor = MENTORS[mentorId] || MENTORS['AARYA'];
            const profilingQuestion = firstConfig.getQuestion(mentor.name, activeProfile?.name, mentorId);
            replyText = `${replyText}\n\n${profilingQuestion}`;
            // Advance DB step so next user message routes to ONBOARDING_RESPONSE
            OnboardingManager.updateOnboardingStepInDb(userId, firstUnfinished as any, false).catch(() => {});
          }
        }
      } else {
        // Normal chat / Technical questions
        const extractedFacts = MemoryExtractor.extractFactsFromMessage(userMessage);
        if (extractedFacts.length > 0) {
          await MemoryExtractor.saveExtractedMemories(userId, extractedFacts);
        }

        const llmContext = ContextBuilder.buildContext({
          profile: activeProfile,
          memories,
          commitments: activeCommitments,
          roadmap,
          recentMessages,
          currentMessage: userMessage,
          classificationSignals: [intent],
          onboardingState: {
            isComplete: Boolean(isCompletedOnboarding),
            currentTopicKey: activeProfile?.onboardingStep
          }
        });

        const stubResult = await LLMResponseService.generateMentorResponse(llmContext);
        replyText = stubResult.text;
        suggestPlan = Boolean(stubResult.suggestPlanTrigger);
        resources = stubResult.resources;

        // Defensive guard: if replyText still looks like raw JSON, extract the reply field.
        // This catches any edge case where the adapter or fallback returns unstripped JSON.
        if (replyText && replyText.trim().startsWith('{') && replyText.includes('"reply"')) {
          try {
            const parsed = JSON.parse(replyText.trim());
            if (parsed && typeof parsed.reply === 'string' && parsed.reply.trim()) {
              replyText = parsed.reply.trim();
              if (parsed.suggestPlan) suggestPlan = true;
            }
          } catch {
            const m = replyText.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            if (m && m[1]) {
              replyText = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
            }
          }
        }

        if (stubResult.proposedAction && stubResult.proposedAction.type !== 'NONE') {
          const actionResult = await ActionDispatcher.dispatchAction(userId, stubResult.proposedAction, {
            conversationId,
            roadmapId: roadmap?.id,
            currentDay: roadmap?.current_day,
            sourceMessageId: userMsgRecord?.id
          });

          // Enforce architectural guardrail: Never confirm an action unless database persistence succeeds
          if (stubResult.proposedAction.type === 'CREATE_COMMITMENT') {
            if (actionResult.success && actionResult.result?.id) {
              const shortId = String(actionResult.result.id).slice(0, 8);
              if (!replyText.includes(shortId)) {
                replyText += `\n\n*(Commitment #${shortId} logged)*`;
              }
            } else {
              replyText = `I noted your reminder request, but could not save it to your profile: ${actionResult.error || 'Database persistence error'}. Please try again.`;
            }
          } else if (stubResult.proposedAction.type === 'ADVANCE_DAY') {
            if (!actionResult.success) {
              replyText = `I wasn't able to advance your roadmap: ${actionResult.error || "Please ensure today's task is completed and the quiz is passed (≥70%)."}`;
            }
          } else if (stubResult.proposedAction.type === 'UPDATE_PROFILE') {
            if (!actionResult.success) {
              replyText = `I couldn't update your profile settings: ${actionResult.error || 'Validation error'}.`;
            }
          } else if (stubResult.proposedAction.type === 'PROPOSE_ROADMAP') {
            // Gemini proposed a roadmap — do NOT auto-create or replace existing one.
            // Signal the UI so it can show the roadmap setup CTA/confirmation, but leave
            // the actual creation to an explicit ROADMAP_REQUEST intent from the student.
            suggestPlan = true;
          }
        }

      }


      // Step 7: Build Structured LLM Context Object
      const llmContext = ContextBuilder.buildContext({
        profile: activeProfile,
        memories,
        commitments: activeCommitments,
        roadmap: createdRoadmapRecord || roadmap,
        recentMessages,
        currentMessage: userMessage,
        classificationSignals: [intent],
        onboardingState: {
          isComplete: Boolean(isCompletedOnboarding),
          currentTopicKey: activeProfile?.onboardingStep
        }
      });

      // Step 8: Persist Mentor Response in Supabase
      const mentorMsgRecord = await RetrievalService.persistMessage(
        conversationId,
        userId,
        'mentor',
        replyText,
        {
          resources,
          suggestPlanTrigger: suggestPlan
        }
      ) || {
        id: 'msg_m_' + Date.now(),
        sender: 'mentor',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        resources,
        suggestPlanTrigger: suggestPlan
      };

      return {
        success: true,
        data: {
          userMessageRecord: userMsgRecord,
          mentorMessageRecord: mentorMsgRecord,
          conversationId,
          llmContext,
          resources,
          suggestPlanTrigger: suggestPlan,
          roadmapRecord: createdRoadmapRecord,
          detectedIntent: intent
        }
      };

    } catch (err: any) {
      console.error('Unhandled exception in ChatOrchestrator:', err);
      return {
        success: false,
        error: {
          code: 'DB_ERROR',
          message: 'An unexpected application error occurred while processing your message.'
        }
      };
    }
  }

  static async handlePostQuizFollowUp(params: {
    userId: string;
    mentorId: MentorId;
    conversationId: string;
    quizResult: { score: number; passed: boolean; totalQuestions: number; correctCount: number; dayNumber?: number; topic?: string };
  }): Promise<ChatMessage | null> {
    const { userId, mentorId, conversationId, quizResult } = params;
    const mentor = MENTORS[mentorId] || MENTORS.ALEX;

    let text = '';
    if (quizResult.passed) {
      text = `🔥 Great work passing the Day ${quizResult.dayNumber || ''} quiz with ${quizResult.score}% (${quizResult.correctCount}/${quizResult.totalQuestions})!\n\nDid you have any doubts about ${quizResult.topic || 'the concepts we covered'}? We can dive deeper now, or if you feel confident: do you want to continue with the next day's task right now, or should I schedule our next session for tomorrow?`;
    } else {
      text = `Solid effort on the Day ${quizResult.dayNumber || ''} quiz (${quizResult.score}%). The passing threshold is 70%, but that's how we find the gaps!\n\nWhich question or concept tripped you up? Tell me what was confusing and I'll break it down with a simple analogy. We can retry the quiz whenever you're ready, or lock in tomorrow's study time.`;
    }

    const mentorMsg = await RetrievalService.persistMessage(
      conversationId,
      userId,
      'mentor',
      text,
      {
        isProactive: true
      }
    );

    return mentorMsg || {
      id: 'msg_m_' + Date.now(),
      sender: 'mentor',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  /**
   * Inject a mentor message after a task is marked complete asking:
   * "Continue to Day N+1 now, or wrap up for today?"
   */
  static async handleDayCompletionPrompt(params: {
    userId: string;
    mentorId: MentorId;
    conversationId: string;
    completedDayNumber: number;
    roadmapId: string;
  }): Promise<ChatMessage | null> {
    const { userId, mentorId, conversationId, completedDayNumber } = params;
    const nextDay = completedDayNumber + 1;

    let text = '';
    // ALEX = strict, LUCY = bubbly, AARYA = balanced
    if (mentorId === 'ALEX') {
      text = `Day ${completedDayNumber} complete. Good execution.\n\nNext: Day ${nextDay} is queued. Are you continuing **right now**, or are we scheduling this for **tomorrow**? Answer directly.`;
    } else if (mentorId === 'LUCY') {
      text = `🎉 YES! Day ${completedDayNumber} is officially in the books! You're crushing it!\n\nSo here's the big question: are you ready to jump into **Day ${nextDay}** RIGHT NOW while you're in the zone? 🔥 Or do you want to celebrate today's win and lock in **tomorrow** as our next session? Either way, I've got you! 💪`;
    } else {
      text = `Excellent work completing Day ${completedDayNumber}! 🙌\n\nDay ${nextDay} is ready whenever you are. Would you like to **continue now** and keep the momentum going, or should we **schedule tomorrow** as our next study session? Just let me know and I'll set it up!`;
    }

    // Persist to conversation history
    const mentorMsg = await RetrievalService.persistMessage(
      conversationId,
      userId,
      'mentor',
      text,
      { isProactive: true }
    );

    return mentorMsg || {
      id: 'msg_m_' + Date.now(),
      sender: 'mentor',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  /**
   * Handle "continue now" progression: advance current_day to nextDay
   * NOTE: This calls advanceToNextDay internally. If the day has already been
   * advanced by the caller, use buildProgressionContinueNowMessage instead.
   */
  static async handleProgressionContinueNow(params: {
    userId: string;
    mentorId: MentorId;
    conversationId: string;
    roadmapId: string;
    completedDayNumber: number;
  }): Promise<{ message: ChatMessage | null; updatedRoadmap: any | null }> {
    const { userId, mentorId, conversationId, roadmapId, completedDayNumber } = params;
    const nextDay = completedDayNumber + 1;

    const updatedRoadmap = await RoadmapManager.advanceToNextDay(userId, roadmapId, completedDayNumber);

    let text = '';
    if (mentorId === 'ALEX') {
      text = `Day ${nextDay} unlocked. Open your roadmap and begin immediately.`;
    } else if (mentorId === 'LUCY') {
      text = `Woohoo! Day ${nextDay} is now unlocked! 🚀 Open your roadmap and let's gooo! ✨`;
    } else {
      text = `Day ${nextDay} is now unlocked! 🎯 Open your roadmap to see today's mission. Let's keep the streak going!`;
    }

    const mentorMsg = await RetrievalService.persistMessage(conversationId, userId, 'mentor', text, { isProactive: true });

    return {
      message: mentorMsg || { id: 'msg_m_' + Date.now(), sender: 'mentor', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      updatedRoadmap
    };
  }

  /**
   * Build the "continue now" mentor congratulations message WITHOUT advancing the day.
   * Use this when the day has ALREADY been advanced by the caller (e.g. ChatInterface
   * calls advanceToNextDay first, then calls this to compose the chat message).
   * This prevents the double-RPC bug where two calls to advance_roadmap_day are made.
   */
  static async buildProgressionContinueNowMessage(params: {
    userId: string;
    mentorId: MentorId;
    conversationId: string;
    roadmapId: string;
    completedDayNumber: number;
  }): Promise<{ message: ChatMessage | null; updatedRoadmap: null }> {
    const { userId, mentorId, conversationId, completedDayNumber } = params;
    const nextDay = completedDayNumber + 1;

    let text = '';
    if (mentorId === 'ALEX') {
      text = `Day ${nextDay} unlocked. Open your roadmap and begin immediately.`;
    } else if (mentorId === 'LUCY') {
      text = `Woohoo! Day ${nextDay} is now unlocked! 🚀 Open your roadmap and let's gooo! ✨`;
    } else {
      text = `Day ${nextDay} is now unlocked! 🎯 Open your roadmap to see today's mission. Let's keep the streak going!`;
    }

    const mentorMsg = await RetrievalService.persistMessage(conversationId, userId, 'mentor', text, { isProactive: true });

    return {
      message: mentorMsg || { id: 'msg_m_' + Date.now(), sender: 'mentor', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      updatedRoadmap: null
    };
  }

  /**
   * Handle "schedule tomorrow" progression: create commitment for next day
   */
  static async handleProgressionScheduleTomorrow(params: {
    userId: string;
    mentorId: MentorId;
    conversationId: string;
    completedDayNumber?: number;
    nextDay?: number;
    roadmapId?: string;
  }): Promise<ChatMessage | null> {
    const { userId, mentorId, conversationId } = params;
    const nextDay = params.nextDay || (params.completedDayNumber ? params.completedDayNumber + 1 : 2);

    // Calculate tomorrow 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    // Create commitment for Day N+1
    try {
      await CommitmentProcessor.saveCommitmentWithDueAt(
        userId,
        conversationId,
        `Start Day ${nextDay} of your learning roadmap`,
        `Day ${nextDay} learning session`,
        'tomorrow morning',
        tomorrow.toISOString()
      );
    } catch (e) {
      console.warn('Could not schedule tomorrow commitment:', e);
    }

    let text = '';
    if (mentorId === 'ALEX') {
      text = `Good. Day ${nextDay} is scheduled for tomorrow. Your commitment is logged. Show up at the agreed time.`;
    } else if (mentorId === 'LUCY') {
      text = `Day ${nextDay} is all set for tomorrow! 📅 I've logged your commitment and I'll send a reminder! You've earned today's break — enjoy it! 🎉`;
    } else {
      text = `Perfect! I've scheduled Day ${nextDay} for tomorrow morning. 📅 You'll get a reminder so you don't lose momentum. Rest well — you've earned it!`;
    }

    const mentorMsg = await RetrievalService.persistMessage(conversationId, userId, 'mentor', text, { isProactive: true });

    return mentorMsg || {
      id: 'msg_m_' + Date.now(),
      sender: 'mentor',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }
}

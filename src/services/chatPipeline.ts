import { MentorId, MentorDomain, PersonalityStyle, UserProfile, ChatMessage, ResourceLink, LLMContextObject } from '../types';
import { MENTORS } from '../data/mentors';
import { MessageClassifier } from './messageClassifier';
import { CasualResponseHandler } from './casualResponseHandler';
import { OnboardingManager } from './onboardingManager';
import { MemoryExtractor } from './memoryExtractor';
import { CommitmentProcessor } from './commitmentProcessor';
import { ProfileUpdater } from './profileUpdater';
import { RoadmapManager } from './roadmapManager';
import { RetrievalService } from './retrievalService';
import { ContextBuilder } from './contextBuilder';
import { LLMResponseService } from './aiMentorStub';

export interface ProcessMessageParams {
  userId: string;
  mentorId: MentorId;
  personality: PersonalityStyle | null;
  userMessage: string;
  existingConversationId?: string | null;
  currentUserProfile?: UserProfile | null;
}

export interface PipelineResult {
  userMessageRecord: ChatMessage;
  mentorMessageRecord: ChatMessage;
  conversationId: string;
  llmContext: LLMContextObject;
  resources?: ResourceLink[];
  suggestPlanTrigger?: boolean;
}

export class ChatPipeline {
  static async processUserMessage(params: ProcessMessageParams): Promise<PipelineResult> {
    const { userId, mentorId, personality, userMessage, existingConversationId, currentUserProfile } = params;
    const mentor = MENTORS[mentorId];
    const domain: MentorDomain = mentor.domain;

    // 1. Authentication & Conversation Validation
    let conversationId = existingConversationId || null;
    if (!conversationId && userId) {
      conversationId = await RetrievalService.getOrCreateConversation(userId, mentorId, personality);
    }
    if (!conversationId) {
      conversationId = 'conv_temp_' + Date.now();
    }

    // 2. Message Classification Layer
    const classification = MessageClassifier.classify(userMessage);

    // 3. Persist User Message
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

    // 4. State Processing (Profile, Memories, Commitments)
    let updatedProfile: Partial<UserProfile> | null = currentUserProfile || null;
    if (userId) {
      // Profile updates
      updatedProfile = await ProfileUpdater.updateProfileIfChanged(userId, updatedProfile, userMessage);

      // Memory Extraction & Deduplication
      const extractedFacts = MemoryExtractor.extractFactsFromMessage(userMessage);
      if (extractedFacts.length > 0) {
        await MemoryExtractor.saveExtractedMemories(userId, extractedFacts);
      }

      // Commitment Detection
      if (classification.signals.isCommitmentCandidate) {
        await CommitmentProcessor.saveCommitment(userId, conversationId, userMessage);
      }
    }

    // 5. Context Retrieval (Profile, Memories, Commitments, Roadmap, Recent Messages)
    const [retrievedProfile, memories, commitments, roadmap, recentMessages] = await Promise.all([
      userId ? RetrievalService.getRelevantProfile(userId) : Promise.resolve(updatedProfile),
      userId ? RetrievalService.getRelevantMemories(userId) : Promise.resolve([]),
      userId ? RetrievalService.getActiveCommitments(userId) : Promise.resolve([]),
      userId ? RoadmapManager.getCurrentRoadmap(userId, domain) : Promise.resolve(null),
      RetrievalService.getRecentMessages(conversationId, 10)
    ]);

    const activeProfile = retrievedProfile || updatedProfile;
    const isCompletedOnboarding = activeProfile?.onboardingCompleted || activeProfile?.onboardingStep === 'ONBOARDING_COMPLETE';

    // 6. Build Structured Context Object for future LLM consumption
    const llmContext = ContextBuilder.buildContext({
      profile: activeProfile,
      memories,
      commitments,
      roadmap,
      recentMessages,
      currentMessage: userMessage,
      classificationSignals: classification.categories,
      onboardingState: {
        isComplete: Boolean(isCompletedOnboarding),
        currentTopicKey: activeProfile?.onboardingStep
      }
    });

    // 7. Response Path Determination
    let replyText = '';
    let suggestPlan = false;
    let resources: ResourceLink[] | undefined = undefined;

    // Path A: Sequential Onboarding Execution (if onboarding incomplete)
    if (!isCompletedOnboarding && userId) {
      const onboardingResult = await OnboardingManager.processOnboardingResponse({
        userId,
        conversationId,
        mentorId,
        userMessage,
        currentProfile: activeProfile
      });
      replyText = onboardingResult.mentorReply;
    }
    // Path B: Casual Message
    else if (classification.signals.isCasual) {
      replyText = CasualResponseHandler.generateResponse(
        userMessage,
        mentorId,
        personality,
        activeProfile?.name || 'Student'
      );
    }
    // Path C: LLM Stub Interface
    else {
      const stubResult = await LLMResponseService.generateMentorResponse(llmContext);
      replyText = stubResult.text;
      suggestPlan = Boolean(stubResult.suggestPlanTrigger);
      resources = stubResult.resources;
    }

    // 8. Persist Assistant Response in messages table
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
      userMessageRecord: userMsgRecord,
      mentorMessageRecord: mentorMsgRecord,
      conversationId,
      llmContext,
      resources,
      suggestPlanTrigger: suggestPlan
    };
  }
}

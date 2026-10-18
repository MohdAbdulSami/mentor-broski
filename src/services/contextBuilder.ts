import { 
  UserProfile, 
  DbMemoryRecord, 
  DbCommitmentRecord, 
  DbRoadmapRecord, 
  ChatMessage, 
  MessageCategory, 
  LLMContextObject 
} from '../types';

export class ContextBuilder {
  static buildContext(params: {
    profile: Partial<UserProfile> | null;
    memories: DbMemoryRecord[];
    commitments: DbCommitmentRecord[];
    roadmap: DbRoadmapRecord | null;
    recentMessages: ChatMessage[];
    currentMessage: string;
    classificationSignals: MessageCategory[];
    onboardingState?: { isComplete: boolean; currentTopicKey?: string; promptQuestion?: string };
  }): LLMContextObject {
    const {
      profile,
      memories,
      commitments,
      roadmap,
      recentMessages,
      currentMessage,
      classificationSignals,
      onboardingState
    } = params;

    const formattedMemories = memories.map(m => ({
      category: m.key_category,
      content: m.content
    }));

    const formattedCommitments = commitments.map(c => ({
      statement: c.statement,
      targetWindow: c.target_window
    }));

    let roadmapSummary: LLMContextObject['roadmapState'] = undefined;
    if (roadmap) {
      const activeStage = (roadmap.stages || [])[0];
      roadmapSummary = {
        id: roadmap.id,
        domain: roadmap.domain,
        title: roadmap.title,
        currentDay: roadmap.current_day,
        activeStageTitle: activeStage ? activeStage.stageTitle : undefined
      };
    }

    const formattedRecentMessages = recentMessages.slice(-10).map(m => ({
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp
    }));

    return {
      userProfile: {
        id: profile?.id,
        fullName: profile?.name,
        email: profile?.email,
        academicYear: profile?.academicYear,
        education: profile?.education,
        targetRole: profile?.targetRole,
        experienceLevel: profile?.experienceLevel,
        weeklyHours: profile?.weeklyHours,
        learningStyle: profile?.learningStyle,
        interests: profile?.interests,
        activeMentorId: profile?.selectedMentor,
        personality: profile?.personality
      },
      relevantMemories: formattedMemories,
      activeCommitments: formattedCommitments,
      roadmapState: roadmapSummary,
      recentMessages: formattedRecentMessages,
      currentMessage: currentMessage.trim(),
      classificationSignals: classificationSignals,
      onboardingState
    };
  }

  static serializeContextPrompt(context: LLMContextObject): string {
    const { userProfile, relevantMemories, activeCommitments, roadmapState, recentMessages, currentMessage } = context;

    const profileStr = `User: ${userProfile.fullName || 'Student'} | Education: ${userProfile.education || userProfile.academicYear || 'Unspecified'} | Goal: ${userProfile.targetRole || 'Exploring'} | Level: ${userProfile.experienceLevel || 'Beginner'} | Hours/Wk: ${userProfile.weeklyHours || 'Flexible'} | Learning Style: ${userProfile.learningStyle || 'Hands-on'} | Interests: ${userProfile.interests || 'General'}`;

    const memoriesStr = relevantMemories.length > 0
      ? relevantMemories.map(m => `- [${m.category}]: ${m.content}`).join('\n')
      : 'None logged yet';

    const commitmentsStr = activeCommitments.length > 0
      ? activeCommitments.map(c => `- ${c.statement} (Window: ${c.targetWindow || 'soon'})`).join('\n')
      : 'None active';

    const roadmapStr = roadmapState
      ? `Roadmap: "${roadmapState.title}" (Day ${roadmapState.currentDay}) - ${roadmapState.activeStageTitle || ''}`
      : 'No active roadmap';

    const historyStr = recentMessages.length > 0
      ? recentMessages.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n')
      : 'No prior messages';

    return `=== PRE-LLM CONTEXT OBJECT ===
[PROFILE]: ${profileStr}
[MEMORIES]:
${memoriesStr}
[COMMITMENTS]:
${commitmentsStr}
[ROADMAP]: ${roadmapStr}

[RECENT CONVERSATION HISTORY]:
${historyStr}

[CURRENT USER MESSAGE]:
${currentMessage}
==============================`;
  }
}

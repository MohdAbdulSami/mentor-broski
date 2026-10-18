import { 
  LLMContextObject, 
  ResourceLink, 
  UserProfile, 
  MentorId, 
  PersonalityStyle,
  MentorDomain
} from '../types';
import { MENTORS } from '../data/mentors';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MemoryExtractor } from './memoryExtractor';
import { CommitmentProcessor } from './commitmentProcessor';
import { RoadmapManager } from './roadmapManager';

export interface ActionDispatchOptions {
  conversationId?: string | null;
  roadmapId?: string | null;
  currentDay?: number;
  sourceMessageId?: string;
}

/**
 * Proposed action types that an intelligence adapter can propose.
 * The LLM never writes directly to the database; it proposes structured actions
 * that are validated and executed by trusted domain services.
 */
export type ProposedActionType = 
  | 'UPDATE_PROFILE' 
  | 'CREATE_COMMITMENT' 
  | 'PROPOSE_ROADMAP' 
  | 'ADVANCE_DAY'
  | 'TAKE_QUIZ'
  | 'NONE';

export interface ProposedAction {
  type: ProposedActionType;
  payload?: {
    profileUpdates?: Partial<UserProfile>;
    commitment?: {
      statement: string;
      action?: string;
      targetWindow?: string;
      dueAt?: string;
    };
    roadmapConfig?: {
      domain?: MentorDomain;
      level?: string;
      duration?: number;
      focus?: string;
    };
    dayNumber?: number;
  };
}

export interface IntelligenceAdapterResponse {
  text: string;
  resources?: ResourceLink[];
  suggestPlanTrigger?: boolean;
  proposedAction?: ProposedAction;
  detectedSentiment?: 'ENCOURAGING' | 'ACCOUNTABLE' | 'NEUTRAL';
  confidence?: number;
  simulated?: boolean; // Label simulated output honestly
}

/**
 * Formal Intelligence Adapter Interface.
 * Any AI provider (Gemini, Claude, or deterministic mock) must satisfy this contract.
 */
export interface IIntelligenceAdapter {
  generateResponse(context: LLMContextObject): Promise<IntelligenceAdapterResponse>;
}

/**
 * Trusted Action Dispatcher:
 * Validates and executes proposed actions from the intelligence adapter.
 * Enforces business logic and database authorization before writing.
 */
export class ActionDispatcher {
  static validateProfileUpdate(updates: Partial<UserProfile>): { isValid: boolean; sanitized?: Record<string, any>; errors?: string[] } {
    const errors: string[] = [];
    const sanitized: Record<string, any> = {};

    if (updates.name !== undefined) {
      const clean = updates.name.trim();
      if (clean.length >= 2 && clean.length <= 60) {
        sanitized.full_name = clean;
      } else {
        errors.push('Name must be between 2 and 60 characters.');
      }
    }

    if (updates.education !== undefined) {
      sanitized.education = updates.education.trim();
    }

    if (updates.targetRole !== undefined) {
      sanitized.target_role = updates.targetRole.trim();
    }

    if (updates.experienceLevel !== undefined) {
      const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NOT_SURE'];
      const upper = updates.experienceLevel.toUpperCase();
      if (validLevels.includes(upper)) {
        sanitized.experience_level = upper;
      } else {
        errors.push(`Invalid experience level: ${updates.experienceLevel}`);
      }
    }

    if (updates.weeklyHours !== undefined) {
      sanitized.weekly_hours = updates.weeklyHours.trim();
    }

    if (updates.learningStyle !== undefined) {
      sanitized.learning_style = updates.learningStyle.trim();
    }

    if (updates.interests !== undefined) {
      sanitized.interests = updates.interests.trim();
    }

    return {
      isValid: errors.length === 0,
      sanitized: errors.length === 0 ? sanitized : undefined,
      errors
    };
  }

  static async dispatchAction(
    userId: string,
    action: ProposedAction,
    options?: ActionDispatchOptions
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!action || action.type === 'NONE') {
      return { success: true };
    }

    if (!userId) {
      return { success: false, error: 'User ID is required to dispatch actions.' };
    }

    try {
      if (action.type === 'UPDATE_PROFILE' && action.payload?.profileUpdates) {
        const validation = this.validateProfileUpdate(action.payload.profileUpdates);
        if (!validation.isValid || !validation.sanitized) {
          return { success: false, error: validation.errors?.join(', ') || 'Invalid profile updates.' };
        }

        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase
            .from('profiles')
            .update(validation.sanitized)
            .eq('user_id', userId);

          if (error) {
            return { success: false, error: error.message };
          }
        }
        return { success: true, result: validation.sanitized };
      }

      if (action.type === 'CREATE_COMMITMENT' && action.payload?.commitment) {
        const comm = action.payload.commitment;
        const text = comm.statement || comm.action || 'Study reminder';
        const created = await CommitmentProcessor.saveCommitment(
          userId,
          options?.conversationId || null,
          text,
          options?.sourceMessageId
        );
        if (!created) {
          return { success: false, error: 'Failed to persist commitment in Supabase.' };
        }
        return { success: true, result: created };
      }

      if (action.type === 'ADVANCE_DAY') {
        const roadmapId = options?.roadmapId;
        const currentDay = options?.currentDay || action.payload?.dayNumber || 1;
        if (!roadmapId) {
          return { success: false, error: 'Active roadmap ID required to advance day.' };
        }
        const updated = await RoadmapManager.advanceToNextDay(userId, roadmapId, currentDay);
        if (!updated) {
          return { success: false, error: 'Roadmap progression prerequisites not met (task or quiz incomplete).' };
        }
        return { success: true, result: updated };
      }

      if (action.type === 'PROPOSE_ROADMAP') {
        return { success: true, result: { suggestPlan: true, config: action.payload?.roadmapConfig } };
      }

      return { success: true, result: action.payload };
    } catch (err: any) {
      console.error('ActionDispatcher error:', err);
      return { success: false, error: err.message || 'Action dispatch failed.' };
    }
  }
}

/**
 * Deterministic Intelligence Adapter (SIMULATED).
 * Serves as the pre-LLM placeholder that implements IIntelligenceAdapter.
 * In Phase 6, this will be swapped for the GeminiIntelligenceAdapter.
 */
export class DeterministicIntelligenceAdapter implements IIntelligenceAdapter {
  async generateResponse(context: LLMContextObject): Promise<IntelligenceAdapterResponse> {
    const mentorId = (context.userProfile.activeMentorId as MentorId) || 'AARYA';
    const personality = (context.userProfile.personality as PersonalityStyle) || 'FRIENDLY';
    const mentor = MENTORS[mentorId] || MENTORS.AARYA;
    const messageLower = context.currentMessage.toLowerCase();

    const suggestPlan = messageLower.includes('roadmap') || messageLower.includes('plan') || messageLower.includes('study schedule');

    let replyText = '';
    let resources: ResourceLink[] | undefined = undefined;
    let proposedAction: ProposedAction = { type: 'NONE' };

    // 1. Technical queries: Overfitting, Core concepts
    if (messageLower.includes('overfitting') || messageLower.includes('what is') || messageLower.includes('difference between')) {
      if (mentor.domain === 'CYBERSECURITY') {
        replyText = `Here is the security breakdown for your question:

Understanding network attack surfaces and protocol vulnerabilities starts with packet flow analysis. In hands-on cybersecurity, theoretical knowledge is always validated in controlled lab environments (like TryHackMe or CTF challenges).

Would you like to explore how to analyze this using Linux CLI tools?`;
      } else if (mentor.domain === 'DATA_SCIENCE') {
        replyText = `Here is the data breakdown for your question:

In data analytics, your primary objective is transforming raw, untrusted data into reliable business metrics. Clear query structure, robust aggregations, and data cleanliness are key.

Would you like to look at a practical SQL example?`;
      } else {
        replyText = `Here is the technical breakdown for your question:

**Overfitting** occurs when a machine learning model learns noise and specific artifacts of the training dataset too closely, failing to generalize to new, unseen test data.

*Key Solutions:*
1. Cross-validation (K-Fold)
2. Regularization (L1/L2 or Dropout)
3. Gathering more diverse training data

Would you like to explore how to implement regularization in Python/PyTorch?`;
      }
    } else if (messageLower.includes('prefer') || messageLower.includes('learning preference') || messageLower.includes('what kind of learning')) {
      const prefMemories = context.relevantMemories.filter(m => m.category === 'learning_style' || m.category === 'dislike_preference');
      if (prefMemories.length > 0) {
        const memList = prefMemories.map(m => `• ${m.content}`).join('\n');
        replyText = `Based on your mentor notes, here are your logged learning preferences:\n\n${memList}\n\nI always tailor our exercises to fit your preferred learning style!`;
      } else {
        replyText = `I don't have a specific learning preference logged for you yet! Do you prefer hands-on project building, watching short videos, or reading official documentation?`;
      }
    } else if (messageLower.includes('work on today') || messageLower.includes("today's task") || messageLower.includes('what should i do')) {
      if (context.roadmapState) {
        replyText = `Here is your focus for today based on your active **${context.roadmapState.title}**:\n\n👉 **Day ${context.roadmapState.currentDay} Milestone**: Master core concepts and complete today's practical exercise.\n\nClick the **"Roadmap"** button in the header to view your mission details!`;
      } else {
        replyText = `You don't have an active roadmap initialized yet! Whenever you're ready, let me know and we can set up a focused plan for your goals.`;
      }
    } else if (suggestPlan) {
      replyText = `Having a structured plan tailored to your level and goals removes guesswork!\n\nI can initialize a continuous **30, 60, or 90-Day ${mentor.subjectBadge} Roadmap** for you whenever you're ready. Just let me know if you would like me to set it up!`;
      proposedAction = {
        type: 'PROPOSE_ROADMAP',
        payload: {
          roadmapConfig: {
            domain: mentor.domain,
            level: context.userProfile.experienceLevel || 'BEGINNER',
            duration: 30,
            focus: 'GENERAL'
          }
        }
      };
    } else {
      if (personality === 'STRICT') {
        replyText = `Got it. Context noted in your profile.\n\nWhat is your single biggest bottleneck right now? Is it finding quality resources, building real projects, or time management?`;
      } else if (personality === 'BUBBLY') {
        replyText = `Awesome! I've updated my mentor notes about you! 📝\n\nWhat's the #1 goal you want us to tackle first? Projects, study schedules, or interview prep? ✨`;
      } else {
        replyText = `That's really helpful context! I've saved this to your mentor memory so we stay completely aligned.\n\nWhat would be most helpful to focus on next?\n1. Creating or reviewing your **learning roadmap**\n2. Recommending **free hands-on resources**\n3. Discussing **portfolio project ideas**`;
      }
    }

    return {
      text: replyText,
      resources,
      suggestPlanTrigger: suggestPlan,
      proposedAction,
      confidence: 1.0,
      simulated: true // Label simulated output honestly
    };
  }
}


/**
 * Defensively extracts a plain conversational string from a Gemini text response.
 *
 * Gemini with responseMimeType:'application/json' is instructed to return structured JSON.
 * However it occasionally:
 *   a) Wraps the entire JSON inside markdown code fences (```json … ```)
 *   b) Puts another JSON object as the value of the "reply" field (nested JSON)
 *   c) Returns plain text when generation falls back to a non-JSON model
 *
 * This function MUST return a clean human-readable string or empty string.
 * It must NEVER return a raw JSON string that would be displayed verbatim to students.
 */
function extractReplyText(rawText: string): { reply: string; suggestPlan: boolean; proposedAction: { type: string; payload?: any } } {
  const VALID_ACTION_TYPES = ['NONE', 'UPDATE_PROFILE', 'CREATE_COMMITMENT', 'PROPOSE_ROADMAP', 'ADVANCE_DAY', 'TAKE_QUIZ'];

  const fallback = { reply: rawText.trim(), suggestPlan: false, proposedAction: { type: 'NONE' } };

  if (!rawText || typeof rawText !== 'string') return fallback;

  const trimmed = rawText.trim();

  function sanitize(obj: any): { reply: string; suggestPlan: boolean; proposedAction: { type: string; payload?: any } } {
    let reply = '';
    if (typeof obj.reply === 'string') reply = obj.reply.trim();
    else if (typeof obj.text === 'string') reply = obj.text.trim();
    else if (typeof obj.message === 'string') reply = obj.message.trim();

    // Unwrap nested JSON in reply field (Gemini double-wrapping bug)
    if (reply && reply.startsWith('{') && reply.includes('"reply"')) {
      try {
        const nested = JSON.parse(reply);
        if (nested && typeof nested.reply === 'string') reply = nested.reply.trim();
      } catch { /* leave as-is */ }
    }

    const suggestPlan = Boolean(obj.suggestPlan);
    let proposedAction: { type: string; payload?: any } = { type: 'NONE' };
    if (obj.proposedAction && typeof obj.proposedAction === 'object') {
      const actionType = String(obj.proposedAction.type || 'NONE').toUpperCase();
      if (VALID_ACTION_TYPES.includes(actionType)) {
        proposedAction = { type: actionType, payload: obj.proposedAction.payload || {} };
      }
    }

    return { reply, suggestPlan, proposedAction };
  }

  // 1. Direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return sanitize(parsed);
  } catch { /* continue */ }

  // 2. Strip markdown code fences (```json ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed && typeof parsed === 'object') return sanitize(parsed);
    } catch { /* continue */ }
  }

  // 3. Extract from first '{' to last '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object') return sanitize(parsed);
    } catch { /* continue */ }
    // Regex fallback: extract "reply" field value even from slightly malformed JSON
    const replyMatch = trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (replyMatch && replyMatch[1]) {
      const extracted = replyMatch[1]
        .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t')
        .replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
      const suggestPlanMatch = trimmed.match(/"suggestPlan"\s*:\s*(true|false)/i);
      const actionTypeMatch = trimmed.match(/"type"\s*:\s*"([A-Z_]+)"/);
      const actionType = actionTypeMatch ? actionTypeMatch[1] : 'NONE';
      return {
        reply: extracted,
        suggestPlan: suggestPlanMatch ? suggestPlanMatch[1].toLowerCase() === 'true' : false,
        proposedAction: { type: VALID_ACTION_TYPES.includes(actionType) ? actionType : 'NONE', payload: {} }
      };
    }
  }

  // 4. Plain text response — already human-readable
  return fallback;
}

/**
 * Production Gemini Intelligence Adapter.
 * Connects to the authenticated Supabase Edge Function 'chat' powered by Gemini Flash.
 * Handles graceful fallback to DeterministicIntelligenceAdapter if offline or unauthenticated.
 */
export class GeminiIntelligenceAdapter implements IIntelligenceAdapter {
  private fallbackAdapter = new DeterministicIntelligenceAdapter();

  async generateResponse(context: LLMContextObject): Promise<IntelligenceAdapterResponse> {
    const mentorId = (context.userProfile.activeMentorId as MentorId) || 'AARYA';
    const personality = (context.userProfile.personality as PersonalityStyle) || 'FRIENDLY';

    try {
      if (!isSupabaseConfigured || !supabase) {
        return this.fallbackAdapter.generateResponse(context);
      }

      // Check for active authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return this.fallbackAdapter.generateResponse(context);
      }

      // Invoke Supabase Edge Function 'chat'
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: context.currentMessage,
          mentorId,
          personality
        }
      });

      if (error || !data) {
        console.warn('Gemini chat Edge Function failed, falling back to deterministic adapter:', error || data);
        return this.fallbackAdapter.generateResponse(context);
      }

      // The Edge Function already extracts reply/suggestPlan/proposedAction server-side.
      // Apply a second defensive extraction pass here in case the reply field itself contains
      // nested JSON (Gemini double-wrapping) or the Edge Function fell back to rawText.
      const rawText: string = data.text || '';
      const { reply, suggestPlan, proposedAction } = extractReplyText(rawText);

      if (!reply) {
        console.warn('Gemini Edge Function returned empty reply, falling back to deterministic adapter.');
        return this.fallbackAdapter.generateResponse(context);
      }

      // Prefer server-side proposedAction (already validated), merge with client extraction
      const serverAction = data.proposedAction;
      const resolvedAction: ProposedAction = (
        serverAction && serverAction.type && serverAction.type !== 'NONE'
          ? { type: serverAction.type as ProposedActionType, payload: serverAction.payload || {} }
          : proposedAction.type !== 'NONE'
            ? { type: proposedAction.type as ProposedActionType, payload: proposedAction.payload || {} }
            : { type: 'NONE' }
      );

      return {
        text: reply,
        suggestPlanTrigger: Boolean(data.suggestPlan ?? suggestPlan),
        proposedAction: resolvedAction,
        simulated: false,
        confidence: 1.0
      };
    } catch (err) {
      console.warn('Error invoking Gemini Edge Function, using deterministic fallback:', err);
      return this.fallbackAdapter.generateResponse(context);
    }
  }
}


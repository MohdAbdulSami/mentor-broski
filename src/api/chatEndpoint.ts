import { MentorId, ChatMessage, MessageCategory, LLMContextObject } from '../types';
import { ChatOrchestrator } from '../services/chatOrchestrator';

export interface ChatApiRequestBody {
  conversationId?: string;
  mentorId?: MentorId;
  message: string;
}

export interface ChatApiResponsePayload {
  success: boolean;
  data?: {
    conversationId: string;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    llmContext: LLMContextObject;
    contextSummary: {
      category: MessageCategory;
      signals: MessageCategory[];
      memoriesRetrievedCount: number;
      commitmentsRetrievedCount: number;
      hasRoadmap: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Backend Chat API Endpoint Handler (`POST /api/chat`).
 * Authenticates user session, validates conversation ownership, executes ChatOrchestrator,
 * and returns clean structured application response.
 */
export async function handleChatApiEndpoint(
  reqBody: ChatApiRequestBody,
  sessionUser: any
): Promise<ChatApiResponsePayload> {
  // 1. Authentication Gatekeeper
  if (!sessionUser || !sessionUser.id) {
    return {
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please sign in to access Mentor Broski chat.'
      }
    };
  }

  // 2. Request Payload Validation
  if (!reqBody || !reqBody.message || typeof reqBody.message !== 'string' || !reqBody.message.trim()) {
    return {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid request body. Parameter "message" is required.'
      }
    };
  }

  const mentorId: MentorId = reqBody.mentorId || 'AARYA';

  // 3. Delegate to Central ChatOrchestrator
  const result = await ChatOrchestrator.handleChatMessage({
    userId: sessionUser.id,
    mentorId,
    personality: sessionUser.personality || null,
    userMessage: reqBody.message.trim(),
    conversationId: reqBody.conversationId || null
  });

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || { code: 'SERVER_ERROR', message: 'Chat execution failed.' }
    };
  }

  const { userMessageRecord, mentorMessageRecord, conversationId, llmContext } = result.data;

  // 4. Return Structured API Response
  return {
    success: true,
    data: {
      conversationId,
      userMessage: userMessageRecord,
      assistantMessage: mentorMessageRecord,
      llmContext,
      contextSummary: {
        category: llmContext.classificationSignals[0] || 'UNKNOWN',
        signals: llmContext.classificationSignals,
        memoriesRetrievedCount: llmContext.relevantMemories.length,
        commitmentsRetrievedCount: llmContext.activeCommitments.length,
        hasRoadmap: Boolean(llmContext.roadmapState)
      }
    }
  };
}

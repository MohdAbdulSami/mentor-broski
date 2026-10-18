import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DbCommitmentRecord, CommitmentStatus } from '../types';
import { ActivityTracker } from './activityTracker';

export class CommitmentProcessor {
  static extractCommitment(text: string): { statement: string; action: string; targetWindow: string; dueAt: string } | null {
    const lower = text.toLowerCase();

    // Promise triggers and reminder triggers
    const promiseTriggers = [
      "remind me", "i'll finish", "i will finish", "i'll complete", "i will complete",
      "i'll do", "i will do", "i promise", "i'm going to finish",
      "i plan to finish", "i'll build", "i will build", "i'll submit", "i will submit",
      "i'll study", "i will study", "need to finish", "going to study"
    ];

    const hasPromise = promiseTriggers.some(t => lower.includes(t));
    if (!hasPromise) return null;

    // Extract clean action string
    let cleanAction = 'Study reminder';
    const explicitTaskMatch = text.match(/(?:remind me(?:\s+in\s+[^,]+)?\s+to\s+|i'll\s+|i will\s+|i promise to\s+|need to\s+|going to\s+|i plan to\s+)(.+)/i);
    if (explicitTaskMatch && explicitTaskMatch[1]) {
      cleanAction = explicitTaskMatch[1].trim();
    } else {
      const stripped = text.replace(/^remind me(?:\s+in\s+\d+\s*\w+)?(?:\s+to)?/i, '').trim();
      if (stripped.length > 0) {
        cleanAction = stripped;
      } else {
        cleanAction = 'Study reminder';
      }
    }

    let targetWindow = 'soon';
    let dueAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 hours

    // Relative minute matching ("in 2 minutes", "in 10 minutes")
    const minuteMatch = lower.match(/in\s+(\d+)\s*(minute|minutes|min|mins)/);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1], 10);
      targetWindow = `in ${minutes} minutes`;
      dueAtDate = new Date(Date.now() + minutes * 60 * 1000);
    } else if (lower.match(/in\s+(\d+)\s*(hour|hours|hr|hrs)/)) {
      const hoursMatch = lower.match(/in\s+(\d+)\s*(hour|hours|hr|hrs)/);
      const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 1;
      targetWindow = `in ${hours} hours`;
      dueAtDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    } else if (lower.includes('tomorrow')) {
      targetWindow = 'tomorrow';
      dueAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (lower.includes('tonight') || lower.includes('this evening')) {
      targetWindow = 'tonight';
      dueAtDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
    } else if (lower.includes('this weekend')) {
      targetWindow = 'this weekend';
      dueAtDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    }

    return {
      statement: text.trim(),
      action: cleanAction,
      targetWindow,
      dueAt: dueAtDate.toISOString()
    };
  }

  static async saveCommitment(
    userId: string, 
    conversationId: string | null, 
    text: string,
    sourceMessageId?: string
  ): Promise<DbCommitmentRecord | null> {
    const extracted = this.extractCommitment(text);
    if (!extracted || !userId || !isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      // 1. Try atomic upsert RPC to handle idempotency by sourceMessageId or rapid burst
      const { data: rpcRecord, error: rpcError } = await supabase.rpc('upsert_commitment', {
        p_user_id: userId,
        p_conversation_id: conversationId || null,
        p_statement: extracted.statement,
        p_action: extracted.action,
        p_target_window: extracted.targetWindow,
        p_due_at: extracted.dueAt,
        p_source_message_id: sourceMessageId || null
      });

      if (!rpcError && rpcRecord) {
        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
        return rpcRecord as DbCommitmentRecord;
      }

      // 2. Fallback direct insert if RPC is unavailable
      // Check idempotency by source_message_id or 5-second rapid burst
      let existingQuery = supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId);

      if (sourceMessageId) {
        existingQuery = existingQuery.eq('source_message_id', sourceMessageId);
      } else {
        const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
        existingQuery = existingQuery.eq('statement', extracted.statement).gte('created_at', fiveSecAgo);
      }

      const { data: existing } = await existingQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
        return existing as DbCommitmentRecord;
      }

      const { data: record } = await supabase
        .from('commitments')
        .insert({
          user_id: userId,
          conversation_id: conversationId || null,
          statement: extracted.statement,
          action: extracted.action,
          target_window: extracted.targetWindow,
          due_at: extracted.dueAt,
          status: 'PENDING',
          notification_status: 'PENDING',
          reminder_count: 0,
          escalation_level: 0,
          source_message_id: sourceMessageId || null
        })
        .select()
        .maybeSingle();

      ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
      return (record as DbCommitmentRecord) || null;
    } catch (err) {
      console.error('Error saving commitment to Supabase:', err);
      return null;
    }
  }

  static async updateCommitmentStatus(
    userId: string,
    commitmentId: string,
    newStatus: CommitmentStatus
  ): Promise<DbCommitmentRecord | null> {
    if (!userId || !commitmentId || !isSupabaseConfigured || !supabase) return null;

    const payload: Record<string, any> = {
      status: newStatus
    };

    if (newStatus === 'IN_PROGRESS') {
      payload.acknowledged_at = new Date().toISOString();
      payload.next_reminder_at = null;
    } else if (newStatus === 'COMPLETED' || newStatus === 'MET') {
      payload.completed_at = new Date().toISOString();
      payload.verified_at = new Date().toISOString();
      payload.next_reminder_at = null;
    }

    try {
      const { data: updated } = await supabase
        .from('commitments')
        .update(payload)
        .eq('id', commitmentId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (updated) {
        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
      }

      return (updated as DbCommitmentRecord) || null;
    } catch (err) {
      console.error('Error updating commitment status in Supabase:', err);
      return null;
    }
  }

  static async rescheduleCommitment(
    userId: string,
    commitmentId: string,
    newTimeText: string
  ): Promise<DbCommitmentRecord | null> {
    if (!userId || !commitmentId || !isSupabaseConfigured || !supabase) return null;

    const parsedTime = this.extractCommitment(`remind me ${newTimeText}`) || {
      statement: newTimeText,
      action: 'rescheduled task',
      targetWindow: 'tomorrow',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    try {
      const { data: updated } = await supabase
        .from('commitments')
        .update({
          status: 'RESCHEDULED',
          target_window: parsedTime.targetWindow,
          due_at: parsedTime.dueAt,
          notification_status: 'PENDING',
          reminder_count: 0,
          escalation_level: 0,
          next_reminder_at: null
        })
        .eq('id', commitmentId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (updated) {
        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
      }

      return (updated as DbCommitmentRecord) || null;
    } catch (err) {
      console.error('Error rescheduling commitment in Supabase:', err);
      return null;
    }
  }

  static async fetchActiveCommitments(userId: string): Promise<DbCommitmentRecord[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      const { data } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .or('status.eq.PENDING,status.eq.REMINDING,status.eq.IN_PROGRESS')
        .order('created_at', { ascending: false });

      return (data as DbCommitmentRecord[]) || [];
    } catch (err) {
      console.error('Error fetching active commitments from Supabase:', err);
      return [];
    }
  }

  /**
   * Save a commitment with an explicit pre-calculated due timestamp.
   * Used by the progression "schedule tomorrow" flow to bypass text extraction.
   */
  static async saveCommitmentWithDueAt(
    userId: string,
    conversationId: string | null,
    statement: string,
    action: string,
    targetWindow: string,
    dueAt: string,
    sourceMessageId?: string
  ): Promise<DbCommitmentRecord | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data: rpcRecord, error: rpcError } = await supabase.rpc('upsert_commitment', {
        p_user_id: userId,
        p_conversation_id: conversationId || null,
        p_statement: statement,
        p_action: action,
        p_target_window: targetWindow,
        p_due_at: dueAt,
        p_source_message_id: sourceMessageId || null
      });

      if (!rpcError && rpcRecord) {
        ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
        return rpcRecord as DbCommitmentRecord;
      }

      // Fallback: direct insert
      const { data: record } = await supabase
        .from('commitments')
        .insert({
          user_id: userId,
          conversation_id: conversationId || null,
          statement,
          action,
          target_window: targetWindow,
          due_at: dueAt,
          status: 'PENDING',
          notification_status: 'PENDING',
          reminder_count: 0,
          escalation_level: 0,
          source_message_id: sourceMessageId || null
        })
        .select()
        .maybeSingle();

      ActivityTracker.recordMeaningfulActivity(userId).catch(() => {});
      return (record as DbCommitmentRecord) || null;
    } catch (err) {
      console.error('Error saving commitment with due_at to Supabase:', err);
      return null;
    }
  }
}

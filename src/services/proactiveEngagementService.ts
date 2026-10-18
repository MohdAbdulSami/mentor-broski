import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MentorId, PersonalityStyle, ChatMessage } from '../types';
import { MENTORS } from '../data/mentors';
import { RetrievalService } from './retrievalService';
import { RoadmapManager } from './roadmapManager';

export class ProactiveEngagementService {
  /**
   * Checks if user has been inactive for 12+ hours and triggers a contextual proactive check-in.
   * Atomically claims check-in window via claim_proactive_checkin RPC to prevent multi-tab duplicate messages.
   */
  static async checkProactiveEngagement(
    userId: string,
    mentorId: MentorId = 'AARYA',
    personality: PersonalityStyle = 'FRIENDLY'
  ): Promise<ChatMessage | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      // 1. Execute atomic claim RPC function in PostgreSQL
      // Returns true ONLY IF user is complete with onboarding, inactive for 12+ hours, and not checked in recently.
      const { data: isClaimed, error: rpcError } = await supabase.rpc('claim_proactive_checkin', {
        p_user_id: userId
      });

      if (rpcError) {
        console.warn('claim_proactive_checkin RPC error, executing client fallback check:', rpcError);
        // Client Fallback Check if RPC is missing
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!profile) return null;

        // Exclude onboarding users
        if (!profile.onboarding_completed && profile.onboarding_step !== 'ONBOARDING_COMPLETE') {
          return null;
        }

        const nowMs = Date.now();
        const INACTIVITY_THRESHOLD_MS = 12 * 60 * 60 * 1000;
        const lastActivityMs = profile.last_user_activity_at ? new Date(profile.last_user_activity_at).getTime() : 0;
        const lastCheckinMs = profile.last_proactive_checkin_at ? new Date(profile.last_proactive_checkin_at).getTime() : 0;

        if ((nowMs - lastActivityMs) < INACTIVITY_THRESHOLD_MS) return null;
        if ((nowMs - lastCheckinMs) < INACTIVITY_THRESHOLD_MS) return null;

        // Update timestamps on fallback
        const nowIso = new Date().toISOString();
        const nextCheckinIso = new Date(nowMs + INACTIVITY_THRESHOLD_MS).toISOString();
        await supabase
          .from('profiles')
          .update({
            last_proactive_checkin_at: nowIso,
            next_proactive_checkin_at: nextCheckinIso,
            engagement_status: 'CHECKED_IN'
          })
          .eq('user_id', userId);
      } else if (!isClaimed) {
        // Not eligible or already claimed by another tab/session
        return null;
      }

      // 2. Fetch profile data for user name
      const profile = await RetrievalService.getRelevantProfile(userId);

      // 3. Fetch or create conversation ID
      const convId = await RetrievalService.getOrCreateConversation(userId, mentorId, personality);
      if (!convId) return null;

      // 4. Build Contextual Check-In Content based on User State
      const mentor = MENTORS[mentorId] || MENTORS['AARYA'];
      const activeRoadmap = await RoadmapManager.getCurrentRoadmap(userId, mentor.domain);
      const pendingCommitments = await RetrievalService.getActiveCommitments(userId);
      const userName = profile?.name || profile?.displayName || 'Student';

      let checkInText = '';

      if (pendingCommitments.length > 0) {
        const topTask = pendingCommitments[0].action || pendingCommitments[0].statement;
        if (personality === 'STRICT') {
          checkInText = `Hey ${userName}. You've been away for a while, and "${topTask}" is still incomplete. Ready to get back to work?`;
        } else if (personality === 'BUBBLY') {
          checkInText = `Hellooo ${userName}! ✨ Quick check! You've been quiet and "${topTask}" is still waiting for you! Ready to crush it? 🎉`;
        } else {
          checkInText = `Hey ${userName}! 😊 You've been away for a bit and your promise to "${topTask}" is still pending. Want to pick it up now?`;
        }
      } else if (activeRoadmap) {
        const currentDay = activeRoadmap.current_day || 1;
        if (personality === 'STRICT') {
          checkInText = `Hey ${userName}. You haven't started Day ${currentDay} of your ${mentor.domain.replace('_', ' ')} roadmap today. Everything okay?`;
        } else if (personality === 'BUBBLY') {
          checkInText = `Hey ${userName}! 👀 Day ${currentDay} of your roadmap is waiting for you! Don't lose your momentum! Let me know when you start! 💪`;
        } else {
          checkInText = `You've been quiet today, ${userName}. Day ${currentDay} of your ${mentor.domain.replace('_', ' ')} roadmap is still waiting. Everything okay?`;
        }
      } else {
        if (personality === 'STRICT') {
          checkInText = `Hey ${userName}. I haven't heard from you today. Progress requires consistency. Let's check in.`;
        } else if (personality === 'BUBBLY') {
          checkInText = `Hey ${userName}! 👋 Missed seeing you today! How are things going? Drop a message when you get a chance! ✨`;
        } else {
          checkInText = `Hey ${userName}, haven't heard from you today. How's everything going?`;
        }
      }

      // 5. Persist Proactive Check-In Message to Supabase DB
      const persistedMsg = await RetrievalService.persistMessage(
        convId,
        userId,
        'mentor',
        checkInText,
        { isProactive: true }
      );

      // 6. Trigger custom event for real-time UI display
      if (typeof window !== 'undefined' && persistedMsg) {
        const event = new CustomEvent('mentor-broski-proactive-checkin', {
          detail: persistedMsg
        });
        window.dispatchEvent(event);
      }

      return persistedMsg;
    } catch (err) {
      console.error('Error in ProactiveEngagementService:', err);
      return null;
    }
  }
}

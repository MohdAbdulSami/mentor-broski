import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AccountabilityPreferences {
  accountabilityOptIn: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailyNotificationCap: number;
  userTimezone: string;
}

export class ActivityTracker {
  /**
   * Updates user's last_user_activity_at timestamp and resets next_proactive_checkin_at
   * 12 hours into the future upon meaningful user activity.
   */
  static async recordMeaningfulActivity(userId: string): Promise<boolean> {
    if (!userId || !isSupabaseConfigured || !supabase) return false;

    try {
      const nowIso = new Date().toISOString();
      const nextCheckinIso = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('profiles')
        .update({
          last_user_activity_at: nowIso,
          next_proactive_checkin_at: nextCheckinIso,
          engagement_status: 'ACTIVE'
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating activity in profiles:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('ActivityTracker error:', err);
      return false;
    }
  }

  /**
   * Records meaningful mission engagement in Supabase so the backend can monitor
   * and initiate proactive accountability if the student abandons today's mission.
   */
  static async recordMissionEngagement(
    roadmapId: string,
    dayNumber: number,
    missionTitle?: string
  ): Promise<boolean> {
    if (!roadmapId || !dayNumber || !isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase.rpc('record_mission_engagement', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber,
        p_mission_title: missionTitle || null
      });

      if (error) {
        console.warn('Error recording mission engagement via RPC:', error.message);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Error in recordMissionEngagement:', err);
      return false;
    }
  }

  /**
   * Stops the proactive inactivity accountability sequence when a mission is completed.
   */
  static async markMissionCompleted(
    roadmapId: string,
    dayNumber: number
  ): Promise<boolean> {
    if (!roadmapId || !dayNumber || !isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase.rpc('mark_mission_completed', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber
      });

      if (error) {
        console.warn('Error marking mission completed via RPC:', error.message);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Error in markMissionCompleted:', err);
      return false;
    }
  }

  /**
   * Snoozes mission accountability reminders for N minutes (defaults to 60m).
   */
  static async snoozeMissionReminders(
    roadmapId: string,
    dayNumber: number,
    minutes: number = 60
  ): Promise<boolean> {
    if (!roadmapId || !dayNumber || !isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase.rpc('snooze_mission_reminders', {
        p_roadmap_id: roadmapId,
        p_day_number: dayNumber,
        p_minutes: minutes
      });

      if (error) {
        console.warn('Error snoozing mission reminders via RPC:', error.message);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Error in snoozeMissionReminders:', err);
      return false;
    }
  }

  /**
   * Updates user accountability notification preferences (opt-in, quiet hours, cap, timezone).
   */
  static async setAccountabilityPreferences(
    prefs: Partial<AccountabilityPreferences>
  ): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    try {
      const { data, error } = await supabase.rpc('set_accountability_preferences', {
        p_opt_in: prefs.accountabilityOptIn ?? true,
        p_quiet_start: prefs.quietHoursStart ?? '22:00:00',
        p_quiet_end: prefs.quietHoursEnd ?? '08:00:00',
        p_cap: prefs.dailyNotificationCap ?? 4,
        p_timezone: prefs.userTimezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
      });

      if (error) {
        console.warn('Error setting accountability preferences via RPC:', error.message);
        return false;
      }

      return data?.success === true;
    } catch (err) {
      console.error('Error in setAccountabilityPreferences:', err);
      return false;
    }
  }

  /**
   * Fetches user accountability preferences from profile.
   */
  static async getAccountabilityPreferences(userId: string): Promise<AccountabilityPreferences | null> {
    if (!userId || !isSupabaseConfigured || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('accountability_opt_in, quiet_hours_start, quiet_hours_end, daily_notification_cap, user_timezone')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        accountabilityOptIn: data.accountability_opt_in ?? true,
        quietHoursStart: data.quiet_hours_start || '22:00',
        quietHoursEnd: data.quiet_hours_end || '08:00',
        dailyNotificationCap: data.daily_notification_cap ?? 4,
        userTimezone: data.user_timezone || 'UTC'
      };
    } catch (err) {
      console.error('Error getting accountability preferences:', err);
      return null;
    }
  }
}

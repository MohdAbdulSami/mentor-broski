import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DbCommitmentRecord, MentorId, PersonalityStyle } from '../types';
import { MENTORS } from '../data/mentors';
import { ProactiveEngagementService } from './proactiveEngagementService';
import { PushNotificationService } from './pushNotifications';

export class ReminderScheduler {
  private static timerId: any = null;
  private static isInitialized = false;

  static init(userId: string, mentorId: MentorId = 'AARYA', personality: PersonalityStyle = 'FRIENDLY'): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Request permission and register Web Push Subscription with backend
    PushNotificationService.requestAndRegisterSubscription(userId).catch(err => {
      console.warn('Push subscription registration warning:', err);
    });

    // Reconcile missed reminders
    PushNotificationService.reconcileMissedReminders(userId).catch(err => {
      console.warn('Reconcile missed reminders warning:', err);
    });

    this.checkDueReminders(userId);
    this.checkUnfinishedMissionReminders(userId);
    ProactiveEngagementService.checkProactiveEngagement(userId, mentorId, personality);

    this.timerId = setInterval(() => {
      this.checkDueReminders(userId);
      this.checkUnfinishedMissionReminders(userId);
      ProactiveEngagementService.checkProactiveEngagement(userId, mentorId, personality);
    }, 15000);
  }

  static stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isInitialized = false;
  }

  static async checkDueReminders(userId: string): Promise<DbCommitmentRecord[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      // 1. Try atomic claim RPC function with FOR UPDATE SKIP LOCKED for multi-tab safety
      const { data: claimedItems, error: rpcError } = await supabase.rpc('claim_due_reminders', {
        p_user_id: userId,
        p_limit: 5
      });

      if (!rpcError && claimedItems && Array.isArray(claimedItems)) {
        const deliveredItems: DbCommitmentRecord[] = [];
        for (const item of claimedItems) {
          const record = item as DbCommitmentRecord;
          deliveredItems.push(record);
          this.triggerNotification(record);
        }
        return deliveredItems;
      }

      // 2. Fallback: Atomic query & update if RPC fails
      const nowIso = new Date().toISOString();
      const { data: dueItems } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .or(`status.eq.PENDING,status.eq.REMINDING`)
        .lte('due_at', nowIso);

      if (!dueItems || dueItems.length === 0) return [];

      const deliveredItems: DbCommitmentRecord[] = [];

      for (const item of dueItems) {
        // Filter out if next_reminder_at is set and in the future
        if (item.next_reminder_at && new Date(item.next_reminder_at).getTime() > Date.now()) {
          continue;
        }

        const nextIntervalMins = item.reminder_interval_minutes || 10;
        const nextReminderDate = new Date(Date.now() + nextIntervalMins * 60 * 1000).toISOString();
        const currentCount = item.reminder_count || 0;
        const newEscalationLevel = Math.min(3, currentCount);

        const { data: updated } = await supabase
          .from('commitments')
          .update({
            status: 'REMINDING',
            notification_status: 'DELIVERED',
            reminder_count: currentCount + 1,
            escalation_level: newEscalationLevel,
            last_reminded_at: nowIso,
            next_reminder_at: nextReminderDate
          })
          .eq('id', item.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        if (updated) {
          deliveredItems.push(updated as DbCommitmentRecord);
          this.triggerNotification(updated as DbCommitmentRecord);
        }
      }

      return deliveredItems;
    } catch (err) {
      console.error('Error in ReminderScheduler checkDueReminders:', err);
      return [];
    }
  }

  static generateEscalatedReminderText(
    reminder: DbCommitmentRecord,
    mentorId: MentorId = 'AARYA',
    personality: PersonalityStyle = 'FRIENDLY',
    userName = 'Student'
  ): string {
    const count = reminder.reminder_count || 0;
    const task = reminder.action || reminder.statement;
    const tone = personality || 'FRIENDLY';

    if (count === 1) {
      // Level 0 (First reminder execution): Gentle
      if (tone === 'STRICT') {
        return `Hey ${userName}. Your task "${task}" is due now. You promised to complete it. Start now.`;
      } else if (tone === 'BUBBLY') {
        return `Hellooo ${userName}! ✨ Friendly reminder that "${task}" is waiting for you! Let's get it done! 🎉`;
      } else {
        return `Hey ${userName}! 😊 Just checking in on your promise to "${task}". Ready to get started?`;
      }
    } else if (count === 2) {
      // Level 1: Direct
      if (tone === 'STRICT') {
        return `Still haven't started "${task}"? Delaying builds bad habits. Let's get moving right now.`;
      } else if (tone === 'BUBBLY') {
        return `Hey ${userName}! 👀 Quick check! Did you start "${task}" or are we procrastinating? Let me know! ✨`;
      } else {
        return `Hey ${userName}, "${task}" is still pending. What's stopping you from getting started?`;
      }
    } else if (count === 3) {
      // Level 2: Firm
      if (tone === 'STRICT') {
        return `You are behind schedule on "${task}". Stop postponing and take action immediately.`;
      } else if (tone === 'BUBBLY') {
        return `Hey! We really need to get "${task}" done! Don't break your momentum now! 💪`;
      } else {
        return `Hey ${userName}, you're falling behind on "${task}". Do you want to work on it now or reschedule?`;
      }
    } else {
      // Level 3+: Hard-hitting / Intervention
      if (tone === 'STRICT') {
        return `Repeated delays on "${task}" will disrupt your entire career roadmap. Are you doing it now, or setting a firm new time?`;
      } else if (tone === 'BUBBLY') {
        return `Okay ${userName}, intervention time! 🚨 You've postponed "${task}" multiple times. Let's make a real plan!`;
      } else {
        return `Hey ${userName}, you've missed multiple reminders for "${task}". Let's reset: are you starting now, or rescheduling?`;
      }
    }
  }

  static async checkUnfinishedMissionReminders(userId: string): Promise<any[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];

    try {
      const { data: claimed, error } = await supabase.rpc('claim_unfinished_mission_reminders', {
        p_limit: 5
      });

      if (!error && claimed && Array.isArray(claimed)) {
        const userItems = claimed.filter((item: any) => item.user_id === userId);
        for (const item of userItems) {
          this.triggerMissionNotification(item);
        }
        return userItems;
      }
      return [];
    } catch (err) {
      console.error('Error checking unfinished mission reminders:', err);
      return [];
    }
  }

  private static triggerMissionNotification(reminder: any): void {
    const title = reminder.notification_title || 'Mentor Broski — Mission Check';
    const messageText = reminder.notification_body || 'You have an unfinished mission for today!';
    const options = {
      body: messageText,
      icon: '/pwa-192x192.png',
      tag: `mission-accountability-d${reminder.day_number}`
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (err) {
        console.warn('Native notification error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('mentor-broski-mission-reminder', {
        detail: reminder
      });
      window.dispatchEvent(event);
    }
  }

  private static triggerNotification(reminder: DbCommitmentRecord): void {
    const title = 'Mentor Broski — Action Required';
    const messageText = `⏰ Reminder: ${reminder.action || reminder.statement}`;
    const options = {
      body: messageText,
      icon: '/pwa-192x192.png',
      tag: reminder.id
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (err) {
        console.warn('Native notification error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('mentor-broski-reminder-due', {
        detail: reminder
      });
      window.dispatchEvent(event);
    }
  }
}

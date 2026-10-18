import { AnalyticsService } from './analytics';
import { MentorId } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface NotificationRecord {
  id: string;
  userId: string;
  mentorId: MentorId;
  type: string;
  title: string;
  body: string;
  actionUrl: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'READ';
  sentAt: string;
  createdAt: string;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export class PushNotificationService {
  /**
   * Request user notification permission
   */
  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Send immediate browser notification
   */
  static sendNotification(userId: string, mentorId: MentorId, title: string, body: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico'
        });
      } catch (err) {
        console.warn('Direct notification error, trying service worker:', err);
        navigator.serviceWorker?.ready.then(reg => {
          reg.showNotification(title, { body, icon: '/favicon.ico' });
        }).catch(() => {});
      }
    }
  }

  /**
   * Request user notification permission and register Web Push Subscription with Supabase
   */
  static async requestAndRegisterSubscription(userId: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Web Push Notifications not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      AnalyticsService.track('push_permission_granted');

      // Fetch VAPID public key from backend/database
      let vapidPublicKey = '';
      if (isSupabaseConfigured && supabase) {
        const { data: keyData } = await supabase.rpc('get_vapid_public_key');
        if (keyData) {
          vapidPublicKey = keyData;
        }
      }

      if (!vapidPublicKey) {
        // Fallback default public key
        vapidPublicKey = 'BGSn7oJFmEwDoB9u3H2_XzcfJrOBrnTp4RfBT6Mdfa1daVe-FgDA_ACQnIMhDV_gPomnroMUwkvI37BYbIwVyx0';
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (subscription && userId && isSupabaseConfigured && supabase) {
        const subJson = subscription.toJSON();
        const endpoint = subJson.endpoint || '';
        const p256dh = subJson.keys?.p256dh || '';
        const auth = subJson.keys?.auth || '';

        if (endpoint && p256dh && auth) {
          // Try atomic SECURITY DEFINER RPC first to allow endpoint reassignment across accounts without RLS rejection
          const { error: rpcError } = await supabase.rpc('upsert_push_subscription', {
            p_endpoint: endpoint,
            p_p256dh: p256dh,
            p_auth: auth,
            p_user_agent: navigator.userAgent
          });

          if (rpcError) {
            console.warn('upsert_push_subscription RPC returned error, falling back to direct upsert:', rpcError);
            const { error: upsertError } = await supabase.from('push_subscriptions').upsert({
              user_id: userId,
              endpoint,
              p256dh,
              auth,
              user_agent: navigator.userAgent,
              updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });

            if (upsertError) {
              console.error('Failed to persist push subscription to Supabase:', upsertError);
              throw new Error(`Subscription storage failed: ${upsertError.message}`);
            }
          }
        } else {
          throw new Error('Push subscription is missing required keys (endpoint, p256dh, auth).');
        }
      } else if (!subscription) {
        throw new Error('pushManager.subscribe() returned null — browser may not support Web Push.');
      }

      return true;
    } catch (err) {
      console.error('Error in requestAndRegisterSubscription:', err);
      return false;
    }
  }

  /**
   * Reconcile unseen/missed reminder messages when app reopens
   */
  static async reconcileMissedReminders(userId: string): Promise<any[]> {
    if (!userId || !isSupabaseConfigured || !supabase) return [];
    try {
      const { data: missed } = await supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'REMINDING')
        .order('last_reminded_at', { ascending: false });

      return missed || [];
    } catch (err) {
      console.error('Error reconciling missed reminders:', err);
      return [];
    }
  }
}

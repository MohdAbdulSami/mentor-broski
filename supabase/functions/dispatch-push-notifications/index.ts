// supabase/functions/dispatch-push-notifications/index.ts
// Objective 8 & Phase 4: Server-side Web Push dispatcher for Commitments & Unfinished Mission Accountability
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://lfzdstodflyprsptelqy.supabase.co';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, serviceKey);

    // Retrieve VAPID credentials: from env or from server_vault table
    let vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    let vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    let vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@mentorbroski.com';

    if (!vapidPrivateKey || !vapidPublicKey) {
      const { data: vaultRows } = await supabase.from('server_vault').select('key, value');
      if (vaultRows) {
        for (const row of vaultRows) {
          if (row.key === 'VAPID_PRIVATE_KEY') vapidPrivateKey = row.value;
          if (row.key === 'VAPID_PUBLIC_KEY') vapidPublicKey = row.value;
          if (row.key === 'VAPID_SUBJECT') vapidSubject = row.value;
        }
      }
    }

    if (!vapidPrivateKey || !vapidPublicKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured in server_vault or environment', dispatched: 0 }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Dynamic import of web-push library
    const webpush = await import('npm:web-push@3.6.7');
    webpush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Parse request body for optional direct push target or batch processing
    let reqBody: any = {};
    try {
      reqBody = await req.json();
    } catch {
      reqBody = {};
    }

    let dispatched = 0;
    const failures: string[] = [];
    const expiredSubscriptions: string[] = [];

    // Case 0: Issue 5 Fix — Dispatch by pre-claimed commitment or mission IDs passed from pg_cron.
    // process_all_scheduled_reminders() has ALREADY claimed the records and passes
    // the claimed IDs here. We fetch by ID directly — NO re-querying claim functions.
    const preClaimedCommitmentIds: string[] = reqBody.commitmentIds || [];
    const preClaimedMissionIds: string[] = reqBody.missionIds || [];

    if (preClaimedCommitmentIds.length > 0 || preClaimedMissionIds.length > 0) {
      if (preClaimedCommitmentIds.length > 0) {
        const { data: claimedCommitments } = await supabase
          .from('commitments')
          .select('id, user_id, action, statement')
          .in('id', preClaimedCommitmentIds);

        if (claimedCommitments && Array.isArray(claimedCommitments)) {
          for (const commitment of claimedCommitments) {
            const { data: subscriptions } = await supabase
              .from('push_subscriptions')
              .select('endpoint, p256dh, auth')
              .eq('user_id', commitment.user_id);

            if (!subscriptions || subscriptions.length === 0) continue;

            const payload = JSON.stringify({
              title: 'Mentor Broski Reminder 🎯',
              body: commitment.action || commitment.statement,
              icon: '/logo.svg',
              badge: '/logo.svg',
              url: '/',
              commitmentId: commitment.id,
              tag: `commitment-${commitment.id}`,
              timestamp: Date.now()
            });

            for (const sub of subscriptions as PushSubscription[]) {
              try {
                await webpush.default.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                );
                dispatched++;
              } catch (e: any) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                  expiredSubscriptions.push(sub.endpoint);
                  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                } else {
                  failures.push(`${commitment.user_id}: ${e.message}`);
                }
              }
            }
          }
        }
      }

      if (preClaimedMissionIds.length > 0) {
        const { data: claimedMissions } = await supabase
          .from('mission_accountability')
          .select('id, user_id, roadmap_id, day_number, mission_title, reminder_count')
          .in('id', preClaimedMissionIds);

        if (claimedMissions && Array.isArray(claimedMissions)) {
          for (const m of claimedMissions) {
            const { data: subscriptions } = await supabase
              .from('push_subscriptions')
              .select('endpoint, p256dh, auth')
              .eq('user_id', m.user_id);

            if (!subscriptions || subscriptions.length === 0) continue;

            const payload = JSON.stringify({
              title: 'Mentor Broski — Mission Check 🎯',
              body: `Don't break your momentum! Day ${m.day_number} (${m.mission_title}) is waiting for you.`,
              icon: '/logo.svg',
              badge: '/logo.svg',
              url: `/?tab=roadmap&day=${m.day_number}`,
              tag: `mission-accountability-d${m.day_number}`,
              dayNumber: m.day_number,
              roadmapId: m.roadmap_id,
              timestamp: Date.now()
            });

            for (const sub of subscriptions as PushSubscription[]) {
              try {
                await webpush.default.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                );
                dispatched++;
              } catch (e: any) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                  expiredSubscriptions.push(sub.endpoint);
                  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                } else {
                  failures.push(`${m.user_id}: ${e.message}`);
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        dispatched,
        preClaimedCommitments: preClaimedCommitmentIds.length,
        preClaimedMissions: preClaimedMissionIds.length,
        failures: failures.length,
        expiredRemoved: expiredSubscriptions.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Case 1: Direct single notification dispatch (e.g. immediate test or trigger)
    if (reqBody.userId && reqBody.title && reqBody.body) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', reqBody.userId);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: reqBody.title,
          body: reqBody.body,
          icon: reqBody.icon || '/logo.svg',
          badge: reqBody.badge || '/logo.svg',
          url: reqBody.url || '/',
          tag: reqBody.tag || 'mentor-broski-direct',
          timestamp: Date.now()
        });

        for (const sub of subscriptions as PushSubscription[]) {
          try {
            await webpush.default.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              payload
            );
            dispatched++;
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              expiredSubscriptions.push(sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } else {
              failures.push(`${sub.endpoint}: ${e.message}`);
            }
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        dispatched,
        failures: failures.length,
        expiredRemoved: expiredSubscriptions.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Case 2: Batch claim and dispatch due commitment reminders
    const { data: dueReminders } = await supabase.rpc('claim_due_reminders', { p_limit: 20 });
    if (dueReminders && Array.isArray(dueReminders)) {
      for (const reminder of dueReminders) {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', reminder.user_id);

        if (!subscriptions || subscriptions.length === 0) continue;

        const payload = JSON.stringify({
          title: 'Mentor Broski Reminder',
          body: reminder.action || reminder.statement,
          icon: '/logo.svg',
          badge: '/logo.svg',
          url: '/',
          commitmentId: reminder.id,
          tag: `commitment-${reminder.id}`,
          timestamp: Date.now()
        });

        for (const sub of subscriptions as PushSubscription[]) {
          try {
            await webpush.default.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              payload
            );
            dispatched++;
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              expiredSubscriptions.push(sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } else {
              failures.push(`${reminder.user_id}: ${e.message}`);
            }
          }
        }
      }
    }

    // Case 3: Batch claim and dispatch unfinished mission accountability reminders
    const { data: missionReminders } = await supabase.rpc('claim_unfinished_mission_reminders', { p_limit: 20 });
    if (missionReminders && Array.isArray(missionReminders)) {
      for (const mReminder of missionReminders) {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', mReminder.user_id);

        if (!subscriptions || subscriptions.length === 0) continue;

        const payload = JSON.stringify({
          title: mReminder.notification_title || 'Mentor Broski — Mission Check',
          body: mReminder.notification_body,
          icon: '/logo.svg',
          badge: '/logo.svg',
          url: `/?tab=roadmap&day=${mReminder.day_number}`,
          tag: `mission-accountability-d${mReminder.day_number}`,
          dayNumber: mReminder.day_number,
          roadmapId: mReminder.roadmap_id,
          timestamp: Date.now()
        });

        for (const sub of subscriptions as PushSubscription[]) {
          try {
            await webpush.default.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              payload
            );
            dispatched++;
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              expiredSubscriptions.push(sub.endpoint);
              await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            } else {
              failures.push(`${mReminder.user_id}: ${e.message}`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dispatched,
      processedCommitments: dueReminders ? dueReminders.length : 0,
      processedMissions: missionReminders ? missionReminders.length : 0,
      failures: failures.length,
      expiredRemoved: expiredSubscriptions.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

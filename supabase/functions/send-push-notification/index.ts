// Supabase Edge Function to send push notifications
// Triggered when a new notification is created in the database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import webpush from 'npm:web-push@3.6.6';

const VAPID_PUBLIC_KEY = Deno.env.get('VITE_VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:noreply@tennisrace.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse the webhook payload
    const { record } = await req.json();

    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing notification:', record.id, 'for user:', record.user_id);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', record.user_id);
      return new Response(JSON.stringify({ message: 'No subscriptions' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check user's notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', record.user_id)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('Error fetching preferences:', prefsError);
    }

    // If push notifications are disabled, skip
    if (prefs && !prefs.push_enabled) {
      console.log('Push notifications disabled for user:', record.user_id);
      return new Response(JSON.stringify({ message: 'Push disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this notification type is enabled
    const notificationType = record.type;
    if (prefs) {
      // Map notification types to preference fields
      const typePrefsMap: Record<string, string> = {
        challenge_received: 'challenge_received',
        challenge_accepted: 'challenge_accepted',
        challenge_declined: 'challenge_declined',
        match_scheduled: 'match_scheduled',
        match_time_changed: 'match_time_changed',
        match_result_submitted: 'result_submitted',
        match_result_confirmed: 'result_confirmed',
        match_result_disputed: 'result_disputed',
        match_deleted: 'match_deleted',
        ranking_changed: 'ranking_changed',
      };

      const prefKey = typePrefsMap[notificationType];
      if (prefKey && !prefs[prefKey]) {
        console.log(`Notification type ${notificationType} disabled for user:`, record.user_id);
        return new Response(
          JSON.stringify({ message: `Type ${notificationType} disabled` }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Prepare notification payload
    const notificationPayload = {
      title: record.title || 'Tennis Race',
      body: record.message,
      icon: '/tennis-icon.png',
      badge: '/tennis-icon.png',
      tag: `notification-${record.id}`,
      data: {
        notificationId: record.id,
        type: record.type,
        url: '/',
      },
      requireInteraction: false,
    };

    // Send to all user's subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          // Construct subscription object in the format web-push expects
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(notificationPayload)
          );

          // Update last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);

          return { success: true, subscriptionId: sub.id };
        } catch (error: any) {
          console.error('Error sending to subscription:', sub.id, error);

          // If subscription is invalid/expired (410 Gone or 404 Not Found), delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('Removing expired subscription:', sub.id);
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }

          return { success: false, error: String(error), subscriptionId: sub.id };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;

    console.log(`Sent push to ${successCount}/${subscriptions.length} subscriptions`);

    return new Response(
      JSON.stringify({
        message: 'Push notifications sent',
        sent: successCount,
        total: subscriptions.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

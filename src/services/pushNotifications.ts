// Push Notifications Service
// Handles registration, subscription, and unsubscription of push notifications

import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('❌ Service Workers are not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return null;
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('❌ Notifications are not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('🔔 Notification permission:', permission);
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    // Check if VAPID key is available
    if (!VAPID_PUBLIC_KEY) {
      console.error('❌ VAPID public key not configured');
      throw new Error('VAPID public key not configured');
    }

    console.log('🔑 VAPID key available:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');

    // 1. Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      throw new Error('Service Worker registration failed');
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready');

    // 2. Request permission
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ Notification permission denied');
      throw new Error('Notification permission denied');
    }

    // 3. Subscribe to push
    console.log('📱 Attempting to subscribe to push...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('✅ Push subscription created:', subscription);

    // 4. Save subscription to database
    const subscriptionData = JSON.parse(JSON.stringify(subscription));

    console.log('💾 Saving subscription to database:', {
      user_id: userId,
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys.p256dh,
      auth: subscriptionData.keys.auth,
    });

    // First, delete any existing subscription for this user
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    // Then insert the new one
    const { error } = await supabase.from('push_subscriptions').insert({
      user_id: userId,
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys.p256dh,
      auth: subscriptionData.keys.auth,
      user_agent: navigator.userAgent,
    });

    if (error) {
      console.error('❌ Error saving subscription:', error);
      return false;
    }

    console.log('✅ Subscription saved to database');
    return true;
  } catch (error) {
    console.error('❌ Error subscribing to push:', error);
    return false;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return true; // Already unsubscribed
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('✅ Push subscription removed');
    }

    // Remove from database
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error removing subscription from database:', error);
      return false;
    }

    console.log('✅ Subscription removed from database');
    return true;
  } catch (error) {
    console.error('❌ Error unsubscribing from push:', error);
    return false;
  }
}

// Check if user is subscribed
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('❌ Error checking subscription:', error);
    return false;
  }
}

// Get current push subscription
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;

    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('❌ Error getting subscription:', error);
    return null;
  }
}

/**
 * Web Push Notification Service
 * 
 * Implements the Web Push API for real-time notifications to user devices.
 * Uses VAPID (Voluntary Application Server Identification) for authentication.
 * 
 * Setup Instructions:
 * 1. Generate VAPID keys: npx web-push generate-vapid-keys
 * 2. Add to .env:
 *    VAPID_PUBLIC_KEY=your_public_key
 *    VAPID_PRIVATE_KEY=your_private_key
 *    VAPID_SUBJECT=mailto:your-email@example.com
 */

import webpush from "web-push";
import { db } from "./db";
import { pushSubscriptions, type PushSubscription } from "../shared/schema";
import { eq, and } from "drizzle-orm";

// ===========================================
// VAPID CONFIGURATION
// ===========================================

// Environment variables for VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@commerzio.online";

// Flag to check if push is properly configured
let isPushConfigured = false;

/**
 * Initializes the Web Push service with VAPID credentials
 * Call this on server startup
 */
export function initializePushService(): boolean {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[Push Service] VAPID keys not configured. Push notifications disabled.");
    console.warn("[Push Service] To enable, run: npx web-push generate-vapid-keys");
    console.warn("[Push Service] Then add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to .env");
    return false;
  }

  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    
    isPushConfigured = true;
    console.log("[Push Service] Initialized successfully with VAPID credentials");
    return true;
  } catch (error) {
    console.error("[Push Service] Failed to initialize:", error);
    return false;
  }
}

/**
 * Returns whether push notifications are properly configured
 */
export function isPushEnabled(): boolean {
  return isPushConfigured;
}

/**
 * Returns the public VAPID key for client-side subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

// ===========================================
// SUBSCRIPTION MANAGEMENT
// ===========================================

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Registers a new push subscription for a user
 */
export async function registerPushSubscription(
  userId: string,
  subscription: SubscriptionData,
  deviceInfo?: {
    userAgent?: string;
    deviceName?: string;
    deviceType?: "desktop" | "mobile" | "tablet";
  }
): Promise<PushSubscription> {
  try {
    // Check if subscription already exists
    const [existing] = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    if (existing) {
      // Update existing subscription
      const [updated] = await db.update(pushSubscriptions)
        .set({
          userId, // Update user in case of re-subscription
          p256dhKey: subscription.keys.p256dh,
          authKey: subscription.keys.auth,
          userAgent: deviceInfo?.userAgent,
          deviceName: deviceInfo?.deviceName,
          deviceType: deviceInfo?.deviceType,
          isActive: true,
          failedAttempts: 0,
          lastFailureReason: null,
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id))
        .returning();

      console.log(`[Push Service] Updated subscription ${updated.id} for user ${userId}`);
      return updated;
    }

    // Create new subscription
    const [created] = await db.insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent: deviceInfo?.userAgent,
        deviceName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
      })
      .returning();

    console.log(`[Push Service] Created subscription ${created.id} for user ${userId}`);
    return created;
  } catch (error) {
    console.error("[Push Service] Failed to register subscription:", error);
    throw error;
  }
}

/**
 * Removes a push subscription
 */
export async function unregisterPushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    const result = await db.delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ))
      .returning();

    console.log(`[Push Service] Removed ${result.length} subscription(s) for user ${userId}`);
    return result.length > 0;
  } catch (error) {
    console.error("[Push Service] Failed to unregister subscription:", error);
    return false;
  }
}

/**
 * Gets all active subscriptions for a user
 */
export async function getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
  try {
    return await db.select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));
  } catch (error) {
    console.error("[Push Service] Failed to get subscriptions:", error);
    return [];
  }
}

// ===========================================
// PUSH NOTIFICATION SENDING
// ===========================================

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

/**
 * Sends a push notification to a specific subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured) {
    console.warn("[Push Service] Push not configured, skipping notification");
    return false;
  }

  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dhKey,
        auth: subscription.authKey,
      },
    };

    const result = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour time-to-live
        urgency: "normal",
      }
    );

    // Update last used timestamp
    await db.update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.id, subscription.id));

    console.log(`[Push Service] Sent notification to subscription ${subscription.id}`);
    return true;
  } catch (error: any) {
    console.error(`[Push Service] Failed to send to ${subscription.id}:`, error);

    // Handle specific error codes
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or invalid - deactivate it
      await db.update(pushSubscriptions)
        .set({ 
          isActive: false,
          lastFailureReason: "Subscription expired or invalid",
        })
        .where(eq(pushSubscriptions.id, subscription.id));
      console.log(`[Push Service] Deactivated expired subscription ${subscription.id}`);
    }

    throw error;
  }
}

/**
 * Sends a push notification to all of a user's devices
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const subscriptions = await getUserSubscriptions(userId);
  
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === "fulfilled" && r.value).length;
  const failed = results.filter(r => r.status === "rejected" || !r.value).length;

  return { sent, failed };
}

/**
 * Sends a push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const { sent, failed } = await sendPushToUser(userId, payload);
    totalSent += sent;
    totalFailed += failed;
  }

  return { totalSent, totalFailed };
}

// ===========================================
// ADMIN FUNCTIONS
// ===========================================

/**
 * Broadcasts a push notification to all users (admin only)
 */
export async function broadcastPush(payload: PushPayload): Promise<{ totalSent: number; totalFailed: number }> {
  if (!isPushConfigured) {
    console.warn("[Push Service] Push not configured, skipping broadcast");
    return { totalSent: 0, totalFailed: 0 };
  }

  try {
    const allSubscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));

    const results = await Promise.allSettled(
      allSubscriptions.map(sub => sendPushNotification(sub, payload))
    );

    const totalSent = results.filter(r => r.status === "fulfilled" && r.value).length;
    const totalFailed = results.filter(r => r.status === "rejected" || !r.value).length;

    console.log(`[Push Service] Broadcast complete: ${totalSent} sent, ${totalFailed} failed`);
    return { totalSent, totalFailed };
  } catch (error) {
    console.error("[Push Service] Broadcast failed:", error);
    return { totalSent: 0, totalFailed: 0 };
  }
}

/**
 * Cleans up inactive subscriptions (run periodically)
 */
export async function cleanupInactiveSubscriptions(daysInactive: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    // Note: This is a simplified cleanup. In production, you might want
    // to first try sending a test notification before deleting.
    const result = await db.delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.isActive, false),
      ))
      .returning();

    console.log(`[Push Service] Cleaned up ${result.length} inactive subscriptions`);
    return result.length;
  } catch (error) {
    console.error("[Push Service] Cleanup failed:", error);
    return 0;
  }
}


/**
 * Notification Service
 * 
 * Handles all notification-related operations including:
 * - Creating and storing notifications
 * - Managing notification preferences
 * - Sending notifications via different channels (in-app, email, push)
 * - AI-powered prioritization
 */

import { db } from "./db";
import { 
  notifications, 
  notificationPreferences, 
  pushSubscriptions,
  users,
  type InsertNotification,
  type Notification,
  type NotificationPreferences,
  type NotificationType,
  NOTIFICATION_TYPES
} from "../shared/schema";
import { eq, and, desc, sql, lt, isNull, or } from "drizzle-orm";
import { sendEmail } from "./emailService";
import { sendPushNotification } from "./pushService";
import { prioritizeNotification } from "./aiNotificationService";

// ===========================================
// NOTIFICATION CREATION
// ===========================================

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
  skipAIPrioritization?: boolean;
}

/**
 * Creates a notification and handles delivery based on user preferences
 * Uses AI to determine priority if not skipped
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
  try {
    const {
      userId,
      type,
      title,
      message,
      icon,
      relatedEntityType,
      relatedEntityId,
      actionUrl,
      metadata = {},
      expiresAt,
      skipAIPrioritization = false,
    } = params;

    // Get user preferences
    const preferences = await getNotificationPreferences(userId);
    
    // Check if notifications are enabled globally
    if (!preferences.notificationsEnabled) {
      console.log(`[Notification] Skipped: User ${userId} has notifications disabled`);
      return null;
    }

    // Check if this specific type is enabled
    const typeSettings = (preferences.typeSettings as Record<string, { in_app: boolean; email: boolean; push: boolean }>)[type];
    if (!typeSettings) {
      console.log(`[Notification] Skipped: Type ${type} not found in preferences`);
      return null;
    }

    // Determine which channels to use
    const shouldSendInApp = preferences.inAppEnabled && typeSettings.in_app;
    const shouldSendEmail = preferences.emailEnabled && typeSettings.email;
    const shouldSendPush = preferences.pushEnabled && typeSettings.push;

    if (!shouldSendInApp && !shouldSendEmail && !shouldSendPush) {
      console.log(`[Notification] Skipped: All channels disabled for type ${type}`);
      return null;
    }

    // Check quiet hours
    if (isInQuietHours(preferences)) {
      // During quiet hours, only create in-app notification (no push/email)
      console.log(`[Notification] Quiet hours active for user ${userId}`);
    }

    // AI Prioritization
    let priority = 5;
    let aiRelevanceScore = 0.5;
    let aiReasoning = "";

    if (!skipAIPrioritization) {
      try {
        const aiResult = await prioritizeNotification({
          userId,
          notificationType: type,
          title,
          message,
          metadata,
        });
        priority = aiResult.priority;
        aiRelevanceScore = aiResult.relevanceScore;
        aiReasoning = aiResult.reasoning;
      } catch (error) {
        console.error("[Notification] AI prioritization failed, using defaults:", error);
      }
    }

    // Create the notification
    const deliveredVia: string[] = [];
    if (shouldSendInApp) deliveredVia.push("in_app");

    const [notification] = await db.insert(notifications).values({
      userId,
      type,
      title,
      message,
      icon: icon || getDefaultIcon(type),
      relatedEntityType,
      relatedEntityId,
      actionUrl,
      priority,
      aiRelevanceScore: aiRelevanceScore.toString(),
      aiReasoning,
      metadata,
      deliveredVia,
      expiresAt,
    }).returning();

    console.log(`[Notification] Created notification ${notification.id} for user ${userId} (type: ${type}, priority: ${priority})`);

    // Send via other channels (async, don't wait)
    if (!isInQuietHours(preferences)) {
      if (shouldSendEmail) {
        sendNotificationEmail(userId, notification).catch(err => 
          console.error("[Notification] Email send failed:", err)
        );
      }

      if (shouldSendPush) {
        sendNotificationPush(userId, notification).catch(err => 
          console.error("[Notification] Push send failed:", err)
        );
      }
    }

    return notification;
  } catch (error) {
    console.error("[Notification] Failed to create notification:", error);
    throw error;
  }
}

/**
 * Gets default icon based on notification type
 */
function getDefaultIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    message: "message-circle",
    booking: "calendar",
    referral: "users",
    service: "briefcase",
    payment: "credit-card",
    system: "bell",
    review: "star",
    promotion: "gift",
  };
  return icons[type] || "bell";
}

/**
 * Checks if current time is within user's quiet hours
 */
function isInQuietHours(preferences: NotificationPreferences): boolean {
  if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }

  try {
    const now = new Date();
    const timezone = preferences.quietHoursTimezone || "UTC";
    
    // Get current time in user's timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now);

    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    
    return currentTime >= start && currentTime < end;
  } catch (error) {
    console.error("[Notification] Error checking quiet hours:", error);
    return false;
  }
}

// ===========================================
// NOTIFICATION RETRIEVAL
// ===========================================

interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
}

/**
 * Gets notifications for a user with optional filtering
 */
export async function getNotifications(
  userId: string, 
  options: GetNotificationsOptions = {}
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false, types } = options;

  try {
    // Build conditions
    const conditions = [
      eq(notifications.userId, userId),
      eq(notifications.isDismissed, false),
      or(
        isNull(notifications.expiresAt),
        sql`${notifications.expiresAt} > NOW()`
      ),
    ];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (types && types.length > 0) {
      conditions.push(sql`${notifications.type} = ANY(${types})`);
    }

    // Get notifications with pagination
    const result = await db.select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.priority), desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count: total }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions));

    // Get unread count
    const [{ count: unreadCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        eq(notifications.isDismissed, false),
        or(
          isNull(notifications.expiresAt),
          sql`${notifications.expiresAt} > NOW()`
        ),
      ));

    return { notifications: result, total, unreadCount };
  } catch (error) {
    console.error("[Notification] Failed to get notifications:", error);
    throw error;
  }
}

/**
 * Gets unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        eq(notifications.isDismissed, false),
        or(
          isNull(notifications.expiresAt),
          sql`${notifications.expiresAt} > NOW()`
        ),
      ));
    return count;
  } catch (error) {
    console.error("[Notification] Failed to get unread count:", error);
    return 0;
  }
}

// ===========================================
// NOTIFICATION STATUS UPDATES
// ===========================================

/**
 * Marks a notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const result = await db.update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error("[Notification] Failed to mark as read:", error);
    return false;
  }
}

/**
 * Marks all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<number> {
  try {
    const result = await db.update(notifications)
      .set({ 
        isRead: true, 
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .returning();

    return result.length;
  } catch (error) {
    console.error("[Notification] Failed to mark all as read:", error);
    return 0;
  }
}

/**
 * Dismisses a notification (soft delete)
 */
export async function dismissNotification(notificationId: string, userId: string): Promise<boolean> {
  try {
    const result = await db.update(notifications)
      .set({ isDismissed: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error("[Notification] Failed to dismiss notification:", error);
    return false;
  }
}

/**
 * Clears all notifications for a user
 */
export async function clearAllNotifications(userId: string): Promise<number> {
  try {
    const result = await db.update(notifications)
      .set({ isDismissed: true })
      .where(eq(notifications.userId, userId))
      .returning();

    return result.length;
  } catch (error) {
    console.error("[Notification] Failed to clear notifications:", error);
    return 0;
  }
}

// ===========================================
// NOTIFICATION PREFERENCES
// ===========================================

/**
 * Gets notification preferences for a user
 * Creates default preferences if none exist
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const [existing] = await db.select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    if (existing) {
      return existing;
    }

    // Create default preferences
    const [created] = await db.insert(notificationPreferences)
      .values({ userId })
      .returning();

    return created;
  } catch (error) {
    console.error("[Notification] Failed to get preferences:", error);
    // Return default preferences on error
    return {
      id: "",
      userId,
      notificationsEnabled: true,
      inAppEnabled: true,
      emailEnabled: true,
      pushEnabled: false,
      typeSettings: {
        message: { in_app: true, email: true, push: true },
        booking: { in_app: true, email: true, push: true },
        referral: { in_app: true, email: false, push: false },
        service: { in_app: true, email: false, push: false },
        payment: { in_app: true, email: true, push: true },
        system: { in_app: true, email: false, push: false },
        review: { in_app: true, email: true, push: false },
        promotion: { in_app: true, email: false, push: false },
      },
      quietHoursEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: "UTC",
      soundEnabled: true,
      vibrationEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

/**
 * Updates notification preferences for a user
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<NotificationPreferences> {
  try {
    // Ensure preferences exist
    await getNotificationPreferences(userId);

    const [updated] = await db.update(notificationPreferences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    return updated;
  } catch (error) {
    console.error("[Notification] Failed to update preferences:", error);
    throw error;
  }
}

// ===========================================
// EMAIL NOTIFICATIONS
// ===========================================

/**
 * Sends notification via email
 */
async function sendNotificationEmail(userId: string, notification: Notification): Promise<void> {
  try {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.email) {
      console.log(`[Notification] No email for user ${userId}`);
      return;
    }

    await sendEmail({
      to: user.email,
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${notification.title}</h2>
          <p style="color: #666; line-height: 1.6;">${notification.message}</p>
          ${notification.actionUrl ? `
            <p style="margin-top: 20px;">
              <a href="${notification.actionUrl}" 
                 style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View Details
              </a>
            </p>
          ` : ""}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
          <p style="color: #999; font-size: 12px;">
            You received this email because of your notification preferences. 
            Update your preferences in your account settings.
          </p>
        </div>
      `,
    });

    // Update notification delivery status
    await db.update(notifications)
      .set({ 
        emailSentAt: new Date(),
        deliveredVia: sql`${notifications.deliveredVia} || '["email"]'::jsonb`,
      })
      .where(eq(notifications.id, notification.id));

    console.log(`[Notification] Email sent for notification ${notification.id}`);
  } catch (error) {
    console.error("[Notification] Email send failed:", error);
    throw error;
  }
}

// ===========================================
// PUSH NOTIFICATIONS
// ===========================================

/**
 * Sends notification via Web Push
 */
async function sendNotificationPush(userId: string, notification: Notification): Promise<void> {
  try {
    // Get active push subscriptions for user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));

    if (subscriptions.length === 0) {
      console.log(`[Notification] No active push subscriptions for user ${userId}`);
      return;
    }

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushNotification(sub, {
        title: notification.title,
        body: notification.message,
        icon: `/icons/${notification.icon || "bell"}.png`,
        badge: "/icons/badge.png",
        data: {
          notificationId: notification.id,
          type: notification.type,
          actionUrl: notification.actionUrl,
        },
      }))
    );

    // Handle failures - deactivate invalid subscriptions
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const subscription = subscriptions[i];
      
      if (result.status === "rejected") {
        console.error(`[Notification] Push failed for subscription ${subscription.id}:`, result.reason);
        
        // Increment failure count
        const newFailCount = subscription.failedAttempts + 1;
        if (newFailCount >= 3) {
          // Deactivate after 3 failures
          await db.update(pushSubscriptions)
            .set({ 
              isActive: false,
              failedAttempts: newFailCount,
              lastFailureReason: String(result.reason),
            })
            .where(eq(pushSubscriptions.id, subscription.id));
        } else {
          await db.update(pushSubscriptions)
            .set({ 
              failedAttempts: newFailCount,
              lastFailureReason: String(result.reason),
            })
            .where(eq(pushSubscriptions.id, subscription.id));
        }
      }
    }

    // Update notification delivery status
    await db.update(notifications)
      .set({ 
        pushSentAt: new Date(),
        deliveredVia: sql`${notifications.deliveredVia} || '["push"]'::jsonb`,
      })
      .where(eq(notifications.id, notification.id));

    console.log(`[Notification] Push sent for notification ${notification.id}`);
  } catch (error) {
    console.error("[Notification] Push send failed:", error);
    throw error;
  }
}

// ===========================================
// HELPER NOTIFICATION CREATORS
// ===========================================

/**
 * Creates a new message notification
 */
export async function notifyNewMessage(
  userId: string, 
  senderName: string, 
  conversationId: string,
  preview: string
): Promise<void> {
  await createNotification({
    userId,
    type: "message",
    title: `New message from ${senderName}`,
    message: preview.length > 100 ? preview.substring(0, 100) + "..." : preview,
    icon: "message-circle",
    relatedEntityType: "conversation",
    relatedEntityId: conversationId,
    actionUrl: `/chat?conversation=${conversationId}`,
  });
}

/**
 * Creates a booking status notification
 */
export async function notifyBookingUpdate(
  userId: string,
  bookingId: string,
  status: string,
  serviceName: string
): Promise<void> {
  const statusMessages: Record<string, { title: string; message: string }> = {
    pending: {
      title: "New Booking Request",
      message: `You have a new booking request for "${serviceName}"`,
    },
    accepted: {
      title: "Booking Confirmed! 🎉",
      message: `Your booking for "${serviceName}" has been confirmed`,
    },
    rejected: {
      title: "Booking Declined",
      message: `Unfortunately, your booking for "${serviceName}" could not be accepted`,
    },
    alternative_proposed: {
      title: "Alternative Time Proposed",
      message: `The vendor has proposed an alternative time for "${serviceName}"`,
    },
    completed: {
      title: "Booking Completed",
      message: `Your booking for "${serviceName}" has been completed. Leave a review!`,
    },
    cancelled: {
      title: "Booking Cancelled",
      message: `A booking for "${serviceName}" has been cancelled`,
    },
  };

  const content = statusMessages[status] || {
    title: "Booking Update",
    message: `Your booking for "${serviceName}" has been updated to ${status}`,
  };

  await createNotification({
    userId,
    type: "booking",
    title: content.title,
    message: content.message,
    icon: "calendar",
    relatedEntityType: "booking",
    relatedEntityId: bookingId,
    actionUrl: `/my-bookings`,
  });
}

/**
 * Creates a referral notification
 */
export async function notifyReferralEvent(
  userId: string,
  eventType: "new_referral" | "commission_earned" | "points_earned",
  details: { referredUserName?: string; amount?: number; points?: number }
): Promise<void> {
  const events: Record<string, { title: string; message: string }> = {
    new_referral: {
      title: "New Referral! 🎉",
      message: `${details.referredUserName} joined using your referral link`,
    },
    commission_earned: {
      title: "Commission Earned! 💰",
      message: `You earned ${details.amount?.toFixed(2)} CHF from a referral purchase`,
    },
    points_earned: {
      title: "Points Earned! ⭐",
      message: `You earned ${details.points} referral points`,
    },
  };

  const content = events[eventType];

  await createNotification({
    userId,
    type: "referral",
    title: content.title,
    message: content.message,
    icon: "users",
    actionUrl: "/profile?tab=referrals",
    metadata: details,
  });
}

/**
 * Creates a payment notification
 */
export async function notifyPayment(
  userId: string,
  eventType: "payment_received" | "payout_sent" | "payment_failed",
  amount: number,
  currency: string = "CHF"
): Promise<void> {
  const events: Record<string, { title: string; message: string }> = {
    payment_received: {
      title: "Payment Received! 💳",
      message: `You received a payment of ${amount.toFixed(2)} ${currency}`,
    },
    payout_sent: {
      title: "Payout Processed 💸",
      message: `Your payout of ${amount.toFixed(2)} ${currency} is on its way`,
    },
    payment_failed: {
      title: "Payment Failed ❌",
      message: `A payment of ${amount.toFixed(2)} ${currency} could not be processed`,
    },
  };

  const content = events[eventType];

  await createNotification({
    userId,
    type: "payment",
    title: content.title,
    message: content.message,
    icon: "credit-card",
    actionUrl: "/profile?tab=orders",
  });
}

/**
 * Creates a service status notification
 */
export async function notifyServiceUpdate(
  userId: string,
  serviceId: string,
  serviceName: string,
  status: "approved" | "featured" | "rejected" | "updated"
): Promise<void> {
  const events: Record<string, { title: string; message: string }> = {
    approved: {
      title: "Service Approved! ✅",
      message: `Your service "${serviceName}" is now live`,
    },
    featured: {
      title: "Service Featured! 🌟",
      message: `Your service "${serviceName}" has been featured`,
    },
    rejected: {
      title: "Service Review Required",
      message: `Your service "${serviceName}" requires modifications`,
    },
    updated: {
      title: "Service Updated",
      message: `Your service "${serviceName}" has been updated`,
    },
  };

  const content = events[status];

  await createNotification({
    userId,
    type: "service",
    title: content.title,
    message: content.message,
    icon: "briefcase",
    relatedEntityType: "service",
    relatedEntityId: serviceId,
    actionUrl: `/service/${serviceId}`,
  });
}

/**
 * Creates a system notification
 */
export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  actionUrl?: string
): Promise<void> {
  await createNotification({
    userId,
    type: "system",
    title,
    message,
    icon: "bell",
    actionUrl,
    skipAIPrioritization: true, // System messages use default priority
  });
}

// ===========================================
// CLEANUP
// ===========================================

/**
 * Deletes expired notifications (run periodically)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  try {
    const result = await db.delete(notifications)
      .where(and(
        lt(notifications.expiresAt, new Date()),
        eq(notifications.isDismissed, true)
      ))
      .returning();

    console.log(`[Notification] Cleaned up ${result.length} expired notifications`);
    return result.length;
  } catch (error) {
    console.error("[Notification] Cleanup failed:", error);
    return 0;
  }
}


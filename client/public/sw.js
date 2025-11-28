/**
 * Service Worker for Push Notifications
 * 
 * Handles:
 * - Push notification display
 * - Notification click events
 * - Background sync
 */

// Service Worker Version
const SW_VERSION = '1.0.0';

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let data = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge.png',
    data: {},
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || {},
        ...payload,
      };
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      // Try to use text if JSON parsing fails
      data.body = event.data.text() || data.body;
    }
  }

  // Show the notification
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    data: data.data,
    tag: data.data?.notificationId || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  if (action === 'dismiss') {
    // Just close, don't open anything
    return;
  }

  // Determine the URL to open
  let urlToOpen = '/';
  
  if (data.actionUrl) {
    urlToOpen = data.actionUrl;
  } else if (data.type) {
    // Type-based routing
    switch (data.type) {
      case 'message':
        urlToOpen = data.conversationId 
          ? `/chat?conversation=${data.conversationId}` 
          : '/chat';
        break;
      case 'booking':
        urlToOpen = '/my-bookings';
        break;
      case 'referral':
        urlToOpen = '/profile?tab=referrals';
        break;
      case 'payment':
        urlToOpen = '/profile?tab=orders';
        break;
      default:
        urlToOpen = '/notifications';
    }
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            // Navigate if needed
            if (client.navigate) {
              return client.navigate(urlToOpen);
            }
            return client;
          }
        }
        // No existing window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );

  // Mark notification as read via API (fire and forget)
  if (data.notificationId) {
    fetch(`/api/notifications/${data.notificationId}/read`, {
      method: 'POST',
      credentials: 'include',
    }).catch((err) => {
      console.error('[Service Worker] Failed to mark notification as read:', err);
    });
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event);
});

// Service Worker installation
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version:', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Service Worker activation
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated version:', SW_VERSION);
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


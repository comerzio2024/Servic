/**
 * NotificationBell Component
 * 
 * Displays a bell icon in the header with unread notification count badge.
 * Clicking opens a dropdown with recent notifications.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, X, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  priority: number;
  createdAt: string;
  metadata: Record<string, any>;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// Icon mapping for notification types
const typeIcons: Record<string, string> = {
  message: "💬",
  booking: "📅",
  referral: "👥",
  service: "💼",
  payment: "💳",
  system: "🔔",
  review: "⭐",
  promotion: "🎁",
};

// Color mapping for notification types
const typeColors: Record<string, string> = {
  message: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  booking: "bg-green-500/10 text-green-500 border-green-500/20",
  referral: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  service: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  payment: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  system: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  promotion: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const bellRef = useRef<HTMLButtonElement>(null);

  // Fetch unread count (polled frequently)
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent notifications
  const { data: notificationsData, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications", { limit: 10 }],
    enabled: open, // Only fetch when dropdown is open
  });

  const unreadCount = unreadData?.count || 0;
  const notifications = notificationsData?.notifications || [];

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markReadMutation.mutateAsync(notification.id);
    }
    
    if (notification.actionUrl) {
      setOpen(false);
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={bellRef}
          variant="ghost"
          size="icon"
          className="relative hover:bg-accent"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-xs font-bold bg-red-500 text-white border-0 animate-pulse"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[380px] p-0 shadow-xl border-2" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs">We'll let you know when something happens</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "group relative p-4 transition-colors cursor-pointer",
                    notification.isRead 
                      ? "bg-background hover:bg-accent/50" 
                      : "bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/30"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    {/* Type Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border",
                      typeColors[notification.type] || typeColors.system
                    )}>
                      {typeIcons[notification.type] || "🔔"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm font-medium leading-tight",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate(notification.id);
                        }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissMutation.mutate(notification.id);
                      }}
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setOpen(false);
              window.location.href = "/notifications";
            }}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;


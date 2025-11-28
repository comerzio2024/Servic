/**
 * Notifications Page
 * 
 * Full-page view of all user notifications with filtering,
 * search, and management capabilities.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  X, 
  Filter, 
  Search,
  Loader2,
  Trash2,
  Settings,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "wouter";

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

// Type info
const typeInfo: Record<string, { label: string; icon: string; color: string }> = {
  message: { label: "Messages", icon: "💬", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  booking: { label: "Bookings", icon: "📅", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  referral: { label: "Referrals", icon: "👥", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  service: { label: "Services", icon: "💼", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  payment: { label: "Payments", icon: "💳", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  system: { label: "System", icon: "🔔", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300" },
  review: { label: "Reviews", icon: "⭐", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  promotion: { label: "Promotions", icon: "🎁", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications", { 
      limit: 50, 
      unreadOnly: activeTab === "unread",
      types: filterType !== "all" ? filterType : undefined,
    }],
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Filter by search query
  const filteredNotifications = notifications.filter(n => 
    searchQuery === "" || 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = format(new Date(notification.createdAt), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
    
    let groupKey: string;
    if (date === today) groupKey = "Today";
    else if (date === yesterday) groupKey = "Yesterday";
    else groupKey = format(new Date(notification.createdAt), "MMMM d, yyyy");
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/dismiss`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/clear-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Bell className="h-8 w-8 text-indigo-600" />
                Notifications
              </h1>
              <p className="text-muted-foreground mt-1">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/profile?tab=notifications">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => markAllReadMutation.mutate()}>
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => clearAllMutation.mutate()}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(typeInfo).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      {info.icon} {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All
              <Badge variant="secondary">{data?.total || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-2">
              Unread
              {unreadCount > 0 && (
                <Badge className="bg-indigo-500 text-white">{unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {activeTab === "unread" ? "All caught up!" : "No notifications yet"}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    {activeTab === "unread" 
                      ? "You've read all your notifications. Great job staying on top of things!"
                      : "When you get notifications, they'll show up here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedNotifications).map(([date, notifs]) => (
                  <div key={date}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950 py-2 z-10">
                      {date}
                    </h3>
                    <div className="space-y-2">
                      {notifs.map((notification) => {
                        const info = typeInfo[notification.type] || typeInfo.system;
                        
                        return (
                          <Card 
                            key={notification.id}
                            className={cn(
                              "transition-all cursor-pointer hover:shadow-md",
                              !notification.isRead && "border-l-4 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                            )}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                {/* Type Badge */}
                                <div className={cn(
                                  "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                                  info.color
                                )}>
                                  {info.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className={cn(
                                        "font-medium",
                                        !notification.isRead && "font-semibold"
                                      )}>
                                        {notification.title}
                                      </p>
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        {info.label}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                    {notification.message}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 flex flex-col gap-1">
                                  {!notification.isRead && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markReadMutation.mutate(notification.id);
                                      }}
                                      title="Mark as read"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dismissMutation.mutate(notification.id);
                                    }}
                                    title="Dismiss"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


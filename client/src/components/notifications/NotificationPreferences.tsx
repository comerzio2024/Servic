/**
 * NotificationPreferences Component
 * 
 * User interface for managing notification settings including:
 * - Global notification toggle
 * - Per-channel toggles (in-app, email, push)
 * - Per-type settings
 * - Quiet hours configuration
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Monitor,
  Moon,
  Volume2,
  Vibrate,
  Settings,
  Loader2,
  Info,
  AlertTriangle,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NotificationTypeSettings {
  in_app: boolean;
  email: boolean;
  push: boolean;
}

interface NotificationPreferences {
  id: string;
  userId: string;
  notificationsEnabled: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  typeSettings: Record<string, NotificationTypeSettings>;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string | null;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

// Notification type descriptions
const notificationTypeInfo: Record<string, { label: string; description: string; icon: string }> = {
  message: {
    label: "Messages",
    description: "Chat messages from vendors or customers",
    icon: "💬",
  },
  booking: {
    label: "Bookings",
    description: "Booking confirmations, updates, and reminders",
    icon: "📅",
  },
  referral: {
    label: "Referrals",
    description: "Referral rewards and new sign-ups",
    icon: "👥",
  },
  service: {
    label: "Services",
    description: "Service approval and status updates",
    icon: "💼",
  },
  payment: {
    label: "Payments",
    description: "Payment receipts and payout notifications",
    icon: "💳",
  },
  system: {
    label: "System",
    description: "Platform updates and announcements",
    icon: "🔔",
  },
  review: {
    label: "Reviews",
    description: "New reviews on your services",
    icon: "⭐",
  },
  promotion: {
    label: "Promotions",
    description: "Special offers and promotional content",
    icon: "🎁",
  },
};

// Common timezones
const timezones = [
  { value: "Europe/Zurich", label: "Zurich (CET)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "America/New_York", label: "New York (EST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "UTC", label: "UTC" },
];

export function NotificationPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Partial<NotificationPreferences>>({});
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // Check push notification support
  useEffect(() => {
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Fetch preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
  });

  // Fetch push status
  const { data: pushStatus } = useQuery<{ enabled: boolean; publicKey?: string }>({
    queryKey: ["/api/push/vapid-key"],
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      setPendingChanges({});
      toast({
        title: "Preferences saved",
        description: "Your notification settings have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Request push permission
  const requestPushPermission = async () => {
    if (!pushSupported) return;

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted" && pushStatus?.publicKey) {
        // Register service worker and subscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: pushStatus.publicKey,
        });

        // Send subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceInfo: {
              userAgent: navigator.userAgent,
              deviceName: getDeviceName(),
              deviceType: getDeviceType(),
            },
          }),
        });

        toast({
          title: "Push notifications enabled",
          description: "You'll receive notifications on this device",
        });

        queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      }
    } catch (error) {
      console.error("Push permission error:", error);
      toast({
        title: "Error",
        description: "Could not enable push notifications",
        variant: "destructive",
      });
    }
  };

  // Helper to detect device type
  const getDeviceType = (): "desktop" | "mobile" | "tablet" => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return "mobile";
    }
    return "desktop";
  };

  // Helper to get device name
  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Chrome")) return "Chrome Browser";
    if (ua.includes("Firefox")) return "Firefox Browser";
    if (ua.includes("Safari")) return "Safari Browser";
    if (ua.includes("Edge")) return "Edge Browser";
    return "Unknown Browser";
  };

  // Handle toggle change
  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    const updates = { ...pendingChanges, [key]: value };
    setPendingChanges(updates);
    updateMutation.mutate(updates);
  };

  // Handle type settings change
  const handleTypeSettingChange = (
    type: string, 
    channel: "in_app" | "email" | "push", 
    value: boolean
  ) => {
    if (!preferences) return;

    const newTypeSettings = {
      ...preferences.typeSettings,
      [type]: {
        ...(preferences.typeSettings[type] || { in_app: true, email: true, push: false }),
        [channel]: value,
      },
    };

    updateMutation.mutate({ typeSettings: newTypeSettings });
  };

  // Handle quiet hours change
  const handleQuietHoursChange = (field: string, value: string | boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Could not load preferences</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Global Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Control how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="notifications-enabled" className="text-base font-medium">
                    Enable Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Master switch for all notifications
                  </p>
                </div>
              </div>
              <Switch
                id="notifications-enabled"
                checked={preferences.notificationsEnabled}
                onCheckedChange={(v) => handleToggle("notificationsEnabled", v)}
                disabled={updateMutation.isPending}
              />
            </div>

            <Separator />

            {/* Delivery Methods */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Delivery Methods
              </h4>
              
              <div className="grid gap-4 md:grid-cols-3">
                {/* In-App */}
                <div className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-colors",
                  preferences.inAppEnabled ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" : "bg-muted/50"
                )}>
                  <div className="flex items-center gap-3">
                    <Monitor className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <Label htmlFor="in-app-enabled" className="font-medium">In-App</Label>
                      <p className="text-xs text-muted-foreground">Browser notifications</p>
                    </div>
                  </div>
                  <Switch
                    id="in-app-enabled"
                    checked={preferences.inAppEnabled}
                    onCheckedChange={(v) => handleToggle("inAppEnabled", v)}
                    disabled={!preferences.notificationsEnabled || updateMutation.isPending}
                  />
                </div>

                {/* Email */}
                <div className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-colors",
                  preferences.emailEnabled ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900" : "bg-muted/50"
                )}>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <Label htmlFor="email-enabled" className="font-medium">Email</Label>
                      <p className="text-xs text-muted-foreground">Email notifications</p>
                    </div>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={preferences.emailEnabled}
                    onCheckedChange={(v) => handleToggle("emailEnabled", v)}
                    disabled={!preferences.notificationsEnabled || updateMutation.isPending}
                  />
                </div>

                {/* Push */}
                <div className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-colors",
                  preferences.pushEnabled ? "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900" : "bg-muted/50"
                )}>
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <Label htmlFor="push-enabled" className="font-medium">Push</Label>
                      <p className="text-xs text-muted-foreground">Device notifications</p>
                    </div>
                  </div>
                  {pushSupported && pushStatus?.enabled ? (
                    pushPermission === "granted" ? (
                      <Switch
                        id="push-enabled"
                        checked={preferences.pushEnabled}
                        onCheckedChange={(v) => handleToggle("pushEnabled", v)}
                        disabled={!preferences.notificationsEnabled || updateMutation.isPending}
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={requestPushPermission}
                        disabled={pushPermission === "denied"}
                      >
                        {pushPermission === "denied" ? "Blocked" : "Enable"}
                      </Button>
                    )
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Push notifications not available
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-Type Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Types</CardTitle>
            <CardDescription>
              Fine-tune notifications for each category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(notificationTypeInfo).map(([type, info]) => {
                const settings = preferences.typeSettings[type] || { in_app: true, email: true, push: false };
                
                return (
                  <AccordionItem key={type} value={type}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{info.icon}</span>
                        <div className="text-left">
                          <span className="font-medium">{info.label}</span>
                          <p className="text-xs text-muted-foreground font-normal">
                            {info.description}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-3 gap-4 py-4 pl-10">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">In-App</Label>
                          <Switch
                            checked={settings.in_app}
                            onCheckedChange={(v) => handleTypeSettingChange(type, "in_app", v)}
                            disabled={!preferences.notificationsEnabled || !preferences.inAppEnabled}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Email</Label>
                          <Switch
                            checked={settings.email}
                            onCheckedChange={(v) => handleTypeSettingChange(type, "email", v)}
                            disabled={!preferences.notificationsEnabled || !preferences.emailEnabled}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Push</Label>
                          <Switch
                            checked={settings.push}
                            onCheckedChange={(v) => handleTypeSettingChange(type, "push", v)}
                            disabled={!preferences.notificationsEnabled || !preferences.pushEnabled}
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Quiet Hours
            </CardTitle>
            <CardDescription>
              Pause notifications during specific hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="quiet-hours-enabled" className="font-medium">
                  Enable Quiet Hours
                </Label>
                <p className="text-sm text-muted-foreground">
                  No push or email notifications during this time
                </p>
              </div>
              <Switch
                id="quiet-hours-enabled"
                checked={preferences.quietHoursEnabled}
                onCheckedChange={(v) => handleQuietHoursChange("quietHoursEnabled", v)}
                disabled={updateMutation.isPending}
              />
            </div>

            {preferences.quietHoursEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-accent/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={preferences.quietHoursStart || "22:00"}
                    onChange={(e) => handleQuietHoursChange("quietHoursStart", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={preferences.quietHoursEnd || "08:00"}
                    onChange={(e) => handleQuietHoursChange("quietHoursEnd", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={preferences.quietHoursTimezone || "Europe/Zurich"}
                    onValueChange={(v) => handleQuietHoursChange("quietHoursTimezone", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sound & Vibration */}
        <Card>
          <CardHeader>
            <CardTitle>Sound & Vibration</CardTitle>
            <CardDescription>
              Control notification sounds and haptics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="sound-enabled" className="font-medium">Notification Sound</Label>
                  <p className="text-sm text-muted-foreground">Play sound for new notifications</p>
                </div>
              </div>
              <Switch
                id="sound-enabled"
                checked={preferences.soundEnabled}
                onCheckedChange={(v) => handleToggle("soundEnabled", v)}
                disabled={updateMutation.isPending}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Vibrate className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="vibration-enabled" className="font-medium">Vibration</Label>
                  <p className="text-sm text-muted-foreground">Vibrate for notifications (mobile)</p>
                </div>
              </div>
              <Switch
                id="vibration-enabled"
                checked={preferences.vibrationEnabled}
                onCheckedChange={(v) => handleToggle("vibrationEnabled", v)}
                disabled={updateMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save indicator */}
        {updateMutation.isPending && (
          <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default NotificationPreferences;


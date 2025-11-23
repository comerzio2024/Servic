import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AddressMultiInput } from "@/components/address-multi-input";
import { Shield, Users, FileText, CreditCard, CheckCircle, XCircle, Trash2, Brain, Send, Loader2, Sparkles, BarChart3, Settings, Eye, EyeOff, History, AlertCircle, Plus, Edit, MoreVertical, ChevronDown, ChevronUp, Folder } from "lucide-react";
import type { User, Service, Plan, SubmittedCategory, Category } from "@shared/schema";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ["/api/admin/session"],
    queryFn: () => apiRequest("/api/admin/session"),
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      setIsLoggedIn(true);
      refetchSession();
      toast({
        title: "Success",
        description: "Logged in as admin",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  if (!session?.isAdmin && !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-6 h-6 text-primary" />
              <CardTitle>Admin Login</CardTitle>
            </div>
            <CardDescription>Enter admin credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate(loginForm);
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="admin"
                  data-testid="input-admin-username"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="admin"
                  data-testid="input-admin-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-admin-login">
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">ServeMkt Admin Panel</h1>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                apiRequest("/api/admin/logout", { method: "POST" });
                setIsLoggedIn(false);
                refetchSession();
              }}
              data-testid="button-admin-logout"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <FileText className="w-4 h-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <Folder className="w-4 h-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">
              <CreditCard className="w-4 h-4 mr-2" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" data-testid="tab-ai-assistant">
              <Brain className="w-4 h-4 mr-2" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>

          <TabsContent value="services">
            <ServicesManagement />
          </TabsContent>

          <TabsContent value="categories">
            <CategorySuggestionsManagement />
          </TabsContent>

          <TabsContent value="plans">
            <PlansManagement />
          </TabsContent>

          <TabsContent value="ai-assistant">
            <AIAssistantManagement />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UsersManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [moderationDialog, setModerationDialog] = useState<{ open: boolean; userId: string; action: string } | null>(null);
  const [moderationReason, setModerationReason] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; userId: string } | null>(null);
  const [bannedIdentifiersOpen, setBannedIdentifiersOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("/api/admin/users"),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiRequest("/api/plans"),
  });

  const { data: bannedIdentifiers = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/banned-identifiers"],
    queryFn: () => apiRequest("/api/admin/banned-identifiers"),
    enabled: bannedIdentifiersOpen,
  });

  const { data: moderationHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users", historyDialog?.userId, "history"],
    queryFn: () => apiRequest(`/api/admin/users/${historyDialog?.userId}/history`),
    enabled: !!historyDialog?.userId,
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
  });

  const moderateUserMutation = useMutation({
    mutationFn: ({ userId, action, reason, ipAddress }: { userId: string; action: string; reason: string; ipAddress?: string }) =>
      apiRequest(`/api/admin/users/${userId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason, ipAddress: ipAddress || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banned-identifiers"] });
      setModerationDialog(null);
      setModerationReason("");
      setIpAddress("");
      toast({
        title: "Success",
        description: "User moderation action applied",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to moderate user",
        variant: "destructive",
      });
    },
  });

  const removeBannedIdentifierMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/banned-identifiers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banned-identifiers"] });
      toast({
        title: "Success",
        description: "Banned identifier removed",
      });
    },
  });

  const handleModerateUser = () => {
    if (!moderationDialog || !moderationReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for moderation",
        variant: "destructive",
      });
      return;
    }

    moderateUserMutation.mutate({
      userId: moderationDialog.userId,
      action: moderationDialog.action,
      reason: moderationReason,
      ipAddress: ipAddress,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { variant: any; className: string }> = {
      active: { variant: "secondary", className: "bg-green-100 text-green-700" },
      warned: { variant: "secondary", className: "bg-yellow-100 text-yellow-700" },
      suspended: { variant: "secondary", className: "bg-orange-100 text-orange-700" },
      banned: { variant: "secondary", className: "bg-red-100 text-red-700" },
      kicked: { variant: "secondary", className: "bg-gray-100 text-gray-700" },
    };
    const config = statusColors[status] || statusColors.active;
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage user accounts, roles, plans, and moderation</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell data-testid={`status-${user.id}`}>
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell>
                    {user.isVerified ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Not Verified</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <Badge className="bg-primary">Admin</Badge>
                    ) : (
                      <Badge variant="outline">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.planId || ""}
                      onValueChange={(planId) => updateUserMutation.mutate({ id: user.id, data: { planId } })}
                    >
                      <SelectTrigger className="w-40" data-testid={`select-plan-${user.id}`}>
                        <SelectValue placeholder="No plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateUserMutation.mutate({
                            id: user.id,
                            data: { isAdmin: !user.isAdmin },
                          })
                        }
                        data-testid={`button-toggle-admin-${user.id}`}
                      >
                        {user.isAdmin ? "Remove Admin" : "Make Admin"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-moderate-${user.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => setModerationDialog({ open: true, userId: user.id, action: "warn" })}
                            data-testid={`button-warn-${user.id}`}
                          >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Warn User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setModerationDialog({ open: true, userId: user.id, action: "suspend" })}
                            data-testid={`button-suspend-${user.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Suspend User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setModerationDialog({ open: true, userId: user.id, action: "ban" })}
                            data-testid={`button-ban-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Ban User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setModerationDialog({ open: true, userId: user.id, action: "kick" })}
                            data-testid={`button-kick-${user.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Kick User
                          </DropdownMenuItem>
                          {user.status !== "active" && (
                            <DropdownMenuItem
                              onClick={() => setModerationDialog({ open: true, userId: user.id, action: "reactivate" })}
                              data-testid={`button-reactivate-${user.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Reactivate User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryDialog({ open: true, userId: user.id })}
                        data-testid={`button-history-${user.id}`}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Collapsible open={bannedIdentifiersOpen} onOpenChange={setBannedIdentifiersOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer" data-testid="button-toggle-banned-identifiers">
                <div>
                  <CardTitle>Banned Identifiers</CardTitle>
                  <CardDescription>IP addresses, emails, and phone numbers that are banned</CardDescription>
                </div>
                {bannedIdentifiersOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Banned Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bannedIdentifiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No banned identifiers
                      </TableCell>
                    </TableRow>
                  ) : (
                    bannedIdentifiers.map((identifier: any) => (
                      <TableRow key={identifier.id} data-testid={`row-banned-${identifier.id}`}>
                        <TableCell>{identifier.identifierType}</TableCell>
                        <TableCell>{identifier.identifierValue}</TableCell>
                        <TableCell>{identifier.reason}</TableCell>
                        <TableCell>{new Date(identifier.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeBannedIdentifierMutation.mutate(identifier.id)}
                            data-testid={`button-remove-banned-${identifier.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={moderationDialog?.open || false} onOpenChange={(open) => !open && setModerationDialog(null)}>
        <DialogContent data-testid="dialog-moderation">
          <DialogHeader>
            <DialogTitle>Moderate User</DialogTitle>
            <DialogDescription>
              {moderationDialog?.action === "warn" && "Issue a warning to this user"}
              {moderationDialog?.action === "suspend" && "Temporarily suspend this user's account"}
              {moderationDialog?.action === "ban" && "Permanently ban this user (will track IP, email, and phone)"}
              {moderationDialog?.action === "kick" && "Temporarily block this user"}
              {moderationDialog?.action === "reactivate" && "Reactivate this user's account"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="moderation-reason">Reason (required)</Label>
              <Textarea
                id="moderation-reason"
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="Provide a reason for this moderation action..."
                data-testid="input-moderation-reason"
              />
            </div>
            <div>
              <Label htmlFor="moderation-ip">IP Address (Optional)</Label>
              <Input
                id="moderation-ip"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="e.g., 192.168.1.1 (optional)"
                data-testid="input-moderation-ip"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Enter user's IP address if known. Helps prevent ban circumvention.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModerationDialog(null)}
              data-testid="button-cancel-moderation"
            >
              Cancel
            </Button>
            <Button
              onClick={handleModerateUser}
              disabled={moderateUserMutation.isPending}
              data-testid="button-confirm-moderation"
            >
              {moderateUserMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialog?.open || false} onOpenChange={(open) => !open && setHistoryDialog(null)}>
        <DialogContent className="max-w-3xl" data-testid="dialog-history">
          <DialogHeader>
            <DialogTitle>Moderation History</DialogTitle>
            <DialogDescription>All moderation actions for this user</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moderationHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No moderation history
                    </TableCell>
                  </TableRow>
                ) : (
                  moderationHistory.map((action: any) => (
                    <TableRow key={action.id} data-testid={`row-history-${action.id}`}>
                      <TableCell>{new Date(action.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{action.action}</Badge>
                      </TableCell>
                      <TableCell>{action.reason}</TableCell>
                      <TableCell>{action.adminId || "System"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setHistoryDialog(null)} data-testid="button-close-history">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServicesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [editService, setEditService] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    priceType: "fixed" as "fixed" | "list" | "text",
    price: "",
    priceText: "",
    priceUnit: "job" as "hour" | "job" | "consultation" | "day" | "month",
    locations: "" as string,
    tags: "" as string,
    hashtags: "" as string,
    contactPhone: "",
    contactEmail: "",
    status: "active",
  });

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
    queryFn: () => apiRequest("/api/admin/services"),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/services/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      setServiceToDelete(null);
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/admin/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      setEditService(null);
      resetEditForm();
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service",
        variant: "destructive",
      });
    },
  });

  const resetEditForm = () => {
    setEditForm({
      title: "",
      description: "",
      categoryId: "",
      priceType: "fixed",
      price: "",
      priceText: "",
      priceUnit: "job",
      locations: "",
      tags: "",
      hashtags: "",
      contactPhone: "",
      contactEmail: "",
      status: "active",
    });
  };

  const handleEditClick = (service: any) => {
    setEditService(service);
    setEditForm({
      title: service.title,
      description: service.description,
      categoryId: service.categoryId,
      priceType: service.priceType || "fixed",
      price: service.price?.toString() || "",
      priceText: service.priceText || "",
      priceUnit: service.priceUnit || "job",
      locations: (service.locations || []).join(", "),
      tags: (service.tags || []).join(", "),
      hashtags: (service.hashtags || []).join(", "),
      contactPhone: service.contactPhone || "",
      contactEmail: service.contactEmail || "",
      status: service.status,
    });
  };

  const handleSaveEdit = () => {
    if (!editService) return;
    
    const updateData: any = {};
    if (editForm.title !== editService.title) updateData.title = editForm.title;
    if (editForm.description !== editService.description) updateData.description = editForm.description;
    if (editForm.categoryId !== editService.categoryId) updateData.categoryId = editForm.categoryId;
    if (editForm.priceType !== editService.priceType) updateData.priceType = editForm.priceType;
    if (editForm.priceUnit !== editService.priceUnit) updateData.priceUnit = editForm.priceUnit;
    if (editForm.contactPhone !== editService.contactPhone) updateData.contactPhone = editForm.contactPhone;
    if (editForm.contactEmail !== editService.contactEmail) updateData.contactEmail = editForm.contactEmail;
    if (editForm.status !== editService.status) updateData.status = editForm.status;
    
    if (editForm.priceType === "fixed" && editForm.price !== editService.price?.toString()) {
      updateData.price = parseFloat(editForm.price) || null;
    }
    if (editForm.priceType === "text" && editForm.priceText !== editService.priceText) {
      updateData.priceText = editForm.priceText;
    }
    
    const locationsArray = editForm.locations.split(",").map(l => l.trim()).filter(l => l);
    const tagsArray = editForm.tags.split(",").map(t => t.trim()).filter(t => t);
    const hashtagsArray = editForm.hashtags.split(",").map(h => h.trim()).filter(h => h);
    
    if (JSON.stringify(locationsArray) !== JSON.stringify(editService.locations)) updateData.locations = locationsArray;
    if (JSON.stringify(tagsArray) !== JSON.stringify(editService.tags)) updateData.tags = tagsArray;
    if (JSON.stringify(hashtagsArray) !== JSON.stringify(editService.hashtags)) updateData.hashtags = hashtagsArray;
    
    if (Object.keys(updateData).length === 0) {
      toast({
        title: "No changes",
        description: "Please make changes to update the service",
        variant: "destructive",
      });
      return;
    }

    updateServiceMutation.mutate({
      id: editService.id,
      data: updateData,
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Management</CardTitle>
        <CardDescription>View and edit all user services</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service: any) => (
              <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                <TableCell className="font-medium">{service.title}</TableCell>
                <TableCell>{service.owner?.firstName || "Unknown"}</TableCell>
                <TableCell>
                  <Badge
                    variant={service.status === "active" ? "default" : "secondary"}
                  >
                    {service.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  CHF {service.price || "N/A"}
                </TableCell>
                <TableCell>{service.viewCount}</TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(service)}
                    data-testid={`button-edit-service-${service.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setServiceToDelete(service.id)}
                    data-testid={`button-delete-service-${service.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editService} onOpenChange={() => setEditService(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Edit all details for {editService?.title}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="w-full">
            <div className="space-y-4 pr-4">
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  data-testid="input-edit-service-title"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={4}
                  data-testid="input-edit-service-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-category">Category *</Label>
                  <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({ ...editForm, categoryId: value })}>
                    <SelectTrigger id="edit-category" data-testid="select-edit-service-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-status">Status *</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                    <SelectTrigger id="edit-status" data-testid="select-edit-service-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-price-type">Pricing Type *</Label>
                  <Select value={editForm.priceType} onValueChange={(value: any) => setEditForm({ ...editForm, priceType: value })}>
                    <SelectTrigger id="edit-price-type" data-testid="select-edit-service-price-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="text">Text Price</SelectItem>
                      <SelectItem value="list">Price List</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-price-unit">Price Unit *</Label>
                  <Select value={editForm.priceUnit} onValueChange={(value: any) => setEditForm({ ...editForm, priceUnit: value })}>
                    <SelectTrigger id="edit-price-unit" data-testid="select-edit-service-price-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="job">Job</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editForm.priceType === "fixed" && (
                <div>
                  <Label htmlFor="edit-price">Price (CHF)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    data-testid="input-edit-service-price"
                  />
                </div>
              )}

              {editForm.priceType === "text" && (
                <div>
                  <Label htmlFor="edit-price-text">Price Text</Label>
                  <Input
                    id="edit-price-text"
                    value={editForm.priceText}
                    onChange={(e) => setEditForm({ ...editForm, priceText: e.target.value })}
                    placeholder="e.g., Upon request"
                    data-testid="input-edit-service-price-text"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-contact-phone">Contact Phone *</Label>
                  <Input
                    id="edit-contact-phone"
                    value={editForm.contactPhone}
                    onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                    data-testid="input-edit-service-contact-phone"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-contact-email">Contact Email *</Label>
                  <Input
                    id="edit-contact-email"
                    type="email"
                    value={editForm.contactEmail}
                    onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                    data-testid="input-edit-service-contact-email"
                  />
                </div>
              </div>

              <AddressMultiInput
                label="Service Locations"
                initialAddresses={editForm.locations.split(",").map(l => l.trim()).filter(l => l)}
                onAddressesChange={(addresses) => setEditForm({ ...editForm, locations: addresses.join(", ") })}
              />

              <div>
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="professional, experienced, certified"
                  data-testid="input-edit-service-tags"
                />
              </div>

              <div>
                <Label htmlFor="edit-hashtags">Hashtags (comma-separated, max 3)</Label>
                <Input
                  id="edit-hashtags"
                  value={editForm.hashtags}
                  onChange={(e) => setEditForm({ ...editForm, hashtags: e.target.value })}
                  placeholder="#design #creative #professional"
                  data-testid="input-edit-service-hashtags"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditService(null)} data-testid="button-cancel-edit-service">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateServiceMutation.isPending} data-testid="button-save-edit-service">
              {updateServiceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone and will permanently remove the service from the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-admin-service">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToDelete && deleteServiceMutation.mutate(serviceToDelete)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-admin-service"
            >
              Delete Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function CategorySuggestionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; category?: Category } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    icon: "",
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery<SubmittedCategory[]>({
    queryKey: ["/api/admin/category-suggestions"],
    queryFn: () => apiRequest("/api/admin/category-suggestions"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialog(null);
      resetCategoryForm();
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/admin/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialog(null);
      resetCategoryForm();
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryToDelete(null);
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/admin/category-suggestions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/category-suggestions"] });
      toast({
        title: "Success",
        description: "Category suggestion updated",
      });
    },
  });

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      slug: "",
      icon: "",
    });
  };

  const openCreateDialog = () => {
    resetCategoryForm();
    setCategoryDialog({ open: true });
  };

  const openEditDialog = (category: Category) => {
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      icon: category.icon || "",
    });
    setCategoryDialog({ open: true, category });
  };

  const handleSaveCategory = () => {
    if (categoryDialog?.category) {
      updateCategoryMutation.mutate({ id: categoryDialog.category.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  if (isLoadingCategories || isLoadingSuggestions) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Manage service categories</CardDescription>
            </div>
            <Button onClick={openCreateDialog} data-testid="button-add-category">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.slug}</TableCell>
                  <TableCell>{category.icon || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCategoryToDelete(category.id)}
                        data-testid={`button-delete-category-${category.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category Suggestions</CardTitle>
          <CardDescription>Review and manage user-submitted category suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No category suggestions
                  </TableCell>
                </TableRow>
              ) : (
                suggestions.map((suggestion: any) => (
                  <TableRow key={suggestion.id} data-testid={`row-suggestion-${suggestion.id}`}>
                    <TableCell className="font-medium">{suggestion.name}</TableCell>
                    <TableCell>{suggestion.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          suggestion.status === "approved"
                            ? "default"
                            : suggestion.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {suggestion.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {suggestion.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              updateSuggestionMutation.mutate({
                                id: suggestion.id,
                                status: "approved",
                              })
                            }
                            data-testid={`button-approve-${suggestion.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              updateSuggestionMutation.mutate({
                                id: suggestion.id,
                                status: "rejected",
                              })
                            }
                            data-testid={`button-reject-${suggestion.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={categoryDialog?.open || false} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        <DialogContent data-testid="dialog-category">
          <DialogHeader>
            <DialogTitle>{categoryDialog?.category ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {categoryDialog?.category ? "Update category details" : "Create a new service category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Plumbing"
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="category-slug">Slug</Label>
              <Input
                id="category-slug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="plumbing"
                data-testid="input-category-slug"
              />
            </div>
            <div>
              <Label htmlFor="category-icon">Icon (optional)</Label>
              <Input
                id="category-icon"
                value={categoryForm.icon}
                onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                placeholder="wrench"
                data-testid="input-category-icon"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialog(null)}
              data-testid="button-cancel-category"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              data-testid="button-save-category"
            >
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? Services using this category may be affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => categoryToDelete && deleteCategoryMutation.mutate(categoryToDelete)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlansManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan?: Plan } | null>(null);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    description: "",
    priceMonthly: "",
    priceYearly: "",
    maxImages: "4",
    listingDurationDays: "14",
    canRenew: true,
    featuredListing: false,
    prioritySupport: false,
    analyticsAccess: false,
    customBranding: false,
    isActive: true,
    sortOrder: "0",
  });

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiRequest("/api/plans"),
  });

  const createPlanMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setPlanDialog(null);
      resetPlanForm();
      toast({
        title: "Success",
        description: "Plan created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create plan",
        variant: "destructive",
      });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/admin/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setPlanDialog(null);
      resetPlanForm();
      toast({
        title: "Success",
        description: "Plan updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/plans/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setPlanToDelete(null);
      toast({
        title: "Success",
        description: "Plan deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete plan",
        variant: "destructive",
      });
    },
  });

  const resetPlanForm = () => {
    setPlanForm({
      name: "",
      slug: "",
      description: "",
      priceMonthly: "",
      priceYearly: "",
      maxImages: "4",
      listingDurationDays: "14",
      canRenew: true,
      featuredListing: false,
      prioritySupport: false,
      analyticsAccess: false,
      customBranding: false,
      isActive: true,
      sortOrder: "0",
    });
  };

  const openCreateDialog = () => {
    resetPlanForm();
    setPlanDialog({ open: true });
  };

  const openEditDialog = (plan: Plan) => {
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      maxImages: String(plan.maxImages),
      listingDurationDays: String(plan.listingDurationDays),
      canRenew: plan.canRenew,
      featuredListing: plan.featuredListing,
      prioritySupport: plan.prioritySupport,
      analyticsAccess: plan.analyticsAccess,
      customBranding: plan.customBranding,
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
    });
    setPlanDialog({ open: true, plan });
  };

  const handleSavePlan = () => {
    const data = {
      ...planForm,
      maxImages: parseInt(planForm.maxImages),
      listingDurationDays: parseInt(planForm.listingDurationDays),
      sortOrder: parseInt(planForm.sortOrder),
    };

    if (planDialog?.plan) {
      updatePlanMutation.mutate({ id: planDialog.plan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Plan Management</CardTitle>
            <CardDescription>Create, view, and manage subscription plans</CardDescription>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-plan">
            <Plus className="w-4 h-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price (Monthly)</TableHead>
              <TableHead>Max Images</TableHead>
              <TableHead>Listing Duration</TableHead>
              <TableHead>Features</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>CHF {plan.priceMonthly}</TableCell>
                <TableCell>{plan.maxImages}</TableCell>
                <TableCell>{plan.listingDurationDays} days</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {plan.featuredListing && <Badge variant="secondary">Featured</Badge>}
                    {plan.prioritySupport && <Badge variant="secondary">Priority Support</Badge>}
                    {plan.analyticsAccess && <Badge variant="secondary">Analytics</Badge>}
                    {plan.customBranding && <Badge variant="secondary">Branding</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(plan)}
                      data-testid={`button-edit-plan-${plan.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setPlanToDelete(plan.id)}
                      data-testid={`button-delete-plan-${plan.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={planDialog?.open || false} onOpenChange={(open) => !open && setPlanDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-plan">
          <DialogHeader>
            <DialogTitle>{planDialog?.plan ? "Edit Plan" : "Add Plan"}</DialogTitle>
            <DialogDescription>
              {planDialog?.plan ? "Update plan details" : "Create a new subscription plan"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-name">Name</Label>
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Basic Plan"
                  data-testid="input-plan-name"
                />
              </div>
              <div>
                <Label htmlFor="plan-slug">Slug</Label>
                <Input
                  id="plan-slug"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                  placeholder="basic-plan"
                  data-testid="input-plan-slug"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Plan description..."
                data-testid="input-plan-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price-monthly">Price Monthly (CHF)</Label>
                <Input
                  id="plan-price-monthly"
                  type="number"
                  step="0.01"
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  placeholder="9.99"
                  data-testid="input-plan-price-monthly"
                />
              </div>
              <div>
                <Label htmlFor="plan-price-yearly">Price Yearly (CHF)</Label>
                <Input
                  id="plan-price-yearly"
                  type="number"
                  step="0.01"
                  value={planForm.priceYearly}
                  onChange={(e) => setPlanForm({ ...planForm, priceYearly: e.target.value })}
                  placeholder="99.99"
                  data-testid="input-plan-price-yearly"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="plan-max-images">Max Images</Label>
                <Input
                  id="plan-max-images"
                  type="number"
                  value={planForm.maxImages}
                  onChange={(e) => setPlanForm({ ...planForm, maxImages: e.target.value })}
                  data-testid="input-plan-max-images"
                />
              </div>
              <div>
                <Label htmlFor="plan-duration">Listing Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  value={planForm.listingDurationDays}
                  onChange={(e) => setPlanForm({ ...planForm, listingDurationDays: e.target.value })}
                  data-testid="input-plan-duration"
                />
              </div>
              <div>
                <Label htmlFor="plan-sort-order">Sort Order</Label>
                <Input
                  id="plan-sort-order"
                  type="number"
                  value={planForm.sortOrder}
                  onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })}
                  data-testid="input-plan-sort-order"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="can-renew"
                    checked={planForm.canRenew}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, canRenew: !!checked })}
                    data-testid="checkbox-can-renew"
                  />
                  <Label htmlFor="can-renew" className="font-normal">Can Renew</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured-listing"
                    checked={planForm.featuredListing}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, featuredListing: !!checked })}
                    data-testid="checkbox-featured-listing"
                  />
                  <Label htmlFor="featured-listing" className="font-normal">Featured Listing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="priority-support"
                    checked={planForm.prioritySupport}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, prioritySupport: !!checked })}
                    data-testid="checkbox-priority-support"
                  />
                  <Label htmlFor="priority-support" className="font-normal">Priority Support</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics-access"
                    checked={planForm.analyticsAccess}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, analyticsAccess: !!checked })}
                    data-testid="checkbox-analytics-access"
                  />
                  <Label htmlFor="analytics-access" className="font-normal">Analytics Access</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="custom-branding"
                    checked={planForm.customBranding}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, customBranding: !!checked })}
                    data-testid="checkbox-custom-branding"
                  />
                  <Label htmlFor="custom-branding" className="font-normal">Custom Branding</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-active"
                    checked={planForm.isActive}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, isActive: !!checked })}
                    data-testid="checkbox-is-active"
                  />
                  <Label htmlFor="is-active" className="font-normal">Is Active</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanDialog(null)}
              data-testid="button-cancel-plan"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              data-testid="button-save-plan"
            >
              {(createPlanMutation.isPending || updatePlanMutation.isPending) ? "Saving..." : "Save Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this plan? Users currently on this plan may be affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-plan">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDelete && deletePlanMutation.mutate(planToDelete)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-plan"
            >
              Delete Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AIAssistantManagement() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("/api/admin/users"),
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
    queryFn: () => apiRequest("/api/admin/services"),
  });

  const { data: categories = [] } = useQuery<SubmittedCategory[]>({
    queryKey: ["/api/admin/category-suggestions"],
    queryFn: () => apiRequest("/api/admin/category-suggestions"),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiRequest("/api/plans"),
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const platformStats = {
    totalUsers: users.length,
    totalServices: services.length,
    activeServices: services.filter((s: any) => s.status === "active").length,
    pendingCategories: categories.filter((c: any) => c.status === "pending").length,
    totalPlans: plans.length,
  };

  const handleSendMessage = async (queryText?: string) => {
    const messageText = queryText || input.trim();
    if (!messageText || isTyping) return;

    if (!queryText) {
      setInput("");
    }

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: messageText },
    ];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await apiRequest<{ response: string }>("/api/ai/admin-assist", {
        method: "POST",
        body: JSON.stringify({
          query: messageText,
          context: {
            platformStats,
            currentPage: "admin",
          },
          conversationHistory: messages,
        }),
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: response.response },
      ]);
    } catch (err: any) {
      console.error("AI Assistant error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to get AI response",
        variant: "destructive",
      });

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "I'm sorry, I'm having trouble responding right now. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAnalyzePlatform = () => {
    const analysisQuery = `Please analyze the current platform data and provide insights. Here's what I can see: ${platformStats.totalUsers} total users, ${platformStats.activeServices} active services out of ${platformStats.totalServices} total, and ${platformStats.pendingCategories} pending category suggestions. What patterns, issues, or opportunities should I be aware of?`;
    handleSendMessage(analysisQuery);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="card-stat-users">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {platformStats.totalUsers}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-services">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-services">
              {platformStats.totalServices}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-active-services">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-services">
              {platformStats.activeServices}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-pending-categories">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-categories">
              {platformStats.pendingCategories}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-plans">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-plans">
              {platformStats.totalPlans}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Admin Assistant
              </CardTitle>
              <CardDescription>
                Get AI-powered insights and assistance for platform management
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleAnalyzePlatform}
              disabled={isTyping}
              data-testid="button-analyze-platform"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analyze Platform Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Messages Area */}
          <ScrollArea className="h-[400px] border rounded-md p-4" data-testid="area-chat-messages">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12" data-testid="text-welcome-admin">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium">Welcome to AI Admin Assistant</p>
                  <p className="mt-2 text-sm">
                    Ask questions about your platform, request insights, or click "Analyze Platform Data" for automated analysis.
                  </p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                  data-testid={`message-${message.role}-${index}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start" data-testid="indicator-typing-admin">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your platform..."
                disabled={isTyping}
                className="flex-1"
                data-testid="input-admin-message"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isTyping}
                data-testid="button-send-admin-message"
              >
                {isTyping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1" data-testid="text-ai-powered-admin">
                <Sparkles className="h-3 w-3" />
                <span>Powered by AI</span>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="hover:text-foreground transition-colors"
                  data-testid="button-clear-admin-chat"
                >
                  Clear conversation
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState({
    twilioSid: false,
    twilioToken: false,
    emailKey: false,
  });

  const [apiKeys, setApiKeys] = useState({
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    emailServiceProvider: "",
    emailServiceApiKey: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("/api/settings"),
  });

  const { data: envStatus } = useQuery({
    queryKey: ["/api/admin/env-status"],
    queryFn: () => apiRequest("/api/admin/env-status"),
  });

  const [localSettings, setLocalSettings] = useState({
    requireEmailVerification: false,
    requirePhoneVerification: false,
    enableSwissAddressValidation: true,
    enableAiCategoryValidation: true,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        requireEmailVerification: settings.requireEmailVerification ?? false,
        requirePhoneVerification: settings.requirePhoneVerification ?? false,
        enableSwissAddressValidation: settings.enableSwissAddressValidation ?? true,
        enableAiCategoryValidation: settings.enableAiCategoryValidation ?? true,
      });
    }
  }, [settings]);

  const handleSaveVerificationSettings = async () => {
    setIsSavingSettings(true);
    try {
      await apiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(localSettings),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Verification settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveApiKeys = async () => {
    setIsSavingApiKeys(true);
    try {
      const envVars: Record<string, string> = {};
      
      if (apiKeys.twilioAccountSid) envVars.TWILIO_ACCOUNT_SID = apiKeys.twilioAccountSid;
      if (apiKeys.twilioAuthToken) envVars.TWILIO_AUTH_TOKEN = apiKeys.twilioAuthToken;
      if (apiKeys.twilioPhoneNumber) envVars.TWILIO_PHONE_NUMBER = apiKeys.twilioPhoneNumber;
      if (apiKeys.emailServiceProvider) envVars.EMAIL_SERVICE_PROVIDER = apiKeys.emailServiceProvider;
      if (apiKeys.emailServiceApiKey) envVars.EMAIL_SERVICE_API_KEY = apiKeys.emailServiceApiKey;

      if (Object.keys(envVars).length === 0) {
        toast({
          title: "Warning",
          description: "No API keys to save. Please enter at least one value.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Info",
        description: "Setting environment variables...",
      });

      setApiKeys({
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioPhoneNumber: "",
        emailServiceProvider: "",
        emailServiceApiKey: "",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/env-status"] });
      
      toast({
        title: "Success",
        description: "API keys saved successfully. Please note: Environment variables must be set in your Replit environment for persistence.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save API keys",
        variant: "destructive",
      });
    } finally {
      setIsSavingApiKeys(false);
    }
  };

  const isConfigured = (service: string) => {
    if (!envStatus) return false;
    if (service === "twilio") return envStatus.twilioConfigured;
    if (service === "email") return envStatus.emailConfigured;
    return false;
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Alert data-testid="alert-settings-info">
        <AlertDescription>
          These settings control verification requirements for the platform. For MVP/testing, you can disable verification even without configuring API keys.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Verification Settings</CardTitle>
          <CardDescription>
            Configure verification requirements for users and services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between" data-testid="setting-email-verification">
              <div className="space-y-0.5">
                <Label htmlFor="require-email">Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Users must verify their email address before posting services
                </p>
              </div>
              <Switch
                id="require-email"
                checked={localSettings.requireEmailVerification}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, requireEmailVerification: checked })
                }
                data-testid="switch-email-verification"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-phone-verification">
              <div className="space-y-0.5">
                <Label htmlFor="require-phone">Require Phone Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Services must have verified phone numbers (requires Twilio configuration)
                </p>
              </div>
              <Switch
                id="require-phone"
                checked={localSettings.requirePhoneVerification}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, requirePhoneVerification: checked })
                }
                data-testid="switch-phone-verification"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-swiss-validation">
              <div className="space-y-0.5">
                <Label htmlFor="swiss-address">Enable Swiss Address Validation</Label>
                <p className="text-sm text-muted-foreground">
                  Validate that service locations are valid Swiss addresses
                </p>
              </div>
              <Switch
                id="swiss-address"
                checked={localSettings.enableSwissAddressValidation}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, enableSwissAddressValidation: checked })
                }
                data-testid="switch-swiss-validation"
              />
            </div>

            <div className="flex items-center justify-between" data-testid="setting-ai-validation">
              <div className="space-y-0.5">
                <Label htmlFor="ai-category">Enable AI Category Validation</Label>
                <p className="text-sm text-muted-foreground">
                  Use AI to validate and suggest category improvements (requires OpenAI API key)
                </p>
              </div>
              <Switch
                id="ai-category"
                checked={localSettings.enableAiCategoryValidation}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, enableAiCategoryValidation: checked })
                }
                data-testid="switch-ai-validation"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveVerificationSettings}
              disabled={isSavingSettings}
              data-testid="button-save-verification-settings"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Verification Settings"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure API keys for third-party services (stored as environment variables)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert data-testid="alert-api-keys-info">
            <AlertDescription>
              API keys are stored as environment variables for security. Enter values below and click Save to configure. Leave fields empty to keep existing values.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Twilio Configuration
                <Badge variant={isConfigured("twilio") ? "default" : "secondary"} data-testid="badge-twilio-status">
                  {isConfigured("twilio") ? "✓ Configured" : "✗ Not Configured"}
                </Badge>
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="twilio-sid">Account SID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="twilio-sid"
                      type={showApiKeys.twilioSid ? "text" : "password"}
                      value={apiKeys.twilioAccountSid}
                      onChange={(e) => setApiKeys({ ...apiKeys, twilioAccountSid: e.target.value })}
                      placeholder="Enter Twilio Account SID"
                      data-testid="input-twilio-sid"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowApiKeys({ ...showApiKeys, twilioSid: !showApiKeys.twilioSid })}
                      data-testid="button-toggle-twilio-sid"
                    >
                      {showApiKeys.twilioSid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="twilio-token">Auth Token</Label>
                  <div className="flex gap-2">
                    <Input
                      id="twilio-token"
                      type={showApiKeys.twilioToken ? "text" : "password"}
                      value={apiKeys.twilioAuthToken}
                      onChange={(e) => setApiKeys({ ...apiKeys, twilioAuthToken: e.target.value })}
                      placeholder="Enter Twilio Auth Token"
                      data-testid="input-twilio-token"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowApiKeys({ ...showApiKeys, twilioToken: !showApiKeys.twilioToken })}
                      data-testid="button-toggle-twilio-token"
                    >
                      {showApiKeys.twilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="twilio-phone">Phone Number</Label>
                  <Input
                    id="twilio-phone"
                    type="text"
                    value={apiKeys.twilioPhoneNumber}
                    onChange={(e) => setApiKeys({ ...apiKeys, twilioPhoneNumber: e.target.value })}
                    placeholder="+41 XX XXX XX XX"
                    data-testid="input-twilio-phone"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                Email Service Configuration
                <Badge variant={isConfigured("email") ? "default" : "secondary"} data-testid="badge-email-status">
                  {isConfigured("email") ? "✓ Configured" : "✗ Not Configured"}
                </Badge>
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="email-provider">Email Service Provider</Label>
                  <Select
                    value={apiKeys.emailServiceProvider}
                    onValueChange={(value) => setApiKeys({ ...apiKeys, emailServiceProvider: value })}
                  >
                    <SelectTrigger id="email-provider" data-testid="select-email-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                      <SelectItem value="ses">AWS SES</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="email-api-key">API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email-api-key"
                      type={showApiKeys.emailKey ? "text" : "password"}
                      value={apiKeys.emailServiceApiKey}
                      onChange={(e) => setApiKeys({ ...apiKeys, emailServiceApiKey: e.target.value })}
                      placeholder="Enter Email Service API Key"
                      data-testid="input-email-api-key"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowApiKeys({ ...showApiKeys, emailKey: !showApiKeys.emailKey })}
                      data-testid="button-toggle-email-key"
                    >
                      {showApiKeys.emailKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveApiKeys}
              disabled={isSavingApiKeys}
              data-testid="button-save-api-keys"
            >
              {isSavingApiKeys ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save API Keys"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

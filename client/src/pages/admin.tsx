import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, FileText, CreditCard, CheckCircle, XCircle, Trash2 } from "lucide-react";
import type { User, Service, Plan, SubmittedCategory } from "@shared/schema";

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
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <FileText className="w-4 h-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <CheckCircle className="w-4 h-4 mr-2" />
              Category Suggestions
            </TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans">
              <CreditCard className="w-4 h-4 mr-2" />
              Plans
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
        </Tabs>
      </div>
    </div>
  );
}

function UsersManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("/api/admin/users"),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiRequest("/api/plans"),
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user accounts, roles, and plans</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ServicesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/admin/services"],
    queryFn: () => apiRequest("/api/admin/services"),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/services/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/services"] });
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Management</CardTitle>
        <CardDescription>View and manage all services</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
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
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteServiceMutation.mutate(service.id)}
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
    </Card>
  );
}

function CategorySuggestionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions = [], isLoading } = useQuery<SubmittedCategory[]>({
    queryKey: ["/api/admin/category-suggestions"],
    queryFn: () => apiRequest("/api/admin/category-suggestions"),
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Suggestions</CardTitle>
        <CardDescription>Review and manage user-submitted categories</CardDescription>
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
            {suggestions.map((suggestion: any) => (
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlansManagement() {
  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    queryFn: () => apiRequest("/api/plans"),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Management</CardTitle>
        <CardDescription>View and manage subscription plans</CardDescription>
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
                  <div className="flex gap-1">
                    {plan.featuredListing && <Badge variant="secondary">Featured</Badge>}
                    {plan.prioritySupport && <Badge variant="secondary">Priority Support</Badge>}
                    {plan.analyticsAccess && <Badge variant="secondary">Analytics</Badge>}
                    {plan.customBranding && <Badge variant="secondary">Branding</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

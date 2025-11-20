import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Settings, CreditCard, BarChart3, RefreshCw, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import type { Service } from "@shared/schema";
import { CreateServiceModal } from "@/components/create-service-modal";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: myServices = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { ownerId: user?.id }],
    queryFn: () => apiRequest(`/api/services?ownerId=${user?.id}`),
    enabled: !!user?.id,
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) =>
      apiRequest(`/api/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Success",
        description: "Service updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service.",
        variant: "destructive",
      });
    },
  });

  const renewServiceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/services/${id}/renew`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Renewed",
        description: "Your service has been renewed for 14 days.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to renew service.",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/services/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Deleted",
        description: "Your service has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (id: string, newStatus: Service['status']) => {
    updateServiceMutation.mutate({ id, data: { status: newStatus } });
  };

  const handleRenew = (id: string) => {
    renewServiceMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
      deleteServiceMutation.mutate(id);
    }
  };

  const isExpired = (date: string | Date) => {
    return new Date(date).getTime() < new Date().getTime();
  };

  const totalViews = useMemo(() => {
    return myServices.reduce((sum, service) => sum + service.viewCount, 0);
  }, [myServices]);

  if (authLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated || !user) {
    setLocation("/auth");
    return null;
  }

  return (
    <Layout>
      <div className="bg-slate-50 min-h-screen py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500">Manage your services and account settings</p>
            </div>
            <Button 
              size="lg" 
              className="gap-2 shadow-md shadow-primary/20"
              onClick={() => setShowCreateModal(true)}
              data-testid="button-post-new-service"
            >
              <PlusCircle className="w-4 h-4" /> Post New Service
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="bg-white p-6 rounded-xl border border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Views</p>
                  <h3 className="text-2xl font-bold">{totalViews.toLocaleString()}</h3>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-full text-green-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Plan</p>
                  <h3 className="text-2xl font-bold capitalize">{user.marketingPackage}</h3>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-border shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Account Status</p>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    {user.isVerified ? "Verified" : "Not Verified"}
                    {user.isVerified && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">✓</Badge>
                    )}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="services" className="w-full">
            <TabsList className="mb-6 bg-white p-1 border border-border">
              <TabsTrigger value="services">My Services</TabsTrigger>
              <TabsTrigger value="billing">Billing & Marketing</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="services" className="space-y-6">
              <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-6">Active Listings</h2>
                
                {servicesLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading your services...</p>
                  </div>
                ) : myServices.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                    {myServices.map(service => {
                      const expired = isExpired(service.expiresAt);
                      return (
                        <div key={service.id} className="flex flex-col md:flex-row gap-6 p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                           <div className="w-full md:w-48 aspect-video bg-slate-200 rounded-md overflow-hidden shrink-0 relative">
                              <img src={service.images[0]} alt="" className={`w-full h-full object-cover ${expired ? 'grayscale opacity-70' : ''}`} />
                              {expired && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <Badge variant="destructive">Expired</Badge>
                                </div>
                              )}
                           </div>
                           <div className="flex-1 py-1">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-bold text-lg">{service.title}</h3>
                                <Badge variant={service.status === 'active' && !expired ? 'default' : 'secondary'}>
                                  {expired ? 'Expired' : service.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{service.description}</p>
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                 <span>Price: <strong>CHF {service.price}</strong>/{service.priceUnit}</span>
                                 <span className={`flex items-center gap-1 ${expired ? 'text-destructive font-medium' : ''}`}>
                                   <Clock className="w-3 h-3" />
                                   Expires: {new Date(service.expiresAt).toLocaleDateString()}
                                 </span>
                              </div>
                           </div>
                           <div className="flex md:flex-col gap-2 justify-center shrink-0">
                              {expired ? (
                                <Button 
                                  className="w-full" 
                                  size="sm" 
                                  onClick={() => handleRenew(service.id)}
                                  disabled={renewServiceMutation.isPending}
                                >
                                  <RefreshCw className="w-3 h-3 mr-2" /> 
                                  {renewServiceMutation.isPending ? "Renewing..." : "Renew"}
                                </Button>
                              ) : (
                                <>
                                  <Button variant="outline" size="sm">Edit</Button>
                                  {service.status === 'active' ? (
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      onClick={() => handleStatusChange(service.id, 'paused')}
                                      disabled={updateServiceMutation.isPending}
                                    >
                                      Pause
                                    </Button>
                                  ) : (
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      onClick={() => handleStatusChange(service.id, 'active')}
                                      disabled={updateServiceMutation.isPending}
                                    >
                                      Activate
                                    </Button>
                                  )}
                                </>
                              )}
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDelete(service.id)}
                                disabled={deleteServiceMutation.isPending}
                              >
                                Delete
                              </Button>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                   <div className="text-center py-12">
                      <p className="text-muted-foreground">You haven't posted any services yet.</p>
                      <Button variant="link" className="mt-2">Create your first post</Button>
                   </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="billing">
              <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Marketing Packages</h2>
                <p className="text-slate-500 mb-8">Boost your listings to get more clients.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="border rounded-xl p-6 hover:border-primary transition-colors cursor-pointer">
                      <h3 className="font-bold text-lg mb-2">Basic</h3>
                      <p className="text-3xl font-bold mb-4">CHF 0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm space-y-2 mb-6 text-slate-600">
                        <li>• 1 Active Listing</li>
                        <li>• Standard Support</li>
                        <li>• 14 Days Visibility</li>
                      </ul>
                      <Button variant="outline" className="w-full">Current Plan</Button>
                   </div>
                   <div className="border rounded-xl p-6 border-primary bg-primary/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary text-white text-xs px-3 py-1 rounded-bl-lg font-medium">Popular</div>
                      <h3 className="font-bold text-lg mb-2">Pro</h3>
                      <p className="text-3xl font-bold mb-4">CHF 29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm space-y-2 mb-6 text-slate-600">
                        <li>• 5 Active Listings</li>
                        <li>• Priority Support</li>
                        <li>• 30 Days Visibility</li>
                        <li>• Verified Badge</li>
                      </ul>
                      <Button className="w-full">Upgrade</Button>
                   </div>
                   <div className="border rounded-xl p-6 hover:border-primary transition-colors cursor-pointer">
                      <h3 className="font-bold text-lg mb-2">Enterprise</h3>
                      <p className="text-3xl font-bold mb-4">CHF 99<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      <ul className="text-sm space-y-2 mb-6 text-slate-600">
                        <li>• Unlimited Listings</li>
                        <li>• Dedicated Manager</li>
                        <li>• Featured Listings</li>
                      </ul>
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                   </div>
                </div>
              </div>
            </TabsContent>

             <TabsContent value="settings">
              <div className="bg-white rounded-xl border border-border shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Identity Verification</h2>
                <p className="text-slate-500 mb-6">Verify your identity to build trust with clients and get a verified badge.</p>
                <Button>Start Verification Process</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CreateServiceModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </Layout>
  );
}

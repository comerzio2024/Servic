import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Settings, CreditCard, BarChart3, RefreshCw, Clock, Trash2, Plus, Edit2, MapPin, CheckCircle2, User as UserIcon, Camera, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useCallback, useRef } from "react";
import type { Service, SelectAddress } from "@shared/schema";
import { CreateServiceModal } from "@/components/create-service-modal";
import { EditServiceModal } from "@/components/edit-service-modal";
import { CategorySuggestionModal } from "@/components/category-suggestion-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Cropper from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import { AddressAutocomplete } from "@/components/address-autocomplete";

export default function Profile() {
  // Scroll to top on mount and tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");

  // Scroll to top when changing tabs
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceWithDetails | null>(null);
  const [showCategorySuggestionModal, setShowCategorySuggestionModal] = useState(false);
  const [pendingCategoryCallback, setPendingCategoryCallback] = useState<((categoryId: string) => void) | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [serviceToPause, setServiceToPause] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  
  const [mainLocationName, setMainLocationName] = useState(user?.preferredLocationName || "");
  const [mainLocationLat, setMainLocationLat] = useState(user?.locationLat ? parseFloat(user.locationLat as any) : null);
  const [mainLocationLng, setMainLocationLng] = useState(user?.locationLng ? parseFloat(user.locationLng as any) : null);
  
  const [editingAddress, setEditingAddress] = useState<SelectAddress | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  const [isAddressValidated, setIsAddressValidated] = useState(false);
  
  const [addressForm, setAddressForm] = useState({
    label: "",
    street: "",
    city: "",
    postalCode: "",
    canton: "",
    country: "Switzerland",
    isPrimary: false,
  });

  // Profile picture upload states
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: myServices = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { ownerId: user?.id }],
    queryFn: () => apiRequest(`/api/services?ownerId=${user?.id}`),
    enabled: !!user?.id,
  });

  const { data: addresses = [] } = useQuery<SelectAddress[]>({
    queryKey: ["/api/users/me/addresses"],
    queryFn: () => apiRequest("/api/users/me/addresses"),
    enabled: isAuthenticated,
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
      setServiceToDelete(null);
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

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; phoneNumber?: string; profileImageUrl?: string; locationLat?: number | null; locationLng?: number | null; preferredLocationName?: string }) => {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createAddressMutation = useMutation({
    mutationFn: async (data: typeof addressForm) => {
      const response = await fetch('/api/users/me/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create address');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/addresses'] });
      setShowAddressForm(false);
      resetAddressForm();
      toast({
        title: "Address added",
        description: "Your address has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof addressForm> }) => {
      const response = await fetch(`/api/users/me/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update address');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/addresses'] });
      setEditingAddress(null);
      setShowAddressForm(false);
      resetAddressForm();
      toast({
        title: "Address updated",
        description: "Your address has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/me/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete address');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/addresses'] });
      setAddressToDelete(null);
      toast({
        title: "Address deleted",
        description: "Your address has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete address. Please try again.",
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
    setServiceToDelete(id);
  };

  const handlePause = (id: string) => {
    setServiceToPause(id);
  };

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const isExpired = (date: string | Date) => {
    return new Date(date).getTime() < new Date().getTime();
  };

  const totalViews = useMemo(() => {
    return myServices.reduce((sum, service) => sum + service.viewCount, 0);
  }, [myServices]);

  const validateSwissPhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Empty is valid (optional field)
    // Swiss phone number validation: must start with +41 and have 9-13 digits after
    // Formats: +41 44 123 4567, +41441234567, +41 79 123 45 67
    const swissPhoneRegex = /^\+41\s?(\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9,11})$/;
    return swissPhoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number if provided
    if (phoneNumber && !validateSwissPhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Swiss phone number starting with +41",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate({ firstName, lastName, phoneNumber });
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enforce validated address for new addresses
    if (!editingAddress && !isAddressValidated) {
      toast({
        title: "Invalid Address",
        description: "Please select a validated Swiss address from the search suggestions",
        variant: "destructive",
      });
      return;
    }
    
    if (editingAddress) {
      updateAddressMutation.mutate({ id: editingAddress.id, data: addressForm });
    } else {
      createAddressMutation.mutate(addressForm);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: "",
      street: "",
      city: "",
      postalCode: "",
      canton: "",
      country: "Switzerland",
      isPrimary: false,
    });
    setIsAddressValidated(false);
  };

  const startEditAddress = (address: SelectAddress) => {
    setEditingAddress(address);
    setAddressForm({
      label: address.label || "",
      street: address.street,
      city: address.city,
      postalCode: address.postalCode,
      canton: address.canton || "",
      country: address.country,
      isPrimary: address.isPrimary,
    });
    setShowAddressForm(true);
  };

  const cancelAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
    resetAddressForm();
  };

  // Profile picture upload handlers
  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const createCroppedImage = async (): Promise<Blob> => {
    if (!imageToCrop || !croppedAreaPixels) {
      throw new Error('No image to crop');
    }

    const image = new Image();
    image.src = imageToCrop;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Set canvas size to cropped area
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleCropSave = async () => {
    try {
      const croppedBlob = await createCroppedImage();
      const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });

      // Upload to object storage
      const uploadRes = await fetch('/api/objects/upload', {
        method: 'POST',
        credentials: 'include',
      });
      if (!uploadRes.ok) throw new Error('Failed to get upload URL');
      const { uploadURL } = await uploadRes.json();

      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResponse.ok) throw new Error('Failed to upload image');

      const setAclRes = await fetch('/api/service-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageURL: uploadURL }),
      });
      if (!setAclRes.ok) throw new Error('Failed to set image ACL');
      const { objectPath } = await setAclRes.json();

      // Update user profile with new image URL
      await updateProfileMutation.mutateAsync({ profileImageUrl: objectPath });

      setShowCropDialog(false);
      setImageToCrop(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
    }
  };

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
    setLocation("/");
    return null;
  }

  return (
    <Layout>
      <div className="bg-slate-50 min-h-screen py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 bg-white p-1 border border-border">
              <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
              <TabsTrigger value="services" data-testid="tab-my-services">My Services</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" data-testid="panel-profile" className="space-y-6">
              <div className="bg-white rounded-xl border border-border shadow-sm p-8">
                <h2 className="text-2xl font-bold mb-6">Your Profile</h2>
                
                {/* Profile Header */}
                <div className="flex flex-col items-center text-center mb-8 pb-8 border-b">
                  <img
                    src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                    alt={`${user?.firstName} ${user?.lastName}`}
                    className="w-24 h-24 rounded-full ring-4 ring-slate-100 mb-4"
                    data-testid="img-profile-avatar"
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h3>
                    {user?.isVerified && (
                      <CheckCircle2 className="w-5 h-5 text-primary fill-primary/10" />
                    )}
                  </div>
                  <p className="text-muted-foreground mb-4">{user?.email}</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {user?.isVerified && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </Badge>
                    )}
                    {user?.marketingPackage && (
                      <Badge variant="outline" className="capitalize">
                        {user.marketingPackage} Plan
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Profile Edit Form */}
                <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-md mx-auto">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-profile-firstName"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-profile-lastName"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+41 44 123 4567"
                      className={phoneNumber && !validateSwissPhoneNumber(phoneNumber) ? "border-red-500" : ""}
                      data-testid="input-profile-phoneNumber"
                    />
                    {phoneNumber && !validateSwissPhoneNumber(phoneNumber) && (
                      <p className="text-sm text-red-500 mt-1">
                        Phone number must start with +41 (e.g., +41 44 123 4567)
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email (managed by Replit)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                      data-testid="input-profile-email-readonly"
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="w-full"
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="services" data-testid="panel-my-services" className="space-y-6">
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
                      <h3 className="text-2xl font-bold capitalize">{user.plan?.name || user.marketingPackage || "Free"}</h3>
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
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setEditingService(service)}
                                    data-testid={`button-edit-service-${service.id}`}
                                  >
                                    Edit
                                  </Button>
                                  {service.status === 'active' ? (
                                    <Button 
                                      variant="secondary" 
                                      size="sm" 
                                      onClick={() => handlePause(service.id)}
                                      disabled={updateServiceMutation.isPending}
                                      data-testid={`button-pause-service-${service.id}`}
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
                                data-testid={`button-delete-service-${service.id}`}
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
                      <Button variant="link" className="mt-2" onClick={() => setShowCreateModal(true)}>Create your first post</Button>
                   </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" data-testid="panel-settings" className="space-y-6">
              {/* Profile Picture Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Profile Picture</CardTitle>
                  <CardDescription>Upload and customize your profile picture</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-6">
                    <Avatar className="w-32 h-32 ring-4 ring-slate-100">
                      <AvatarImage 
                        src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                        alt={`${user?.firstName} ${user?.lastName}`}
                      />
                      <AvatarFallback>
                        <UserIcon className="w-16 h-16 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        data-testid="input-profile-picture"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-change-photo"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Change Photo
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Recommended: Square image, at least 400x400 pixels. JPG, PNG, or GIF.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        data-testid="input-firstName"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        data-testid="input-lastName"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+41 44 123 4567"
                        className={phoneNumber && !validateSwissPhoneNumber(phoneNumber) ? "border-red-500" : ""}
                        data-testid="input-phoneNumber"
                      />
                      {phoneNumber && !validateSwissPhoneNumber(phoneNumber) && (
                        <p className="text-sm text-red-500 mt-1">
                          Phone number must start with +41 (e.g., +41 44 123 4567)
                        </p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Location of Interest</CardTitle>
                  <CardDescription>Set your main location to auto-load services on the home page</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <AddressAutocomplete
                      onAddressSelect={(address) => {
                        if (address) {
                          setMainLocationName(address.city || address.displayName);
                          setMainLocationLat(address.lat);
                          setMainLocationLng(address.lng);
                        } else {
                          setMainLocationName("");
                          setMainLocationLat(null);
                          setMainLocationLng(null);
                        }
                      }}
                      label="Search for your location"
                      initialValue={mainLocationName}
                      required={false}
                    />
                    
                    {mainLocationName && mainLocationLat && mainLocationLng && (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-slate-900">{mainLocationName}</p>
                            <p className="text-sm text-slate-500 mt-1">
                              {mainLocationLat.toFixed(4)}, {mainLocationLng.toFixed(4)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateProfileMutation.mutate({
                          locationLat: mainLocationLat,
                          locationLng: mainLocationLng,
                          preferredLocationName: mainLocationName
                        })}
                        disabled={!mainLocationName || updateProfileMutation.isPending}
                        data-testid="button-save-location"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Location"}
                      </Button>
                      
                      {mainLocationName && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMainLocationName("");
                            setMainLocationLat(null);
                            setMainLocationLng(null);
                          }}
                          data-testid="button-clear-location"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Addresses</CardTitle>
                  <CardDescription>Manage your saved addresses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {addresses.length === 0 && !showAddressForm && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No addresses saved yet</p>
                      </div>
                    )}

                    {addresses.map((address) => (
                      <div 
                        key={address.id} 
                        className="border rounded-lg p-4 space-y-2"
                        data-testid={`address-card-${address.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {address.label && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{address.label}</span>
                                {address.isPrimary && (
                                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-sm">{address.street}</p>
                            <p className="text-sm">
                              {address.postalCode} {address.city}
                              {address.canton && `, ${address.canton}`}
                            </p>
                            <p className="text-sm text-muted-foreground">{address.country}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditAddress(address)}
                              data-testid={`button-edit-${address.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAddressToDelete(address.id)}
                              data-testid={`button-delete-${address.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {showAddressForm ? (
                      <form onSubmit={handleAddressSubmit} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                        <h3 className="font-semibold">
                          {editingAddress ? "Edit Address" : "Add New Address"}
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="label">Label (optional)</Label>
                            <Input
                              id="label"
                              value={addressForm.label}
                              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                              placeholder="e.g., Home, Work, Business"
                              data-testid="input-address-label"
                            />
                          </div>
                          
                          <AddressAutocomplete
                            onAddressSelect={(address) => {
                              if (address) {
                                setAddressForm({
                                  ...addressForm,
                                  street: address.street,
                                  city: address.city,
                                  postalCode: address.postalCode,
                                  canton: address.canton,
                                });
                                setIsAddressValidated(true);
                              } else {
                                // Address cleared
                                setAddressForm({
                                  ...addressForm,
                                  street: "",
                                  city: "",
                                  postalCode: "",
                                  canton: "",
                                });
                                setIsAddressValidated(false);
                              }
                            }}
                            label="Search Swiss Address"
                            required
                          />
                          
                          {isAddressValidated && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <Label htmlFor="street">Street *</Label>
                                <Input
                                  id="street"
                                  value={addressForm.street}
                                  disabled
                                  className="bg-muted"
                                  data-testid="input-address-street"
                                />
                              </div>
                              <div>
                                <Label htmlFor="postalCode">Postal Code *</Label>
                                <Input
                                  id="postalCode"
                                  value={addressForm.postalCode}
                                  disabled
                                  className="bg-muted"
                                  data-testid="input-address-postalCode"
                                />
                              </div>
                              <div>
                                <Label htmlFor="city">City *</Label>
                                <Input
                                  id="city"
                                  value={addressForm.city}
                                  disabled
                                  className="bg-muted"
                                  data-testid="input-address-city"
                                />
                              </div>
                              <div>
                                <Label htmlFor="canton">Canton</Label>
                                <Input
                                  id="canton"
                                  value={addressForm.canton}
                                  disabled
                                  className="bg-muted"
                                  data-testid="input-address-canton"
                                />
                              </div>
                              <div>
                                <Label htmlFor="country">Country</Label>
                                <Input
                                  id="country"
                                  value={addressForm.country}
                                  disabled
                                  className="bg-muted cursor-not-allowed"
                                  data-testid="input-address-country"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isPrimary"
                              checked={addressForm.isPrimary}
                              onChange={(e) => setAddressForm({ ...addressForm, isPrimary: e.target.checked })}
                              className="rounded"
                              data-testid="checkbox-address-isPrimary"
                            />
                            <Label htmlFor="isPrimary" className="cursor-pointer">
                              Set as primary address
                            </Label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="submit"
                            disabled={createAddressMutation.isPending || updateAddressMutation.isPending}
                            data-testid="button-save-address"
                          >
                            {createAddressMutation.isPending || updateAddressMutation.isPending
                              ? "Saving..."
                              : editingAddress
                              ? "Update Address"
                              : "Add Address"}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={cancelAddressForm}
                            data-testid="button-cancel-address"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button 
                        onClick={() => setShowAddressForm(true)}
                        className="w-full"
                        variant="outline"
                        data-testid="button-add-address"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Address
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" data-testid="panel-account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your account details managed by Replit</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input 
                        value={user.email || ""} 
                        disabled 
                        className="bg-muted"
                        data-testid="input-email-readonly"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => window.open('https://replit.com/account', '_blank')}
                        data-testid="button-manage-email"
                      >
                        Manage on Replit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Email is managed through your Replit account
                    </p>
                  </div>
                  <div>
                    <Label>Password</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input 
                        type="password" 
                        value="••••••••" 
                        disabled 
                        className="bg-muted"
                        data-testid="input-password-readonly"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => window.open('https://replit.com/account', '_blank')}
                        data-testid="button-manage-password"
                      >
                        Manage on Replit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Password is managed through your Replit account
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CreateServiceModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onSuggestCategory={() => setShowCategorySuggestionModal(true)}
      />
      <EditServiceModal 
        open={!!editingService} 
        onOpenChange={(open) => !open && setEditingService(null)} 
        service={editingService}
      />
      <CategorySuggestionModal
        open={showCategorySuggestionModal}
        onOpenChange={setShowCategorySuggestionModal}
        onCategoryCreated={(categoryId) => {
          if (pendingCategoryCallback) {
            pendingCategoryCallback(categoryId);
            setPendingCategoryCallback(null);
          }
        }}
      />

      <AlertDialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone and will permanently remove the service from your listings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-service">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToDelete && deleteServiceMutation.mutate(serviceToDelete)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-service"
            >
              Delete Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!addressToDelete} onOpenChange={() => setAddressToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-address">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => addressToDelete && deleteAddressMutation.mutate(addressToDelete)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-address"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!serviceToPause} onOpenChange={() => setServiceToPause(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pause Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Your service will be temporarily hidden from search results. You can reactivate it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-pause-service">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => serviceToPause && handleStatusChange(serviceToPause, 'paused')}
              data-testid="button-confirm-pause-service"
            >
              Pause Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Picture Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Profile Picture</DialogTitle>
          </DialogHeader>
          {imageToCrop && (
            <div className="space-y-6">
              <div className="relative h-96 bg-slate-900 rounded-lg overflow-hidden">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Zoom</Label>
                  <Slider
                    value={[zoom]}
                    min={1}
                    max={3}
                    step={0.1}
                    onValueChange={([value]) => setZoom(value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCropDialog(false);
                setImageToCrop(null);
                setCrop({ x: 0, y: 0 });
                setZoom(1);
                setRotation(0);
              }}
              data-testid="button-cancel-crop"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCropSave}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-crop"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Save Profile Picture"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

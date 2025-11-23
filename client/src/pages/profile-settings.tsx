import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Edit2, MapPin } from "lucide-react";
import type { SelectAddress } from "@shared/schema";

export default function ProfileSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("account");
  
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  
  const [editingAddress, setEditingAddress] = useState<SelectAddress | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  
  const [addressForm, setAddressForm] = useState({
    label: "",
    street: "",
    city: "",
    postalCode: "",
    canton: "",
    country: "Switzerland",
    isPrimary: false,
  });

  const { data: addresses = [] } = useQuery<SelectAddress[]>({
    queryKey: ['/api/users/me/addresses'],
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; phoneNumber?: string }) => {
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

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ firstName, lastName, phoneNumber });
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p>Please log in to access settings.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-settings-title">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8" data-testid="tabs-settings">
            <TabsTrigger value="account" data-testid="tab-account">Account Info</TabsTrigger>
            <TabsTrigger value="personal" data-testid="tab-personal">Personal Info</TabsTrigger>
            <TabsTrigger value="addresses" data-testid="tab-addresses">Addresses</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
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

          <TabsContent value="personal">
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
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      data-testid="input-phoneNumber"
                    />
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
          </TabsContent>

          <TabsContent value="addresses">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="label">Label (optional)</Label>
                          <Input
                            id="label"
                            value={addressForm.label}
                            onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                            placeholder="e.g., Home, Work, Business"
                            data-testid="input-address-label"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="street">Street *</Label>
                          <Input
                            id="street"
                            value={addressForm.street}
                            onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                            placeholder="Enter street address"
                            required
                            data-testid="input-address-street"
                          />
                        </div>
                        <div>
                          <Label htmlFor="postalCode">Postal Code *</Label>
                          <Input
                            id="postalCode"
                            value={addressForm.postalCode}
                            onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                            placeholder="1234"
                            required
                            data-testid="input-address-postalCode"
                          />
                        </div>
                        <div>
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            placeholder="Enter city"
                            required
                            data-testid="input-address-city"
                          />
                        </div>
                        <div>
                          <Label htmlFor="canton">Canton</Label>
                          <Input
                            id="canton"
                            value={addressForm.canton}
                            onChange={(e) => setAddressForm({ ...addressForm, canton: e.target.value })}
                            placeholder="e.g., Zürich"
                            data-testid="input-address-canton"
                          />
                        </div>
                        <div>
                          <Label htmlFor="country">Country *</Label>
                          <Input
                            id="country"
                            value={addressForm.country}
                            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                            placeholder="Switzerland"
                            required
                            data-testid="input-address-country"
                          />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
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
        </Tabs>

        <AlertDialog open={!!addressToDelete} onOpenChange={() => setAddressToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Address</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this address? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => addressToDelete && deleteAddressMutation.mutate(addressToDelete)}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}

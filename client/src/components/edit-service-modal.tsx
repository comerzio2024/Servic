import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Upload } from "lucide-react";
import type { Service } from "@shared/schema";
import { uploadImage } from "@/lib/imageUpload";

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service & { category: any; owner: any } | null;
}

type PricingType = "fixed" | "list" | "text";

export function EditServiceModal({ open, onOpenChange, service }: EditServiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (service) {
      setFormData({
        title: service.title,
        description: service.description,
        priceType: service.priceType || "fixed",
        price: service.price || "",
        priceText: service.priceText || "",
        priceList: service.priceList || [],
        priceUnit: service.priceUnit,
        locations: service.locations || [""],
        contactPhone: service.contactPhone,
        contactEmail: service.contactEmail,
        images: service.images || [],
      });
    }
  }, [service]);

  const updateServiceMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/services/${service?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Updated!",
        description: "Your service has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service",
        variant: "destructive",
      });
    },
  });

  if (!formData) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingImage(true);
      try {
        const objectPath = await uploadImage(file);
        setFormData((prev: any) => ({
          ...prev,
          images: [...prev.images, objectPath],
        }));
        toast({
          title: "Image uploaded",
          description: "Image uploaded successfully",
        });
      } catch (error) {
        console.error("Failed to upload image:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      images: prev.images.filter((_: any, i: number) => i !== index),
    }));
  };

  const addLocation = () => {
    setFormData((prev: any) => ({
      ...prev,
      locations: [...prev.locations, ""],
    }));
  };

  const updateLocation = (index: number, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      locations: prev.locations.map((loc: string, i: number) => (i === index ? value : loc)),
    }));
  };

  const removeLocation = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      locations: prev.locations.filter((_: any, i: number) => i !== index),
    }));
  };

  const addPriceItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      priceList: [...prev.priceList, { description: "", price: "", unit: "" }],
    }));
  };

  const updatePriceItem = (index: number, field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      priceList: prev.priceList.map((item: any, i: number) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removePriceItem = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      priceList: prev.priceList.filter((_: any, i: number) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLocations = formData.locations.filter((l: string) => l.trim());
    if (validLocations.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please provide at least one location",
        variant: "destructive",
      });
      return;
    }
    updateServiceMutation.mutate({
      ...formData,
      locations: validLocations,
      priceList: formData.priceType === "list" ? formData.priceList : undefined,
      price: formData.priceType === "fixed" ? formData.price : undefined,
      priceText: formData.priceType === "text" ? formData.priceText : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>Update your service details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Location</TabsTrigger>
              <TabsTrigger value="media">Images & Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Service Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-edit-service-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="textarea-edit-service-description"
                />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <div className="space-y-2">
                <Label>Pricing Type</Label>
                <div className="flex gap-4">
                  {(["fixed", "list", "text"] as PricingType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priceType"
                        value={type}
                        checked={formData.priceType === type}
                        onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                        data-testid={`radio-edit-price-type-${type}`}
                      />
                      <span className="capitalize">{type === "list" ? "Price List" : type === "text" ? "Text-based" : "Fixed Price"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.priceType === "fixed" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (CHF)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      data-testid="input-edit-service-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceUnit">Per</Label>
                    <select
                      id="priceUnit"
                      value={formData.priceUnit}
                      onChange={(e) => setFormData({ ...formData, priceUnit: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="hour">Hour</option>
                      <option value="job">Job</option>
                      <option value="consultation">Consultation</option>
                      <option value="day">Day</option>
                      <option value="month">Month</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.priceType === "list" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Price List Items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addPriceItem}>
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {formData.priceList.map((item: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 border p-3 rounded">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updatePriceItem(idx, "description", e.target.value)}
                      />
                      <Input placeholder="Price" type="number" step="0.01" value={item.price} onChange={(e) => updatePriceItem(idx, "price", e.target.value)} />
                      <div className="flex gap-2">
                        <Input placeholder="Unit" value={item.unit} onChange={(e) => updatePriceItem(idx, "unit", e.target.value)} />
                        <Button type="button" size="sm" variant="destructive" onClick={() => removePriceItem(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {formData.priceType === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="priceText">Price Description</Label>
                  <Textarea
                    id="priceText"
                    value={formData.priceText}
                    onChange={(e) => setFormData({ ...formData, priceText: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Service Locations</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addLocation}>
                    <Plus className="w-4 h-4 mr-1" /> Add Location
                  </Button>
                </div>
                {formData.locations.map((location: string, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <Input value={location} onChange={(e) => updateLocation(idx, e.target.value)} />
                    {formData.locations.length > 1 && (
                      <Button type="button" size="sm" variant="destructive" onClick={() => removeLocation(idx)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <div className="space-y-4">
                <Label>Service Images</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="edit-image-upload"
                  />
                  <label htmlFor="edit-image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm">Click to upload images</span>
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {formData.images.map((img: string, idx: number) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`Service ${idx}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1"
                          onClick={() => removeImage(idx)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  data-testid="input-edit-service-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  data-testid="input-edit-service-email"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" disabled={updateServiceMutation.isPending} data-testid="button-submit-edit">
              {updateServiceMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

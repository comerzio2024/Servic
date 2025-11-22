import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Upload } from "lucide-react";
import type { Category } from "@shared/schema";
import { uploadImage } from "@/lib/imageUpload";

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggestCategory: () => void;
}

type PricingType = "fixed" | "list" | "text";

export function CreateServiceModal({ open, onOpenChange, onSuggestCategory }: CreateServiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    priceType: "fixed" as PricingType,
    price: "",
    priceText: "",
    priceList: [] as Array<{ description: string; price: string; unit: string }>,
    priceUnit: "hour",
    locations: [""],
    contactPhone: "",
    contactEmail: "",
    images: [] as string[],
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("/api/services", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          status: "active",
          priceList: formData.priceType === "list" ? formData.priceList : undefined,
          price: formData.priceType === "fixed" ? formData.price : undefined,
          priceText: formData.priceType === "text" ? formData.priceText : undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Posted!",
        description: "Your service has been posted successfully.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      categoryId: "",
      priceType: "fixed",
      price: "",
      priceText: "",
      priceList: [],
      priceUnit: "hour",
      locations: [""],
      contactPhone: "",
      contactEmail: "",
      images: [],
    });
    setImagePreview(null);
    setDraftSaved(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      try {
        const objectPath = await uploadImage(file);
        setFormData((prev) => ({
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
        setImagePreview(null);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const addLocation = () => {
    setFormData((prev) => ({
      ...prev,
      locations: [...prev.locations, ""],
    }));
  };

  const updateLocation = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, i) => (i === index ? value : loc)),
    }));
  };

  const removeLocation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }));
  };

  const addPriceItem = () => {
    setFormData((prev) => ({
      ...prev,
      priceList: [...prev.priceList, { description: "", price: "", unit: "" }],
    }));
  };

  const updatePriceItem = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      priceList: prev.priceList.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removePriceItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      priceList: prev.priceList.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validLocations = formData.locations.filter((l) => l.trim());
    if (
      !formData.title ||
      !formData.description ||
      !formData.categoryId ||
      !formData.contactPhone ||
      !formData.contactEmail ||
      validLocations.length === 0
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createServiceMutation.mutate({ ...formData, locations: validLocations });
  };

  const handleSaveDraft = () => {
    localStorage.setItem("serviceDraft", JSON.stringify(formData));
    setDraftSaved(true);
    toast({
      title: "Draft Saved",
      description: "Your service draft has been saved locally.",
    });
    setTimeout(() => setDraftSaved(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a New Service</DialogTitle>
          <DialogDescription>Create a detailed listing for your service</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Location</TabsTrigger>
              <TabsTrigger value="media">Images & Contact</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Service Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Professional House Cleaning"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-service-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your service in detail..."
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="textarea-service-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="select-service-category"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  Can't find the right category?{" "}
                  <button
                    type="button"
                    onClick={onSuggestCategory}
                    className="text-primary hover:underline font-medium"
                    data-testid="button-suggest-category-inline"
                  >
                    Suggest a new one
                  </button>
                </p>
              </div>
            </TabsContent>

            {/* Pricing & Location Tab */}
            <TabsContent value="pricing" className="space-y-6">
              <div className="space-y-2">
                <Label>Pricing Type *</Label>
                <div className="flex gap-4">
                  {(["fixed", "list", "text"] as PricingType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="priceType"
                        value={type}
                        checked={formData.priceType === type}
                        onChange={(e) => setFormData({ ...formData, priceType: e.target.value as PricingType })}
                        data-testid={`radio-price-type-${type}`}
                      />
                      <span className="capitalize">{type === "list" ? "Price List" : type === "text" ? "Text-based" : "Fixed Price"}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Fixed Pricing */}
              {formData.priceType === "fixed" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (CHF) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      data-testid="input-service-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceUnit">Per *</Label>
                    <select
                      id="priceUnit"
                      value={formData.priceUnit}
                      onChange={(e) => setFormData({ ...formData, priceUnit: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      data-testid="select-service-price-unit"
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

              {/* Price List */}
              {formData.priceType === "list" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Price List Items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addPriceItem} data-testid="button-add-price-item">
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  {formData.priceList.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 border p-3 rounded">
                      <Input
                        placeholder="Description (e.g., Basic)"
                        value={item.description}
                        onChange={(e) => updatePriceItem(idx, "description", e.target.value)}
                        data-testid={`input-price-item-description-${idx}`}
                      />
                      <Input
                        placeholder="Price"
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updatePriceItem(idx, "price", e.target.value)}
                        data-testid={`input-price-item-price-${idx}`}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="Unit (e.g., hour)"
                          value={item.unit}
                          onChange={(e) => updatePriceItem(idx, "unit", e.target.value)}
                          data-testid={`input-price-item-unit-${idx}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removePriceItem(idx)}
                          data-testid={`button-remove-price-item-${idx}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Text-based Pricing */}
              {formData.priceType === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="priceText">Price Description *</Label>
                  <Textarea
                    id="priceText"
                    placeholder="e.g., Flexible pricing based on project scope. Contact for quote."
                    value={formData.priceText}
                    onChange={(e) => setFormData({ ...formData, priceText: e.target.value })}
                    data-testid="textarea-price-text"
                  />
                </div>
              )}

              {/* Locations */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Service Locations *</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addLocation} data-testid="button-add-location">
                    <Plus className="w-4 h-4 mr-1" /> Add Location
                  </Button>
                </div>
                {formData.locations.map((location, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="City or Region"
                      value={location}
                      onChange={(e) => updateLocation(idx, e.target.value)}
                      data-testid={`input-location-${idx}`}
                    />
                    {formData.locations.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeLocation(idx)}
                        data-testid={`button-remove-location-${idx}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Media & Contact Tab */}
            <TabsContent value="media" className="space-y-6">
              {/* Images */}
              <div className="space-y-4">
                <Label>Service Images</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    data-testid="input-image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm">Click to upload images</span>
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`Service ${idx}`} className="w-full h-24 object-cover rounded" />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1"
                          onClick={() => removeImage(idx)}
                          data-testid={`button-remove-image-${idx}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+41 44 123 4567"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  data-testid="input-service-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Contact Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@example.com"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  data-testid="input-service-email"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              data-testid="button-save-draft"
              className={draftSaved ? "border-green-500" : ""}
            >
              {draftSaved ? "✓ Draft Saved" : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-service"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createServiceMutation.isPending}
              data-testid="button-submit-service"
            >
              {createServiceMutation.isPending ? "Posting..." : "Post Service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

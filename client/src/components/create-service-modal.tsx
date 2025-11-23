import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails, type CategoryWithTemporary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePageContextActions } from "@/App";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, AlertCircle, Sparkles, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlatformSettings } from "@shared/schema";
import { ImageManager } from "@/components/image-manager";
import { ContactInput, type Contact } from "@/components/contact-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationAutocomplete } from "@/components/location-autocomplete";

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggestCategory: () => void;
}

type PricingType = "fixed" | "list" | "text";

export function CreateServiceModal({ open, onOpenChange, onSuggestCategory }: CreateServiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const contextActions = usePageContextActions();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    priceType: "fixed" as PricingType,
    price: "",
    priceText: "",
    priceList: [] as Array<{ description: string; price: string; unit: string }>,
    priceUnit: "hour",
    locations: [] as string[],
    contacts: [] as Contact[],
    images: [] as string[],
    imageMetadata: [] as Array<any>,
    mainImageIndex: 0,
    hashtags: [] as string[],
  });
  const [draftSaved, setDraftSaved] = useState(false);
  const [validatingAddresses, setValidatingAddresses] = useState(false);
  const [addressErrors, setAddressErrors] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);

  const maxImages = user?.plan?.maxImages || 4;

  const { data: categories = [] } = useQuery<CategoryWithTemporary[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: settings } = useQuery<PlatformSettings>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("/api/settings"),
  });

  // Track modal open/close state
  useEffect(() => {
    if (open) {
      contextActions.setModalOpen("create_service");
    } else {
      contextActions.setModalOpen(null);
    }
  }, [open]);

  // Track form progress
  useEffect(() => {
    if (!open) return; // Only track when modal is open
    
    contextActions.updateFormProgress("hasTitle", !!formData.title.trim());
    contextActions.updateFormProgress("hasDescription", !!formData.description.trim());
    contextActions.updateFormProgress("hasCategory", !!formData.categoryId);
    contextActions.updateFormProgress("hasImages", formData.images.length > 0);
    contextActions.updateFormProgress("imageCount", formData.images.length);
    contextActions.updateFormProgress("hasLocation", formData.locations.some(l => l.trim()));
    contextActions.updateFormProgress("hasContact", formData.contacts.some(c => c.value.trim()));
    
    const hasPrice = formData.priceType === "fixed" 
      ? !!formData.price 
      : formData.priceType === "text" 
      ? !!formData.priceText.trim() 
      : formData.priceList.length > 0;
    contextActions.updateFormProgress("hasPrice", hasPrice);
  }, [formData.title, formData.description, formData.categoryId, formData.images.length, formData.locations, formData.contacts, formData.price, formData.priceText, formData.priceList, formData.priceType, open]);

  // Initialize contacts with user's profile data
  useEffect(() => {
    if (user && formData.contacts.length === 0) {
      const initialContacts: Contact[] = [];
      
      if (user.phoneNumber) {
        initialContacts.push({
          contactType: "phone",
          value: user.phoneNumber,
          name: `${user.firstName} ${user.lastName}`.trim() || undefined,
          isPrimary: true,
          isVerified: user.phoneVerified,
        });
      }
      
      if (user.email) {
        initialContacts.push({
          contactType: "email",
          value: user.email,
          isPrimary: initialContacts.length === 0,
          isVerified: user.emailVerified,
        });
      }
      
      if (initialContacts.length === 0) {
        initialContacts.push({
          contactType: "email",
          value: "",
          isPrimary: true,
        });
      }
      
      setFormData(prev => ({ ...prev, contacts: initialContacts }));
    }
  }, [user]);

  const createServiceMutation = useMutation({
    mutationFn: async ({ data, status }: { data: typeof formData; status: "draft" | "active" }) => {
      // First create the service
      const service = await apiRequest("/api/services", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          priceType: data.priceType,
          price: data.priceType === "fixed" ? data.price : undefined,
          priceText: data.priceType === "text" ? data.priceText : undefined,
          priceList: data.priceType === "list" ? data.priceList : undefined,
          priceUnit: data.priceUnit,
          locations: data.locations.filter(l => l.trim()),
          images: data.images,
          imageMetadata: data.imageMetadata,
          mainImageIndex: data.mainImageIndex,
          status: status,
          hashtags: data.hashtags,
          // Keep old fields for backward compatibility
          contactPhone: data.contacts.find(c => c.contactType === "phone")?.value || "",
          contactEmail: data.contacts.find(c => c.contactType === "email")?.value || "",
        }),
      });

      // Then create contacts
      for (const contact of data.contacts) {
        if (contact.value.trim()) {
          await apiRequest(`/api/services/${service.id}/contacts`, {
            method: "POST",
            body: JSON.stringify({
              contactType: contact.contactType,
              value: contact.value,
              name: contact.name || undefined,
              role: contact.role || undefined,
              isPrimary: contact.isPrimary || false,
            }),
          });
        }
      }

      return { service, status };
    },
    onSuccess: ({ status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: status === "draft" ? "Draft Saved!" : "Service Posted!",
        description: status === "draft" ? "Your service has been saved as a draft." : "Your service has been posted successfully.",
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
      locations: [],
      contacts: [],
      images: [],
      imageMetadata: [],
      mainImageIndex: 0,
      hashtags: [],
    });
    setDraftSaved(false);
    setAddressErrors([]);
    setHashtagInput("");
    setSuggestedHashtags([]);
    setShowHashtagSuggestions(false);
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

  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { contactType: "email", value: "", isPrimary: false }],
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: any) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const removeContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const addHashtag = (tag: string) => {
    const cleaned = tag.replace(/^#/, '').trim().toLowerCase();
    if (cleaned && cleaned.length > 0 && formData.hashtags.length < 3 && !formData.hashtags.includes(cleaned)) {
      setFormData((prev) => ({
        ...prev,
        hashtags: [...prev.hashtags, cleaned],
      }));
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter(t => t !== tag),
    }));
  };

  const handleAISuggestHashtags = async () => {
    if (formData.images.length === 0) {
      toast({
        title: "No Images",
        description: "Please upload at least one image to get hashtag suggestions",
        variant: "destructive",
      });
      return;
    }

    setLoadingHashtags(true);
    try {
      const response = await apiRequest("/api/ai/suggest-hashtags", {
        method: "POST",
        body: JSON.stringify({ imageUrls: formData.images }),
      });
      
      if (response.hashtags && response.hashtags.length > 0) {
        setSuggestedHashtags(response.hashtags);
        setShowHashtagSuggestions(true);
        toast({
          title: "Hashtags Suggested",
          description: `AI suggested ${response.hashtags.length} hashtags based on your images`,
        });
      } else {
        toast({
          title: "No Suggestions",
          description: "AI couldn't generate hashtag suggestions from your images. Try adding them manually.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Suggestion Failed",
        description: "We couldn't generate hashtag suggestions right now. You can add hashtags manually instead.",
      });
    } finally {
      setLoadingHashtags(false);
    }
  };

  const selectSuggestedHashtag = (tag: string) => {
    addHashtag(tag);
  };

  const validateAddresses = async (): Promise<boolean> => {
    const validLocations = formData.locations.filter(l => l.trim());
    if (validLocations.length === 0) return false;

    setValidatingAddresses(true);
    setAddressErrors([]);
    const errors: string[] = [];

    try {
      for (const location of validLocations) {
        try {
          const result = await apiRequest("/api/validate-address", {
            method: "POST",
            body: JSON.stringify({ address: location }),
          });

          if (!result.isSwiss) {
            errors.push(`"${location}" is not a valid Swiss address. ${result.suggestion || ""}`);
          }
        } catch (error) {
          errors.push(`Failed to validate "${location}"`);
        }
      }

      setAddressErrors(errors);
      return errors.length === 0;
    } finally {
      setValidatingAddresses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validLocations = formData.locations.filter((l) => l.trim());
    const validContacts = formData.contacts.filter((c) => c.value.trim());

    // Validate addresses FIRST if enabled (before any other checks)
    if (settings?.enableSwissAddressValidation) {
      const addressesValid = await validateAddresses();
      if (!addressesValid) {
        toast({
          title: "Address Validation Failed",
          description: "Please correct the address errors below",
          variant: "destructive",
        });
        return;
      }
    }

    // Then validate other required fields
    if (
      !formData.title ||
      !formData.description ||
      !formData.categoryId ||
      validLocations.length === 0 ||
      validContacts.length === 0
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields including at least one contact",
        variant: "destructive",
      });
      return;
    }

    createServiceMutation.mutate({ data: { ...formData, locations: validLocations }, status: "active" });
  };

  const handleSaveDraft = async () => {
    const validLocations = formData.locations.filter((l) => l.trim());
    const validContacts = formData.contacts.filter((c) => c.value.trim());

    // Basic validation for draft - only require title
    if (!formData.title) {
      toast({
        title: "Validation Error",
        description: "Please provide at least a title for your draft",
        variant: "destructive",
      });
      return;
    }

    createServiceMutation.mutate({ data: { ...formData, locations: validLocations }, status: "draft" });
  };

  const verificationEnabled = settings?.requireEmailVerification || settings?.requirePhoneVerification;

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
              <TabsTrigger value="media">Images & Contacts</TabsTrigger>
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

              {/* Hashtags Section */}
              <div className="space-y-4">
                <div>
                  <Label>Hashtags (Optional)</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add up to 3 hashtags to help users discover your service
                  </p>
                </div>

                {/* Current Hashtags */}
                {formData.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2" data-testid="hashtags-container">
                    {formData.hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 text-sm flex items-center gap-1"
                        data-testid={`hashtag-badge-${tag}`}
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-hashtag-${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Hashtag Input */}
                {formData.hashtags.length < 3 && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a hashtag and press Enter"
                      value={hashtagInput}
                      onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addHashtag(hashtagInput);
                        }
                      }}
                      data-testid="input-hashtag"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addHashtag(hashtagInput)}
                      disabled={!hashtagInput.trim()}
                      data-testid="button-add-hashtag"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* AI Suggest Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAISuggestHashtags}
                  disabled={formData.images.length === 0 || loadingHashtags}
                  className="w-full"
                  data-testid="button-ai-suggest-hashtags"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {loadingHashtags ? "Analyzing Images..." : "AI Suggest Hashtags"}
                </Button>
                {formData.images.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Upload images first to get AI hashtag suggestions
                  </p>
                )}
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
                {addressErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {addressErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <LocationAutocomplete
                  locations={formData.locations.filter(l => l.trim())}
                  onLocationsChange={(locations) => setFormData(prev => ({ ...prev, locations }))}
                  maxLocations={10}
                  label="Service Locations"
                  required={true}
                  testIdPrefix="service-location"
                />
                {settings?.enableSwissAddressValidation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Addresses will be validated to ensure they are in Switzerland
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Media & Contact Tab */}
            <TabsContent value="media" className="space-y-6">
              {/* Images */}
              <ImageManager
                images={formData.images}
                imageMetadata={formData.imageMetadata}
                mainImageIndex={formData.mainImageIndex}
                maxImages={maxImages}
                onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
                onMetadataChange={(metadata) => setFormData(prev => ({ ...prev, imageMetadata: metadata }))}
                onMainImageChange={(index) => setFormData(prev => ({ ...prev, mainImageIndex: index }))}
              />

              {/* Contacts */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Contact Information *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addContact}
                    data-testid="button-add-contact"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Another Contact
                  </Button>
                </div>
                
                {formData.contacts.map((contact, idx) => (
                  <ContactInput
                    key={idx}
                    contact={contact}
                    index={idx}
                    canRemove={formData.contacts.length > 1}
                    verificationEnabled={!!verificationEnabled}
                    showVerification={false}
                    onUpdate={updateContact}
                    onRemove={removeContact}
                  />
                ))}

                {formData.contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Please add at least one contact method
                  </p>
                )}
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
              disabled={createServiceMutation.isPending || validatingAddresses}
              data-testid="button-submit-service"
            >
              {validatingAddresses ? "Validating..." : createServiceMutation.isPending ? "Posting..." : "Post Service"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* AI Hashtag Suggestions Dialog */}
      <Dialog open={showHashtagSuggestions} onOpenChange={setShowHashtagSuggestions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI Hashtag Suggestions</DialogTitle>
            <DialogDescription>
              Select hashtags to add to your service (max 3 total)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {suggestedHashtags.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {suggestedHashtags.map((tag) => {
                    const isAdded = formData.hashtags.includes(tag);
                    const canAdd = formData.hashtags.length < 3;
                    
                    return (
                      <Badge
                        key={tag}
                        variant={isAdded ? "default" : "outline"}
                        className={`cursor-pointer ${!canAdd && !isAdded ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => {
                          if (!isAdded && canAdd) {
                            selectSuggestedHashtag(tag);
                          }
                        }}
                        data-testid={`suggested-hashtag-${tag}`}
                      >
                        <Hash className="w-3 h-3 mr-1" />
                        {tag}
                        {isAdded && <span className="ml-1">✓</span>}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formData.hashtags.length}/3 hashtags selected
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hashtag suggestions available
              </p>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowHashtagSuggestions(false)}
                data-testid="button-close-suggestions"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

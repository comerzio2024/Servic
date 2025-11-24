import { useState, useEffect, useRef } from "react";
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
import type { Service, PlatformSettings, ServiceContact } from "@shared/schema";
import { ImageManager } from "@/components/image-manager";
import { ContactInput, type Contact } from "@/components/contact-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationAutocomplete } from "@/components/location-autocomplete";

interface ServiceFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggestCategory?: () => void;
  service?: Service & { category: any; owner: any } | null;
}

type PricingType = "fixed" | "list" | "text";

interface PriceItem {
  description: string;
  price: string;
  unit: string;
}

interface ImageMetadata {
  [key: string]: any;
}

interface FormData {
  title: string;
  description: string;
  categoryId: string;
  priceType: PricingType;
  price: string;
  priceText: string;
  priceList: PriceItem[];
  priceUnit: string;
  locations: string[];
  contacts: Contact[];
  images: string[];
  imageMetadata: ImageMetadata[];
  mainImageIndex: number;
  hashtags: string[];
}

export function ServiceFormModal({ open, onOpenChange, onSuggestCategory, service }: ServiceFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const contextActions = usePageContextActions();
  const initializedRef = useRef(false);
  const isEditMode = !!service;
  
  const [formData, setFormData] = useState<FormData | null>(isEditMode ? null : {
    title: "",
    description: "",
    categoryId: "",
    priceType: "fixed" as PricingType,
    price: "",
    priceText: "",
    priceList: [] as PriceItem[],
    priceUnit: "hour",
    locations: [] as string[],
    contacts: [] as Contact[],
    images: [] as string[],
    imageMetadata: [] as ImageMetadata[],
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
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const maxImages = user?.plan?.maxImages || 4;

  const { data: categories = [] } = useQuery<CategoryWithTemporary[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: settings } = useQuery<PlatformSettings>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("/api/settings"),
  });

  const { data: existingContacts = [] } = useQuery<ServiceContact[]>({
    queryKey: [`/api/services/${service?.id}/contacts`],
    queryFn: () => apiRequest(`/api/services/${service?.id}/contacts`),
    enabled: !!service?.id && open && isEditMode,
  });

  // Track modal open/close state (only in create mode)
  useEffect(() => {
    if (!isEditMode) {
      if (open) {
        contextActions.setModalOpen("create_service");
      } else {
        contextActions.setModalOpen(null);
      }
    }
  }, [open, isEditMode]);

  // Track form progress (only in create mode)
  useEffect(() => {
    if (!open || isEditMode || !formData) return;
    
    contextActions.updateFormProgress("hasTitle", !!formData.title?.trim());
    contextActions.updateFormProgress("hasDescription", !!formData.description?.trim());
    contextActions.updateFormProgress("hasCategory", !!formData.categoryId);
    contextActions.updateFormProgress("hasImages", formData.images?.length > 0);
    contextActions.updateFormProgress("imageCount", formData.images?.length || 0);
    contextActions.updateFormProgress("hasLocation", formData.locations?.some((l: string) => l.trim()));
    contextActions.updateFormProgress("hasContact", formData.contacts?.some((c: Contact) => c.value.trim()));
    
    const hasPrice = formData.priceType === "fixed" 
      ? !!formData.price 
      : formData.priceType === "text" 
      ? !!formData.priceText?.trim() 
      : formData.priceList?.length > 0;
    contextActions.updateFormProgress("hasPrice", hasPrice);
  }, [formData, open, isEditMode]);

  // Initialize form data immediately from service prop (Bug Fix #2)
  useEffect(() => {
    if (isEditMode && service && open && !initializedRef.current) {
      // Initialize with fallback contacts from service data immediately
      const fallbackContacts: Contact[] = [];
      
      if (service.contactPhone) {
        fallbackContacts.push({
          contactType: "phone",
          value: service.contactPhone,
          isPrimary: true,
        });
      }
      if (service.contactEmail) {
        fallbackContacts.push({
          contactType: "email",
          value: service.contactEmail,
          isPrimary: fallbackContacts.length === 0,
        });
      }

      setFormData({
        title: service.title,
        description: service.description,
        categoryId: service.categoryId, // Bug Fix #1: Include categoryId
        priceType: service.priceType || "fixed",
        price: service.price || "",
        priceText: service.priceText || "",
        priceList: service.priceList || [],
        priceUnit: service.priceUnit,
        locations: service.locations || [],
        contacts: fallbackContacts.length > 0 ? fallbackContacts : [{ contactType: "email", value: "", isPrimary: true }],
        images: service.images || [],
        imageMetadata: service.imageMetadata || [],
        mainImageIndex: service.mainImageIndex || 0,
        hashtags: service.hashtags || [],
      });
      
      initializedRef.current = true;
    }
    
    if (!open) {
      initializedRef.current = false;
    }
  }, [service, open, isEditMode]);

  // Enrich contacts with fetched data when available (Bug Fix #2)
  useEffect(() => {
    if (isEditMode && service && open && existingContacts.length > 0 && formData) {
      const mappedContacts: Contact[] = existingContacts.map(c => ({
        id: c.id,
        contactType: c.contactType,
        value: c.value,
        name: c.name || undefined,
        role: c.role || undefined,
        isPrimary: c.isPrimary,
        isVerified: c.isVerified,
      }));

      setFormData((prev: FormData | null) => ({
        ...prev!,
        contacts: mappedContacts,
      }));
    }
  }, [existingContacts, isEditMode, service, open, formData]);

  // Initialize contacts with user's profile data (only in create mode)
  useEffect(() => {
    if (isEditMode || !user || !open || !formData || formData.contacts?.length > 0) return;
    
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
    
    setFormData((prev: FormData | null) => ({ ...prev!, contacts: initialContacts }));
  }, [user, open, formData, isEditMode]);

  const createServiceMutation = useMutation({
    mutationFn: async ({ data, status }: { data: typeof formData; status: "draft" | "active" }) => {
      const serviceData = await apiRequest("/api/services", {
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
          locations: data.locations.filter((l: string) => l.trim()),
          images: data.images,
          imageMetadata: data.imageMetadata,
          mainImageIndex: data.mainImageIndex,
          status: status,
          hashtags: data.hashtags,
          contactPhone: data.contacts.find((c: Contact) => c.contactType === "phone")?.value || "",
          contactEmail: data.contacts.find((c: Contact) => c.contactType === "email")?.value || "",
        }),
      });

      for (const contact of data.contacts) {
        if (contact.value.trim()) {
          await apiRequest(`/api/services/${serviceData.id}/contacts`, {
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

      return { service: serviceData, status };
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

  const updateServiceMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const updatedService = await apiRequest(`/api/services/${service?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          priceType: data.priceType,
          price: data.priceType === "fixed" ? data.price : undefined,
          priceText: data.priceType === "text" ? data.priceText : undefined,
          priceList: data.priceType === "list" ? data.priceList : undefined,
          priceUnit: data.priceUnit,
          locations: data.locations.filter((l: string) => l.trim()),
          images: data.images,
          imageMetadata: data.imageMetadata,
          mainImageIndex: data.mainImageIndex,
          hashtags: data.hashtags,
          contactPhone: data.contacts.find((c: Contact) => c.contactType === "phone")?.value || "",
          contactEmail: data.contacts.find((c: Contact) => c.contactType === "email")?.value || "",
        }),
      });

      const existingContactIds = existingContacts.map(c => c.id);
      const currentContactIds = data.contacts.filter((c: Contact) => c.id).map((c: Contact) => c.id);

      for (const existingId of existingContactIds) {
        if (!currentContactIds.includes(existingId)) {
          await apiRequest(`/api/contacts/${existingId}`, {
            method: "DELETE",
          });
        }
      }

      for (const contact of data.contacts) {
        if (!contact.id && contact.value.trim()) {
          await apiRequest(`/api/services/${service?.id}/contacts`, {
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

      return updatedService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: [`/api/services/${service?.id}/contacts`] });
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
    setFormData((prev: FormData | null) => ({
      ...prev!,
      priceList: [...prev!.priceList, { description: "", price: "", unit: "" }],
    }));
  };

  const updatePriceItem = (index: number, field: string, value: string) => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      priceList: prev!.priceList.map((item: PriceItem, i: number) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removePriceItem = (index: number) => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      priceList: prev!.priceList.filter((_: PriceItem, i: number) => i !== index),
    }));
  };

  const addContact = () => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      contacts: [...prev!.contacts, { contactType: "email", value: "", isPrimary: false }],
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: string | boolean) => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      contacts: prev!.contacts.map((contact: Contact, i: number) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const removeContact = (index: number) => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      contacts: prev!.contacts.filter((_: Contact, i: number) => i !== index),
    }));
  };

  const addHashtag = (tag: string) => {
    const cleaned = tag.replace(/^#/, '').trim().toLowerCase();
    if (cleaned && cleaned.length > 0 && formData!.hashtags.length < 3 && !formData!.hashtags.includes(cleaned)) {
      setFormData((prev: FormData | null) => ({
        ...prev!,
        hashtags: [...prev!.hashtags, cleaned],
      }));
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setFormData((prev: FormData | null) => ({
      ...prev!,
      hashtags: prev!.hashtags.filter((t: string) => t !== tag),
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

  const handleGenerateDescription = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a service title first",
        variant: "destructive",
      });
      return;
    }

    setGeneratingDescription(true);
    try {
      const categoryName = categories.find(c => c.id === formData.categoryId)?.name;
      const response = await apiRequest("/api/ai/generate-description-simple", {
        method: "POST",
        body: JSON.stringify({ 
          title: formData.title,
          categoryName
        }),
      });
      
      if (response.description) {
        setFormData((prev: FormData | null) => ({ ...prev!, description: response.description }));
        toast({
          title: "Description Generated",
          description: "AI has generated a description based on your title. Feel free to edit it!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Couldn't generate description. Please write it manually.",
        variant: "destructive",
      });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const validateAddresses = async (): Promise<boolean> => {
    const validLocations = formData!.locations.filter((l: string) => l.trim());
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
    
    if (!formData) return;
    
    const validLocations = formData.locations.filter((l: string) => l.trim());
    const validContacts = formData.contacts.filter((c: Contact) => c.value.trim());

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

    if (isEditMode) {
      if (validLocations.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please provide at least one location",
          variant: "destructive",
        });
        return;
      }

      if (validContacts.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please provide at least one contact",
          variant: "destructive",
        });
        return;
      }

      updateServiceMutation.mutate({
        ...formData,
        locations: validLocations,
      });
    } else {
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
    }
  };

  const handleSaveDraft = async () => {
    const validLocations = formData!.locations.filter((l: string) => l.trim());
    const validContacts = formData!.contacts.filter((c: Contact) => c.value.trim());

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

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Service" : "Post a New Service"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update your service details" : "Create a detailed listing for your service"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="media" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="media">Images & Contacts</TabsTrigger>
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Location</TabsTrigger>
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
                <div className="flex justify-between items-center">
                  <Label htmlFor="description">Description *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescription}
                    disabled={!formData.title.trim() || generatingDescription}
                    className="gap-2"
                    data-testid="button-ai-generate-description"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingDescription ? "Generating..." : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe your service in detail... or click 'AI Generate' for suggestions"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="textarea-service-description"
                />
                {!formData.title.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Enter a title first to generate AI description
                  </p>
                )}
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
                  {categories.map((cat: CategoryWithTemporary) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {onSuggestCategory && !isEditMode && (
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
                )}
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
                    {formData.hashtags.map((tag: string) => (
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
                  {formData.priceList.map((item: PriceItem, idx: number) => (
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
                        {addressErrors.map((error: string, idx: number) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <LocationAutocomplete
                  locations={formData.locations.filter((l: string) => l.trim())}
                  onLocationsChange={(locations: string[]) => setFormData((prev: FormData | null) => ({ ...prev!, locations }))}
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
                onImagesChange={(images: string[]) => setFormData((prev: FormData | null) => ({ ...prev!, images }))}
                onMetadataChange={(metadata: ImageMetadata[]) => setFormData((prev: FormData | null) => ({ ...prev!, imageMetadata: metadata }))}
                onMainImageChange={(index: number) => setFormData((prev: FormData | null) => ({ ...prev!, mainImageIndex: index }))}
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
                
                {formData.contacts.map((contact: Contact, idx: number) => (
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
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                data-testid="button-save-draft"
                className={draftSaved ? "border-green-500" : ""}
              >
                {draftSaved ? "✓ Draft Saved" : "Save Draft"}
              </Button>
            )}
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
              disabled={(isEditMode ? updateServiceMutation.isPending : createServiceMutation.isPending) || validatingAddresses}
              data-testid="button-submit-service"
            >
              {validatingAddresses 
                ? "Validating..." 
                : isEditMode 
                  ? (updateServiceMutation.isPending ? "Updating..." : "Update Service")
                  : (createServiceMutation.isPending ? "Posting..." : "Post Service")
              }
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
                  {suggestedHashtags.map((tag: string) => {
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

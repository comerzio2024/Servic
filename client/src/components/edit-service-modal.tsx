import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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

interface EditServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service & { category: any; owner: any } | null;
}

type PricingType = "fixed" | "list" | "text";

export function EditServiceModal({ open, onOpenChange, service }: EditServiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState<any>(null);
  const [validatingAddresses, setValidatingAddresses] = useState(false);
  const [addressErrors, setAddressErrors] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const initializedRef = useRef(false);

  const maxImages = user?.plan?.maxImages || 4;

  const { data: settings } = useQuery<PlatformSettings>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("/api/settings"),
  });

  const { data: existingContacts = [] } = useQuery<ServiceContact[]>({
    queryKey: [`/api/services/${service?.id}/contacts`],
    queryFn: () => apiRequest(`/api/services/${service?.id}/contacts`),
    enabled: !!service?.id && open,
  });

  useEffect(() => {
    if (service && open && !initializedRef.current) {
      // Map existing contacts to Contact format
      const mappedContacts: Contact[] = existingContacts.map(c => ({
        id: c.id,
        contactType: c.contactType,
        value: c.value,
        name: c.name || undefined,
        role: c.role || undefined,
        isPrimary: c.isPrimary,
        isVerified: c.isVerified,
      }));

      // If no contacts exist, add default ones from service
      if (mappedContacts.length === 0) {
        if (service.contactPhone) {
          mappedContacts.push({
            contactType: "phone",
            value: service.contactPhone,
            isPrimary: true,
          });
        }
        if (service.contactEmail) {
          mappedContacts.push({
            contactType: "email",
            value: service.contactEmail,
            isPrimary: mappedContacts.length === 0,
          });
        }
      }

      setFormData({
        title: service.title,
        description: service.description,
        priceType: service.priceType || "fixed",
        price: service.price || "",
        priceText: service.priceText || "",
        priceList: service.priceList || [],
        priceUnit: service.priceUnit,
        locations: service.locations || [],
        contacts: mappedContacts.length > 0 ? mappedContacts : [{ contactType: "email", value: "", isPrimary: true }],
        images: service.images || [],
        imageMetadata: service.imageMetadata || [],
        mainImageIndex: service.mainImageIndex || 0,
        hashtags: service.hashtags || [],
      });
      
      initializedRef.current = true;
    }
    
    // Reset when modal closes
    if (!open) {
      initializedRef.current = false;
    }
  }, [service, open, existingContacts]);

  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      // Update the service
      const updatedService = await apiRequest(`/api/services/${service?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          description: data.description,
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

      // Handle contacts: delete removed, update existing, create new
      const existingContactIds = existingContacts.map(c => c.id);
      const currentContactIds = data.contacts.filter((c: Contact) => c.id).map((c: Contact) => c.id);

      // Delete removed contacts
      for (const existingId of existingContactIds) {
        if (!currentContactIds.includes(existingId)) {
          await apiRequest(`/api/contacts/${existingId}`, {
            method: "DELETE",
          });
        }
      }

      // Create new contacts (those without id)
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

  if (!formData) return null;

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

  const addContact = () => {
    setFormData((prev: any) => ({
      ...prev,
      contacts: [...prev.contacts, { contactType: "email", value: "", isPrimary: false }],
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      contacts: prev.contacts.map((contact: Contact, i: number) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const removeContact = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      contacts: prev.contacts.filter((_: any, i: number) => i !== index),
    }));
  };

  const addHashtag = (tag: string) => {
    const cleaned = tag.replace(/^#/, '').trim().toLowerCase();
    if (cleaned && cleaned.length > 0 && formData.hashtags.length < 3 && !formData.hashtags.includes(cleaned)) {
      setFormData((prev: any) => ({
        ...prev,
        hashtags: [...prev.hashtags, cleaned],
      }));
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setFormData((prev: any) => ({
      ...prev,
      hashtags: prev.hashtags.filter((t: string) => t !== tag),
    }));
  };

  const handleAISuggestHashtags = async () => {
    if (formData.images.length === 0) {
      toast({
        title: "No Images",
        description: "Please upload at least one image to get AI hashtag suggestions",
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
    const validLocations = formData.locations.filter((l: string) => l.trim());
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
    
    const validLocations = formData.locations.filter((l: string) => l.trim());
    const validContacts = formData.contacts.filter((c: Contact) => c.value.trim());

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
              <TabsTrigger value="media">Images & Contacts</TabsTrigger>
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
                  <div className="flex flex-wrap gap-2" data-testid="edit-hashtags-container">
                    {formData.hashtags.map((tag: string) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 text-sm flex items-center gap-1"
                        data-testid={`edit-hashtag-badge-${tag}`}
                      >
                        <Hash className="w-3 h-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-edit-remove-hashtag-${tag}`}
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
                      data-testid="input-edit-hashtag"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addHashtag(hashtagInput)}
                      disabled={!hashtagInput.trim()}
                      data-testid="button-edit-add-hashtag"
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
                  data-testid="button-edit-ai-suggest-hashtags"
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
                  locations={formData.locations.filter((l: string) => l.trim())}
                  onLocationsChange={(locations) => setFormData((prev: any) => ({ ...prev, locations }))}
                  maxLocations={10}
                  label="Service Locations"
                  required={true}
                  testIdPrefix="edit-service-location"
                />
                {settings?.enableSwissAddressValidation && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Addresses will be validated to ensure they are in Switzerland
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-6">
              <ImageManager
                images={formData.images}
                imageMetadata={formData.imageMetadata}
                mainImageIndex={formData.mainImageIndex}
                maxImages={maxImages}
                onImagesChange={(images) => setFormData((prev: any) => ({ ...prev, images }))}
                onMetadataChange={(metadata) => setFormData((prev: any) => ({ ...prev, imageMetadata: metadata }))}
                onMainImageChange={(index) => setFormData((prev: any) => ({ ...prev, mainImageIndex: index }))}
              />

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
                    verificationEnabled={!!settings?.requireEmailVerification || !!settings?.requirePhoneVerification}
                    showVerification={!!contact.id}
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

          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button type="submit" disabled={updateServiceMutation.isPending || validatingAddresses} data-testid="button-submit-edit">
              {validatingAddresses ? "Validating..." : updateServiceMutation.isPending ? "Saving..." : "Save Changes"}
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
                        data-testid={`edit-suggested-hashtag-${tag}`}
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
                data-testid="button-edit-close-suggestions"
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

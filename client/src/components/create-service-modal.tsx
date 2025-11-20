import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Category } from "@shared/schema";

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateServiceModal({ open, onOpenChange }: CreateServiceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    price: "",
    priceUnit: "hour",
    location: "",
    contactPhone: "",
    contactEmail: "",
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("/api/services", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({
        title: "Service Posted!",
        description: "Your service has been posted successfully. It will automatically expire in 14 days.",
      });
      setFormData({
        title: "",
        description: "",
        categoryId: "",
        price: "",
        priceUnit: "hour",
        location: "",
        contactPhone: "",
        contactEmail: "",
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.categoryId || !formData.price || !formData.location) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createServiceMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post a New Service</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your service in detail..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="textarea-service-description"
            />
          </div>

          {/* Category */}
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
          </div>

          {/* Price and Unit */}
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
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="select-service-price-unit"
              >
                <option value="hour">Hour</option>
                <option value="job">Job</option>
                <option value="consultation">Consultation</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              placeholder="e.g., Zurich, Switzerland"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              data-testid="input-service-location"
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+41 44 123 4567"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              data-testid="input-service-phone"
            />
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@example.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              data-testid="input-service-email"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
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

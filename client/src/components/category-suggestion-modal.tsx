import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb } from "lucide-react";
import { CategoryValidationDialog } from "./category-validation-dialog";

interface CategorySuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryCreated?: (categoryId: string) => void;
}

interface ValidationResult {
  isValid: boolean;
  suggestedName?: string;
  reasoning: string;
  confidence: number;
}

export function CategorySuggestionModal({ open, onOpenChange, onCategoryCreated }: CategorySuggestionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  // Helper function to generate unique slug with timestamp
  const generateUniqueSlug = (name: string) => {
    const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
    return `${baseSlug}-${timestamp}`;
  };

  const validateCategoryMutation = useMutation({
    mutationFn: (data: { categoryName: string; description?: string }) =>
      apiRequest<ValidationResult>("/api/ai/validate-category", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      if (result.isValid && result.confidence > 0.7) {
        // AI says it's valid - create temporary category directly
        createTemporaryCategoryMutation.mutate({
          name: categoryName.trim(),
          slug: generateUniqueSlug(categoryName.trim()),
        });
      } else {
        // AI says it's invalid - show validation dialog
        setValidationResult(result);
        setShowValidationDialog(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createTemporaryCategoryMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      apiRequest("/api/temporary-categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      
      if (data.isExistingCategory) {
        toast({
          title: "Category Found!",
          description: data.message || `Using the existing category "${data.name}".`,
        });
      } else {
        toast({
          title: "Category Created!",
          description: "Your category has been created successfully.",
        });
      }
      
      if (onCategoryCreated) {
        onCategoryCreated(data.id);
      }
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const submitCategoryMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest("/api/categories/suggest", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Category Suggested!",
        description: "Your category suggestion has been submitted for admin review.",
      });
      resetForm();
      onOpenChange(false);
      setShowValidationDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit category suggestion",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setValidationResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim() && categoryDescription.trim()) {
      // First validate with AI
      validateCategoryMutation.mutate({ 
        categoryName: categoryName.trim(),
        description: categoryDescription.trim()
      });
    }
  };

  const handleUseSuggestedName = () => {
    if (!validationResult?.suggestedName) return;
    
    createTemporaryCategoryMutation.mutate({
      name: validationResult.suggestedName,
      slug: generateUniqueSlug(validationResult.suggestedName),
    });
    setShowValidationDialog(false);
  };

  const handleSubmitForReview = () => {
    submitCategoryMutation.mutate({
      name: categoryName.trim(),
      description: categoryDescription.trim(),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Suggest a New Category
            </DialogTitle>
            <DialogDescription>
              Can't find the right category for your service? Suggest a new one and our AI will help validate it.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                type="text"
                placeholder="e.g., Pet Grooming, Home Renovation"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
                maxLength={100}
                data-testid="input-suggest-category-name"
              />
              <p className="text-sm text-muted-foreground">
                Provide a clear, descriptive name for the category
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description *</Label>
              <Textarea
                id="category-description"
                placeholder="Explain what types of services would fit in this category..."
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                required
                maxLength={500}
                rows={4}
                data-testid="input-suggest-category-description"
              />
              <p className="text-sm text-muted-foreground">
                Help us understand the purpose and scope of this category (10-500 characters)
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-category-suggestion"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !categoryName.trim() || 
                  !categoryDescription.trim() || 
                  validateCategoryMutation.isPending ||
                  createTemporaryCategoryMutation.isPending
                }
                data-testid="button-submit-category-suggestion"
              >
                {validateCategoryMutation.isPending || createTemporaryCategoryMutation.isPending 
                  ? "Validating..." 
                  : "Submit Suggestion"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {validationResult && (
        <CategoryValidationDialog
          open={showValidationDialog}
          onOpenChange={setShowValidationDialog}
          originalName={categoryName}
          aiSuggestedName={validationResult.suggestedName}
          aiReasoning={validationResult.reasoning}
          onUseSuggested={handleUseSuggestedName}
          onSubmitForReview={handleSubmitForReview}
          isProcessing={createTemporaryCategoryMutation.isPending || submitCategoryMutation.isPending}
        />
      )}
    </>
  );
}

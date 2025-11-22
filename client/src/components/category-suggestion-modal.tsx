import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lightbulb } from "lucide-react";

interface CategorySuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategorySuggestionModal({ open, onOpenChange }: CategorySuggestionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryName, setCategoryName] = useState("");

  const submitCategoryMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("/api/categories/suggest", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      toast({
        title: "Category Suggested!",
        description: "Your category suggestion has been submitted for review.",
      });
      setCategoryName("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit category suggestion",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim()) {
      submitCategoryMutation.mutate(categoryName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Suggest a New Category
          </DialogTitle>
          <DialogDescription>
            Can't find the right category for your service? Suggest a new one and we'll review it.
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
              data-testid="input-suggest-category-name"
            />
            <p className="text-sm text-muted-foreground">
              Provide a clear, descriptive name for the category
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
              disabled={!categoryName.trim() || submitCategoryMutation.isPending}
              data-testid="button-submit-category-suggestion"
            >
              {submitCategoryMutation.isPending ? "Submitting..." : "Submit Suggestion"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

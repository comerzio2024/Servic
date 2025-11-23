import type { ServiceWithDetails } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, MapPin, CheckCircle2, Heart, Hash } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCroppedImage } from "@/hooks/useCroppedImage";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

interface ServiceCardProps {
  service: ServiceWithDetails & { distance?: number };
  compact?: boolean;
  isSaved?: boolean;
}

export function ServiceCard({ service, compact = false, isSaved: initialIsSaved }: ServiceCardProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaved, setIsSaved] = useState(initialIsSaved ?? false);
  const [showUnfavoriteDialog, setShowUnfavoriteDialog] = useState(false);
  const daysRemaining = Math.ceil((new Date(service.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysRemaining <= 0;

  // Get the main image based on mainImageIndex
  const mainImageIndex = service.mainImageIndex || 0;
  const mainImage = service.images[mainImageIndex] || service.images[0];
  const imageMetadata = service.imageMetadata as any[] || [];
  const mainImageMetadata = imageMetadata[mainImageIndex];

  // Generate cropped thumbnail using canvas rendering
  const displayImage = useCroppedImage(mainImage, mainImageMetadata);

  // Query favorite status only if not provided
  const { data: favoriteStatus } = useQuery({
    queryKey: ["/api/favorites", service.id, "status"],
    queryFn: () => apiRequest<{ isFavorite: boolean }>(`/api/favorites/${service.id}/status`),
    enabled: isAuthenticated && initialIsSaved === undefined,
  });

  // Update local state when saved status is fetched or prop changes
  useEffect(() => {
    let newValue: boolean | undefined;
    
    if (initialIsSaved !== undefined) {
      newValue = initialIsSaved;
    } else if (favoriteStatus?.isFavorite !== undefined) {
      newValue = favoriteStatus.isFavorite;
    }
    
    // Only update if value actually changed
    if (newValue !== undefined && newValue !== isSaved) {
      setIsSaved(newValue);
    }
  }, [favoriteStatus, initialIsSaved]);

  // Toggle saved mutation with optimistic updates
  const toggleSaved = useMutation({
    mutationFn: async ({ action }: { action: 'add' | 'remove' }) => {
      if (action === 'remove') {
        await apiRequest(`/api/favorites/${service.id}`, { method: "DELETE" });
      } else {
        await apiRequest(`/api/favorites/${service.id}`, { method: "POST" });
      }
    },
    onMutate: async ({ action }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/favorites", service.id, "status"] });
      
      // Snapshot the previous value
      const previousState = isSaved;
      
      // Optimistically update the UI immediately
      const newState = action === 'add';
      setIsSaved(newState);
      
      // Return context with previous state for rollback
      return { previousState };
    },
    onSuccess: (_data, variables) => {
      // Invalidate queries for fresh data (don't wait for refetch)
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", service.id, "status"] });
      
      setShowUnfavoriteDialog(false);
      
      // Show feedback toast
      const wasAdded = variables.action === 'add';
      toast({
        title: wasAdded ? "Service saved" : "Removed from saved",
        description: wasAdded 
          ? "Service added to your saved services" 
          : "Service removed from your saved services",
      });
    },
    onError: (error: any, _variables, context) => {
      // Revert to previous state on error
      if (context?.previousState !== undefined) {
        setIsSaved(context.previousState);
      }
      setShowUnfavoriteDialog(false);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update saved services",
        variant: "destructive",
      });
    },
  });

  const handleSaveClick = () => {
    if (isSaved) {
      // Show confirmation dialog when removing saved
      setShowUnfavoriteDialog(true);
    } else {
      // Immediately add to saved without confirmation
      toggleSaved.mutate({ action: 'add' });
    }
  };

  return (
    <Card className={cn(
      "h-full flex flex-col group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50",
      isExpired && "opacity-60 grayscale-[0.5]"
    )}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted flex-shrink-0">
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={service.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted animate-pulse" />
        )}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-foreground font-medium shadow-sm">
            {service.category.name}
          </Badge>
          {service.distance !== undefined && (
            <Badge variant="secondary" className="bg-blue-500/90 text-white backdrop-blur-sm font-medium shadow-sm">
              {service.distance.toFixed(1)} km away
            </Badge>
          )}
          {isExpired && (
            <Badge variant="destructive" className="shadow-sm">Expired</Badge>
          )}
        </div>
        
        {/* Favorite button - show for all users with auth gating */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 shadow-md transition-all duration-200",
                  isAuthenticated ? "hover:bg-white hover:scale-110" : "cursor-pointer opacity-80"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isAuthenticated) {
                    handleSaveClick();
                  }
                }}
                disabled={isAuthenticated && toggleSaved.isPending}
                data-testid={`button-favorite-${service.id}`}
              >
                <Heart 
                  className={cn(
                    "w-5 h-5 transition-all duration-100",
                    isSaved ? "fill-red-500 text-red-500" : "text-gray-400"
                  )}
                />
              </button>
            </TooltipTrigger>
            {!isAuthenticated && (
              <TooltipContent>
                <p>Login to save services</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
          <div className="flex items-center gap-2 text-white/90 text-xs font-medium min-w-0">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {service.locations?.[0] || (service as any).location || "Location not specified"}
            </span>
          </div>
        </div>
      </div>

      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-3">
          <Link href={`/service/${service.id}`} className="min-w-0 flex-1">
            <h3 className="font-bold text-base sm:text-lg leading-tight text-foreground hover:text-primary cursor-pointer line-clamp-2">
              {service.title}
            </h3>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center text-amber-400">
            <Star className="w-4 h-4 fill-current" />
            <span className="ml-1 text-sm font-bold text-foreground">{service.rating.toFixed(1)}</span>
          </div>
          <span className="text-muted-foreground text-sm">({service.reviewCount} reviews)</span>
        </div>

        {/* Hashtags Section */}
        {service.hashtags && service.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {service.hashtags.slice(0, 3).map(tag => (
              <Link
                key={tag}
                href={`/hashtags/${tag}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                data-testid={`hashtag-${tag}`}
              >
                <Hash className="w-3 h-3 mr-0.5" />
                {tag}
              </Link>
            ))}
          </div>
        )}
      </CardContent>

      {/* Pricing section - FULL WIDTH, separate line with responsive font sizing */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 md:px-5 py-3 border-t border-border/50 bg-muted/30 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap min-w-0 flex-1">
          {service.priceType === 'fixed' && (
            <>
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary whitespace-nowrap">CHF {service.price}</span>
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">/{service.priceUnit}</span>
            </>
          )}
          {service.priceType === 'text' && (
            <span className="text-sm sm:text-base md:text-lg font-medium text-foreground line-clamp-2 break-words">{service.priceText}</span>
          )}
          {service.priceType === 'list' && (
            <span className="text-sm sm:text-base md:text-lg font-medium text-foreground whitespace-nowrap">From CHF {(service.priceList as any)?.[0]?.price || 'N/A'}</span>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">{service.priceType}</Badge>
      </div>

      {/* User section - FULL WIDTH, separate line */}
      <div className="flex items-center gap-3 px-5 py-3">
        <img 
          src={service.owner.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${service.owner.id}`} 
          alt={`${service.owner.firstName} ${service.owner.lastName}`} 
          className="w-10 h-10 rounded-full ring-2 ring-primary/20"
        />
        <div className="flex-1">
          <Link
            href={`/users/${service.owner.id}`}
            className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1"
            data-testid={`link-user-${service.owner.id}`}
          >
            {service.owner.firstName} {service.owner.lastName}
            {service.owner.isVerified && (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            )}
          </Link>
          <div className="text-xs text-muted-foreground">Service Provider</div>
        </div>
      </div>
      
      {!compact && (
        <CardFooter className="p-5 pt-0">
          <Link href={`/service/${service.id}`} className="w-full">
            <Button variant="outline" className="w-full group-hover:border-primary/50 group-hover:text-primary transition-colors">
              View Details
            </Button>
          </Link>
        </CardFooter>
      )}

      <AlertDialog open={showUnfavoriteDialog} onOpenChange={setShowUnfavoriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Saved?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this service from your saved services? You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-unsave">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleSaved.mutate({ action: 'remove' })}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-unsave"
            >
              Remove from Saved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

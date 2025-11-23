import type { ServiceWithDetails } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, MapPin, CheckCircle2, Heart } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useCroppedImage } from "@/hooks/useCroppedImage";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface ServiceCardProps {
  service: ServiceWithDetails & { distance?: number };
  compact?: boolean;
}

export function ServiceCard({ service, compact = false }: ServiceCardProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFavorited, setIsFavorited] = useState(false);
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

  // Query favorite status
  const { data: favoriteStatus } = useQuery({
    queryKey: ["/api/favorites", service.id, "status"],
    queryFn: () => apiRequest<{ isFavorite: boolean }>(`/api/favorites/${service.id}/status`),
    enabled: isAuthenticated,
  });

  // Update local state when favorite status is fetched
  useEffect(() => {
    if (favoriteStatus?.isFavorite !== undefined) {
      setIsFavorited(favoriteStatus.isFavorite);
    }
  }, [favoriteStatus]);

  // Toggle favorite mutation
  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (isFavorited) {
        await apiRequest(`/api/favorites/${service.id}`, { method: "DELETE" });
      } else {
        await apiRequest(`/api/favorites/${service.id}`, { method: "POST" });
      }
    },
    onMutate: async () => {
      // Save previous state for potential rollback
      const previousState = isFavorited;
      // Optimistic update
      setIsFavorited(!isFavorited);
      return { previousState };
    },
    onSuccess: (data, variables, context) => {
      // Use previousState to determine action
      const wasAdded = context?.previousState === false;
      
      // Invalidate favorites queries
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites", service.id, "status"] });
      setShowUnfavoriteDialog(false);
      
      toast({
        title: wasAdded ? "Added to favorites" : "Removed from favorites",
        description: wasAdded 
          ? "Service saved to your favorites" 
          : "Service removed from your favorites",
      });
    },
    onError: (error: any, variables, context) => {
      // Revert optimistic update using saved state
      if (context?.previousState !== undefined) {
        setIsFavorited(context.previousState);
      }
      setShowUnfavoriteDialog(false);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update favorites",
        variant: "destructive",
      });
    },
  });

  const handleFavoriteClick = () => {
    if (isFavorited) {
      // Show confirmation dialog when removing favorite
      setShowUnfavoriteDialog(true);
    } else {
      // Immediately add to favorites without confirmation
      toggleFavorite.mutate();
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
        
        {/* Favorite button - only show for authenticated users */}
        {isAuthenticated && (
          <button
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all duration-200 hover:scale-110"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFavoriteClick();
            }}
            disabled={toggleFavorite.isPending}
            data-testid={`button-favorite-${service.id}`}
          >
            <Heart 
              className={cn(
                "w-5 h-5 transition-all duration-200",
                isFavorited ? "fill-red-500 text-red-500" : "text-gray-400"
              )}
            />
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
          <div className="flex items-center gap-2 text-white/90 text-xs font-medium">
            <MapPin className="w-3.5 h-3.5" />
            {service.locations?.[0] || (service as any).location || "Location not specified"}
          </div>
        </div>
      </div>

      <CardContent className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-3">
          <Link href={`/service/${service.id}`}>
            <h3 className="font-bold text-lg leading-tight text-foreground hover:text-primary cursor-pointer line-clamp-2">
              {service.title}
            </h3>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center text-amber-400">
            <Star className="w-4 h-4 fill-current" />
            <span className="ml-1 text-sm font-bold text-foreground">{service.rating}</span>
          </div>
          <span className="text-muted-foreground text-sm">({service.reviewCount} reviews)</span>
        </div>
      </CardContent>

      {/* Pricing section - FULL WIDTH, separate line */}
      <div className="flex items-center justify-between px-3 sm:px-4 md:px-5 py-3 border-t border-border/50 bg-muted/30">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {service.priceType === 'fixed' && (
            <>
              <span className="text-xl sm:text-2xl font-bold text-primary">CHF {service.price}</span>
              <span className="text-xs sm:text-sm text-muted-foreground">/{service.priceUnit}</span>
            </>
          )}
          {service.priceType === 'text' && (
            <span className="text-sm sm:text-base font-medium text-foreground line-clamp-1">{service.priceText}</span>
          )}
          {service.priceType === 'list' && (
            <span className="text-sm sm:text-base font-medium text-foreground">From CHF {(service.priceList as any)?.[0]?.price || 'N/A'}</span>
          )}
        </div>
        <Badge variant="secondary" className="text-xs sm:text-sm shrink-0">{service.priceType}</Badge>
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
            <AlertDialogTitle>Remove Favorite?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this service from your favorites? You can always add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-unfavorite">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toggleFavorite.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-unfavorite"
            >
              Remove Favorite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

import type { ServiceWithDetails } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      
      toast({
        title: "Error",
        description: error.message || "Failed to update favorites",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-border/50",
      isExpired && "opacity-60 grayscale-[0.5]"
    )}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
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
              toggleFavorite.mutate();
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

      <CardContent className="p-5">
        <div className="flex justify-between items-start gap-4 mb-3">
          <Link href={`/service/${service.id}`}>
            <h3 className="font-bold text-lg leading-tight text-foreground hover:text-primary cursor-pointer line-clamp-2">
              {service.title}
            </h3>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center text-amber-400">
            <Star className="w-4 h-4 fill-current" />
            <span className="ml-1 text-sm font-bold text-foreground">{service.rating}</span>
          </div>
          <span className="text-muted-foreground text-sm">({service.reviewCount} reviews)</span>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-border/50">
          <img 
            src={service.owner.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${service.owner.id}`} 
            alt={`${service.owner.firstName} ${service.owner.lastName}`} 
            className="w-8 h-8 rounded-full ring-2 ring-background"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Link
                href={`/users/${service.owner.id}`}
                className="text-sm font-medium truncate hover:text-primary transition-colors"
                data-testid={`link-user-${service.owner.id}`}
              >
                {service.owner.firstName} {service.owner.lastName}
              </Link>
              {service.owner.isVerified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary fill-primary/10" />
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">CHF {service.price}</span>
            <span className="text-xs text-muted-foreground">/{service.priceUnit}</span>
          </div>
        </div>
      </CardContent>
      
      {!compact && (
        <CardFooter className="p-5 pt-0">
          <Link href={`/service/${service.id}`} className="w-full">
            <Button variant="outline" className="w-full group-hover:border-primary/50 group-hover:text-primary transition-colors">
              View Details
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

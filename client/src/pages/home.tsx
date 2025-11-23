import { Layout } from "@/components/layout";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight, Heart, MapPin, Loader2, Navigation } from "lucide-react";
import heroImg from "@assets/generated_images/abstract_community_connection_hero_background.png";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, type ServiceWithDetails, type CategoryWithTemporary, type FavoriteWithService } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CategoryWithTemporary[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { status: "active" }],
    queryFn: () => apiRequest("/api/services?status=active"),
  });

  const { data: favorites = [] } = useQuery<FavoriteWithService[]>({
    queryKey: ["/api/favorites"],
    queryFn: () => apiRequest("/api/favorites"),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isAuthenticated && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationError(null);
        },
        (error) => {
          console.log("Location access denied:", error);
          setLocationError("Location access denied");
        }
      );
    }
  }, [isAuthenticated]);

  const { data: nearbyServices = [], isLoading: nearbyLoading } = useQuery<Array<ServiceWithDetails & { distance: number }>>({
    queryKey: ["/api/services/nearby", userLocation, radiusKm],
    queryFn: () => apiRequest("/api/services/nearby", {
      method: "POST",
      body: JSON.stringify({
        lat: userLocation!.lat,
        lng: userLocation!.lng,
        radiusKm,
        limit: 10
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }),
    enabled: !!userLocation && isAuthenticated,
  });

  const filteredServices = useMemo(() => {
    if (!selectedCategory) return services;
    return services.filter(service => service.categoryId === selectedCategory);
  }, [services, selectedCategory]);

  const categoryServiceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach(service => {
      counts[service.categoryId] = (counts[service.categoryId] || 0) + 1;
    });
    return counts;
  }, [services]);

  return (
    <Layout>
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImg} 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/60 to-slate-50" />
        </div>

        <div className="container mx-auto px-4 py-8 md:py-12 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-3 border border-primary/30 backdrop-blur-sm">
                <Sparkles className="w-4 h-4" />
                AI-Powered Marketplace
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 leading-tight">
                Find the perfect service for your next project
              </h1>
              <p className="text-base text-slate-300 mb-6 max-w-2xl mx-auto">
                Connect with trusted professionals who have been verified by our community.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex gap-3 justify-center flex-wrap"
            >
              <Button 
                size="default" 
                className="px-6"
                onClick={() => {
                  const categoriesSection = document.querySelector('[data-testid="categories-section"]');
                  categoriesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-browse-categories"
              >
                Browse Categories
              </Button>
              <Button 
                size="default" 
                variant="outline"
                className="px-6 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                onClick={() => {
                  const servicesSection = document.querySelector('[data-testid="services-section"]');
                  servicesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-view-all-services"
              >
                View All Services
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {isAuthenticated && (
        <section className="py-12 container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Navigation className="w-6 h-6 text-blue-500" />
              Services Near You
            </h2>
          </div>

          {locationError ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
              <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Enable location access to see services near you
              </h3>
              <p className="text-slate-500 text-sm">
                Grant location permission to discover local services in your area
              </p>
            </div>
          ) : !userLocation ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
              <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Detecting your location...
              </h3>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6 bg-slate-50 p-4 rounded-lg">
                <Label className="text-sm font-medium whitespace-nowrap">
                  Search Radius: <span className="text-primary font-bold">{radiusKm} km</span>
                </Label>
                <Slider
                  value={[radiusKm]}
                  onValueChange={([value]) => setRadiusKm(value)}
                  min={1}
                  max={50}
                  step={1}
                  className="flex-1"
                  data-testid="slider-radius-km"
                />
              </div>

              {nearbyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : nearbyServices.length > 0 ? (
                <ScrollArea className="w-full">
                  <div className="flex gap-6 pb-4">
                    {nearbyServices.map((service) => (
                      <motion.div
                        key={service.id}
                        className="w-80 flex-shrink-0"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        data-testid={`nearby-service-card-${service.id}`}
                      >
                        <ServiceCard service={service} />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                  <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No services found within {radiusKm} km
                  </h3>
                  <p className="text-slate-500 text-sm">
                    Try increasing the search radius to discover more services
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {isAuthenticated && favorites && favorites.length > 0 && (
        <section className="py-12 container mx-auto px-4 bg-slate-50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              Your Favorites
              <Badge variant="secondary" className="ml-2">{favorites.length}</Badge>
            </h2>
            <Link href="/favorites">
              <Button variant="ghost" className="gap-1" data-testid="button-view-all-favorites">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          
          <ScrollArea className="w-full">
            <div className="flex gap-6 pb-4">
              {favorites.map((fav) => (
                <motion.div
                  key={fav.id}
                  className="w-80 flex-shrink-0"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  data-testid={`favorite-card-${fav.id}`}
                >
                  <ServiceCard service={fav.service} />
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </section>
      )}

      <section className="py-12 container mx-auto px-4" data-testid="categories-section">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Browse by Category</h2>
        </div>
        
        {categoriesLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "p-6 rounded-lg border-2 transition-all flex flex-col items-center gap-3 hover:shadow-md",
                selectedCategory === null
                  ? "border-primary bg-primary/10"
                  : "border-gray-200 hover:border-primary/50"
              )}
              data-testid="category-card-all"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-center">All Categories</h3>
              <p className="text-sm text-muted-foreground">{services.length} services</p>
            </button>
            
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "p-6 rounded-lg border-2 transition-all flex flex-col items-center gap-3 hover:shadow-md",
                  selectedCategory === cat.id
                    ? "border-primary bg-primary/10"
                    : "border-gray-200 hover:border-primary/50"
                )}
                data-testid={`category-card-${cat.slug}`}
              >
                {cat.icon && (
                  <div className="p-3 rounded-full bg-secondary w-16 h-16 flex items-center justify-center">
                    <span className="text-2xl md:text-3xl">{cat.icon}</span>
                  </div>
                )}
                <h3 className="font-semibold text-center">{cat.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {categoryServiceCounts[cat.id] || 0} services
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="py-12 bg-slate-50" data-testid="services-section">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              {selectedCategory 
                ? `${categories.find(c => c.id === selectedCategory)?.name || ''} Services`
                : 'All Services'
              }
            </h2>
            {selectedCategory && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-clear-category-filter"
              >
                Clear Filter
              </Button>
            )}
          </div>

          {servicesLoading ? (
            <div className="text-center py-20">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-slate-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Loading services...</h3>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-fr">
              {filteredServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  data-testid={`service-card-${service.id}`}
                  className="h-full"
                >
                  <ServiceCard service={service} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedCategory ? 'No services in this category yet' : 'No services found'}
              </h3>
              <p className="text-slate-500">
                {selectedCategory 
                  ? 'Try selecting a different category or check back later'
                  : 'Check back later for new services'
                }
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

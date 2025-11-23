import { Layout } from "@/components/layout";
import { ServiceCard } from "@/components/service-card";
import { CategoryFilterBar } from "@/components/category-filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight, Heart, MapPin, Loader2, Navigation, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import heroImg from "@assets/generated_images/abstract_community_connection_hero_background.png";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, type ServiceWithDetails, type CategoryWithTemporary, type FavoriteWithService } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  
  const [customLocation, setCustomLocation] = useState<{lat: number; lng: number; name: string} | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isNearbyExpanded, setIsNearbyExpanded] = useState(true);
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{lat: number; lng: number; displayName: string; name: string}>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Auto-collapse categories when scrolling down
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Collapse when scrolling down past the header area
      if (currentScrollY > lastScrollY && currentScrollY > 200) {
        setIsCategoriesExpanded(false);
      }
      // Expand when scrolling up to top area
      else if (currentScrollY < 100) {
        setIsCategoriesExpanded(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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

  const { data: newServiceCounts = [] } = useQuery<Array<{ categoryId: string; newCount: number }>>({
    queryKey: ["/api/categories/new-service-counts"],
    queryFn: () => apiRequest("/api/categories/new-service-counts"),
    enabled: isAuthenticated,
  });

  const newCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    newServiceCounts.forEach(item => {
      map[item.categoryId] = item.newCount;
    });
    return map;
  }, [newServiceCounts]);

  // Only auto-detect location if user has searched or explicitly enabled it
  useEffect(() => {
    if (isAuthenticated && navigator.geolocation && !customLocation && hasSearchedLocation) {
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
  }, [isAuthenticated, customLocation, hasSearchedLocation]);

  // Get address suggestions as user types
  const handleLocationInputChange = async (value: string) => {
    setLocationSearchQuery(value);
    
    if (value.trim().length < 2) {
      setAddressSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const results = await apiRequest<Array<{lat: number; lng: number; displayName: string; name: string}>>("/api/geocode-suggestions", {
        method: "POST",
        body: JSON.stringify({ query: value }),
        headers: {
          "Content-Type": "application/json"
        }
      });
      setAddressSuggestions(results);
    } catch (error) {
      console.error("Error getting suggestions:", error);
      setAddressSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleLocationSearch = async (location?: {lat: number; lng: number; displayName: string; name: string}) => {
    const selectedLocation = location || (addressSuggestions.length > 0 ? addressSuggestions[0] : null);
    
    if (!locationSearchQuery.trim() && !selectedLocation) {
      toast({
        title: "Location required",
        description: "Please enter a postcode, city, or address",
        variant: "destructive",
      });
      return;
    }

    setHasSearchedLocation(true);
    setIsGeocoding(true);
    try {
      let result: {lat: number; lng: number; displayName: string; name: string};
      
      if (selectedLocation) {
        result = selectedLocation;
      } else {
        result = await apiRequest<{lat: number; lng: number; displayName: string; name: string}>("/api/geocode", {
          method: "POST",
          body: JSON.stringify({ location: locationSearchQuery }),
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      setCustomLocation({
        lat: result.lat,
        lng: result.lng,
        name: result.name || result.displayName
      });
      
      setAddressSuggestions([]);
      setLocationSearchQuery("");

      toast({
        title: "Location found",
        description: `Searching near ${result.name || result.displayName}`,
      });
    } catch (error: any) {
      console.error("Geocoding error:", error);
      toast({
        title: "Location not found",
        description: error.message || "Please try a valid Swiss postcode or city name",
        variant: "destructive",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleClearLocation = () => {
    setCustomLocation(null);
    setLocationSearchQuery("");
    setAddressSuggestions([]);
  };

  const activeLocation = customLocation || userLocation;

  const { data: nearbyServices = [], isLoading: nearbyLoading } = useQuery<Array<ServiceWithDetails & { distance: number }>>({
    queryKey: ["/api/services/nearby", activeLocation, radiusKm],
    queryFn: () => apiRequest("/api/services/nearby", {
      method: "POST",
      body: JSON.stringify({
        lat: activeLocation!.lat,
        lng: activeLocation!.lng,
        radiusKm,
        limit: 10
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }),
    enabled: !!activeLocation && isAuthenticated,
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

      <CategoryFilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        serviceCount={services.length}
        categoryCounts={categoryServiceCounts}
        newCounts={newCountsMap}
        isExpanded={isCategoriesExpanded}
        setIsExpanded={setIsCategoriesExpanded}
      />

      {isAuthenticated && hasSearchedLocation && (
        <section className="py-12 container mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Navigation className="w-6 h-6 text-blue-500" />
              Services Near You
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNearbyExpanded(!isNearbyExpanded)}
              className="h-8 px-2 hover:bg-slate-100 transition-colors"
              data-testid="button-toggle-nearby"
            >
              {isNearbyExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  <span className="text-xs">Hide</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  <span className="text-xs">Show</span>
                </>
              )}
            </Button>
          </div>

          <AnimatePresence>
            {isNearbyExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Label htmlFor="location-search" className="text-sm font-medium mb-2 block">
                  Search Location
                </Label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      id="location-search"
                      type="text"
                      placeholder="Enter postcode, city, or street address (e.g., 8001, Zürich or Bahnhofstrasse 1, Zurich)..."
                      value={locationSearchQuery}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && locationSearchQuery.trim()) {
                          handleLocationSearch();
                        }
                      }}
                      disabled={isGeocoding}
                      className="flex-1"
                      data-testid="input-location-search"
                      autoComplete="off"
                    />
                    <Button
                      onClick={() => handleLocationSearch()}
                      disabled={isGeocoding || !locationSearchQuery.trim()}
                      data-testid="button-search-location"
                    >
                      {isGeocoding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleLocationSearch(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                          data-testid={`suggestion-address-${idx}`}
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{suggestion.name || suggestion.displayName}</p>
                              <p className="text-xs text-slate-500 truncate">{suggestion.displayName}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {isLoadingSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading suggestions...
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-48">
                <Label htmlFor="radius-select" className="text-sm font-medium mb-2 block">
                  Search Radius
                </Label>
                <Select 
                  value={radiusKm.toString()} 
                  onValueChange={(value) => setRadiusKm(parseInt(value, 10))}
                  disabled={!customLocation}
                >
                  <SelectTrigger id="radius-select" data-testid="select-radius">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 km</SelectItem>
                    <SelectItem value="10">10 km</SelectItem>
                    <SelectItem value="25">25 km</SelectItem>
                    <SelectItem value="50">50 km</SelectItem>
                    <SelectItem value="100">100 km</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {customLocation && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="px-3 py-1" data-testid="badge-active-location">
                  <MapPin className="w-3 h-3 mr-1" />
                  {customLocation.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearLocation}
                  className="h-7 px-2"
                  data-testid="button-clear-location"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            )}
          </div>

          {!customLocation ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
              <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Detecting your location...
              </h3>
              <p className="text-slate-500 text-sm">
                Or search for a location manually above
              </p>
            </div>
          ) : (
            <>

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
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {isAuthenticated && !hasSearchedLocation && (
        <section className="py-12 container mx-auto px-4 bg-slate-50">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Find Services Near You</h2>
            <p className="text-center text-slate-600 mb-6">
              Search for a location to discover services in your area
            </p>
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="relative">
                <Label htmlFor="initial-location-search" className="text-sm font-medium mb-2 block">
                  Search Location
                </Label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      id="initial-location-search"
                      type="text"
                      placeholder="Enter postcode, city, or street address..."
                      value={locationSearchQuery}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && locationSearchQuery.trim()) {
                          handleLocationSearch();
                        }
                      }}
                      className="flex-1"
                      data-testid="input-initial-location-search"
                      autoComplete="off"
                    />
                    <Button
                      onClick={() => handleLocationSearch()}
                      disabled={!locationSearchQuery.trim()}
                      data-testid="button-initial-search-location"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleLocationSearch(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                          data-testid={`initial-suggestion-address-${idx}`}
                        >
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{suggestion.name || suggestion.displayName}</p>
                              <p className="text-xs text-slate-500 truncate">{suggestion.displayName}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {isLoadingSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading suggestions...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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
            <div className="flex items-center gap-2">
              <Link href="/favorites">
                <Button variant="ghost" className="gap-1" data-testid="button-view-all-favorites">
                  View All <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
                className="h-8 px-2 hover:bg-slate-100 transition-colors"
                data-testid="button-toggle-favorites"
              >
                {isFavoritesExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    <span className="text-xs">Hide</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    <span className="text-xs">Show</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {isFavoritesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}


      <section className="py-12 bg-slate-50" data-testid="services-section">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              {selectedCategory 
                ? `${categories.find(c => c.id === selectedCategory)?.name || ''} Services`
                : 'All Services'
              }
            </h2>
            <div className="flex items-center gap-3">
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
              <Link href="/services">
                <Button 
                  variant="default" 
                  size="sm"
                  className="gap-1"
                  data-testid="button-see-more-services"
                >
                  See More <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
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

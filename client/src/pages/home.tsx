import { Layout } from "@/components/layout";
import { ServiceCard } from "@/components/service-card";
import { ServiceResultsRail } from "@/components/service-results-rail";
import { GoogleMaps } from "@/components/google-maps";
import { CategoryFilterBar } from "@/components/category-filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ArrowRight, Heart, MapPin, Loader2, Navigation, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import heroImg from "@assets/generated_images/abstract_community_connection_hero_background.png";
import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, type ServiceWithDetails, type CategoryWithTemporary, type FavoriteWithService } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useGeocoding } from "@/hooks/useGeocoding";
import { geocodeLocation, suggestionToGeocodeResult, type GeocodingSuggestion } from "@/lib/geocoding";

type SortOption = "newest" | "oldest" | "most-viewed" | "price-low" | "price-high";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  
  const [searchLocation, setSearchLocation] = useState<{lat: number; lng: number; name: string} | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isNearbyExpanded, setIsNearbyExpanded] = useState(false);
  const [isAllListingsExpanded, setIsAllListingsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [useLocationPermissions, setUseLocationPermissions] = useState(false);
  const locationPermissionProcessingRef = useRef(false);
  
  // Independent state for All Listings tab
  const [allListingsCategory, setAllListingsCategory] = useState<string | null>(null);
  const [allListingsSort, setAllListingsSort] = useState<SortOption>("newest");
  
  // Independent state for Saved Listings tab
  const [savedListingsCategory, setSavedListingsCategory] = useState<string | null>(null);
  const [savedListingsSort, setSavedListingsSort] = useState<SortOption>("newest");
  
  // Use shared geocoding hook for location search
  const { 
    query: locationSearchQuery, 
    setQuery: setLocationSearchQuery, 
    suggestions: addressSuggestions, 
    isLoading: isLoadingSuggestions, 
    clearSuggestions 
  } = useGeocoding({
    minQueryLength: 2,
    debounceMs: 300,
    limit: 10,
    autoSearch: true,
  });
  
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Handle tab switch when authentication changes - switch to "all" if on "saved" and user logs out
  useEffect(() => {
    if (!isAuthenticated && activeTab === "saved") {
      setActiveTab("all");
    }
  }, [isAuthenticated, activeTab]);

  // Sync hero category filter to All Listings tab
  useEffect(() => {
    setAllListingsCategory(selectedCategory);
  }, [selectedCategory]);

  // Auto-load user's saved location on mount (works for all users with stored location)
  useEffect(() => {
    if (user && user.locationLat && user.locationLng && !searchLocation) {
      // Authenticated user profile location takes priority
      setSearchLocation({
        lat: parseFloat(user.locationLat as any),
        lng: parseFloat(user.locationLng as any),
        name: user.preferredLocationName || "Your Location"
      });
    } else if (!searchLocation) {
      // Try to load from localStorage for unauthenticated users or those without profile location
      try {
        const saved = localStorage.getItem('lastSearchLocation');
        if (saved) {
          setSearchLocation(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load saved location from localStorage:', error);
      }
    }
  }, [user]);

  // Save search location to localStorage whenever it changes (for unauthenticated users)
  useEffect(() => {
    if (searchLocation) {
      try {
        localStorage.setItem('lastSearchLocation', JSON.stringify(searchLocation));
      } catch (error) {
        console.error('Failed to save location to localStorage:', error);
      }
    }
  }, [searchLocation]);

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

  const { data: userAddresses = [] } = useQuery<Array<{ id: string; street: string; city: string; postalCode: string; lat: number; lng: number; isPrimary: boolean }>>({
    queryKey: ["/api/users/me/addresses"],
    queryFn: () => apiRequest("/api/users/me/addresses"),
    enabled: isAuthenticated,
  });

  const { data: mapsConfig = { apiKey: "", isConfigured: false } } = useQuery<{ apiKey: string; isConfigured: boolean }>({
    queryKey: ["/api/maps/config"],
    queryFn: () => apiRequest("/api/maps/config").catch(() => ({ apiKey: "", isConfigured: false })),
  });

  const newCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    newServiceCounts.forEach(item => {
      map[item.categoryId] = item.newCount;
    });
    return map;
  }, [newServiceCounts]);


  const handleLocationSearch = async (suggestion?: GeocodingSuggestion) => {
    const selectedLocation = suggestion || (addressSuggestions.length > 0 ? addressSuggestions[0] : null);
    
    if (!locationSearchQuery.trim() && !selectedLocation) {
      toast({
        title: "Location required",
        description: "Please enter a postcode, city, or address",
        variant: "destructive",
      });
      return;
    }

    setIsGeocoding(true);
    try {
      let result: {lat: number; lng: number; displayName: string; name: string};
      
      if (selectedLocation) {
        // Use shared helper to normalize suggestion
        result = suggestionToGeocodeResult(selectedLocation);
      } else {
        // Use shared geocodeLocation service
        result = await geocodeLocation(locationSearchQuery);
      }

      setSearchLocation({
        lat: result.lat,
        lng: result.lng,
        name: result.name || result.displayName
      });
      
      clearSuggestions();
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
    setSearchLocation(null);
    setLocationSearchQuery("");
    clearSuggestions();
  };

  const handleBrowserLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Reverse geocode coordinates to get address name
      const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const response = await fetch(reverseGeocodeUrl, {
        headers: {
          'User-Agent': 'ServiceMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reverse geocode location');
      }

      const data = await response.json();
      const locationName = data.address?.city || data.address?.town || data.address?.village || data.display_name;

      // Save location to user profile if authenticated
      if (isAuthenticated) {
        await apiRequest("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({
            locationLat: lat,
            locationLng: lng,
            preferredLocationName: locationName,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        // Invalidate user query cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }

      setSearchLocation({
        lat,
        lng,
        name: locationName,
      });

      toast({
        title: "Location detected",
        description: `Using your current location: ${locationName}`,
      });
    } catch (error: any) {
      console.error("Geolocation error:", error);
      let errorMessage = "Unable to get your location";
      
      if (error.code === 1) {
        errorMessage = "Location permission denied. Please enable location access in your browser settings.";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable. Please try again.";
      } else if (error.code === 3) {
        errorMessage = "Location request timed out. Please try again.";
      }

      toast({
        title: "Location error",
        description: errorMessage,
        variant: "destructive",
      });
      setUseLocationPermissions(false);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationPermissionsToggle = async (checked: boolean) => {
    // Debounce: prevent rapid toggling while location is being processed
    if (locationPermissionProcessingRef.current) {
      return;
    }

    setUseLocationPermissions(checked);
    
    if (checked) {
      locationPermissionProcessingRef.current = true;
      try {
        await handleBrowserLocation();
      } finally {
        locationPermissionProcessingRef.current = false;
      }
    }
  };

  const handleAddressSwitch = async (addressId: string) => {
    if (!userAddresses || userAddresses.length === 0) {
      toast({
        title: "No addresses available",
        description: "Please add an address first",
        variant: "destructive",
      });
      return;
    }

    const selectedAddress = userAddresses.find(addr => addr.id === addressId);
    if (!selectedAddress) {
      toast({
        title: "Address not found",
        description: "The selected address could not be found",
        variant: "destructive",
      });
      return;
    }

    if (!selectedAddress.lat || !selectedAddress.lng) {
      toast({
        title: "Invalid address",
        description: "This address doesn't have valid coordinates",
        variant: "destructive",
      });
      return;
    }

    const locationName = `${selectedAddress.street}, ${selectedAddress.postalCode} ${selectedAddress.city}`;
    
    setSearchLocation({
      lat: selectedAddress.lat,
      lng: selectedAddress.lng,
      name: locationName,
    });

    // Save location to user profile if authenticated
    if (isAuthenticated) {
      try {
        await apiRequest("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({
            locationLat: selectedAddress.lat,
            locationLng: selectedAddress.lng,
            preferredLocationName: locationName,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        // Invalidate user query cache to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      } catch (error) {
        console.error("Failed to save location to profile:", error);
      }
    }

    toast({
      title: "Address switched",
      description: `Now searching near ${selectedAddress.city}`,
    });
  };

  const { data: nearbyServices = [], isLoading: nearbyLoading } = useQuery<Array<ServiceWithDetails & { distance: number }>>({
    queryKey: ["/api/services/nearby", searchLocation, radiusKm],
    queryFn: () => apiRequest("/api/services/nearby", {
      method: "POST",
      body: JSON.stringify({
        lat: searchLocation!.lat,
        lng: searchLocation!.lng,
        radiusKm,
        limit: 10
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }),
    enabled: !!searchLocation,
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
  
  // Sorting function
  const sortServices = (servicesList: ServiceWithDetails[], sortBy: SortOption) => {
    return [...servicesList].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "most-viewed":
          return b.viewCount - a.viewCount;
        case "price-low":
          const priceA = a.priceType === "fixed" && a.price !== null 
            ? (typeof a.price === 'string' ? parseFloat(a.price) : a.price) 
            : 0;
          const priceB = b.priceType === "fixed" && b.price !== null 
            ? (typeof b.price === 'string' ? parseFloat(b.price) : b.price) 
            : 0;
          const safePriceA = isNaN(priceA) ? 0 : priceA;
          const safePriceB = isNaN(priceB) ? 0 : priceB;
          return safePriceA - safePriceB;
        case "price-high":
          const priceA2 = a.priceType === "fixed" && a.price !== null 
            ? (typeof a.price === 'string' ? parseFloat(a.price) : a.price) 
            : 0;
          const priceB2 = b.priceType === "fixed" && b.price !== null 
            ? (typeof b.price === 'string' ? parseFloat(b.price) : b.price) 
            : 0;
          const safePriceA2 = isNaN(priceA2) ? 0 : priceA2;
          const safePriceB2 = isNaN(priceB2) ? 0 : priceB2;
          return safePriceB2 - safePriceA2;
        default:
          return 0;
      }
    });
  };
  
  // Filtered and sorted All Listings
  const filteredAllListings = useMemo(() => {
    let filtered = services;
    if (allListingsCategory) {
      filtered = filtered.filter(service => service.categoryId === allListingsCategory);
    }
    return sortServices(filtered, allListingsSort);
  }, [services, allListingsCategory, allListingsSort]);
  
  // Category counts for All Listings
  const allListingsCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach(service => {
      counts[service.categoryId] = (counts[service.categoryId] || 0) + 1;
    });
    return counts;
  }, [services]);
  
  // Filtered and sorted Saved Listings
  const filteredSavedListings = useMemo(() => {
    const savedServices = favorites?.map(fav => fav.service) || [];
    let filtered = savedServices;
    if (savedListingsCategory) {
      filtered = filtered.filter(service => service.categoryId === savedListingsCategory);
    }
    return sortServices(filtered, savedListingsSort);
  }, [favorites, savedListingsCategory, savedListingsSort]);
  
  // Category counts for Saved Listings
  const savedListingsCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const savedServices = favorites?.map(fav => fav.service) || [];
    savedServices.forEach(service => {
      counts[service.categoryId] = (counts[service.categoryId] || 0) + 1;
    });
    return counts;
  }, [favorites]);

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
              className="space-y-6"
            >
              {/* Find Services Near You */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Location Search */}
                  <div className="md:col-span-6 relative">
                    <Label htmlFor="hero-location-search" className="text-white text-sm font-medium mb-2 block">
                      Location
                    </Label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="hero-location-search"
                            type="text"
                            placeholder="Enter postcode, city, or address..."
                            value={locationSearchQuery}
                            onChange={(e) => setLocationSearchQuery(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && locationSearchQuery.trim()) {
                                handleLocationSearch();
                              }
                            }}
                            disabled={isGeocoding || isGettingLocation}
                            className="pl-10 bg-white/95 border-white/30 text-slate-900 placeholder:text-slate-500"
                            data-testid="input-hero-location-search"
                            autoComplete="off"
                          />
                        </div>
                        <Button
                          onClick={() => handleLocationSearch()}
                          disabled={isGeocoding || !locationSearchQuery.trim() || isGettingLocation}
                          className="bg-primary hover:bg-primary/90"
                          data-testid="button-hero-search-location"
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
                              data-testid={`suggestion-hero-address-${idx}`}
                            >
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{suggestion.city || suggestion.postcode || suggestion.display_name}</p>
                                  <p className="text-xs text-slate-500 truncate">{suggestion.display_name}</p>
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

                  {/* Radius Selector */}
                  <div className="md:col-span-3">
                    <Label htmlFor="hero-radius-select" className="text-white text-sm font-medium mb-2 block">
                      Radius
                    </Label>
                    <Select 
                      value={radiusKm.toString()} 
                      onValueChange={(value) => setRadiusKm(parseInt(value, 10))}
                    >
                      <SelectTrigger 
                        id="hero-radius-select" 
                        className="bg-white/95 border-white/30 text-slate-900"
                        data-testid="select-hero-radius"
                      >
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

                  {/* Location Permissions Toggle */}
                  <div className="md:col-span-3">
                    <Label htmlFor="hero-location-permissions" className="text-white text-sm font-medium mb-2 block">
                      Use My Location
                    </Label>
                    <div className="flex items-center h-10 px-4 bg-white/95 border border-white/30 rounded-md">
                      <Switch
                        id="hero-location-permissions"
                        checked={useLocationPermissions}
                        onCheckedChange={handleLocationPermissionsToggle}
                        disabled={isGettingLocation || isGeocoding}
                        data-testid="switch-hero-location-permissions"
                      />
                      {isGettingLocation && (
                        <Loader2 className="w-4 h-4 animate-spin ml-2 text-slate-600" />
                      )}
                      <span className="ml-2 text-sm text-slate-700">
                        {isGettingLocation ? "Getting..." : useLocationPermissions ? "On" : "Off"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Location & Address Switcher */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {searchLocation && (
                    <Badge variant="secondary" className="px-3 py-1.5 bg-white/20 text-white border-white/30" data-testid="badge-hero-active-location">
                      <MapPin className="w-3 h-3 mr-1" />
                      {searchLocation.name}
                    </Badge>
                  )}

                  {isAuthenticated && userAddresses.length > 0 && (
                    <Select onValueChange={handleAddressSwitch}>
                      <SelectTrigger 
                        className="w-auto bg-white/90 border-white/30 text-slate-900 h-8"
                        data-testid="select-hero-address-switcher"
                      >
                        <SelectValue placeholder="Switch Address" />
                      </SelectTrigger>
                      <SelectContent>
                        {userAddresses.map((address) => (
                          <SelectItem key={address.id} value={address.id}>
                            {address.isPrimary && "⭐ "}
                            {address.street}, {address.postalCode} {address.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 bg-white/90 border-white/30 text-slate-900 hover:bg-white"
                    onClick={() => {
                      const servicesSection = document.querySelector('[data-testid="services-section"]');
                      servicesSection?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    data-testid="button-hero-view-all-services"
                  >
                    View All Services
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Category Quick Filters */}
              <div className="overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/60 [&::-webkit-scrollbar-thumb]:transition-colors">
                <div className="flex gap-3 pb-2 min-w-max">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all backdrop-blur-sm text-sm font-medium whitespace-nowrap",
                      selectedCategory === null
                        ? "bg-white text-primary border-white"
                        : "bg-white/20 text-white border-white/30 hover:bg-white/30"
                    )}
                    data-testid="category-hero-filter-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    All Services
                    <Badge variant={selectedCategory === null ? "default" : "secondary"} className="ml-1">
                      {services.length}
                    </Badge>
                  </motion.button>

                  {categories.map((category) => (
                    <motion.button
                      key={category.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedCategory(category.id)}
                      className={cn(
                        "relative inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all backdrop-blur-sm text-sm font-medium whitespace-nowrap",
                        selectedCategory === category.id
                          ? "bg-white text-primary border-white"
                          : "bg-white/20 text-white border-white/30 hover:bg-white/30"
                      )}
                      data-testid={`category-hero-filter-${category.slug}`}
                    >
                      {newCountsMap[category.id] > 0 && (
                        <div className="absolute -top-1 -right-1">
                          <div className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                            {newCountsMap[category.id]}
                          </div>
                        </div>
                      )}
                      {category.icon && <span className="text-lg">{category.icon}</span>}
                      {category.name}
                      <Badge variant={selectedCategory === category.id ? "default" : "secondary"} className="ml-1">
                        {categoryServiceCounts[category.id] || 0}
                      </Badge>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {searchLocation && (
        <section className="py-12 container mx-auto px-4">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                Services Near {searchLocation.name}
              </h2>
              <p className="text-slate-600 text-sm mb-6">
                Showing services within {radiusKm} km of your selected location
              </p>
            </div>
            
            <GoogleMaps 
              services={nearbyServices}
              userLocation={searchLocation}
              maxServices={5}
              defaultExpanded={false}
              apiKey={mapsConfig?.apiKey || ""}
            />
            
            <ServiceResultsRail
              services={nearbyServices}
              isLoading={nearbyLoading}
              emptyMessage={`No services found within ${radiusKm} km`}
              emptyDescription="Try increasing the search radius to discover more services"
              isExpanded={isNearbyExpanded}
              onExpandChange={setIsNearbyExpanded}
              dataTestIdPrefix="nearby"
            />
          </div>
        </section>
      )}

      <section className="py-12 bg-slate-50" data-testid="services-section">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-white mb-0">
              <TabsTrigger value="all" className="gap-2" data-testid="tab-all-listings">
                <Sparkles className="w-4 h-4" />
                All Listings
                <Badge variant="secondary" className="ml-1">{filteredAllListings.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="saved" className="gap-2" data-testid="tab-saved-listings">
                <Heart className="w-4 h-4" />
                Saved Listings
                <Badge variant="secondary" className="ml-1">{favorites?.length || 0}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <CategoryFilterBar
                categories={categories}
                selectedCategory={allListingsCategory}
                onCategoryChange={setAllListingsCategory}
                serviceCount={services.length}
                categoryCounts={allListingsCategoryCounts}
                newCounts={newCountsMap}
              />
              
              <div className="bg-white border-b shadow-sm">
                <div className="container mx-auto px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Label htmlFor="all-listings-sort" className="text-sm font-medium text-slate-700">
                        Sort by:
                      </Label>
                      <Select value={allListingsSort} onValueChange={(value: SortOption) => setAllListingsSort(value)}>
                        <SelectTrigger id="all-listings-sort" className="w-48" data-testid="select-all-listings-sort">
                          <SelectValue placeholder="Sort by: Newest First" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="most-viewed">Most Viewed</SelectItem>
                          <SelectItem value="price-low">Price: Low to High</SelectItem>
                          <SelectItem value="price-high">Price: High to Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {allListingsCategory && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setAllListingsCategory(null)}
                          data-testid="button-clear-all-category-filter"
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
                </div>
              </div>
              
              <div className="mt-6">
                {servicesLoading ? (
                  <div className="text-center py-20">
                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-slate-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Loading services...</h3>
                  </div>
                ) : filteredAllListings.length > 0 ? (
                  <ServiceResultsRail
                    services={filteredAllListings}
                    isLoading={false}
                    emptyMessage={allListingsCategory ? 'No services in this category yet' : 'No services found'}
                    emptyDescription={allListingsCategory ? 'Try selecting a different category or check back later' : 'Check back later for new services'}
                    isExpanded={isAllListingsExpanded}
                    onExpandChange={setIsAllListingsExpanded}
                    dataTestIdPrefix="all-listings"
                    maxRows={3}
                    columnsPerRow={4}
                    alwaysUseGrid={true}
                  />
                ) : (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {allListingsCategory ? 'No services in this category yet' : 'No services found'}
                    </h3>
                    <p className="text-slate-500">
                      {allListingsCategory 
                        ? 'Try selecting a different category or check back later'
                        : 'Check back later for new services'
                      }
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="saved" className="mt-0">
              {isAuthenticated ? (
                <>
                  <CategoryFilterBar
                    categories={categories}
                    selectedCategory={savedListingsCategory}
                    onCategoryChange={setSavedListingsCategory}
                    serviceCount={favorites?.length || 0}
                    categoryCounts={savedListingsCategoryCounts}
                    newCounts={newCountsMap}
                  />
                  
                  <div className="bg-white border-b shadow-sm">
                    <div className="container mx-auto px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Label htmlFor="saved-listings-sort" className="text-sm font-medium text-slate-700">
                            Sort by:
                          </Label>
                          <Select value={savedListingsSort} onValueChange={(value: SortOption) => setSavedListingsSort(value)}>
                            <SelectTrigger id="saved-listings-sort" className="w-48" data-testid="select-saved-listings-sort">
                              <SelectValue placeholder="Sort by: Newest First" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="newest">Newest First</SelectItem>
                              <SelectItem value="oldest">Oldest First</SelectItem>
                              <SelectItem value="most-viewed">Most Viewed</SelectItem>
                              <SelectItem value="price-low">Price: Low to High</SelectItem>
                              <SelectItem value="price-high">Price: High to Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {savedListingsCategory && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSavedListingsCategory(null)}
                              data-testid="button-clear-saved-category-filter"
                            >
                              Clear Filter
                            </Button>
                          )}
                          <Link href="/favorites">
                            <Button variant="ghost" className="gap-1" data-testid="button-view-all-favorites">
                              View All <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    {filteredSavedListings.length > 0 ? (
                      <ServiceResultsRail
                        services={filteredSavedListings}
                        isLoading={false}
                        emptyMessage="No saved services"
                        emptyDescription="Start saving services you like to see them here"
                        dataTestIdPrefix="saved-listings"
                        maxRows={3}
                        columnsPerRow={4}
                        alwaysUseGrid={true}
                      />
                    ) : (
                      <div className="text-center py-20 bg-white rounded-2xl border border-dashed">
                        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Heart className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {savedListingsCategory ? 'No saved services in this category' : 'No saved services yet'}
                        </h3>
                        <p className="text-slate-500">
                          {savedListingsCategory 
                            ? 'Try selecting a different category' 
                            : 'Start saving services you like to see them here'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
                  <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Save Your Favorite Services</h3>
                  <p className="text-muted-foreground mb-4">Log in to start saving services you love</p>
                  <Button onClick={() => window.location.href = "/api/login"} data-testid="button-login-cta">Log In</Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}

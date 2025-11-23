import { Layout } from "@/components/layout";
import { ServiceCard } from "@/components/service-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Filter, X, Loader2, SlidersHorizontal, Package } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type ServiceWithDetails, type CategoryWithTemporary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

type SortOption = "newest" | "price-low" | "price-high" | "rating";

export default function BrowseServices() {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  
  // Parse URL query parameters
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean) || []
  );
  const [priceMin, setPriceMin] = useState(Number(searchParams.get("priceMin")) || 0);
  const [priceMax, setPriceMax] = useState(Number(searchParams.get("priceMax")) || 1000);
  const [priceMinDrag, setPriceMinDrag] = useState(Number(searchParams.get("priceMin")) || 0);
  const [priceMaxDrag, setPriceMaxDrag] = useState(Number(searchParams.get("priceMax")) || 1000);
  const [locationFilter, setLocationFilter] = useState(searchParams.get("location") || "");
  const [locationInput, setLocationInput] = useState(searchParams.get("location") || "");
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get("sort") as SortOption) || "newest");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const itemsPerPage = 12;

  // Fetch categories and services
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CategoryWithTemporary[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("/api/categories"),
  });

  const { data: allServices = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services", { status: "active" }],
    queryFn: () => apiRequest("/api/services?status=active"),
  });

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategories.length > 0) params.set("categories", selectedCategories.join(","));
    if (priceMin > 0) params.set("priceMin", priceMin.toString());
    if (priceMax < 1000) params.set("priceMax", priceMax.toString());
    if (locationFilter) params.set("location", locationFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (currentPage > 1) params.set("page", currentPage.toString());
    
    const newSearch = params.toString();
    const newUrl = newSearch ? `/services?${newSearch}` : "/services";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchQuery, selectedCategories, priceMin, priceMax, locationFilter, sortBy, currentPage]);

  // Apply filters and sorting
  const filteredServices = useMemo(() => {
    let filtered = allServices;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (service) =>
          service.title.toLowerCase().includes(query) ||
          service.description.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((service) =>
        selectedCategories.includes(service.categoryId)
      );
    }

    // Price filter
    filtered = filtered.filter((service) => {
      if (service.priceType === "fixed" && service.price !== null) {
        const price = typeof service.price === 'string' ? parseFloat(service.price) : service.price;
        return price >= priceMin && price <= priceMax;
      }
      // For non-fixed prices, we can't filter effectively, so include them
      return true;
    });

    // Location filter
    if (locationFilter) {
      const locationQuery = locationFilter.toLowerCase();
      filtered = filtered.filter((service) => {
        const locations = service.locations || [];
        return locations.some((loc) => loc.toLowerCase().includes(locationQuery));
      });
    }

    // Sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "price-low":
          const priceA = a.priceType === "fixed" && a.price !== null 
            ? (typeof a.price === 'string' ? parseFloat(a.price) : a.price) 
            : 0;
          const priceB = b.priceType === "fixed" && b.price !== null 
            ? (typeof b.price === 'string' ? parseFloat(b.price) : b.price) 
            : 0;
          return priceA - priceB;
        case "price-high":
          const priceA2 = a.priceType === "fixed" && a.price !== null 
            ? (typeof a.price === 'string' ? parseFloat(a.price) : a.price) 
            : 0;
          const priceB2 = b.priceType === "fixed" && b.price !== null 
            ? (typeof b.price === 'string' ? parseFloat(b.price) : b.price) 
            : 0;
          return priceB2 - priceA2;
        case "rating":
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allServices, searchQuery, selectedCategories, priceMin, priceMax, locationFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredServices.slice(start, end);
  }, [filteredServices, currentPage, itemsPerPage]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedCategories.length > 0) count++;
    if (priceMin > 0 || priceMax < 1000) count++;
    if (locationFilter) count++;
    return count;
  }, [searchQuery, selectedCategories, priceMin, priceMax, locationFilter]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSearchInput("");
    setSelectedCategories([]);
    setPriceMin(0);
    setPriceMax(1000);
    setPriceMinDrag(0);
    setPriceMaxDrag(1000);
    setLocationFilter("");
    setLocationInput("");
    setSortBy("newest");
    setCurrentPage(1);
  };

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
    setCurrentPage(1);
  };

  // Filter sidebar content
  const FilterContent = () => (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      <div className="py-4 px-6 space-y-6">
        {/* Clear Filters at Top */}
        {activeFiltersCount > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={clearFilters}
              data-testid="button-clear-filters-top"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Clear ({activeFiltersCount})
            </Button>
            <Separator />
          </>
        )}

        {/* Search */}
        <div className="space-y-4">
          <Label htmlFor="search-input" className="text-base font-semibold">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              id="search-input"
              placeholder="Search services..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              onBlur={() => {
                if (searchInput !== searchQuery) {
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                }
              }}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </div>

        <Separator />

        {/* Categories */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Categories</Label>
          <div className="space-y-3">
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => toggleCategory(category.id)}
                    data-testid={`checkbox-category-${category.slug}`}
                  />
                  <label
                    htmlFor={`category-${category.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    {category.icon && <span>{category.icon}</span>}
                    <span>{category.name}</span>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator />

        {/* Price Range */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Price Range (CHF)</Label>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="price-min" className="text-xs text-muted-foreground">
                  Min
                </Label>
                <Input
                  id="price-min"
                  type="number"
                  min={0}
                  max={priceMax}
                  value={priceMin}
                  onChange={(e) => {
                    setPriceMin(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  data-testid="input-price-min"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="price-max" className="text-xs text-muted-foreground">
                  Max
                </Label>
                <Input
                  id="price-max"
                  type="number"
                  min={priceMin}
                  max={10000}
                  value={priceMax}
                  onChange={(e) => {
                    setPriceMax(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  data-testid="input-price-max"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Slider
                min={0}
                max={1000}
                step={1}
                value={[priceMinDrag, priceMaxDrag]}
                onValueChange={([min, max]) => {
                  setPriceMinDrag(min);
                  setPriceMaxDrag(max);
                }}
                onValueCommit={([min, max]) => {
                  setPriceMin(min);
                  setPriceMax(max);
                  setPriceMinDrag(min);
                  setPriceMaxDrag(max);
                  setCurrentPage(1);
                }}
                className="w-full transition-opacity hover:opacity-90"
                data-testid="slider-price-range"
              />
              <div className="flex justify-between text-xs text-muted-foreground transition-all">
                <span>CHF {priceMinDrag}</span>
                <span>CHF {priceMaxDrag}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Location */}
        <div className="space-y-4">
          <Label htmlFor="location-input" className="text-base font-semibold">Location</Label>
          <Input
            id="location-input"
            placeholder="City or canton..."
            value={locationInput}
            onChange={(e) => {
              setLocationInput(e.target.value);
            }}
            onBlur={() => {
              if (locationInput !== locationFilter) {
                setLocationFilter(locationInput);
                setCurrentPage(1);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setLocationFilter(locationInput);
                setCurrentPage(1);
              }
            }}
            data-testid="input-location"
          />
        </div>
      </div>
    </ScrollArea>
  );

  return (
    <Layout>
      <div className="bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold mb-2">Browse Services</h1>
              <p className="text-muted-foreground">
                Discover and filter through our comprehensive collection of professional services
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            {!isMobile && (
              <aside className="w-80 flex-shrink-0">
                <Card className="sticky top-8">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5" />
                        Filters
                      </h2>
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary">{activeFiltersCount}</Badge>
                      )}
                    </div>
                    <FilterContent />
                  </CardContent>
                </Card>
              </aside>
            )}

            {/* Main Content Area */}
            <div className="flex-1">
              {/* Mobile Filter Button & Sort */}
              <div className="flex items-center justify-between mb-6 gap-4">
                {isMobile && (
                  <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="gap-2" data-testid="button-open-filters">
                        <Filter className="w-4 h-4" />
                        Filters
                        {activeFiltersCount > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {activeFiltersCount}
                          </Badge>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <SlidersHorizontal className="w-5 h-5" />
                          Filters
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FilterContent />
                      </div>
                    </SheetContent>
                  </Sheet>
                )}

                {/* Sort Dropdown */}
                <div className="flex items-center gap-3 ml-auto">
                  <Label htmlFor="sort-select" className="text-sm whitespace-nowrap">
                    Sort by:
                  </Label>
                  <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                    <SelectTrigger id="sort-select" className="w-48" data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Filters Display */}
              {activeFiltersCount > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Active filters:
                  </span>
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      Search: {searchQuery}
                      <button
                        onClick={() => setSearchQuery("")}
                        className="ml-1 hover:text-destructive"
                        data-testid="badge-remove-search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedCategories.map((catId) => {
                    const category = categories.find((c) => c.id === catId);
                    return (
                      <Badge key={catId} variant="secondary" className="gap-1">
                        {category?.name}
                        <button
                          onClick={() => toggleCategory(catId)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`badge-remove-category-${category?.slug}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  {(priceMin > 0 || priceMax < 1000) && (
                    <Badge variant="secondary" className="gap-1">
                      CHF {priceMin} - {priceMax}
                      <button
                        onClick={() => {
                          setPriceMin(0);
                          setPriceMax(1000);
                        }}
                        className="ml-1 hover:text-destructive"
                        data-testid="badge-remove-price"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                  {locationFilter && (
                    <Badge variant="secondary" className="gap-1">
                      Location: {locationFilter}
                      <button
                        onClick={() => setLocationFilter("")}
                        className="ml-1 hover:text-destructive"
                        data-testid="badge-remove-location"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}

              {/* Results Count */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground" data-testid="text-results-count">
                  Showing {paginatedServices.length} of {filteredServices.length} services
                </p>
              </div>

              {/* Services Grid */}
              {servicesLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading services...</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-dashed">
                  <Package className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No services found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Try adjusting your filters to see more results
                  </p>
                  {activeFiltersCount > 0 && (
                    <Button onClick={clearFilters} variant="outline" data-testid="button-clear-no-results">
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <AnimatePresence mode="popLayout">
                      {paginatedServices.map((service, index) => (
                        <motion.div
                          key={service.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          layout
                          data-testid={`service-card-${service.id}`}
                        >
                          <ServiceCard service={service} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              data-testid={`button-page-${pageNum}`}
                              className={cn(
                                "w-10",
                                currentPage === pageNum && "pointer-events-none"
                              )}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

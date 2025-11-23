import { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface LocationSuggestion {
  id: string;
  displayName: string;
  city: string;
  postcode: string;
  canton: string;
  fullAddress: string;
}

interface LocationAutocompleteProps {
  locations: string[];
  onLocationsChange: (locations: string[]) => void;
  maxLocations?: number;
  label?: string;
  required?: boolean;
  testIdPrefix?: string;
}

export function LocationAutocomplete({
  locations,
  onLocationsChange,
  maxLocations = 10,
  label = "Service Locations",
  required = false,
  testIdPrefix = "location",
}: LocationAutocompleteProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = locations.length < maxLocations;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/location/search?q=${encodeURIComponent(query)}&limit=10`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          throw new Error(`Location search failed: ${response.status}`);
        }

        const data = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setSelectedIndex(-1);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Location search error:", error);
          toast({
            title: "Location search unavailable",
            description: "You can still type your location manually and press Enter.",
            variant: "default",
          });
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
      setIsLoading(false);
    };
  }, [query]);

  const addLocation = (location: string) => {
    const trimmedLocation = location.trim();
    
    if (!trimmedLocation) return;
    
    if (locations.includes(trimmedLocation)) {
      return;
    }

    if (locations.length >= maxLocations) {
      return;
    }

    onLocationsChange([...locations, trimmedLocation]);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const removeLocation = (index: number) => {
    onLocationsChange(locations.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key for both autocomplete and manual entry
    if (e.key === 'Enter' && query.trim().length >= 2) {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && suggestions[selectedIndex]) {
        // Add selected suggestion from autocomplete
        addLocation(suggestions[selectedIndex].displayName);
      } else {
        // Fallback: Add manually typed query
        addLocation(query.trim());
      }
      return;
    }

    // Only handle navigation keys if dropdown is open with suggestions
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="space-y-4" data-testid={`${testIdPrefix}-autocomplete-container`}>
      <div className="flex justify-between items-center">
        <Label htmlFor={`${testIdPrefix}-input`}>
          {label} {required && '*'}
        </Label>
        {maxLocations && (
          <span className="text-xs text-muted-foreground">
            {locations.length}/{maxLocations} locations
          </span>
        )}
      </div>

      {locations.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid={`${testIdPrefix}-chips-container`}>
          {locations.map((location, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="pl-3 pr-2 py-1.5 text-sm flex items-center gap-2"
              data-testid={`${testIdPrefix}-chip-${index}`}
            >
              <MapPin className="w-3 h-3" />
              {location}
              <button
                type="button"
                onClick={() => removeLocation(index)}
                className="ml-1 hover:text-destructive transition-colors"
                aria-label={`Remove ${location}`}
                data-testid={`${testIdPrefix}-remove-chip-${index}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {canAddMore && (
        <div ref={autocompleteRef} className="relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={`${testIdPrefix}-input`}
              type="text"
              placeholder="Search Swiss cities, postcodes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              className="pl-10 pr-10"
              data-testid={`${testIdPrefix}-search-input`}
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls={`${testIdPrefix}-suggestions`}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {isOpen && suggestions.length > 0 && (
            <div
              id={`${testIdPrefix}-suggestions`}
              className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border z-50 max-h-80 overflow-y-auto"
              role="listbox"
              data-testid={`${testIdPrefix}-dropdown`}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => addLocation(suggestion.displayName)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                    selectedIndex === index
                      ? 'bg-slate-100 dark:bg-slate-700'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  data-testid={`${testIdPrefix}-suggestion-${index}`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {suggestion.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {suggestion.fullAddress}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {isOpen && !isLoading && query.length >= 2 && suggestions.length === 0 && (
            <div
              className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border z-50 px-4 py-8 text-center"
              data-testid={`${testIdPrefix}-no-results`}
            >
              <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No locations found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for a Swiss city or postcode
              </p>
            </div>
          )}

          {!isOpen && query.length === 0 && locations.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Start typing to search locations...
            </p>
          )}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxLocations} locations reached
        </p>
      )}
    </div>
  );
}

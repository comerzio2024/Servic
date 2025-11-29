import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Map, ZoomIn, ZoomOut, X, Navigation, ExternalLink } from "lucide-react";
import type { ServiceWithDetails } from "@/lib/api";

interface GoogleMapsProps {
  services: (ServiceWithDetails & { distance?: number })[];
  userLocation: { lat: number; lng: number; name: string } | null;
  maxServices?: number;
  defaultExpanded?: boolean;
  apiKey?: string;
}

interface GoogleMapsWindow extends Window {
  google?: any;
}

export function GoogleMaps({
  services,
  userLocation,
  maxServices = 5,
  defaultExpanded = false,
  apiKey,
}: GoogleMapsProps) {
  if (!userLocation) return null;

  const [isMapVisible, setIsMapVisible] = useState(defaultExpanded);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);
  const currentInfoWindowRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const activeDirectionsServiceIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasFitBoundsRef = useRef(false);

  // Memoize filtered services to prevent unnecessary recalculations
  const closestServices = useMemo(() => 
    services
      .filter(s => {
        // Service has its own location OR owner has location
        return (s.locationLat && s.locationLng) || (s.owner?.locationLat && s.owner?.locationLng);
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, maxServices),
    [services, maxServices]
  );

  // Initialize directions service and renderer
  const initializeDirections = useCallback(() => {
    const google = (window as GoogleMapsWindow).google;
    if (!google || !mapRef.current) return;

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true, // We'll use our custom markers
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeOpacity: 0.7,
          strokeWeight: 4,
        },
      });
    }
  }, []);

  // Clear directions
  const clearDirections = useCallback(() => {
    if (directionsRendererRef.current) {
      // Remove the renderer from the map to fully clear it
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
      activeDirectionsServiceIdRef.current = null;
    }
  }, []);

  // Close all info windows
  const closeAllInfoWindows = useCallback(() => {
    infoWindowsRef.current.forEach((infoWindow: any) => {
      if (infoWindow) {
        infoWindow.close();
      }
    });
    currentInfoWindowRef.current = null;
  }, []);

  // Show directions for a specific service
  const showDirections = useCallback((service: ServiceWithDetails & { distance?: number }) => {
    const google = (window as GoogleMapsWindow).google;
    if (!google || !mapRef.current || !userLocation) return;

    // Use service's own location first, fallback to owner's location
    const serviceLat = service.locationLat ? parseFloat(service.locationLat as any) : (service.owner?.locationLat ? parseFloat(service.owner.locationLat as any) : null);
    const serviceLng = service.locationLng ? parseFloat(service.locationLng as any) : (service.owner?.locationLng ? parseFloat(service.owner.locationLng as any) : null);

    if (!serviceLat || !serviceLng || isNaN(serviceLat) || isNaN(serviceLng)) {
      console.error('Service missing location:', service.id, service.title, {
        serviceLocation: { lat: service.locationLat, lng: service.locationLng },
        ownerLocation: { lat: service.owner?.locationLat, lng: service.owner?.locationLng }
      });
      return;
    }

    // Clear previous directions by removing the renderer completely
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    activeDirectionsServiceIdRef.current = null;

    // Initialize directions service if needed
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    // Create LatLng objects for precise point-to-point routing
    const originLatLng = new google.maps.LatLng(userLocation.lat, userLocation.lng);
    const destinationLatLng = new google.maps.LatLng(serviceLat, serviceLng);

    console.log('Requesting directions:', {
      serviceId: service.id,
      serviceTitle: service.title,
      origin: { lat: userLocation.lat, lng: userLocation.lng },
      destination: { lat: serviceLat, lng: serviceLng },
      originLatLng: originLatLng.toString(),
      destinationLatLng: destinationLatLng.toString(),
    });

    const request = {
      origin: originLatLng,
      destination: destinationLatLng,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    };

    // Request the route first, then create renderer after we get the result
    directionsServiceRef.current.route(request, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK) {
        console.log('Directions received for service:', service.id, service.title);
        
        // Create a fresh directions renderer for this route
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true, // We'll use our custom markers
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 4,
          },
        });

        // Set the directions on the new renderer
        directionsRendererRef.current.setDirections(result);
        activeDirectionsServiceIdRef.current = service.id;
        
        // Fit map to show entire route
        const bounds = new google.maps.LatLngBounds();
        result.routes[0].legs[0].steps.forEach((step: any) => {
          bounds.extend(step.start_location);
          bounds.extend(step.end_location);
        });
        mapRef.current?.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      } else {
        console.error('Directions request failed:', status, 'for service:', service.id, service.title);
        activeDirectionsServiceIdRef.current = null;
      }
    });
  }, [userLocation]);

  // Update markers when services change
  const updateMarkers = useCallback((shouldFitBounds = false) => {
    const google = (window as GoogleMapsWindow).google;
    if (!google || !mapRef.current || !userLocation) return;

    // Clear existing markers and info windows
    markersRef.current.forEach((marker: any) => marker.setMap(null));
    markersRef.current = [];
    infoWindowsRef.current = [];
    currentInfoWindowRef.current = null;
    
    // Initialize directions if not already done
    initializeDirections();

    // Add user location marker
    const userMarker = new google.maps.Marker({
      map: mapRef.current,
      position: { lat: userLocation.lat, lng: userLocation.lng },
      title: userLocation.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
    });

    const userInfoWindow = new google.maps.InfoWindow({
      content: `<div style="padding: 8px; font-weight: bold;">${userLocation.name}<br/><small>Your location</small></div>`,
    });

    infoWindowsRef.current.push(userInfoWindow);

    userMarker.addListener("click", () => {
      // Close any other open info windows
      closeAllInfoWindows();
      userInfoWindow.open(mapRef.current, userMarker);
      currentInfoWindowRef.current = userInfoWindow;
    });

    markersRef.current.push(userMarker);

    // Add service markers
    const bounds = new google.maps.LatLngBounds(
      { lat: userLocation.lat, lng: userLocation.lng },
      { lat: userLocation.lat, lng: userLocation.lng }
    );

    // Track positions to add offset for overlapping markers
    const positionCounts: Record<string, number> = {};

    closestServices.forEach((service, index) => {
      // Use service's own location first, fallback to owner's location
      const serviceLat = service.locationLat ? parseFloat(service.locationLat as any) : (service.owner?.locationLat ? parseFloat(service.owner.locationLat as any) : null);
      const serviceLng = service.locationLng ? parseFloat(service.locationLng as any) : (service.owner?.locationLng ? parseFloat(service.owner.locationLng as any) : null);
      
      if (!serviceLat || !serviceLng || isNaN(serviceLat) || isNaN(serviceLng)) return;

      let adjustedLat = serviceLat;
      let adjustedLng = serviceLng;

      // Create a key for this position to detect duplicates
      const posKey = `${adjustedLat.toFixed(4)},${adjustedLng.toFixed(4)}`;
      const count = positionCounts[posKey] || 0;
      positionCounts[posKey] = count + 1;

      // Add small offset for overlapping markers (circle pattern)
      if (count > 0) {
        const angle = (count * 60) * (Math.PI / 180); // 60 degrees apart
        const offsetDistance = 0.002; // ~200m offset
        adjustedLat += offsetDistance * Math.cos(angle);
        adjustedLng += offsetDistance * Math.sin(angle);
      }

      const serviceMarker = new google.maps.Marker({
        map: mapRef.current,
        position: { lat: adjustedLat, lng: adjustedLng },
        title: service.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          label: {
            text: String(index + 1),
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
          },
        },
      });

      // Generate pricing display based on priceType
      let priceDisplay = '';
      if (service.priceType === 'fixed') {
        priceDisplay = `<div style="display: flex; flex-direction: column; gap: 0;">
          <span style="color: #3b82f6; font-weight: 700; font-size: 1rem;">CHF ${service.price}</span>
          <span style="color: #6b7280; font-size: 0.75rem;">per ${service.priceUnit}</span>
        </div>`;
      } else if (service.priceType === 'text') {
        priceDisplay = `<a href="/service/${service.id}" style="color: #3b82f6; font-weight: 600; text-decoration: underline;">Visit Listing</a>`;
      } else if (service.priceType === 'list') {
        const firstPrice = (service.priceList as any)?.[0]?.price;
        priceDisplay = `<span style="color: #3b82f6; font-weight: 600;">From CHF ${firstPrice || 'N/A'}</span>`;
      }

      // Get service image (first image or placeholder)
      const serviceImage = service.images && service.images.length > 0 
        ? service.images[0] 
        : null;
      
      const imageHtml = serviceImage 
        ? `<img src="${serviceImage}" alt="${service.title}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
        : '';

      // Build Google Maps directions URL using address strings
      // Use user's location name for origin, and service location or title for destination
      const originAddress = encodeURIComponent(userLocation.name);
      const destinationAddress = service.locations && service.locations.length > 0
        ? encodeURIComponent(service.locations[0])
        : encodeURIComponent(service.title);
      // Also include coordinates as fallback for better accuracy
      const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originAddress}&destination=${destinationAddress}`;

      // Create unique IDs for buttons to handle clicks
      const infoWindowId = `info-window-${service.id}`;
      const getDirectionsBtnId = `get-directions-${service.id}`;
      const googleMapsBtnId = `google-maps-${service.id}`;

      const serviceInfoWindow = new google.maps.InfoWindow({
        content: `
          <div id="${infoWindowId}" style="min-width: 250px; max-width: 300px; padding: 0;">
            ${imageHtml}
            <div style="padding: 8px;">
              <a href="/service/${service.id}" style="text-decoration: none; color: inherit;">
                <strong style="display: block; margin-bottom: 6px; color: #1e293b; font-size: 1rem; line-height: 1.3;">${service.title}</strong>
              </a>
              ${priceDisplay}
              ${service.distance ? `<small style="color: #64748b; display: block; margin-top: 6px; margin-bottom: 8px;">${service.distance.toFixed(1)} km away</small>` : ''}
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
                <button id="${getDirectionsBtnId}" style="
                  background-color: #3b82f6;
                  color: white;
                  border: none;
                  padding: 8px 12px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 0.875rem;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: background-color 0.2s;
                " onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Get Directions
                </button>
                <a href="${googleMapsDirectionsUrl}" target="_blank" rel="noopener noreferrer" style="
                  background-color: #f1f5f9;
                  color: #1e293b;
                  border: 1px solid #e2e8f0;
                  padding: 8px 12px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 0.875rem;
                  font-weight: 600;
                  text-decoration: none;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  transition: background-color 0.2s;
                  text-align: center;
                " onmouseover="this.style.backgroundColor='#e2e8f0'" onmouseout="this.style.backgroundColor='#f1f5f9'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                  </svg>
                  Get Directions in Google Maps
                </a>
              </div>
            </div>
          </div>
          <script>
            (function() {
              const btn = document.getElementById('${getDirectionsBtnId}');
              if (btn) {
                btn.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('show-directions', { detail: { serviceId: '${service.id}' } }));
                });
              }
            })();
          </script>
        `,
      });

      infoWindowsRef.current.push(serviceInfoWindow);

      serviceMarker.addListener("click", () => {
        // Close any other open info windows
        closeAllInfoWindows();
        
        // Clear any existing directions when opening a new info window
        if (activeDirectionsServiceIdRef.current !== service.id) {
          clearDirections();
        }
        
        serviceInfoWindow.open(mapRef.current, serviceMarker);
        currentInfoWindowRef.current = serviceInfoWindow;
        
        // Set up event listener for directions button after info window opens
        // Use a closure to capture the correct service
        setTimeout(() => {
          const getDirectionsBtn = document.getElementById(`get-directions-${service.id}`);
          if (getDirectionsBtn) {
            // Store the service ID in a data attribute to ensure we use the correct service
            const currentServiceId = service.id;
            const currentService = service; // Capture service in closure
            
            // Remove any existing listeners to avoid duplicates
            const newBtn = getDirectionsBtn.cloneNode(true);
            getDirectionsBtn.parentNode?.replaceChild(newBtn, getDirectionsBtn);
            
            newBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Find the service from the services array to ensure we have the latest data
              const serviceToUse = closestServices.find(s => s.id === currentServiceId) || currentService;
              
              console.log('Get Directions clicked for service:', serviceToUse.id, serviceToUse.title);
              showDirections(serviceToUse);
              
              // Close the info window after showing directions
              serviceInfoWindow.close();
              currentInfoWindowRef.current = null;
            });
          }
        }, 100);
      });

      markersRef.current.push(serviceMarker);
      bounds.extend({ lat: adjustedLat, lng: adjustedLng });
    });

    // Only fit bounds on initial load or when explicitly requested
    if (shouldFitBounds && closestServices.length > 0) {
      mapRef.current?.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      hasFitBoundsRef.current = true;
    }
  }, [userLocation, closestServices, initializeDirections, clearDirections, closeAllInfoWindows]);

  // Initialize map only once when it becomes visible
  useEffect(() => {
    if (!isMapVisible || !mapContainerRef.current || isInitializedRef.current || !apiKey) return;

    const win = window as GoogleMapsWindow;

    function initializeMap() {
      const google = (window as GoogleMapsWindow).google;
      if (!google || !mapContainerRef.current || !userLocation) return;

      const map = new google.maps.Map(mapContainerRef.current as any, {
        zoom: 12,
        center: { lat: userLocation.lat, lng: userLocation.lng },
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      });

      // Add click listener to map to close info windows when clicking outside
      map.addListener("click", () => {
        closeAllInfoWindows();
      });

      mapRef.current = map;
      isInitializedRef.current = true;
      hasFitBoundsRef.current = false;
      // Fit bounds on initial load
      updateMarkers(true);
    }

    // Load Google Maps script if not already loaded (with directions library)
    if (!win.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=directions`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      document.head.appendChild(script);
    } else {
      // Check if directions library is loaded
      if (win.google.maps && win.google.maps.DirectionsService) {
        initializeMap();
      } else {
        // Reload with directions library
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=directions&callback=initMap`;
        script.async = true;
        script.defer = true;
        (window as any).initMap = initializeMap;
        document.head.appendChild(script);
      }
    }
  }, [isMapVisible, apiKey]);

  // Update markers when services change (without refitting bounds)
  useEffect(() => {
    if (isMapVisible && isInitializedRef.current && hasFitBoundsRef.current) {
      updateMarkers(false);
    }
  }, [closestServices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker: any) => marker.setMap(null));
      markersRef.current = [];
    };
  }, []);

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.setZoom((mapRef.current.getZoom() || 12) + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.setZoom((mapRef.current.getZoom() || 12) - 1);
    }
  };

  if (closestServices.length === 0) {
    return (
      <div className="text-center text-slate-500 py-4" data-testid="text-no-services-map">
        No services with locations available to display on the map.
      </div>
    );
  }

  const handleToggleMap = () => {
    if (!apiKey) {
      alert("Google Maps API key is not configured. Please add it in the admin panel settings.");
      return;
    }
    setIsMapVisible(!isMapVisible);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleMap}
          className="gap-2"
          data-testid="button-toggle-map"
        >
          {isMapVisible ? (
            <>
              <X className="w-4 h-4" />
              Collapse Map
            </>
          ) : (
            <>
              <Map className="w-4 h-4" />
              Show Map ({closestServices.length} locations)
            </>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {isMapVisible && apiKey && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 400, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden rounded-lg border border-slate-200"
          >
            <div className="relative w-full h-full">
              <div
                ref={mapContainerRef}
                className="w-full h-full"
                data-testid="service-map"
                style={{ minHeight: "400px" }}
              />

              {/* Custom zoom controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleZoomIn}
                  className="bg-white hover:bg-slate-50 shadow-lg"
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleZoomOut}
                  className="bg-white hover:bg-slate-50 shadow-lg"
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

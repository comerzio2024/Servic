import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Map, ZoomIn, ZoomOut, X, Navigation, ExternalLink } from "lucide-react";
import type { ServiceWithDetails } from "@/lib/api";
import { geocodeLocation } from '@/lib/geocoding';

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
  // Store the coordinates used for each service marker to ensure directions use the same coordinates
  const serviceCoordinatesRef = useRef<Record<string, { lat: number; lng: number }>>({});

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
  const showDirections = useCallback(async (service: ServiceWithDetails & { distance?: number }) => {
    const google = (window as GoogleMapsWindow).google;
    if (!google || !mapRef.current || !userLocation) return;

    // FIRST: Check if we have stored coordinates from the marker (this ensures we use the SAME coordinates as the marker)
    let serviceLat: number | null = null;
    let serviceLng: number | null = null;
    
    const storedCoords = serviceCoordinatesRef.current[service.id];
    if (storedCoords) {
      serviceLat = storedCoords.lat;
      serviceLng = storedCoords.lng;
      console.log('=== USING STORED COORDINATES FROM MARKER ===', {
        serviceId: service.id,
        serviceTitle: service.title,
        storedCoords: { lat: serviceLat, lng: serviceLng },
      });
    } else {
      // Fallback: Parse coordinates - use service.locationLat/lng if they exist and are valid
      if (service.locationLat) {
        const parsed = parseFloat(service.locationLat as any);
        if (!isNaN(parsed)) {
          serviceLat = parsed;
        }
      }
      
      if (service.locationLng) {
        const parsed = parseFloat(service.locationLng as any);
        if (!isNaN(parsed)) {
          serviceLng = parsed;
        }
      }
      
      // If service doesn't have coordinates, try to geocode from locations array
      if ((!serviceLat || !serviceLng) && service.locations && service.locations.length > 0) {
        console.log('=== GEOCODING SERVICE LOCATION (FALLBACK) ===', {
          serviceId: service.id,
          serviceTitle: service.title,
          locationAddress: service.locations[0],
          allLocations: service.locations,
        });
        try {
          const geocoded = await geocodeLocation(service.locations[0]);
          serviceLat = geocoded.lat;
          serviceLng = geocoded.lng;
          console.log('=== GEOCODING RESULT ===', {
            serviceId: service.id,
            originalAddress: service.locations[0],
            geocodedCoords: { lat: serviceLat, lng: serviceLng },
            displayName: geocoded.displayName,
          });
        } catch (error) {
          console.error('Failed to geocode service location:', error);
        }
      }
      
      // Fallback to owner's location if service doesn't have its own and geocoding failed
      if (!serviceLat || !serviceLng) {
        if (service.owner?.locationLat) {
          const parsed = parseFloat(service.owner.locationLat as any);
          if (!isNaN(parsed)) {
            serviceLat = parsed;
          }
        }
        if (service.owner?.locationLng) {
          const parsed = parseFloat(service.owner.locationLng as any);
          if (!isNaN(parsed)) {
            serviceLng = parsed;
          }
        }
      }
    }

    if (!serviceLat || !serviceLng || isNaN(serviceLat) || isNaN(serviceLng)) {
      console.error('Service missing location:', service.id, service.title, {
        storedCoords: storedCoords,
        serviceLocation: { lat: service.locationLat, lng: service.locationLng },
        ownerLocation: { lat: service.owner?.locationLat, lng: service.owner?.locationLng },
        locationsArray: service.locations,
      });
      return;
    }

    console.log('=== SHOW DIRECTIONS CALLED ===', {
      serviceId: service.id,
      serviceTitle: service.title,
      serviceLat,
      serviceLng,
      previousActiveService: activeDirectionsServiceIdRef.current,
    });

    // Aggressively clear previous directions
    if (directionsRendererRef.current) {
      console.log('Clearing previous directions renderer');
      try {
        // Clear directions first
        directionsRendererRef.current.setDirections({ routes: [] });
        // Remove from map
        directionsRendererRef.current.setMap(null);
      } catch (e) {
        console.warn('Error clearing renderer:', e);
      }
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
        const endLocation = result.routes[0].legs[0].end_location;
        const endLat = typeof endLocation.lat === 'function' ? endLocation.lat() : endLocation.lat;
        const endLng = typeof endLocation.lng === 'function' ? endLocation.lng() : endLocation.lng;
        
        console.log('=== DIRECTIONS RECEIVED ===', {
          serviceId: service.id,
          serviceTitle: service.title,
          routeDistance: result.routes[0].legs[0].distance?.text,
          routeDuration: result.routes[0].legs[0].duration?.text,
          startAddress: result.routes[0].legs[0].start_address,
          endAddress: result.routes[0].legs[0].end_address,
          requestedDestination: { lat: serviceLat, lng: serviceLng },
          actualDestination: { lat: endLat, lng: endLng },
          destinationMatch: Math.abs(endLat - serviceLat) < 0.001 && Math.abs(endLng - serviceLng) < 0.001,
          serviceLocationAddress: service.locations?.[0],
          routeOverviewPolyline: result.routes[0].overview_polyline?.points?.substring(0, 50) + '...',
        });
        
        // Double-check: clear any existing renderer
        if (directionsRendererRef.current) {
          console.log('Removing existing renderer before creating new one');
          try {
            directionsRendererRef.current.setDirections({ routes: [] });
            directionsRendererRef.current.setMap(null);
          } catch (e) {
            console.warn('Error clearing renderer:', e);
          }
          directionsRendererRef.current = null;
        }
        
        // Generate a unique color based on service ID for debugging
        const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
        const colorIndex = parseInt(service.id.slice(-1)) % colors.length || 0;
        const routeColor = colors[colorIndex];
        
        // Create a completely fresh directions renderer for this route
        console.log('Creating new directions renderer for service:', service.id, 'with color:', routeColor);
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true, // We'll use our custom markers
          polylineOptions: {
            strokeColor: routeColor, // Use unique color per service for debugging
            strokeOpacity: 0.8,
            strokeWeight: 5,
          },
        });

        // Set the directions on the new renderer
        directionsRendererRef.current.setDirections(result);
        activeDirectionsServiceIdRef.current = service.id;
        
        console.log('=== DIRECTIONS RENDERER SET ===', {
          serviceId: service.id,
          rendererAttached: directionsRendererRef.current.getMap() ? 'yes' : 'no',
          routeSteps: result.routes[0].legs[0].steps.length,
          routeColor: routeColor,
          firstStep: result.routes[0].legs[0].steps[0]?.instructions?.substring(0, 50),
          lastStep: result.routes[0].legs[0].steps[result.routes[0].legs[0].steps.length - 1]?.instructions?.substring(0, 50),
          overviewPolyline: result.routes[0].overview_polyline?.points?.substring(0, 100) + '...',
        });
        
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
  const updateMarkers = useCallback(async (shouldFitBounds = false) => {
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

    // Log summary of all services and their locations
    console.log('=== ALL SERVICES LOCATION SUMMARY ===', closestServices.map(s => ({
      id: s.id,
      title: s.title,
      hasOwnLocation: !!(s.locationLat && s.locationLng),
      serviceLocation: { lat: s.locationLat, lng: s.locationLng },
      ownerId: s.owner?.id,
      ownerLocation: { lat: s.owner?.locationLat, lng: s.owner?.locationLng },
    })));

    // Geocode service locations in parallel if needed
    const geocodePromises = closestServices.map(async (service) => {
      // Use service's own location first, fallback to owner's location
      let serviceLat = service.locationLat ? parseFloat(service.locationLat as any) : null;
      let serviceLng = service.locationLng ? parseFloat(service.locationLng as any) : null;
      
      // If service doesn't have coordinates, try to geocode from locations array
      if ((!serviceLat || !serviceLng || isNaN(serviceLat) || isNaN(serviceLng)) && service.locations && service.locations.length > 0) {
        try {
          const geocoded = await geocodeLocation(service.locations[0]);
          serviceLat = geocoded.lat;
          serviceLng = geocoded.lng;
          console.log(`[Geocoded] Service: ${service.id} (${service.title})`, {
            address: service.locations[0],
            coordinates: { lat: serviceLat, lng: serviceLng },
          });
        } catch (error) {
          console.warn(`Failed to geocode service ${service.id}:`, error);
        }
      }
      
      // Fallback to owner's location
      if (!serviceLat || !serviceLng || isNaN(serviceLat) || isNaN(serviceLng)) {
        serviceLat = service.owner?.locationLat ? parseFloat(service.owner.locationLat as any) : null;
        serviceLng = service.owner?.locationLng ? parseFloat(service.owner.locationLng as any) : null;
      }
      
      if (serviceLat && serviceLng && !isNaN(serviceLat) && !isNaN(serviceLng)) {
        // Store the coordinates used for this service
        serviceCoordinatesRef.current[service.id] = { lat: serviceLat, lng: serviceLng };
        return { service, serviceLat, serviceLng };
      }
      return null;
    });
    
    const geocodedServices = (await Promise.all(geocodePromises)).filter((s): s is NonNullable<typeof s> => s !== null);

    geocodedServices.forEach(({ service, serviceLat, serviceLng }, index) => {
      // Log coordinates for debugging
      console.log(`[Marker ${index + 1}] Service: ${service.id} (${service.title})`, {
        serviceLocation: { lat: service.locationLat, lng: service.locationLng },
        ownerLocation: { lat: service.owner?.locationLat, lng: service.owner?.locationLng },
        ownerId: service.owner?.id,
        usingCoords: { lat: serviceLat, lng: serviceLng },
        source: service.locationLat ? 'service' : (service.locations?.[0] ? 'geocoded' : 'owner'),
      });

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

      // Build Google Maps directions URL using stored coordinates (same as marker)
      // This ensures the external link uses the exact same coordinates as the marker and embedded directions
      const storedCoordsForUrl = serviceCoordinatesRef.current[service.id] || { lat: serviceLat, lng: serviceLng };
      const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${storedCoordsForUrl.lat},${storedCoordsForUrl.lng}`;

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
        // IMPORTANT: Capture coordinates in the closure to avoid all buttons using the same values
        // Create a function that captures the specific service's coordinates
        const setupDirectionsButton = (serviceId: string, serviceTitle: string, capturedLat: number, capturedLng: number, serviceObj: any) => {
          setTimeout(() => {
            const getDirectionsBtn = document.getElementById(`get-directions-${serviceId}`);
            if (getDirectionsBtn) {
              console.log('Setting up directions button for service:', serviceId, {
                capturedCoords: { lat: capturedLat, lng: capturedLng },
                serviceLocation: { lat: serviceObj.locationLat, lng: serviceObj.locationLng },
                ownerLocation: { lat: serviceObj.owner?.locationLat, lng: serviceObj.owner?.locationLng },
              });
              
              // Remove any existing listeners to avoid duplicates
              const newBtn = getDirectionsBtn.cloneNode(true);
              getDirectionsBtn.parentNode?.replaceChild(newBtn, getDirectionsBtn);
              
              newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Create a service object with the CORRECT coordinates we captured in the closure
                // Include the locations array so geocoding can happen if needed
                const serviceWithCorrectCoords = {
                  ...serviceObj,
                  locationLat: serviceObj.locationLat || null, // Keep original, will be geocoded if null
                  locationLng: serviceObj.locationLng || null, // Keep original, will be geocoded if null
                  locations: serviceObj.locations || [], // Ensure locations array is included
                  owner: {
                    ...serviceObj.owner,
                    locationLat: serviceObj.owner?.locationLat || null,
                    locationLng: serviceObj.owner?.locationLng || null,
                  },
                };
                
                console.log('=== GET DIRECTIONS CLICKED ===', {
                  serviceId: serviceWithCorrectCoords.id,
                  serviceTitle: serviceWithCorrectCoords.title,
                  capturedCoordinates: { lat: capturedLat, lng: capturedLng },
                  serviceObject: {
                    locationLat: serviceWithCorrectCoords.locationLat,
                    locationLng: serviceWithCorrectCoords.locationLng,
                    locations: serviceWithCorrectCoords.locations,
                    ownerLocationLat: serviceWithCorrectCoords.owner?.locationLat,
                    ownerLocationLng: serviceWithCorrectCoords.owner?.locationLng,
                  },
                });
                
                // showDirections is now async and will geocode if needed
                await showDirections(serviceWithCorrectCoords);
                
                // Close the info window after showing directions
                serviceInfoWindow.close();
                currentInfoWindowRef.current = null;
              });
            }
          }, 100);
        };
        
        // Use the stored coordinates from serviceCoordinatesRef (which were used for the marker)
        // This ensures directions use the EXACT same coordinates as the marker
        const storedCoords = serviceCoordinatesRef.current[service.id];
        const coordsToUse = storedCoords || { lat: serviceLat, lng: serviceLng };
        
        // Log what we're passing to verify each service has different coordinates
        console.log(`[Setup Button] Service: ${service.id} (${service.title})`, {
          storedCoords: storedCoords,
          fallbackCoords: { lat: serviceLat, lng: serviceLng },
          usingCoords: coordsToUse,
          serviceHasOwnLocation: !!(service.locationLat && service.locationLng),
          serviceLocation: { lat: service.locationLat, lng: service.locationLng },
          ownerLocation: { lat: service.owner?.locationLat, lng: service.owner?.locationLng },
          ownerId: service.owner?.id,
        });
        setupDirectionsButton(service.id, service.title, coordsToUse.lat, coordsToUse.lng, service);
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

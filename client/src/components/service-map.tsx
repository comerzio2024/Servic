import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';
import type { ServiceWithDetails } from '@/lib/api';
import { useState, useEffect } from 'react';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icon for user location (green)
const userMarkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Calculate distance using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface ServiceMapProps {
  service: ServiceWithDetails;
  userLocation: { lat: number; lng: number } | null;
}

export function ServiceMap({ service, userLocation }: ServiceMapProps) {
  const [mapHeight, setMapHeight] = useState(400);

  useEffect(() => {
    const updateHeight = () => {
      setMapHeight(window.innerWidth < 768 ? 300 : 400);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (!service.owner.locationLat || !service.owner.locationLng) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500">Location not specified</p>
        {service.locations && service.locations.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            Serving: {service.locations.join(', ')}
          </p>
        )}
      </div>
    );
  }

  const serviceLat = parseFloat(service.owner.locationLat);
  const serviceLng = parseFloat(service.owner.locationLng);

  return (
    <>
      <div className="rounded-lg overflow-hidden border border-border mb-4" style={{ height: `${mapHeight}px` }}>
        <MapContainer
          center={[serviceLat, serviceLng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          data-testid="service-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Service location marker */}
          <Marker position={[serviceLat, serviceLng]}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold">{service.title}</p>
                <p className="text-sm text-muted-foreground">{service.locations[0] || 'Service location'}</p>
              </div>
            </Popup>
          </Marker>
          
          {/* User location marker */}
          {userLocation && (
            <>
              <Marker 
                position={[userLocation.lat, userLocation.lng]}
                icon={userMarkerIcon}
              >
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold flex items-center gap-1">
                      <Navigation className="w-4 h-4" />
                      Your location
                    </p>
                  </div>
                </Popup>
              </Marker>
              
              {/* Distance line */}
              <Polyline
                positions={[
                  [userLocation.lat, userLocation.lng],
                  [serviceLat, serviceLng]
                ]}
                color="#3b82f6"
                dashArray="5, 10"
                weight={2}
              />
            </>
          )}
        </MapContainer>
      </div>
      
      {/* Location info */}
      <div className="space-y-2">
        {service.locations && service.locations.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Service Location{service.locations.length > 1 ? 's' : ''}</p>
              <p className="text-muted-foreground">{service.locations.join(', ')}</p>
            </div>
          </div>
        )}
        
        {userLocation && (
          <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200">
            <Navigation className="w-4 h-4" />
            <span className="font-medium">
              {calculateDistance(
                userLocation.lat,
                userLocation.lng,
                serviceLat,
                serviceLng
              ).toFixed(1)} km from your location
            </span>
          </div>
        )}
      </div>
    </>
  );
}

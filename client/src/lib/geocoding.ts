/**
 * Shared geocoding utilities for location search and address validation
 * Centralizes all geocoding API calls to ensure consistent behavior across the app
 */

export interface GeocodingSuggestion {
  display_name: string;
  lat: number;
  lon: number;
  city: string;
  postcode: string;
  street: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  name: string;
}

export interface AddressData {
  street: string;
  city: string;
  postalCode: string;
  canton: string;
  fullAddress: string;
}

/**
 * Search for location suggestions based on a query string
 * @param query - The search query
 * @param limit - Maximum number of results to return
 * @param signal - Optional AbortSignal to cancel the request
 * @returns Array of geocoding suggestions
 */
export async function searchGeocodeSuggestions(
  query: string,
  limit: number = 10,
  signal?: AbortSignal
): Promise<GeocodingSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const response = await fetch('/api/geocode/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.trim(),
        limit,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch geocoding suggestions');
    }

    const results = await response.json();
    return results || [];
  } catch (error) {
    console.error('Error fetching geocode suggestions:', error);
    throw error;
  }
}

/**
 * Geocode a single location query to get coordinates and formatted name
 * @param query - The location query
 * @returns Geocoded location with coordinates
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  if (!query || query.trim().length === 0) {
    throw new Error('Query is required');
  }

  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location: query.trim() }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to geocode location');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error geocoding location:', error);
    throw error;
  }
}

/**
 * Convert a geocoding suggestion to standardized geocode result format
 * Normalizes lon→lng and provides consistent naming
 * @param suggestion - The geocoding suggestion
 * @returns Standardized geocode result
 */
export function suggestionToGeocodeResult(suggestion: GeocodingSuggestion): GeocodeResult {
  return {
    lat: suggestion.lat,
    lng: suggestion.lon, // Normalize lon → lng
    displayName: suggestion.display_name,
    name: suggestion.city || suggestion.postcode || suggestion.display_name,
  };
}

/**
 * Convert a geocoding suggestion to address data format
 * @param suggestion - The geocoding suggestion
 * @returns Formatted address data
 */
export function suggestionToAddressData(suggestion: GeocodingSuggestion): AddressData {
  return {
    street: suggestion.street || '',
    city: suggestion.city || '',
    postalCode: suggestion.postcode || '',
    canton: '', // Canton is typically extracted from state field in address
    fullAddress: suggestion.display_name,
  };
}

/**
 * Format a full address string from components
 * @param address - Address components
 * @returns Formatted address string
 */
export function formatAddress(address: {
  street?: string;
  postalCode?: string;
  city?: string;
  canton?: string;
}): string {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.postalCode || address.city) {
    const cityPart = [address.postalCode, address.city].filter(Boolean).join(' ');
    parts.push(cityPart);
  }
  if (address.canton) parts.push(address.canton);
  
  return parts.join(', ');
}

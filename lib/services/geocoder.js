/**
 * Geocoding Service using Mapbox Geocoding API
 *
 * Converts addresses to geographic coordinates and extracts location attributes.
 * Used for client location detection and coverage area matching.
 */

/**
 * Geocode an address using Mapbox Geocoding API
 * @param {string} address - The address to geocode
 * @returns {Promise<Object>} Geocoding result with coordinates and location attributes
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') {
    return {
      success: false,
      error: 'Invalid address provided'
    };
  }

  const apiKey = process.env.MAPBOX_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'MAPBOX_API_KEY environment variable not set'
    };
  }

  try {
    // Encode address for URL
    const encodedAddress = encodeURIComponent(address.trim());

    // Mapbox Geocoding API endpoint
    // Use country=us to limit results to United States
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?country=us&access_token=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Check if we got any results
    if (!data.features || data.features.length === 0) {
      return {
        success: false,
        error: 'No results found for this address',
        query: address
      };
    }

    // Get the best match (first result)
    const feature = data.features[0];

    // Extract coordinates [lng, lat] from Mapbox
    const [lng, lat] = feature.center;

    // Extract location attributes from context
    const context = feature.context || [];

    // Parse context to extract state, county, city, zipcode
    let state = null;
    let stateCode = null;
    let county = null;
    let city = null;
    let zipcode = null;

    // Extract from context array
    for (const item of context) {
      if (item.id.startsWith('region.')) {
        // State
        state = item.text;
        stateCode = item.short_code?.replace('US-', ''); // e.g., "US-CA" -> "CA"
      } else if (item.id.startsWith('district.')) {
        // County (in Mapbox, counties are "district")
        county = item.text;
      } else if (item.id.startsWith('place.')) {
        // City
        city = item.text;
      } else if (item.id.startsWith('postcode.')) {
        // ZIP code
        zipcode = item.text;
      }
    }

    // If feature itself is a place (city), use it
    if (!city && feature.place_type?.includes('place')) {
      city = feature.text;
    }

    // If feature is a postcode, extract it
    if (!zipcode && feature.place_type?.includes('postcode')) {
      zipcode = feature.text;
    }

    return {
      success: true,
      coordinates: {
        lat,
        lng
      },
      formattedAddress: feature.place_name,
      location: {
        city,
        county,
        state,
        stateCode,
        zipcode
      },
      // Relevance score from Mapbox (0-1, where 1 is perfect match)
      relevance: feature.relevance,
      // Full feature for debugging
      _raw: feature
    };

  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      success: false,
      error: error.message,
      query: address
    };
  }
}

/**
 * Reverse geocode coordinates to an address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Reverse geocoding result
 */
export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      success: false,
      error: 'Invalid coordinates provided'
    };
  }

  const apiKey = process.env.MAPBOX_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'MAPBOX_API_KEY environment variable not set'
    };
  }

  try {
    // Mapbox reverse geocoding endpoint
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return {
        success: false,
        error: 'No address found for these coordinates'
      };
    }

    const feature = data.features[0];

    return {
      success: true,
      address: feature.place_name,
      // Parse context same as forward geocoding
      _raw: feature
    };

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  geocodeAddress,
  reverseGeocode
};

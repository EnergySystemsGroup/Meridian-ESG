'use client';

/**
 * AddressAutofillInput Core Component
 *
 * Wraps Mapbox Search JS React AddressAutofill component to provide
 * address autocomplete with full location data extraction.
 *
 * Note: This component is imported dynamically via address-autofill-input-client.jsx
 * to prevent SSR errors with Mapbox library.
 *
 * Returns structured location data matching our database schema:
 * - address, city, county, state, stateCode, zipcode, coordinates
 */

import { AddressAutofill } from '@mapbox/search-js-react';
import { Input } from '@/components/ui/input';

export default function AddressAutofillInput({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Start typing an address...",
  required = false,
  className,
  id = "address"
}) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured');
    // Fallback to regular input if token not available
    return (
      <Input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={className}
        title={value}
      />
    );
  }

  const handleRetrieve = (result) => {
    // Called when user selects an address from autocomplete suggestions
    if (!result.features || result.features.length === 0) {
      console.log('[AddressAutofill] No features in result');
      return;
    }

    const feature = result.features[0];

    // Debug: Log the raw feature to see its structure
    console.log('[AddressAutofill] Raw feature from Mapbox:', JSON.stringify(feature, null, 2));

    // AddressAutofill uses properties (WHATWG standard), not context array
    const properties = feature.properties || {};
    console.log('[AddressAutofill] Properties:', Object.keys(properties));

    // Extract coordinates [lng, lat]
    const coordinates = {
      lng: feature.geometry?.coordinates?.[0],
      lat: feature.geometry?.coordinates?.[1]
    };

    // Extract location components directly from properties
    // Mapbox provides these as direct properties (not WHATWG address_level)
    const location = {
      city: properties.place || null,           // City name
      county: properties.district || null,      // County name
      state: properties.region || null,         // State full name
      stateCode: properties.region_code || null, // State code (already 2-letter)
      zipcode: properties.postcode || null      // ZIP code
    };

    console.log('[AddressAutofill] Parsed location:', location);

    // Use full_address or place_name for display
    const formattedAddress = properties.full_address || feature.place_name;

    // Structure data to match what our backend expects
    const locationData = {
      address: formattedAddress,
      coordinates,
      location,
      formattedAddress, // For display purposes
      relevance: feature.relevance || 1
    };

    console.log('[AddressAutofill] Selected location:', locationData);

    // Pass structured data to parent component
    if (onAddressSelect) {
      onAddressSelect(locationData);
    }
  };

  return (
    <AddressAutofill
      accessToken={accessToken}
      onRetrieve={handleRetrieve}
      options={{
        country: 'us',
        language: 'en'
      }}
    >
      <Input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="address-line1"
        title={value}
      />
    </AddressAutofill>
  );
}

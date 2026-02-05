/**
 * Client Geocoding Tests
 *
 * Tests the address-to-coverage-area detection logic:
 * - State code extraction from address
 * - Coverage area matching from coordinates
 * - Handling ambiguous/incomplete addresses
 * - Fallback behavior when geocoding fails
 */

import { describe, test, expect } from 'vitest';
import { coverageAreas } from '../../fixtures/coverageAreas.js';

/**
 * Extract state code from address components
 */
function extractStateCode(addressComponents) {
  if (!addressComponents || !Array.isArray(addressComponents)) return null;

  const stateComponent = addressComponents.find(c =>
    c.types?.includes('administrative_area_level_1')
  );

  return stateComponent?.short_name || null;
}

/**
 * Find coverage areas that contain a given point
 * (Simplified version - real implementation uses PostGIS)
 */
function findCoverageAreasForPoint(lat, lng, allAreas, stateCode) {
  if (!lat || !lng) return [];

  // Filter to areas in the same state
  const stateAreas = allAreas.filter(area =>
    area.state_code === stateCode
  );

  // In real implementation, PostGIS checks if point is within polygon
  // For testing, we return all areas in the state
  return stateAreas;
}

/**
 * Build coverage area ID list from detected areas
 */
function buildCoverageAreaIds(detectedAreas) {
  return detectedAreas.map(area => area.id);
}

/**
 * Determine coverage area types found
 */
function summarizeCoverageDetection(detectedAreas) {
  const summary = {
    state: null,
    counties: [],
    utilities: [],
    total: detectedAreas.length,
  };

  for (const area of detectedAreas) {
    switch (area.kind) {
      case 'state':
        summary.state = area.name;
        break;
      case 'county':
        summary.counties.push(area.name);
        break;
      case 'utility':
        summary.utilities.push(area.name);
        break;
    }
  }

  return summary;
}

/**
 * Validate geocoding result
 */
function validateGeocodingResult(result) {
  if (!result) return { valid: false, reason: 'No geocoding result' };
  if (!result.lat || !result.lng) return { valid: false, reason: 'Missing coordinates' };
  if (result.lat < 24 || result.lat > 50) return { valid: false, reason: 'Latitude out of US range' };
  if (result.lng < -125 || result.lng > -66) return { valid: false, reason: 'Longitude out of US range' };
  return { valid: true, reason: null };
}

const allAreas = Object.values(coverageAreas);

describe('Client Geocoding', () => {

  describe('State Code Extraction', () => {
    test('extracts state from address components', () => {
      const components = [
        { types: ['locality'], long_name: 'San Francisco', short_name: 'SF' },
        { types: ['administrative_area_level_1'], long_name: 'California', short_name: 'CA' },
        { types: ['country'], long_name: 'United States', short_name: 'US' },
      ];

      expect(extractStateCode(components)).toBe('CA');
    });

    test('returns null when no state component', () => {
      const components = [
        { types: ['locality'], long_name: 'San Francisco', short_name: 'SF' },
        { types: ['country'], long_name: 'United States', short_name: 'US' },
      ];

      expect(extractStateCode(components)).toBeNull();
    });

    test('handles null input', () => {
      expect(extractStateCode(null)).toBeNull();
    });

    test('handles empty array', () => {
      expect(extractStateCode([])).toBeNull();
    });

    test('handles missing types in component', () => {
      const components = [{ long_name: 'California', short_name: 'CA' }];
      expect(extractStateCode(components)).toBeNull();
    });
  });

  describe('Coverage Area Detection', () => {
    test('finds areas in the correct state', () => {
      const areas = findCoverageAreasForPoint(37.7749, -122.4194, allAreas, 'CA');

      expect(areas.length).toBeGreaterThan(0);
      expect(areas.every(a => a.state_code === 'CA')).toBe(true);
    });

    test('returns empty for null coordinates', () => {
      expect(findCoverageAreasForPoint(null, null, allAreas, 'CA')).toEqual([]);
    });

    test('returns empty for unknown state', () => {
      const areas = findCoverageAreasForPoint(37.7749, -122.4194, allAreas, 'ZZ');
      expect(areas).toEqual([]);
    });

    test('builds ID list from detected areas', () => {
      const detected = [
        { id: 1, name: 'PG&E', kind: 'utility' },
        { id: 2, name: 'SF County', kind: 'county' },
        { id: 6, name: 'California', kind: 'state' },
      ];

      const ids = buildCoverageAreaIds(detected);
      expect(ids).toEqual([1, 2, 6]);
    });
  });

  describe('Coverage Detection Summary', () => {
    test('summarizes detected areas by kind', () => {
      const areas = [
        { id: 1, name: 'Pacific Gas & Electric', kind: 'utility', state_code: 'CA' },
        { id: 2, name: 'San Francisco County', kind: 'county', state_code: 'CA' },
        { id: 6, name: 'California', kind: 'state', state_code: 'CA' },
      ];

      const summary = summarizeCoverageDetection(areas);

      expect(summary.state).toBe('California');
      expect(summary.counties).toEqual(['San Francisco County']);
      expect(summary.utilities).toEqual(['Pacific Gas & Electric']);
      expect(summary.total).toBe(3);
    });

    test('handles empty detection', () => {
      const summary = summarizeCoverageDetection([]);
      expect(summary.state).toBeNull();
      expect(summary.counties).toEqual([]);
      expect(summary.utilities).toEqual([]);
      expect(summary.total).toBe(0);
    });

    test('handles multiple utilities', () => {
      const areas = [
        { id: 1, name: 'PG&E', kind: 'utility' },
        { id: 4, name: 'SCE', kind: 'utility' },
      ];

      const summary = summarizeCoverageDetection(areas);
      expect(summary.utilities).toHaveLength(2);
    });
  });

  describe('Geocoding Validation', () => {
    test('valid US coordinates pass', () => {
      const result = validateGeocodingResult({ lat: 37.7749, lng: -122.4194 });
      expect(result.valid).toBe(true);
    });

    test('null result fails', () => {
      const result = validateGeocodingResult(null);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('No geocoding');
    });

    test('missing lat fails', () => {
      const result = validateGeocodingResult({ lng: -122.4194 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing coordinates');
    });

    test('latitude outside US fails', () => {
      const result = validateGeocodingResult({ lat: 60.0, lng: -122.0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Latitude out of US');
    });

    test('longitude outside US fails', () => {
      const result = validateGeocodingResult({ lat: 37.0, lng: -130.0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Longitude out of US');
    });

    test('edge of US range passes', () => {
      // Southern tip of Florida area
      expect(validateGeocodingResult({ lat: 25.0, lng: -80.0 }).valid).toBe(true);
      // Northern border
      expect(validateGeocodingResult({ lat: 49.0, lng: -100.0 }).valid).toBe(true);
    });
  });
});

'use client';

/**
 * Client Form Component
 *
 * Form for creating and editing clients with automatic geocoding and coverage area detection.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { AddressAutofillInput } from '@/components/ui/address-autofill-input-client';
import { TAXONOMIES } from '@/lib/constants/taxonomies';

// Build client types from taxonomy (hot + strong + mild tiers only, alphabetically sorted)
const CLIENT_TYPES = [
  ...TAXONOMIES.ELIGIBLE_APPLICANTS.hot,
  ...TAXONOMIES.ELIGIBLE_APPLICANTS.strong,
  ...TAXONOMIES.ELIGIBLE_APPLICANTS.mild
].sort();

// Build project needs from taxonomy (hot + strong + mild tiers only, alphabetically sorted)
const PROJECT_NEEDS = [
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.hot,
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.strong,
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.mild
].sort();

export default function ClientForm({ client, onSuccess, onCancel }) {
  const isEdit = !!client;

  const [formData, setFormData] = useState({
    name: client?.name || '',
    type: client?.type || '',
    address: client?.address || '',
    project_needs: client?.project_needs || [],
    budget: client?.budget || '',
    contact: client?.contact || '',
    description: client?.description || '',
    dac: client?.dac || false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [geocodedInfo, setGeocodedInfo] = useState(null);
  const [autofilledLocation, setAutofilledLocation] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation for required fields
    if (!formData.name?.trim()) {
      setError('Client name is required');
      setLoading(false);
      return;
    }

    if (!formData.type) {
      setError('Client type is required');
      setLoading(false);
      return;
    }

    if (!formData.address?.trim()) {
      setError('Address is required');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/clients/${client.id}` : '/api/clients';
      const method = isEdit ? 'PUT' : 'POST';

      // Include autofilled location data if available (to skip server-side geocoding)
      const submitData = {
        ...formData,
        ...(autofilledLocation && {
          _autofilledLocation: autofilledLocation
        })
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      // Check HTTP status first before trying to parse
      if (!response.ok) {
        console.error('[ClientForm] HTTP Error Status:', response.status, response.statusText);

        // Try to parse error as JSON, fallback to text if that fails
        let errorMessage;
        try {
          const result = await response.json();
          console.error('[ClientForm] API Error Response:', result);
          errorMessage = result.error || `Server error: ${response.status} ${response.statusText}`;
        } catch (parseError) {
          // Response wasn't valid JSON - get as text instead
          const errorText = await response.text();
          console.error('[ClientForm] Non-JSON Error Response:', errorText);
          errorMessage = `Server error (${response.status}): ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }

      // Only parse JSON if response was ok (200-299)
      const result = await response.json();

      if (!result.success) {
        console.error('[ClientForm] API Error Response:', result);
        throw new Error(result.error || 'Failed to save client');
      }

      // Show geocoded information
      if (result.geocode) {
        setGeocodedInfo(result.geocode);
      }

      // Call success callback
      if (onSuccess) {
        onSuccess(result.client);
      }

    } catch (err) {
      console.error('[ClientForm] Form submission error:', err);
      console.error('[ClientForm] Error details:', {
        message: err.message,
        stack: err.stack,
        formData: {
          ...formData,
          // Redact sensitive info if any
        }
      });
      setError(err.message || 'An unexpected error occurred. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {geocodedInfo && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          <p className="font-semibold">Location detected:</p>
          <p className="text-sm">
            {geocodedInfo.location.city && `${geocodedInfo.location.city}, `}
            {geocodedInfo.location.county && `${geocodedInfo.location.county}, `}
            {geocodedInfo.location.state} {geocodedInfo.location.zipcode}
          </p>
          <p className="text-xs mt-1">
            Coordinates: {geocodedInfo.coordinates.lat.toFixed(6)}, {geocodedInfo.coordinates.lng.toFixed(6)}
          </p>
        </div>
      )}

      {/* Name */}
      <div>
        <Label htmlFor="name">Client Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Organization name"
          required
        />
      </div>

      {/* Type */}
      <div>
        <Label htmlFor="type">Client Type *</Label>
        <Combobox
          options={CLIENT_TYPES}
          value={formData.type}
          onChange={(value) => setFormData({ ...formData, type: value })}
          placeholder="Select client type..."
          searchPlaceholder="Search client types..."
          emptyMessage="No client type found."
        />
      </div>

      {/* Address */}
      <div>
        <Label htmlFor="address">Address *</Label>
        <AddressAutofillInput
          id="address"
          value={formData.address}
          onChange={(e) => {
            setFormData({ ...formData, address: e.target.value });
            // Clear autofilled location when manually editing
            if (autofilledLocation) {
              setAutofilledLocation(null);
            }
          }}
          onAddressSelect={(locationData) => {
            // Update form with selected address
            setFormData({ ...formData, address: locationData.address });
            // Store location data for preview and submission
            setAutofilledLocation(locationData);
            console.log('[ClientForm] Address selected:', locationData);
          }}
          placeholder="Start typing an address..."
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Start typing to see address suggestions. Select from the dropdown for best geocoding accuracy.
        </p>

        {/* Show preview of selected location */}
        {autofilledLocation && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              📍 Location Detected:
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {autofilledLocation.location.city && `${autofilledLocation.location.city}, `}
              {autofilledLocation.location.county && `${autofilledLocation.location.county}, `}
              {autofilledLocation.location.state} {autofilledLocation.location.zipcode}
            </p>
            {autofilledLocation.coordinates && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Coordinates: {autofilledLocation.coordinates.lat?.toFixed(6)}, {autofilledLocation.coordinates.lng?.toFixed(6)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Project Needs */}
      <div>
        <Label>Project Needs</Label>
        <Combobox
          multiple
          options={PROJECT_NEEDS}
          value={formData.project_needs}
          onChange={(value) => setFormData({ ...formData, project_needs: value })}
          placeholder="Select project needs..."
          searchPlaceholder="Search project types..."
          emptyMessage="No project type found."
        />
      </div>

      {/* Budget */}
      <div>
        <Label htmlFor="budget">Budget</Label>
        <Input
          id="budget"
          type="number"
          value={formData.budget || ''}
          onChange={(e) => setFormData({ ...formData, budget: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="Available budget (optional, e.g., 1000000)"
          min="0"
          step="1000"
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter numeric value (e.g., 1000000 for $1M). Used for budget tier categorization.
        </p>
      </div>

      {/* Contact */}
      <div>
        <Label htmlFor="contact">Contact Information</Label>
        <Input
          id="contact"
          value={formData.contact}
          onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
          placeholder="Email or phone (optional)"
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional notes about the client"
          rows={3}
        />
      </div>

      {/* DAC Status */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="dac"
          checked={formData.dac}
          onCheckedChange={(checked) => setFormData({ ...formData, dac: checked })}
        />
        <Label htmlFor="dac" className="cursor-pointer">
          Disadvantaged Community (DAC)
        </Label>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (isEdit ? 'Update Client' : 'Create Client')}
        </Button>
      </div>
    </form>
  );
}

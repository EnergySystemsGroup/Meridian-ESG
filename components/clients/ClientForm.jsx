'use client';

/**
 * Client Form Component
 *
 * Form for creating and editing clients with automatic geocoding and coverage area detection.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { AddressAutofillInput } from '@/components/ui/address-autofill-input-client';
import { TAXONOMIES, getSelectableClientTypes, PROJECT_TYPE_GROUPS, CLIENT_TYPE_GROUPS } from '@/lib/constants/taxonomies';
import { useUsers } from '@/lib/hooks/queries/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Get selectable client types (children + standalone + selectable parent exceptions)
// This encourages users to select specific types rather than broad parent categories
const CLIENT_TYPES = getSelectableClientTypes();

// Build project needs from taxonomy (hot + strong + mild tiers only, alphabetically sorted)
const PROJECT_NEEDS = [
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.hot,
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.strong,
  ...TAXONOMIES.ELIGIBLE_PROJECT_TYPES.mild
].sort();

export default function ClientForm({ client, onSuccess, onCancel }) {
  const isEdit = !!client;
  const { user } = useAuth();
  const { data: usersData } = useUsers();
  const allUsers = useMemo(() => usersData?.users || [], [usersData]);

  const userOptions = useMemo(
    () => allUsers.map((u) => ({ value: u.id, label: u.display_name })),
    [allUsers]
  );

  const [formData, setFormData] = useState({
    name: client?.name || '',
    type: client?.type || '',
    address: client?.address || '',
    project_needs: client?.project_needs || [],
    budget: client?.budget || '',
    contact: client?.contact || '',
    description: client?.description || '',
    dac: client?.dac || false,
    assigned_users: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [geocodedInfo, setGeocodedInfo] = useState(null);
  const [autofilledLocation, setAutofilledLocation] = useState(null);
  const [showProjectNeedsSummary, setShowProjectNeedsSummary] = useState(isEdit);

  // Load assigned users: pre-populate current user on add, fetch existing on edit
  useEffect(() => {
    let cancelled = false;

    if (isEdit && client?.id) {
      fetch(`/api/clients/${client.id}/users`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.success) {
            setFormData((prev) => ({ ...prev, assigned_users: data.user_ids || [] }));
          }
        })
        .catch(() => {});
    } else if (!isEdit && user?.id) {
      setFormData((prev) => ({ ...prev, assigned_users: [user.id] }));
    }

    return () => { cancelled = true; };
  }, [isEdit, client?.id, user?.id]);

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {geocodedInfo && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <p className="font-semibold text-sm">Location detected:</p>
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

      {/* Section: Identity */}
      <SectionHeader label="Identity" />
      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="name">Client Name <span className="text-red-400 ml-0.5">*</span></Label>
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
          <Label htmlFor="type">Client Type <span className="text-red-400 ml-0.5">*</span></Label>
          <Combobox
            groups={CLIENT_TYPE_GROUPS}
            options={CLIENT_TYPES}
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: value })}
            placeholder="Select client type..."
            searchPlaceholder="Search client types..."
            emptyMessage="No client type found."
          />
        </div>
      </div>

      {/* Section: Location */}
      <SectionHeader label="Location" />
      <div className="space-y-4">
        {/* Address */}
        <div>
          <Label htmlFor="address">Address <span className="text-red-400 ml-0.5">*</span></Label>
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
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Location Detected:
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
      </div>

      {/* Section: Scope & Needs */}
      <SectionHeader label="Scope & Needs" />
      <div className="space-y-4">
        {/* Project Needs */}
        <div>
          <Label>Project Needs</Label>
          <Combobox
            multiple
            groups={PROJECT_TYPE_GROUPS}
            options={PROJECT_NEEDS}
            value={formData.project_needs}
            onChange={(value) => setFormData({ ...formData, project_needs: value })}
            placeholder="Select project needs..."
            searchPlaceholder="Search project types..."
            emptyMessage="No project type found."
          />

          {/* Collapsible selection review */}
          {formData.project_needs.length > 0 && (
            <div className="mt-2 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowProjectNeedsSummary(!showProjectNeedsSummary)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                aria-expanded={showProjectNeedsSummary}
              >
                <span className="text-neutral-600 dark:text-neutral-400">
                  {formData.project_needs.length} project {formData.project_needs.length === 1 ? 'need' : 'needs'} selected
                </span>
                <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform duration-200", showProjectNeedsSummary && "rotate-180")} />
              </button>
              {showProjectNeedsSummary && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                  {formData.project_needs.map((need) => (
                    <span key={need} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800">
                      {need}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, project_needs: formData.project_needs.filter(n => n !== need) })}
                        className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-sm p-0.5 min-w-[20px] min-h-[20px] flex items-center justify-center"
                        aria-label={`Remove ${need}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Budget */}
        <div>
          <Label htmlFor="budget">Budget Range</Label>
          <Combobox
            options={[
              { value: 'small', label: 'Small ($50K – $500K)' },
              { value: 'medium', label: 'Medium ($500K – $5M)' },
              { value: 'large', label: 'Large ($5M – $50M)' },
              { value: 'very_large', label: 'Very Large ($50M+)' },
            ]}
            value={formData.budget || ''}
            onChange={(value) => setFormData({ ...formData, budget: value })}
            placeholder="Select budget range..."
            searchPlaceholder="Search budget tiers..."
            emptyMessage="No budget tier found."
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
      </div>

      {/* Section: Additional Details */}
      <SectionHeader label="Additional Details" />
      <div className="space-y-4">
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
            className="resize-y min-h-[72px] max-h-[200px]"
          />
        </div>

        {/* Assigned Users */}
        <div>
          <Label>Assigned Users</Label>
          <Combobox
            multiple
            options={userOptions}
            value={formData.assigned_users}
            onChange={(value) => setFormData({ ...formData, assigned_users: value })}
            placeholder="Select users to assign..."
            searchPlaceholder="Search users..."
            emptyMessage="No users found."
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className="min-w-[140px]">
          {loading ? 'Saving...' : (isEdit ? 'Update Client' : 'Create Client')}
        </Button>
      </div>
    </form>
  );
}

/** Small section header with line divider */
function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

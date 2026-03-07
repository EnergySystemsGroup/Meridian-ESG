'use client';

/**
 * Client Profile Modal Component
 *
 * Displays detailed client information in a modal dialog.
 * Supports editing mode via ClientForm integration.
 * All hooks are called unconditionally before any early returns.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Building,
  DollarSign,
  Shield,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { formatProjectNeeds } from '@/lib/utils/clientMatching';
import { PROJECT_TYPE_GROUPS } from '@/lib/constants/taxonomies';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';
import { useUsers } from '@/lib/hooks/queries/useUsers';
import ClientForm from './ClientForm';

export default function ClientProfileModal({ client, isOpen, onClose, onClientUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState([]);

  const { data: usersData } = useUsers();
  const allUsers = useMemo(() => usersData?.users || [], [usersData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setAssignedUserIds([]);
    }
  }, [isOpen]);

  // Fetch assigned user IDs when modal opens
  useEffect(() => {
    if (!isOpen || !client?.id) return;
    let cancelled = false;

    fetch(`/api/clients/${client.id}/users`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setAssignedUserIds(data.user_ids || []);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isOpen, client?.id]);

  // Re-fetch assigned users after an edit saves
  const handleClientUpdate = (updatedClient) => {
    setIsEditing(false);
    // Re-fetch assignments since the edit may have changed them
    if (updatedClient?.id) {
      fetch(`/api/clients/${updatedClient.id}/users`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAssignedUserIds(data.user_ids || []);
        })
        .catch(() => {});
    }
    onClientUpdate?.(updatedClient);
  };

  const assignedUsers = useMemo(
    () => allUsers.filter((u) => assignedUserIds.includes(u.id)),
    [allUsers, assignedUserIds]
  );

  // Group project needs by category for organized display
  const groupedProjectNeeds = useMemo(() => {
    const needs = formatProjectNeeds(client?.project_needs);
    if (!needs || needs.length === 0) return [];

    const grouped = [];
    const categorized = new Set();

    for (const group of PROJECT_TYPE_GROUPS) {
      const matching = needs.filter((need) => group.items.includes(need));
      if (matching.length > 0) {
        grouped.push({ label: group.label, items: matching });
        matching.forEach((m) => categorized.add(m));
      }
    }

    // Catch any uncategorized items
    const uncategorized = needs.filter((need) => !categorized.has(need));
    if (uncategorized.length > 0) {
      grouped.push({ label: 'Other', items: uncategorized });
    }

    return grouped;
  }, [client?.project_needs]);

  if (!client) return null;

  const budgetLabels = {
    small: 'Small ($50K - $500K)',
    medium: 'Medium ($500K - $5M)',
    large: 'Large ($5M - $50M)',
    very_large: 'Very Large ($50M+)'
  };

  const budgetDisplay = budgetLabels[client.budget] || client.budget || 'Not specified';

  // Format location from database fields
  const location = [client.city, client.state_code].filter(Boolean).join(', ') || client.address;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {isEditing ? `Edit: ${client.name}` : client.name}
          </DialogTitle>
          {!isEditing && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {client.type} &middot; {location}
            </p>
          )}
        </DialogHeader>

        {isEditing ? (
          <ClientForm
            client={client}
            onSuccess={handleClientUpdate}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <div className="space-y-5">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <Building className="h-4 w-4 mr-2 text-neutral-400" />
                  <div>
                    <div className="text-xs text-neutral-500">Organization Type</div>
                    <div className="text-sm font-medium">{client.type}</div>
                  </div>
                </div>

                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-neutral-400" />
                  <div>
                    <div className="text-xs text-neutral-500">Location</div>
                    <div className="text-sm font-medium">{location}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2 text-neutral-400" />
                  <div>
                    <div className="text-xs text-neutral-500">Budget Range</div>
                    <div className="text-sm font-medium">{budgetDisplay}</div>
                  </div>
                </div>

                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-neutral-400" />
                  <div>
                    <div className="text-xs text-neutral-500">Disadvantaged Community</div>
                    <div className="text-sm font-medium">
                      {client.dac === true || client.dac === 'Yes' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                          Yes
                        </span>
                      ) : (
                        <span className="text-neutral-500">No</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {client.description && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap">About</span>
                    <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                  </div>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {client.description}
                  </p>
                </div>
              </>
            )}

            {/* Project Needs — Grouped by Category */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                  Project Needs
                </span>
                {client.project_needs?.length > 0 && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    ({client.project_needs.length})
                  </span>
                )}
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              </div>

              {groupedProjectNeeds.length > 0 ? (
                <div className="space-y-3">
                  {groupedProjectNeeds.map((group) => (
                    <div key={group.label}>
                      <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        {group.label}
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {group.items.map((need, index) => {
                          const typeColor = getProjectTypeColor(need);
                          return (
                            <span
                              key={index}
                              className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md border border-l-2 text-neutral-700 border-neutral-200 dark:text-neutral-300 dark:border-neutral-700"
                              style={{ backgroundColor: typeColor.bgColor, borderLeftColor: typeColor.color }}
                            >
                              {need}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 italic">No project needs specified</p>
              )}
            </div>

            {/* Assigned Users */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Assigned Users</span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              </div>
              {assignedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {assignedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-300"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {u.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                      {u.display_name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 italic">No users assigned</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <Button asChild className="flex-1">
                <Link href={`/clients/${client.id}/matches`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Matches
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

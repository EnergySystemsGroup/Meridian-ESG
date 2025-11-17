/**
 * Client Profile Modal Component
 *
 * Displays detailed client information in a modal dialog
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Building,
  DollarSign,
  Shield,
  Target,
  FileText,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { formatProjectNeeds } from '@/lib/utils/clientMatching';

export default function ClientProfileModal({ client, isOpen, onClose }) {
  if (!client) return null;

  const budgetLabels = {
    small: 'Small ($50K - $500K)',
    medium: 'Medium ($500K - $5M)',
    large: 'Large ($5M - $50M)',
    very_large: 'Very Large ($50M+)'
  };

  const budgetDisplay = budgetLabels[client.budget] || client.budget || 'Not specified';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{client.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center">
                <Building className="h-5 w-5 mr-2 text-neutral-500" />
                <div>
                  <div className="text-sm text-neutral-500">Organization Type</div>
                  <div className="font-medium">{client.type}</div>
                </div>
              </div>

              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-neutral-500" />
                <div>
                  <div className="text-sm text-neutral-500">Location</div>
                  <div className="font-medium">
                    {[client.city, client.state_code].filter(Boolean).join(', ') || client.address}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-neutral-500" />
                <div>
                  <div className="text-sm text-neutral-500">Budget Range</div>
                  <div className="font-medium">{budgetDisplay}</div>
                </div>
              </div>

              <div className="flex items-center">
                <Shield className="h-5 w-5 mr-2 text-neutral-500" />
                <div>
                  <div className="text-sm text-neutral-500">Disadvantaged Community</div>
                  <div className="font-medium">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
                      client.dac === 'Yes'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                    }`}>
                      {client.dac || 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Description */}
          {client.description && (
            <div>
              <div className="flex items-center mb-3">
                <FileText className="h-5 w-5 mr-2 text-neutral-500" />
                <h3 className="text-lg font-semibold">About</h3>
              </div>
              <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {client.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Project Needs */}
          <div>
            <div className="flex items-center mb-3">
              <Target className="h-5 w-5 mr-2 text-neutral-500" />
              <h3 className="text-lg font-semibold">Project Needs</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {formatProjectNeeds(client.project_needs).map((need, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                >
                  {need}
                </Badge>
              ))}
            </div>
            {(!client.project_needs || client.project_needs.length === 0) && (
              <p className="text-neutral-500 italic">No project needs specified</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button asChild className="flex-1">
              <Link href={`/clients/${client.id}/matches`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Matches
              </Link>
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
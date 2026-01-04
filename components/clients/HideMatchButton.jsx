'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * Hide Match Button Component
 *
 * Renders a button to hide an opportunity from a client's matches.
 * Opens a confirmation dialog with optional reason input.
 */
export function HideMatchButton({ clientId, opportunityId, opportunityTitle, onHidden }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isHiding, setIsHiding] = useState(false);
  const [error, setError] = useState(null);

  const handleHide = async () => {
    setIsHiding(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/${clientId}/hidden-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          reason: reason.trim() || null,
          hiddenBy: 'user'
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to hide match');
      }

      setIsOpen(false);
      setReason('');

      if (onHidden) {
        onHidden(opportunityId);
      }
    } catch (err) {
      console.error('Error hiding match:', err);
      setError(err.message);
    } finally {
      setIsHiding(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        title="Hide this match"
      >
        <EyeOff className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Hide Match</DialogTitle>
            <DialogDescription>
              Hide &quot;{opportunityTitle}&quot; from this client&apos;s matches.
              You can restore it later from the Hidden Matches view.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason (optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="Why are you hiding this match?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isHiding}>
              Cancel
            </Button>
            <Button onClick={handleHide} disabled={isHiding}>
              {isHiding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Hiding...
                </>
              ) : (
                'Hide Match'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default HideMatchButton;

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Loader2, EyeOff, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Hidden Matches Panel
 *
 * Displays hidden matches for a client with ability to restore them.
 */
export function HiddenMatchesPanel({ clientId, onRestore }) {
  const [hiddenMatches, setHiddenMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const fetchHiddenMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/clients/${clientId}/hidden-matches`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch hidden matches');
      }

      setHiddenMatches(data.hiddenMatches);
    } catch (err) {
      console.error('Error fetching hidden matches:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchHiddenMatches();
  }, [fetchHiddenMatches]);

  const handleRestore = async (opportunityId) => {
    setRestoringId(opportunityId);

    try {
      const response = await fetch(
        `/api/clients/${clientId}/hidden-matches?opportunityId=${opportunityId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore match');
      }

      // Remove from local state
      setHiddenMatches(prev => prev.filter(h => h.opportunity_id !== opportunityId));

      if (onRestore) {
        onRestore(opportunityId);
      }
    } catch (err) {
      console.error('Error restoring match:', err);
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button variant="outline" onClick={fetchHiddenMatches}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (hiddenMatches.length === 0) {
    return (
      <div className="text-center p-12 text-gray-500">
        <EyeOff className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium">No hidden matches</p>
        <p className="text-sm mt-1">Matches you hide will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        {hiddenMatches.length} hidden {hiddenMatches.length === 1 ? 'match' : 'matches'}
      </p>
      {hiddenMatches.map((hidden) => {
        const opportunity = hidden.funding_opportunities;
        const isRestoring = restoringId === hidden.opportunity_id;

        return (
          <Card key={hidden.id} className="border-dashed border-gray-300">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {opportunity?.title || 'Unknown Opportunity'}
                  </h4>
                  <div className="text-sm text-gray-500 mt-1">
                    {opportunity?.agency_name && (
                      <span>{opportunity.agency_name} &bull; </span>
                    )}
                    Hidden {formatDistanceToNow(new Date(hidden.hidden_at), { addSuffix: true })}
                  </div>
                  {hidden.reason && (
                    <p className="text-sm text-gray-600 mt-2 italic bg-gray-50 p-2 rounded">
                      &quot;{hidden.reason}&quot;
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(hidden.opportunity_id)}
                  disabled={isRestoring}
                  className="shrink-0"
                >
                  {isRestoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1" />
                      Restore
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default HiddenMatchesPanel;

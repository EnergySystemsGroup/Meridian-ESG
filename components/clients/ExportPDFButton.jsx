'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { ExportPDFModal } from './ExportPDFModal';

/**
 * Export PDF Button
 *
 * Simple button that opens the export modal
 */
export function ExportPDFButton({ client, matches, variant = 'outline', size = 'default' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const matchCount = matches?.length || 0;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={matchCount === 0}
        title={matchCount === 0 ? 'No matches to export' : 'Export matches to PDF'}
      >
        <FileText className="h-4 w-4 mr-2" />
        Export PDF
      </Button>

      <ExportPDFModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={client}
        matches={matches}
      />
    </>
  );
}

export default ExportPDFButton;

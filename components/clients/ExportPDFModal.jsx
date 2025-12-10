'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Download, Loader2, Eye, EyeOff } from 'lucide-react';
import { ClientMatchesPDF } from '@/lib/pdf';

/**
 * Export PDF Modal
 *
 * Allows users to configure and generate PDF exports of client matches
 * Now includes a preview mode!
 */
export function ExportPDFModal({ isOpen, onClose, client, matches }) {
  const [viewMode, setViewMode] = useState('summary');
  const [includeCover, setIncludeCover] = useState(true);
  const [sortBy, setSortBy] = useState('score');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Memoize the PDF options
  const options = useMemo(() => ({
    viewMode,
    includeCover,
    sortBy,
  }), [viewMode, includeCover, sortBy]);

  const handleExport = useCallback(async () => {
    if (!client || !matches) {
      setError('Missing client or matches data');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate PDF blob
      const doc = <ClientMatchesPDF client={client} matches={matches} options={options} />;
      const blob = await pdf(doc).toBlob();

      // Generate filename
      const clientName = client.name
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
      const date = new Date().toISOString().split('T')[0];
      const filename = `${clientName}-funding-matches-${date}.pdf`;

      // Download
      saveAs(blob, filename);

      // Close modal on success
      onClose();
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(`Failed to generate PDF: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [client, matches, options, onClose]);

  const matchCount = matches?.length || 0;

  // Toggle preview mode
  const togglePreview = useCallback(() => {
    setShowPreview(prev => !prev);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={showPreview ? "sm:max-w-[900px] max-h-[90vh]" : "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Funding Matches
          </DialogTitle>
          <DialogDescription>
            Generate a PDF report of {matchCount} funding{' '}
            {matchCount === 1 ? 'opportunity' : 'opportunities'} for {client?.name || 'this client'}.
          </DialogDescription>
        </DialogHeader>

        <div className={showPreview ? "flex gap-6" : ""}>
          {/* Options Panel */}
          <div className={showPreview ? "w-[300px] flex-shrink-0" : ""}>
            <div className="space-y-6 py-4">
              {/* View Mode Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Report Style</Label>
                <RadioGroup value={viewMode} onValueChange={setViewMode}>
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="summary" id="summary" />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="summary" className="font-medium cursor-pointer">
                        Summary View
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Compact list with key facts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 mt-3">
                    <RadioGroupItem value="detailed" id="detailed" />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="detailed" className="font-medium cursor-pointer">
                        Detailed View
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Full info with insights
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Sort Order */}
              <div className="space-y-3">
                <Label htmlFor="sortBy" className="text-sm font-medium">
                  Sort By
                </Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sortBy">
                    <SelectValue placeholder="Select sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deadline">Deadline (Soonest First)</SelectItem>
                    <SelectItem value="score">Match Score (Highest First)</SelectItem>
                    <SelectItem value="amount">Funding Amount (Highest First)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cover Page Option */}
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="includeCover"
                  checked={includeCover}
                  onCheckedChange={setIncludeCover}
                />
                <Label htmlFor="includeCover" className="cursor-pointer text-sm">
                  Include cover page
                </Label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          {showPreview && client && matches && (
            <div className="flex-1 border rounded-lg overflow-hidden bg-gray-100" style={{ height: '500px' }}>
              {/* Key forces remount when options change to avoid @react-pdf/reconciler errors */}
              <PDFViewer key={`${viewMode}-${sortBy}-${includeCover}`} width="100%" height="100%" showToolbar={false}>
                <ClientMatchesPDF client={client} matches={matches} options={options} />
              </PDFViewer>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={togglePreview}
            disabled={matchCount === 0}
            className="mr-auto"
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isGenerating || matchCount === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPDFModal;

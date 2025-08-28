'use client';

import React from 'react';
import PropTypes from 'prop-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatJobProgress } from '@/lib/utils/jobAggregation';

/**
 * JobSelector Component
 * 
 * Allows users to select and view individual jobs from a job-based pipeline run.
 * Shows job metadata including chunk index, status, and progress.
 */
export function JobSelector({ 
  jobs = [], 
  selectedJobId, 
  onJobChange, 
  defaultToLatest = true,
  className = "" 
}) {
  // Auto-select first job if none selected and defaultToLatest is true
  React.useEffect(() => {
    if (defaultToLatest && !selectedJobId && jobs.length > 0) {
      onJobChange(jobs[0].jobId);
    }
  }, [jobs, selectedJobId, onJobChange, defaultToLatest]);

  if (jobs.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No jobs found for this run
      </div>
    );
  }

  const selectedJob = jobs.find(job => job.jobId === selectedJobId) || jobs[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Job Selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label htmlFor="job-selector" className="text-sm font-medium text-foreground mb-2 block">
            Select Job Chunk
          </label>
          <Select value={selectedJobId || jobs[0]?.jobId} onValueChange={onJobChange}>
            <SelectTrigger id="job-selector" className="w-full">
              <SelectValue placeholder="Select a job chunk..." />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.jobId} value={job.jobId}>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={job.status} />
                    <span>
                      Chunk {job.chunkIndex + 1}/{job.totalChunks}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Quick Stats */}
        <div className="text-sm text-muted-foreground">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Selected Job Details */}
      {selectedJob && (
        <div className="bg-muted/50 rounded-lg p-4 border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Job Info */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">
                Job Details
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Chunk {selectedJob.chunkIndex + 1} of {selectedJob.totalChunks}</div>
                <div>{selectedJob.stageCount} stages</div>
              </div>
            </div>

            {/* Status */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">
                Status
              </div>
              <StatusBadge status={selectedJob.status} />
            </div>

            {/* Timing */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">
                Timing
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Started: {formatTime(selectedJob.createdAt)}</div>
                {selectedJob.completedAt && (
                  <div>Completed: {formatTime(selectedJob.completedAt)}</div>
                )}
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">
                Progress
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedJob.status === 'completed' && '✓ All stages complete'}
                {selectedJob.status === 'processing' && (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </div>
                )}
                {selectedJob.status === 'failed' && '✗ Processing failed'}
                {selectedJob.status === 'pending' && 'Waiting to start...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PropTypes validation for JobSelector
JobSelector.propTypes = {
  jobs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['pending', 'processing', 'completed', 'failed']).isRequired,
    chunk_index: PropTypes.number,
    createdAt: PropTypes.string,
    completedAt: PropTypes.string,
    progress: PropTypes.object
  })).isRequired,
  selectedJobId: PropTypes.string,
  onJobChange: PropTypes.func.isRequired,
  defaultToLatest: PropTypes.bool,
  className: PropTypes.string
};

JobSelector.defaultProps = {
  selectedJobId: null,
  defaultToLatest: true,
  className: ''
};

/**
 * Status Badge Component
 */
function StatusBadge({ status }) {
  const variants = {
    completed: { variant: "success", text: "Completed" },
    processing: { variant: "warning", text: "Processing" },
    failed: { variant: "destructive", text: "Failed" },
    pending: { variant: "secondary", text: "Pending" },
    unknown: { variant: "outline", text: "Unknown" }
  };

  const config = variants[status] || variants.unknown;
  
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.text}
    </Badge>
  );
}

/**
 * Status Icon Component
 */
function StatusIcon({ status, className = "h-4 w-4" }) {
  const icons = {
    completed: <CheckCircle2 className={`text-green-500 ${className}`} />,
    processing: <Loader2 className={`text-yellow-500 animate-spin ${className}`} />,
    failed: <XCircle className={`text-red-500 ${className}`} />,
    pending: <Clock className={`text-gray-500 ${className}`} />,
    unknown: <AlertCircle className={`text-gray-400 ${className}`} />
  };

  return icons[status] || icons.unknown;
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * JobSelector Summary Component
 * 
 * Shows a compact summary of job progress without the full selector
 */
export function JobSelectorSummary({ jobs = [], className = "" }) {
  if (jobs.length === 0) {
    return null;
  }

  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  const completed = statusCounts.completed || 0;
  const total = jobs.length;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      <div className="font-medium">
        Jobs: {completed}/{total} complete ({progressPercent}%)
      </div>
      
      <div className="flex items-center gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1">
            <StatusIcon status={status} className="h-3 w-3" />
            <span className="text-muted-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
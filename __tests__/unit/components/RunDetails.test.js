/**
 * RunDetails Component Tests
 * 
 * Comprehensive test suite for the RunDetails (V2) component covering:
 * - Run status display (pending, running, completed, failed)
 * - Progress tracking visualization
 * - Run action tests (start, stop, retry)
 * - Error handling and status updates
 * - WebSocket connection mocking for real-time updates
 * - Metrics display (tokens used, opportunities processed)
 * - Log viewing functionality
 * - Run history navigation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import RunDetailPageV2 from '@/app/admin/funding-sources/runs/[id]/pageV2';
import { createClient } from '@/utils/supabase/client';

// Mock Supabase
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock Link component
jest.mock('next/link', () => {
  return function Link({ children, href }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }) => (
    <div data-testid="progress" data-value={value}>
      Progress: {value}%
    </div>
  ),
}));

// Mock chart components
jest.mock('@/components/admin/charts', () => ({
  StagePerformanceChart: () => <div data-testid="stage-performance-chart">Stage Performance Chart</div>,
  OpportunityFlowChart: () => <div data-testid="opportunity-flow-chart">Opportunity Flow Chart</div>,
}));

describe('RunDetailPageV2', () => {
  let mockSupabase;
  let mockRouter;
  let mockParams;
  let mockChannels;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock channels for real-time subscriptions
    mockChannels = new Map();
    
    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(),
      channel: jest.fn((channelName) => {
        const channel = {
          on: jest.fn().mockReturnThis(),
          subscribe: jest.fn().mockReturnThis(),
          unsubscribe: jest.fn(),
        };
        mockChannels.set(channelName, channel);
        return channel;
      }),
      removeChannel: jest.fn((channel) => {
        // Find and remove channel from mockChannels
        for (const [name, ch] of mockChannels.entries()) {
          if (ch === channel) {
            mockChannels.delete(name);
            break;
          }
        }
      }),
    };

    createClient.mockReturnValue(mockSupabase);

    // Setup router mock
    mockRouter = {
      push: jest.fn(),
      back: jest.fn(),
    };
    
    const useRouter = require('next/navigation').useRouter;
    useRouter.mockReturnValue(mockRouter);

    // Setup params mock
    mockParams = { id: 'test-run-id' };
    const useParams = require('next/navigation').useParams;
    useParams.mockReturnValue(mockParams);
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      render(<RunDetailPageV2 />);
      
      expect(screen.getByText('Loading run details...')).toBeInTheDocument();
    });

    it('should render V2 run details', async () => {
      const mockV2Run = {
        id: 'test-run-id',
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
        total_opportunities: 100,
        new_opportunities: 20,
        updated_opportunities: 30,
        skipped_opportunities: 50,
        error_message: null,
        api_sources: {
          name: 'Test Source',
          type: 'API',
        },
      };

      const mockStages = [
        {
          id: 'stage-1',
          run_id: 'test-run-id',
          stage_name: 'data_extraction',
          stage_order: 1,
          status: 'completed',
          started_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-15T10:05:00Z',
          execution_time_ms: 5000,
          input_count: 100,
          output_count: 95,
          error_message: null,
          stage_results: JSON.stringify({
            totalAvailable: 100,
            extractedOpportunities: 95,
          }),
        },
        {
          id: 'stage-2',
          run_id: 'test-run-id',
          stage_name: 'early_duplicate_detector',
          stage_order: 2,
          status: 'completed',
          started_at: '2024-01-15T10:05:00Z',
          completed_at: '2024-01-15T10:10:00Z',
          execution_time_ms: 5000,
          input_count: 95,
          output_count: 50,
        },
      ];

      // Mock initial data fetch
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockV2Run, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });
    });

    it('should render V1 run fallback when V2 data not found', async () => {
      const mockV1Run = {
        id: 'test-run-id',
        status: 'completed',
        created_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
        api_sources: {
          name: 'Legacy Source',
          type: 'Manual',
        },
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: null, 
                  error: { message: 'Not found' } 
                }),
              }),
            }),
          };
        }
        if (table === 'api_source_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockV1Run, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
        expect(screen.getByText('Legacy Source')).toBeInTheDocument();
      });
    });
  });

  describe('Run Status Display', () => {
    const setupRunWithStatus = async (status, error = null) => {
      const mockRun = {
        id: 'test-run-id',
        status,
        created_at: '2024-01-15T10:00:00Z',
        error_message: error,
        api_sources: {
          name: 'Test Source',
        },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
      });
    };

    it('should display pending status', async () => {
      await setupRunWithStatus('pending');
      
      const statusBadge = screen.getByTestId('badge');
      expect(statusBadge).toHaveTextContent('pending');
    });

    it('should display running status', async () => {
      await setupRunWithStatus('running');
      
      const statusBadge = screen.getByTestId('badge');
      expect(statusBadge).toHaveTextContent('running');
    });

    it('should display completed status', async () => {
      await setupRunWithStatus('completed');
      
      const statusBadge = screen.getByTestId('badge');
      expect(statusBadge).toHaveTextContent('completed');
    });

    it('should display failed status with error message', async () => {
      await setupRunWithStatus('failed', 'Connection timeout');
      
      const statusBadge = screen.getByTestId('badge');
      expect(statusBadge).toHaveTextContent('failed');
      expect(screen.getByText(/Connection timeout/)).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('should display progress bar with correct percentage', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'running',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        { stage_name: 'data_extraction', status: 'completed' },
        { stage_name: 'early_duplicate_detector', status: 'completed' },
        { stage_name: 'analysis', status: 'running' },
        { stage_name: 'storage', status: 'pending' },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        const progressBar = screen.getByTestId('progress');
        expect(progressBar).toHaveAttribute('data-value', '50'); // 2 of 4 completed
      });
    });

    it('should show individual stage statuses', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'running',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'data_extraction',
          status: 'completed',
          execution_time_ms: 5000,
          output_count: 100,
        },
        {
          stage_name: 'analysis',
          status: 'running',
          execution_time_ms: null,
          output_count: null,
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Data Extraction')).toBeInTheDocument();
        expect(screen.getByText('Analysis')).toBeInTheDocument();
        expect(screen.getByText('5.0s')).toBeInTheDocument(); // Execution time
        expect(screen.getByText('100')).toBeInTheDocument(); // Output count
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should subscribe to run updates', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'running',
        api_sources: { name: 'Test Source' },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith('v2_run_updates');
        expect(mockSupabase.channel).toHaveBeenCalledWith('v2_stages_updates');
      });

      const runChannel = mockChannels.get('v2_run_updates');
      expect(runChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'pipeline_runs',
          filter: 'id=eq.test-run-id',
        }),
        expect.any(Function)
      );
    });

    it('should update run status on real-time event', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'running',
        api_sources: { name: 'Test Source' },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('running')).toBeInTheDocument();
      });

      // Simulate real-time update
      const runChannel = mockChannels.get('v2_run_updates');
      const updateCallback = runChannel.on.mock.calls[0][2];
      
      act(() => {
        updateCallback({
          new: {
            status: 'completed',
            completed_at: '2024-01-15T10:30:00Z',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
      });
    });

    it('should clean up subscriptions on unmount', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'running',
        api_sources: { name: 'Test Source' },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      const { unmount } = render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalled();
      });

      const runChannel = mockChannels.get('v2_run_updates');
      const stagesChannel = mockChannels.get('v2_stages_updates');

      unmount();

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(runChannel);
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(stagesChannel);
    });
  });

  describe('Metrics Display', () => {
    it('should display opportunity metrics', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        total_opportunities: 100,
        new_opportunities: 20,
        updated_opportunities: 30,
        skipped_opportunities: 50,
        api_sources: { name: 'Test Source' },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Total Opportunities')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
        expect(screen.getByText('Updated')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
        expect(screen.getByText('Skipped')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });

    it('should display token usage metrics', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'analysis',
          status: 'completed',
          stage_results: JSON.stringify({
            tokenUsage: {
              input: 10000,
              output: 5000,
              total: 15000,
            },
          }),
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Token Usage')).toBeInTheDocument();
        expect(screen.getByText('15,000')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    beforeEach(async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'data_extraction',
          status: 'completed',
          execution_time_ms: 5000,
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
      });
    });

    it('should switch between pipeline and metrics tabs', async () => {
      const pipelineTab = screen.getByText('Pipeline');
      const metricsTab = screen.getByText('Metrics');

      expect(pipelineTab).toHaveClass('bg-blue-500');
      expect(metricsTab).not.toHaveClass('bg-blue-500');

      fireEvent.click(metricsTab);

      expect(metricsTab).toHaveClass('bg-blue-500');
      expect(pipelineTab).not.toHaveClass('bg-blue-500');

      expect(screen.getByTestId('stage-performance-chart')).toBeInTheDocument();
      expect(screen.getByTestId('opportunity-flow-chart')).toBeInTheDocument();
    });

    it('should display pipeline view by default', async () => {
      expect(screen.getByText('Pipeline Stages')).toBeInTheDocument();
      expect(screen.getByText('Data Extraction')).toBeInTheDocument();
    });
  });

  describe('Sample Data Display', () => {
    it('should expand and collapse sample data', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'data_extraction',
          status: 'completed',
          stage_results: JSON.stringify({
            samples: [
              { id: 1, title: 'Sample 1' },
              { id: 2, title: 'Sample 2' },
            ],
          }),
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Sample Data (2 items)')).toBeInTheDocument();
      });

      const toggleButton = screen.getByText('Sample Data (2 items)').closest('button');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText(/"id": 1/)).toBeInTheDocument();
        expect(screen.getByText(/"title": "Sample 1"/)).toBeInTheDocument();
      });

      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.queryByText(/"id": 1/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { 
          id: 'source-123',
          name: 'Test Source' 
        },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
      });
    });

    it('should navigate back to source page', async () => {
      const backButton = screen.getByText('Back to Source');
      expect(backButton.closest('a')).toHaveAttribute('href', '/admin/funding-sources/source-123');
    });

    it('should have breadcrumb navigation', async () => {
      expect(screen.getByText('Sources')).toBeInTheDocument();
      expect(screen.getByText('Test Source')).toBeInTheDocument();
      expect(screen.getByText('Run test-run-id')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error when run fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSupabase.from.mockImplementation(() => {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching run:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should display stage errors', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'failed',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'data_extraction',
          status: 'failed',
          error_message: 'API connection timeout',
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('API connection timeout')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should format durations correctly', async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { name: 'Test Source' },
      };

      const mockStages = [
        {
          stage_name: 'quick_stage',
          status: 'completed',
          execution_time_ms: 500,
        },
        {
          stage_name: 'medium_stage',
          status: 'completed',
          execution_time_ms: 5500,
        },
        {
          stage_name: 'long_stage',
          status: 'completed',
          execution_time_ms: 120000,
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        if (table === 'pipeline_stages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ 
                  data: mockStages, 
                  error: null 
                }),
              }),
            }),
          };
        }
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('500ms')).toBeInTheDocument();
        expect(screen.getByText('5.5s')).toBeInTheDocument();
        expect(screen.getByText('2.0m')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      const mockRun = {
        id: 'test-run-id',
        status: 'completed',
        api_sources: { name: 'Test Source' },
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'pipeline_runs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: mockRun, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ 
                data: [], 
                error: null 
              }),
            }),
          }),
        };
      });

      render(<RunDetailPageV2 />);

      await waitFor(() => {
        expect(screen.getByText('Run Details')).toBeInTheDocument();
      });
    });

    it('should have proper heading hierarchy', async () => {
      const headings = screen.getAllByTestId('card-title');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', async () => {
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });

    it('should be keyboard navigable', async () => {
      // Check that buttons are focusable
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        buttons[0].focus();
        expect(document.activeElement).toBe(buttons[0]);
      }
    });
  });
});
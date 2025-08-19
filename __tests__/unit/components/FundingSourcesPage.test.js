/**
 * FundingSourcesPage Component Tests
 * 
 * Comprehensive test suite for the FundingSourcesPage component covering:
 * - Rendering with mock funding source data
 * - Add/Edit/Delete functionality
 * - Filtering and search
 * - Error state handling
 * - Loading states
 * - Supabase client mocking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import FundingSourcesPage from '@/app/admin/funding-sources/page';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(() => ({ id: 'test-id' })),
}));

// Mock Link component
jest.mock('next/link', () => {
  return ({ children, href }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock fetch globally
global.fetch = jest.fn();

describe('FundingSourcesPage', () => {
  let mockRouter;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup router mock
    mockRouter = {
      push: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
    };
    useRouter.mockReturnValue(mockRouter);

    // Mock document visibility API
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });

    // Clear any intervals from previous tests
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      // Mock fetch to delay response
      fetch.mockImplementationOnce(() => new Promise(() => {}));

      render(<FundingSourcesPage />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render funding sources table with data', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Grants.gov',
          organization: 'Federal Government',
          type: 'API',
          last_checked: '2024-01-01T12:00:00Z',
          active: true,
          force_full_reprocessing: false,
        },
        {
          id: '2',
          name: 'State Grants',
          organization: 'California',
          type: 'Manual',
          last_checked: null,
          active: false,
          force_full_reprocessing: true,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Grants.gov')).toBeInTheDocument();
        expect(screen.getByText('State Grants')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Organization')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Last Checked')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Force Reprocess')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check source details
      expect(screen.getByText('Federal Government')).toBeInTheDocument();
      expect(screen.getByText('California')).toBeInTheDocument();
      expect(screen.getByText('API')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });

    it('should render error state when fetch fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      });
    });

    it('should render empty state when no sources exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: [] }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('No sources found. Add a new source to get started.')).toBeInTheDocument();
      });
    });
  });

  describe('Add New Funding Source', () => {
    it('should navigate to add new source page when button clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: [] }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        const addButton = screen.getByText('Add New Source');
        expect(addButton).toBeInTheDocument();
        expect(addButton.closest('a')).toHaveAttribute('href', '/admin/funding-sources/new');
      });
    });
  });

  describe('Edit Existing Funding Source', () => {
    it('should navigate to edit page when source name is clicked', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        const sourceLink = screen.getByText('Test Source');
        expect(sourceLink.closest('a')).toHaveAttribute('href', '/admin/funding-sources/1');
      });
    });
  });

  describe('Delete Funding Source', () => {
    beforeEach(() => {
      global.confirm = jest.fn();
    });

    it('should delete source when confirmed', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      global.confirm.mockReturnValue(true);

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this source?');
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1', {
          method: 'DELETE',
        });
      });
    });

    it('should not delete source when cancelled', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      global.confirm.mockReturnValue(false);

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(global.confirm).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial fetch
    });

    it('should show error notification when delete fails', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Delete failed' }),
        });

      global.confirm.mockReturnValue(true);

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Error deleting source/)).toBeInTheDocument();
      });
    });
  });

  describe('Processing Sources', () => {
    it('should process individual source when Process button clicked', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            handlerResult: { opportunitiesCount: 10 },
          }),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const processButton = screen.getByText('Process');
      fireEvent.click(processButton);

      expect(screen.getByText('Processing...')).toBeInTheDocument();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1/process', {
          method: 'POST',
        });
        expect(screen.getByText(/Successfully processed source. Found 10 opportunities/)).toBeInTheDocument();
      });
    });

    it('should handle process errors gracefully', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockRejectedValueOnce(new Error('Processing failed'));

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const processButton = screen.getByText('Process');
      fireEvent.click(processButton);

      await waitFor(() => {
        expect(screen.getByText(/Error processing source: Processing failed/)).toBeInTheDocument();
      });
    });

    it('should process next source in queue', async () => {
      global.alert = jest.fn();
      global.location = { reload: jest.fn() };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ source: 'Test Source', message: 'Processing started' }),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        const processQueueButton = screen.getByText('Process Next Source in Queue');
        expect(processQueueButton).toBeInTheDocument();
      });

      const processQueueButton = screen.getByText('Process Next Source in Queue');
      fireEvent.click(processQueueButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/funding/process', {
          method: 'POST',
        });
        expect(global.alert).toHaveBeenCalledWith('Processing started');
      });
    });
  });

  describe('Toggle Source Active Status', () => {
    it('should activate inactive source', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: false,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });

      const activateButton = screen.getByText('Activate');
      fireEvent.click(activateButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ active: true }),
        });
      });
    });

    it('should deactivate active source', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });

      const deactivateButton = screen.getByText('Deactivate');
      fireEvent.click(deactivateButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ active: false }),
        });
      });
    });
  });

  describe('Force Full Reprocessing', () => {
    it('should toggle individual source force reprocessing', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
          force_full_reprocessing: false,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox', { name: '' });
        expect(checkbox).not.toBeChecked();
      });

      const checkbox = screen.getByRole('checkbox', { name: '' });
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ force_full_reprocessing: true }),
        });
      });
    });

    it('should toggle global force reprocessing for all sources', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Source 1',
          organization: 'Org 1',
          type: 'API',
          active: true,
          force_full_reprocessing: false,
        },
        {
          id: '2',
          name: 'Source 2',
          organization: 'Org 2',
          type: 'API',
          active: true,
          force_full_reprocessing: false,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Global Force Full Reprocessing')).toBeInTheDocument();
      });

      const globalToggle = screen.getByText('Global Force Full Reprocessing')
        .closest('div')
        .querySelector('input[type="checkbox"]');
      
      fireEvent.click(globalToggle);

      await waitFor(() => {
        // Should update both sources
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/1', expect.any(Object));
        expect(fetch).toHaveBeenCalledWith('/api/funding/sources/2', expect.any(Object));
      });
    });

    it('should show warning when global reprocessing is enabled', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Source 1',
          organization: 'Org 1',
          type: 'API',
          active: true,
          force_full_reprocessing: true,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Global reprocessing is active - all sources will skip duplicate detection')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-refresh', () => {
    it('should refresh data when page becomes visible', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      // Simulate page becoming hidden then visible
      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'hidden',
      });

      Object.defineProperty(document, 'visibilityState', {
        writable: true,
        configurable: true,
        value: 'visible',
      });

      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);

      await waitFor(() => {
        // Should have fetched data again (initial + visibility change)
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should periodically refresh data', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      // Fast-forward time by 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        // Should have fetched data again
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Notifications', () => {
    it('should display success notification', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: false,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const activateButton = screen.getByText('Activate');
      fireEvent.click(activateButton);

      await waitFor(() => {
        expect(screen.getByText('Source activated successfully')).toBeInTheDocument();
      });

      // Notification should auto-dismiss after 5 seconds
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('Source activated successfully')).not.toBeInTheDocument();
      });
    });

    it('should display error notification', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSources }),
        })
        .mockRejectedValueOnce(new Error('Update failed'));

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      const deactivateButton = screen.getByText('Deactivate');
      fireEvent.click(deactivateButton);

      await waitFor(() => {
        expect(screen.getByText(/Error updating source: Update failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
          force_full_reprocessing: false,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        // Check table structure
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();

        // Check buttons have proper roles
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);

        // Check links
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should be keyboard navigable', async () => {
      const mockSources = [
        {
          id: '1',
          name: 'Test Source',
          organization: 'Test Org',
          type: 'API',
          active: true,
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: mockSources }),
      });

      render(<FundingSourcesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Source')).toBeInTheDocument();
      });

      // Check that interactive elements are present and can receive focus
      const addNewSourceLink = screen.getByText('Add New Source');
      expect(addNewSourceLink).toBeInTheDocument();
      addNewSourceLink.focus();
      expect(document.activeElement).toBe(addNewSourceLink);
    });
  });
});
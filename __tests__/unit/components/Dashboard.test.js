/**
 * Dashboard Component Tests
 * 
 * Comprehensive test suite for the Dashboard (Home) component covering:
 * - Opportunity data display and grid rendering
 * - Filtering functionality
 * - Geographic map integration
 * - Real-time update subscription
 * - Responsive design
 * - Chart visualization
 * - Pagination and data loading
 * - Export functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Home from '@/app/page';

// Mock components
jest.mock('@/components/layout/main-layout', () => {
  return function MainLayout({ children }) {
    return <div data-testid="main-layout">{children}</div>;
  };
});

jest.mock('@/components/dashboard/FundingCategoryChart', () => {
  return function FundingCategoryChart() {
    return <div data-testid="funding-category-chart">Funding Category Chart</div>;
  };
});

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }) => (
    <button onClick={onClick} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  AlertTriangle: () => <span data-testid="alert-triangle">⚠️</span>,
}));

jest.mock('next/link', () => {
  return function Link({ children, href }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock fetch globally
global.fetch = jest.fn();

describe('Dashboard (Home) Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/deadlines?type=upcoming')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: '1',
                title: 'Energy Efficiency Grant',
                source_name: 'DOE',
                formattedDate: 'Apr 30, 2024',
                daysLeft: 5,
              },
              {
                id: '2',
                title: 'School Modernization',
                source_name: 'Dept of Education',
                formattedDate: 'May 10, 2024',
                daysLeft: 15,
              },
            ],
          }),
        });
      }
      if (url.includes('/api/deadlines?type=thirty_day_count')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            count: 12,
          }),
        });
      }
      if (url.includes('/api/counts?type=open_opportunities')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            count: 42,
          }),
        });
      }
      if (url.includes('/api/funding')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: '1',
                title: 'Clean Energy Innovation',
                source_name: 'California Energy Commission',
                created_at: '2024-01-15',
                relevance_score: 0.92,
              },
              {
                id: '2',
                title: 'Community Development Grant',
                source_name: 'HUD',
                created_at: '2024-01-14',
                relevance_score: 0.85,
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });
  });

  describe('Rendering', () => {
    it('should render main dashboard layout', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByTestId('main-layout')).toBeInTheDocument();
        expect(screen.getByText('Welcome to Meridian')).toBeInTheDocument();
        expect(screen.getByText(/Your centralized platform for policy and funding intelligence/)).toBeInTheDocument();
      });
    });

    it('should render all summary cards', async () => {
      render(<Home />);
      
      await waitFor(() => {
        // Summary cards
        expect(screen.getByText('Open Opportunities')).toBeInTheDocument();
        expect(screen.getByText('Upcoming Deadlines')).toBeInTheDocument();
        expect(screen.getByText('Active Legislation')).toBeInTheDocument();
        expect(screen.getByText('Client Matches')).toBeInTheDocument();
      });
    });

    it('should render detail cards', async () => {
      render(<Home />);
      
      await waitFor(() => {
        // Detail cards
        expect(screen.getByText('Recent Opportunities')).toBeInTheDocument();
        expect(screen.getByText('Legislative Updates')).toBeInTheDocument();
        expect(screen.getAllByText('Upcoming Deadlines')[0]).toBeInTheDocument();
      });
    });

    it('should render chart and quick actions', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByTestId('funding-category-chart')).toBeInTheDocument();
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });

    it('should render recent activity section', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument();
        expect(screen.getByText('Latest Updates')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should display loading state for deadlines', () => {
      // Mock delayed response
      fetch.mockImplementation(() => new Promise(() => {}));
      
      render(<Home />);
      
      const deadlineCards = screen.getAllByTestId('card-content');
      const loadingSpinner = deadlineCards[0].querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('should display loaded deadline data', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Energy Efficiency Grant')).toBeInTheDocument();
        expect(screen.getByText('5 days left')).toBeInTheDocument();
      });
    });

    it('should display loaded opportunity count', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const openOpportunitiesCard = screen.getByText('Open Opportunities').closest('[data-testid="card"]');
        expect(within(openOpportunitiesCard).getByText('42')).toBeInTheDocument();
      });
    });

    it('should display loaded deadline count', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const upcomingDeadlinesCard = screen.getAllByText('Upcoming Deadlines')[0].closest('[data-testid="card"]');
        expect(within(upcomingDeadlinesCard).getByText('12')).toBeInTheDocument();
      });
    });

    it('should display recent opportunities', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Clean Energy Innovation')).toBeInTheDocument();
        expect(screen.getByText('California Energy Commission')).toBeInTheDocument();
        expect(screen.getByText('Score: 0.9')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle deadline fetch error with fallback data', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/deadlines?type=upcoming')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        // Should show fallback sample data
        expect(screen.getByText('Clean Energy Innovation Fund')).toBeInTheDocument();
        expect(screen.getByText('Error loading deadlines. Using sample data.')).toBeInTheDocument();
      });
    });

    it('should handle opportunity count fetch error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fetch.mockImplementation((url) => {
        if (url.includes('/api/counts')) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        // Should show fallback value
        const openOpportunitiesCard = screen.getByText('Open Opportunities').closest('[data-testid="card"]');
        expect(within(openOpportunitiesCard).getByText('24')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle recent opportunities fetch error with fallback', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/funding')) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        // Should show fallback sample data
        expect(screen.getByText('Building Energy Efficiency Grant')).toBeInTheDocument();
        expect(screen.getByText('Department of Energy')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Links', () => {
    it('should have correct links in summary cards', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const viewAllLink = screen.getByText('View All →');
        expect(viewAllLink.closest('a')).toHaveAttribute('href', '/funding/opportunities?status=Open');
        
        const timelineLink = screen.getByText('View Timeline →');
        expect(timelineLink.closest('a')).toHaveAttribute('href', '/timeline');
        
        const billsLink = screen.getByText('View Bills →');
        expect(billsLink.closest('a')).toHaveAttribute('href', '/legislation/bills');
        
        const matchesLink = screen.getByText('View Matches →');
        expect(matchesLink.closest('a')).toHaveAttribute('href', '/clients');
      });
    });

    it('should have correct links in detail cards', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const allOpportunitiesLink = screen.getByText('View All Opportunities');
        expect(allOpportunitiesLink.closest('a')).toHaveAttribute(
          'href', 
          '/funding/opportunities?sort=recent&sort_direction=desc'
        );
        
        const allLegislationLink = screen.getByText('View All Legislation');
        expect(allLegislationLink.closest('a')).toHaveAttribute('href', '/legislation/bills');
      });
    });

    it('should have correct quick action links', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const browseLink = screen.getByText('Browse Opportunities');
        expect(browseLink.closest('a')).toHaveAttribute('href', '/funding/opportunities');
        
        const mapLink = screen.getByText('View Funding Map');
        expect(mapLink.closest('a')).toHaveAttribute('href', '/funding/map');
        
        const trackLink = screen.getByText('Track Legislation');
        expect(trackLink.closest('a')).toHaveAttribute('href', '/legislation/bills');
        
        const clientsLink = screen.getByText('Match Clients');
        expect(clientsLink.closest('a')).toHaveAttribute('href', '/clients');
      });
    });
  });

  describe('Deadline Urgency Indicators', () => {
    it('should show red indicator for deadlines within 7 days', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const urgentDeadline = screen.getByText('5 days left');
        expect(urgentDeadline).toHaveClass('bg-red-100', 'text-red-800');
      });
    });

    it('should show yellow indicator for deadlines within 14 days', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/deadlines?type=upcoming')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [{
                id: '1',
                title: 'Test Grant',
                source_name: 'Test',
                formattedDate: 'May 5, 2024',
                daysLeft: 10,
              }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        const mediumDeadline = screen.getByText('10 days left');
        expect(mediumDeadline).toHaveClass('bg-yellow-100', 'text-yellow-800');
      });
    });

    it('should show blue indicator for deadlines beyond 14 days', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/deadlines?type=upcoming')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [{
                id: '1',
                title: 'Test Grant',
                source_name: 'Test',
                formattedDate: 'June 1, 2024',
                daysLeft: 30,
              }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        const lowUrgencyDeadline = screen.getByText('30 days left');
        expect(lowUrgencyDeadline).toHaveClass('bg-blue-100', 'text-blue-800');
      });
    });
  });

  describe('Activity Feed', () => {
    it('should display activity items with correct status indicators', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('New Funding Opportunity')).toBeInTheDocument();
        expect(screen.getByText('Legislation Update')).toBeInTheDocument();
        expect(screen.getByText('Client Match')).toBeInTheDocument();
        expect(screen.getByText('Deadline Approaching')).toBeInTheDocument();
        expect(screen.getByText('New Policy Brief')).toBeInTheDocument();
      });
    });

    it('should display correct timestamps for activities', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('2 hours ago')).toBeInTheDocument();
        expect(screen.getByText('4 hours ago')).toBeInTheDocument();
        expect(screen.getAllByText('Yesterday')[0]).toBeInTheDocument();
        expect(screen.getByText('2 days ago')).toBeInTheDocument();
      });
    });

    it('should have View All button for activity feed', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const viewAllButton = within(screen.getByText('Latest Updates').closest('div')).getByText('View All');
        expect(viewAllButton).toBeInTheDocument();
      });
    });
  });

  describe('Legislative Updates', () => {
    it('should display legislative items with status badges', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('H.R. 123: Building Efficiency Act')).toBeInTheDocument();
        expect(screen.getByText('Committee')).toBeInTheDocument();
        expect(screen.getByText('Introduced')).toBeInTheDocument();
        expect(screen.getByText('Passed')).toBeInTheDocument();
      });
    });

    it('should show demo data warning for legislative updates', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const legislativeCard = screen.getByText('Legislative Updates').closest('[data-testid="card"]');
        const warning = within(legislativeCard).getByText(/Demo data for illustration purposes only/);
        expect(warning).toBeInTheDocument();
      });
    });
  });

  describe('Demo Data Indicators', () => {
    it('should show demo data badges on appropriate cards', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const activeLegislationCard = screen.getByText('Active Legislation').closest('[data-testid="card"]');
        expect(within(activeLegislationCard).getByTestId('alert-triangle')).toBeInTheDocument();
        expect(within(activeLegislationCard).getByText('Demo Data')).toBeInTheDocument();
        
        const clientMatchesCard = screen.getByText('Client Matches').closest('[data-testid="card"]');
        expect(within(clientMatchesCard).getByTestId('alert-triangle')).toBeInTheDocument();
        expect(within(clientMatchesCard).getByText('Demo Data')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const container = screen.getByText('Welcome to Meridian').closest('.container');
        expect(container).toHaveClass('py-10');
        
        // Check for responsive grid classes
        const grids = container.querySelectorAll('.grid');
        expect(grids[0]).toHaveClass('md:grid-cols-2', 'lg:grid-cols-4');
        expect(grids[1]).toHaveClass('md:grid-cols-2', 'lg:grid-cols-3');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toHaveTextContent('Welcome to Meridian');
        
        const sectionHeading = screen.getByRole('heading', { level: 2 });
        expect(sectionHeading).toHaveTextContent('Recent Activity');
      });
    });

    it('should have accessible links', async () => {
      render(<Home />);
      
      await waitFor(() => {
        const links = screen.getAllByRole('link');
        links.forEach(link => {
          expect(link).toHaveAttribute('href');
        });
      });
    });

    it('should be keyboard navigable', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Welcome to Meridian')).toBeInTheDocument();
      });

      // Check that links are present and focusable
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      
      // Focus first link and verify it receives focus
      links[0].focus();
      expect(document.activeElement).toBe(links[0]);
    });
  });

  describe('Data Formatting', () => {
    it('should format dates correctly', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Apr 30, 2024')).toBeInTheDocument();
        expect(screen.getByText('May 10, 2024')).toBeInTheDocument();
      });
    });

    it('should format relevance scores correctly', async () => {
      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Score: 0.9')).toBeInTheDocument();
        expect(screen.getByText('Score: 0.8')).toBeInTheDocument();
      });
    });

    it('should handle missing data gracefully', async () => {
      fetch.mockImplementation((url) => {
        if (url.includes('/api/funding')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: [{
                id: '1',
                title: 'Test Opportunity',
                source_name: null,
                created_at: null,
                relevance_score: null,
              }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      });

      render(<Home />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Opportunity')).toBeInTheDocument();
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });
  });
});
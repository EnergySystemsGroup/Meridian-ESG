/**
 * Funding API Service
 * 
 * This service provides an abstraction layer for funding-related database operations.
 * It works with both the old lib/supabase patterns and the new SSR utilities.
 */

// Helper function to calculate days left until a deadline
export const calculateDaysLeft = (closeDate) => {
  const today = new Date();
  const deadline = new Date(closeDate);
  const diffTime = Math.abs(deadline - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Helper function to determine status based on dates
export const determineStatus = (openDate, closeDate) => {
  const today = new Date();
  const open = openDate ? new Date(openDate) : null;
  const close = new Date(closeDate);

  if (close < today) {
    return 'Closed';
  } else if (open && open > today) {
    return 'Upcoming';
  } else {
    return 'Open';
  }
};

// Funding Opportunities API
export const fundingApi = {
  // Get all funding opportunities with optional filters
  getOpportunities: async (supabase, filters = {}) => {
    try {
      // Prepare parameters for the RPC call, matching the function definition
      const params = {
        p_status: filters.status || null,
        p_categories:
          filters.categories && filters.categories.length > 0
            ? filters.categories
            : null,
        p_state_code: filters.stateCode || null,  // Single state code for coverage-based filtering
        p_coverage_types:
          filters.coverageTypes && filters.coverageTypes.length > 0
            ? filters.coverageTypes
            : null,  // Array of coverage types: national, state, local, unknown
        p_search: filters.search || null,
        p_sort_by: filters.sort_by || 'relevance',
        p_sort_direction: filters.sort_direction || 'desc',
        p_page: filters.page || 1,
        p_page_size: filters.page_size || 9, // Match function default
        p_tracked_ids:
          filters.trackedIds !== undefined
            ? filters.trackedIds // Pass the array even if empty
            : null,
      };

      // Call the database function to get paginated and sorted data
      const { data, error } = await supabase.rpc(
        'get_funding_opportunities_dynamic_sort',
        params
      );

      if (error) {
        console.error(
          'Error calling get_funding_opportunities_dynamic_sort RPC:',
          error
        );
        throw error;
      }

      // Get total count using another RPC call with high page size to count all
      // We use the same function but with a very high page_size and page 1
      const countParams = {
        ...params,
        p_page: 1,
        p_page_size: 10000, // Large enough to get all results for counting
      };

      const { data: allData, error: countError } = await supabase.rpc(
        'get_funding_opportunities_dynamic_sort',
        countParams
      );

      let count = 0;
      if (countError) {
        console.error('Error fetching opportunity count:', countError);
        // Fall back to data length if count query fails
        count = data?.length || 0;
      } else {
        count = allData?.length || 0;
      }

      // Return both the data from RPC and the total count
      return { data, count };
    } catch (error) {
      console.error('Error in getOpportunities:', error);
      throw error;
    }
  },

  // Get a single funding opportunity by ID
  getOpportunityById: async (supabase, id) => {
    try {
      const { data, error } = await supabase
        .from('funding_opportunities_with_geography')
        .select(
          `
          *,
          api_sources ( url ) 
        `
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      // Flatten the result to include api_source_url directly
      const opportunityData = { ...data };
      if (data.api_sources) {
        opportunityData.api_source_url = data.api_sources.url;
        delete opportunityData.api_sources; // Clean up nested object
      } else {
        opportunityData.api_source_url = null; // Ensure the field exists
      }

      return opportunityData;
    } catch (error) {
      console.error('Error fetching opportunity by ID:', error);
      throw error;
    }
  },

  // Get recent opportunities
  getRecentOpportunities: async (supabase, limit = 5) => {
    const { data, error } = await supabase
      .from('funding_opportunities')
      .select('*')
      .order('posted_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent opportunities:', error);
      throw error;
    }

    return data;
  },

  // Get upcoming deadlines
  getUpcomingDeadlines: async (supabase, limit = 5) => {
    try {
      const today = new Date().toISOString();

      const { data, error } = await supabase
        .from('funding_opportunities')
        .select('*')
        .gte('close_date', today)
        .order('close_date', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching upcoming deadlines:', error);
      // Return mock data as fallback
      return getMockDeadlines(limit);
    }
  },

  // Get funding sources
  getFundingSources: async (supabase) => {
    try {
      const { data, error } = await supabase
        .from('funding_sources')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching funding sources:', error);
      // Return mock data as fallback
      return getMockFundingSources();
    }
  },

  // Get funding applications for a client
  getClientApplications: async (supabase, clientId) => {
    try {
      const { data, error } = await supabase
        .from('funding_applications')
        .select('*') // Simplified query without joins
        .eq('client_id', clientId)
        .order('next_deadline', { ascending: true });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error(
        `Error fetching applications for client ${clientId}:`,
        error
      );
      // Return mock data as fallback
      return getMockClientApplications(clientId);
    }
  },
};

// Mock data functions for fallback
function getMockDeadlines(limit = 5) {
  const mockDeadlines = [
    {
      id: 1,
      title: 'Clean Energy Innovation Fund',
      source_name: 'California Energy Commission',
      close_date: '2023-04-30T00:00:00Z',
      description:
        'Funding for innovative clean energy projects that reduce greenhouse gas emissions and promote energy independence.',
    },
    {
      id: 2,
      title: 'School Modernization Program',
      source_name: 'Department of Education',
      close_date: '2023-05-01T00:00:00Z',
      description:
        'Grants for K-12 schools to modernize facilities with a focus on energy efficiency, indoor air quality, and sustainability improvements.',
    },
    {
      id: 3,
      title: 'Community Climate Resilience Grant',
      source_name: 'EPA',
      close_date: '2023-05-15T00:00:00Z',
      description:
        'Support for communities to develop and implement climate resilience strategies, including building upgrades and infrastructure improvements.',
    },
    {
      id: 4,
      title: 'Solar for Schools Initiative',
      source_name: 'California Energy Commission',
      close_date: '2023-05-20T00:00:00Z',
      description:
        'Grants to install solar photovoltaic systems on K-12 school facilities to reduce energy costs and provide educational opportunities.',
    },
    {
      id: 5,
      title: 'Zero Emission School Bus Program',
      source_name: 'EPA',
      close_date: '2023-05-30T00:00:00Z',
      description:
        'Grants to replace diesel school buses with zero-emission electric buses and install necessary charging infrastructure.',
    },
    {
      id: 6,
      title: 'Municipal Building Retrofit Program',
      source_name: 'Department of Energy',
      close_date: '2023-06-01T00:00:00Z',
      description:
        'Funding for local governments to retrofit municipal buildings for improved energy efficiency and reduced operational costs.',
    },
    {
      id: 7,
      title: 'Building Electrification Program',
      source_name: 'Oregon Department of Energy',
      close_date: '2023-06-15T00:00:00Z',
      description:
        'Incentives for building owners to convert from fossil fuel systems to electric alternatives for heating, cooling, and water heating.',
    },
    {
      id: 8,
      title: 'Energy Storage Demonstration Grant',
      source_name: 'Department of Energy',
      close_date: '2023-07-01T00:00:00Z',
      description:
        'Funding for demonstration projects that integrate energy storage with renewable energy systems in commercial and institutional buildings.',
    },
  ];

  return mockDeadlines.slice(0, limit);
}

function getMockFundingSources() {
  return [
    { id: 1, name: 'Department of Energy', type: 'Federal' },
    { id: 2, name: 'Environmental Protection Agency', type: 'Federal' },
    { id: 3, name: 'Department of Education', type: 'Federal' },
    { id: 4, name: 'California Energy Commission', type: 'State' },
    { id: 5, name: 'Oregon Department of Energy', type: 'State' },
  ];
}

function getMockClientApplications(clientId) {
  return [
    {
      id: 1,
      client_id: clientId,
      opportunity_id: 1,
      status: 'In Progress',
      next_deadline: '2023-04-15T00:00:00Z',
      notes: 'Need to complete budget section',
    },
    {
      id: 2,
      client_id: clientId,
      opportunity_id: 3,
      status: 'Draft',
      next_deadline: '2023-05-01T00:00:00Z',
      notes: 'Waiting for client to provide project details',
    },
  ];
}

// Export default for backward compatibility
export default fundingApi;
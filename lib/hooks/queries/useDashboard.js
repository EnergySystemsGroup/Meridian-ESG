'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import { fetchDeadlines, fetchCounts } from '@/lib/queries/api';
import { useOpportunities } from './useFunding';

const RECENT_OPPORTUNITIES_FILTERS = {
	sort_by: 'created_at',
	sort_direction: 'desc',
	page: 1,
	page_size: 5,
};

export function useUpcomingDeadlines(limit, options = {}) {
	return useQuery({
		queryKey: queryKeys.dashboard.deadlines('upcoming', limit),
		queryFn: () => fetchDeadlines({ type: 'upcoming', limit }),
		...options,
	});
}

export function useThirtyDayDeadlineCount(options = {}) {
	return useQuery({
		queryKey: queryKeys.dashboard.deadlines('thirty_day_count', undefined),
		queryFn: () => fetchDeadlines({ type: 'thirty_day_count' }),
		...options,
	});
}

export function useOpenOpportunitiesCount(options = {}) {
	return useQuery({
		queryKey: queryKeys.dashboard.counts('open_opportunities'),
		queryFn: () => fetchCounts('open_opportunities'),
		...options,
	});
}

export function useRecentOpportunities(options = {}) {
	return useOpportunities(RECENT_OPPORTUNITIES_FILTERS, options);
}

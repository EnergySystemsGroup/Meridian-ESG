'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	fetchFunding,
	fetchFundingDetail,
	fetchProjectTypes,
	fetchFundingCoverageCounts,
	fetchFundingTotalAvailable,
} from '@/lib/queries/api';

const LONG_STALE_TIME = 15 * 60 * 1000;

export function useOpportunities(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.funding.list(filters),
		queryFn: () => fetchFunding(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useOpportunityDetail(id, options = {}) {
	return useQuery({
		queryKey: queryKeys.funding.detail(id),
		queryFn: () => fetchFundingDetail(id),
		enabled: !!id,
		...options,
	});
}

export function useProjectTypes(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.projectTypes.list(filters),
		queryFn: () => fetchProjectTypes(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useCoverageCounts(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.funding.coverageCounts(filters),
		queryFn: () => fetchFundingCoverageCounts(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useFundingCount(options = {}) {
	return useQuery({
		queryKey: queryKeys.funding.totalAvailable,
		queryFn: fetchFundingTotalAvailable,
		staleTime: LONG_STALE_TIME,
		...options,
	});
}

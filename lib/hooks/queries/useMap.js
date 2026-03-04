'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	fetchMapFundingByState,
	fetchMapNational,
	fetchMapOpportunities,
	fetchMapOpportunitiesByState,
	fetchMapScopeBreakdown,
	fetchCategories,
} from '@/lib/queries/api';

const LONG_STALE_TIME = 15 * 60 * 1000;

export function useFundingByState(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.map.fundingByState(filters),
		queryFn: () => fetchMapFundingByState(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useNationalOpportunities(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.map.national(filters),
		queryFn: () => fetchMapNational(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useMapOpportunities(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.map.opportunities(filters),
		queryFn: () => fetchMapOpportunities(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useStateOpportunities(stateCode, filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.map.opportunitiesByState(stateCode, filters),
		queryFn: () => fetchMapOpportunitiesByState(stateCode, filters),
		enabled: !!stateCode,
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useScopeBreakdown(stateCode, filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.map.scopeBreakdown(stateCode, filters),
		queryFn: () => fetchMapScopeBreakdown(stateCode, filters),
		enabled: !!stateCode,
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useCategoryMapping(options = {}) {
	return useQuery({
		queryKey: queryKeys.categories.list(),
		queryFn: fetchCategories,
		staleTime: LONG_STALE_TIME,
		select: (data) => ({
			rawToNormalizedMap: data.rawToNormalizedMap ?? {},
			categories: data.categories ?? [],
		}),
		...options,
	});
}

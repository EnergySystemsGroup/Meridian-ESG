'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	fetchClientMatching,
	fetchClientMatchingSummary,
	fetchClientMatchingTopMatches,
} from '@/lib/queries/api';

export function useClientMatches(clientId, options = {}) {
	return useQuery({
		queryKey: queryKeys.clientMatching.matches(clientId),
		queryFn: () => fetchClientMatching(clientId),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useClientMatchSummary(options = {}) {
	return useQuery({
		queryKey: queryKeys.clientMatching.summary(),
		queryFn: fetchClientMatchingSummary,
		...options,
	});
}

export function useTopClientMatches(options = {}) {
	return useQuery({
		queryKey: queryKeys.clientMatching.topMatches(),
		queryFn: fetchClientMatchingTopMatches,
		...options,
	});
}

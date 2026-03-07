'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	fetchClientMatching,
	fetchClientMatchingSummary,
	fetchClientMatchingTopMatches,
} from '@/lib/queries/api';

export function useClientMatches(clientId, options = {}) {
	const { userId, ...queryOptions } = options;
	return useQuery({
		queryKey: queryKeys.clientMatching.matches(clientId, userId),
		queryFn: () => fetchClientMatching(clientId, userId),
		placeholderData: (prev) => prev,
		...queryOptions,
	});
}

export function useClientMatchSummary(options = {}) {
	const { userId, ...queryOptions } = options;
	return useQuery({
		queryKey: queryKeys.clientMatching.summary(userId),
		queryFn: () => fetchClientMatchingSummary(userId),
		...queryOptions,
	});
}

export function useTopClientMatches(options = {}) {
	const { userId, ...queryOptions } = options;
	return useQuery({
		queryKey: queryKeys.clientMatching.topMatches(userId),
		queryFn: () => fetchClientMatchingTopMatches(userId),
		...queryOptions,
	});
}

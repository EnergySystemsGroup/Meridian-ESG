'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	fetchAdminReview,
	postAdminApprove,
	postAdminReject,
} from '@/lib/queries/api';

export function useAdminReview(filters = {}, options = {}) {
	return useQuery({
		queryKey: queryKeys.admin.review(filters),
		queryFn: () => fetchAdminReview(filters),
		placeholderData: (prev) => prev,
		...options,
	});
}

export function useApproveReview(options = {}) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ ids, reviewed_by }) =>
			postAdminApprove({ ids, reviewed_by }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
		},
		...options,
	});
}

export function useRejectReview(options = {}) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ ids, reviewed_by, review_notes }) =>
			postAdminReject({ ids, reviewed_by, review_notes }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
		},
		...options,
	});
}

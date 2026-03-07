'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries/queryKeys';
import { fetchUsers } from '@/lib/queries/api';

export function useUsers(options = {}) {
	return useQuery({
		queryKey: queryKeys.users.list(),
		queryFn: fetchUsers,
		staleTime: 5 * 60 * 1000,
		...options,
	});
}

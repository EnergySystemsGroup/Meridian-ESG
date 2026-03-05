'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({ children }) {
	const { isAdmin, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !isAdmin) {
			router.push('/');
		}
	}, [isAdmin, loading, router]);

	if (loading) {
		return (
			<div className='flex items-center justify-center min-h-[50vh]'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
			</div>
		);
	}

	if (!isAdmin) {
		return null;
	}

	return children;
}

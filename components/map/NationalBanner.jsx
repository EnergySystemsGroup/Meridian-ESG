'use client';

import { useState, useEffect } from 'react';
import { Globe, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * NationalBanner - Persistent banner showing national opportunities count
 * Clicking "View All" switches to National View mode
 */
export default function NationalBanner({ onViewNational, filters = {} }) {
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchNationalCount() {
			try {
				setLoading(true);
				const params = new URLSearchParams();

				// Add status filter if set
				if (filters.status && filters.status !== 'all') {
					params.append('status', filters.status);
				}

				// Add project types filter if set
				if (filters.projectTypes?.length > 0) {
					params.append('projectTypes', filters.projectTypes.join(','));
				}

				params.append('countOnly', 'true');

				const response = await fetch(`/api/map/national?${params}`);
				const result = await response.json();

				if (result.success) {
					setCount(result.count || 0);
				}
			} catch (error) {
				console.error('Error fetching national count:', error);
			} finally {
				setLoading(false);
			}
		}

		fetchNationalCount();
	}, [filters.status, filters.projectTypes]);

	return (
		<div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4 mb-6 flex items-center justify-between shadow-md">
			<div className="flex items-center gap-3">
				<div className="bg-white/20 p-2 rounded-full">
					<Globe className="h-5 w-5" />
				</div>
				<div>
					<div className="text-sm font-medium opacity-90">
						National Opportunities
					</div>
					<div className="text-lg font-bold">
						{loading ? (
							<Loader2 className="h-5 w-5 animate-spin inline" />
						) : (
							<>{count} Available Nationwide</>
						)}
					</div>
				</div>
			</div>

			<Button
				variant="secondary"
				size="sm"
				onClick={onViewNational}
				className="bg-white text-blue-700 hover:bg-blue-50"
			>
				View All
				<ChevronRight className="h-4 w-4 ml-1" />
			</Button>
		</div>
	);
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SimpleMapPage() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [data, setData] = useState([]);

	useEffect(() => {
		async function fetchData() {
			try {
				setLoading(true);
				const response = await fetch('/api/map/funding-by-state');

				if (!response.ok) {
					throw new Error(`API error: ${response.status}`);
				}

				const result = await response.json();
				setData(result.data || []);
			} catch (err) {
				console.error('Error fetching map data:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, []);

	return (
		<div className='container py-8'>
			<h1 className='text-3xl font-bold mb-6'>Funding Map (Simple Version)</h1>

			{error && (
				<div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6'>
					Error loading map data: {error}
				</div>
			)}

			{loading ? (
				<div className='h-[400px] bg-gray-100 animate-pulse rounded-md'></div>
			) : (
				<div>
					<p className='mb-4'>Found {data.length} states with funding data</p>

					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
						{data.slice(0, 9).map((state, index) => (
							<div key={index} className='border rounded-md p-4'>
								<h3 className='font-medium'>{state.state}</h3>
								<p className='text-sm text-gray-600'>
									${state.value?.toLocaleString()} in funding
								</p>
								<p className='text-sm text-gray-600'>
									{state.opportunities} opportunities
								</p>
							</div>
						))}
					</div>

					<div className='mt-6'>
						<Link href='/' className='text-blue-600 hover:underline'>
							Return to Home
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}

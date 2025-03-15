'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPage() {
	const supabase = createClientComponentClient();
	const router = useRouter();
	const { id } = useParams();
	const [run, setRun] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('api-call');

	useEffect(() => {
		fetchRun();
		subscribeToRun();
	}, [id]);

	async function fetchRun() {
		try {
			const { data, error } = await supabase
				.from('api_source_runs')
				.select('*, api_sources(*)')
				.eq('id', id)
				.single();

			if (error) throw error;
			setRun(data);
		} catch (error) {
			console.error('Error fetching run:', error);
		} finally {
			setLoading(false);
		}
	}

	function subscribeToRun() {
		const channel = supabase
			.channel('run_updates')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'api_source_runs',
					filter: `id=eq.${id}`,
				},
				(payload) => {
					if (payload.new) {
						setRun((currentRun) => ({
							...currentRun,
							...payload.new,
						}));
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}

	if (loading) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' disabled>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Source
					</Button>
				</div>
				<div className='space-y-4'>
					<div className='h-8 w-1/3 bg-gray-200 animate-pulse rounded' />
					<div className='h-4 w-1/4 bg-gray-200 animate-pulse rounded' />
				</div>
			</div>
		);
	}

	// Calculate metrics for the pipeline overview
	const initialCount = run?.initial_api_call?.totalHitCount || 0;
	const firstFilterCount = run?.first_stage_filter?.passedCount || 0;
	const detailCallCount = run?.detail_api_calls?.successfulDetailCalls || 0;
	const secondFilterCount = run?.second_stage_filter?.passedCount || 0;
	const storedCount = run?.storage_results?.storedCount || 0;

	return (
		<div className='container mx-auto py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href={`/admin/funding-sources/${run?.source_id}`}>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Source
					</Link>
				</Button>
			</div>

			<h1 className='text-2xl font-bold mb-6'>Run Details</h1>

			{/* Processing Pipeline Overview */}
			<div className='bg-white shadow rounded-lg p-6 mb-6'>
				<h3 className='text-lg font-medium mb-4'>
					Processing Pipeline Overview
				</h3>
				<div className='grid grid-cols-5 gap-4 mb-6'>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>Initial Results</p>
						<p className='text-2xl font-bold'>{initialCount}</p>
					</div>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>First Filter</p>
						<p className='text-2xl font-bold'>{firstFilterCount}</p>
						<span
							className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
								firstFilterCount / initialCount < 0.2
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{initialCount
								? ((firstFilterCount / initialCount) * 100).toFixed(1)
								: 0}
							%
						</span>
					</div>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>Detail Calls</p>
						<p className='text-2xl font-bold'>{detailCallCount}</p>
						<span
							className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
								detailCallCount < firstFilterCount
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{firstFilterCount
								? ((detailCallCount / firstFilterCount) * 100).toFixed(1)
								: 0}
							%
						</span>
					</div>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>Second Filter</p>
						<p className='text-2xl font-bold'>{secondFilterCount}</p>
						<span
							className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
								secondFilterCount / detailCallCount < 0.5
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{detailCallCount
								? ((secondFilterCount / detailCallCount) * 100).toFixed(1)
								: 0}
							%
						</span>
					</div>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>Stored</p>
						<p className='text-2xl font-bold'>{storedCount}</p>
						<span
							className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
								storedCount / initialCount < 0.05
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{initialCount
								? ((storedCount / initialCount) * 100).toFixed(1)
								: 0}
							%
						</span>
					</div>
				</div>

				<div className='w-full h-8 bg-gray-100 rounded-full overflow-hidden'>
					<div className='flex h-full'>
						<div
							className='bg-blue-500 h-full'
							style={{
								width: `${
									initialCount ? (firstFilterCount / initialCount) * 100 : 0
								}%`,
							}}
						/>
						<div
							className='bg-green-500 h-full'
							style={{
								width: `${
									initialCount ? (secondFilterCount / initialCount) * 100 : 0
								}%`,
							}}
						/>
						<div
							className='bg-purple-500 h-full'
							style={{
								width: `${
									initialCount ? (storedCount / initialCount) * 100 : 0
								}%`,
							}}
						/>
					</div>
				</div>

				<div className='mt-4 text-sm text-gray-500'>
					Processing {run?.status === 'completed' ? 'completed' : 'in progress'}{' '}
					{run?.total_processing_time
						? `in ${(run.total_processing_time / 1000).toFixed(3)}s`
						: ''}
				</div>
			</div>

			{/* Stage Details Tabs */}
			<div className='border-b border-gray-200'>
				<nav className='-mb-px flex space-x-8' aria-label='Tabs'>
					{[
						'api-call',
						'first-filter',
						'detail-calls',
						'second-filter',
						'storage',
					].map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={`
								whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
								${
									activeTab === tab
										? 'border-blue-500 text-blue-600'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
								}
							`}>
							{tab
								.split('-')
								.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
								.join(' ')}
						</button>
					))}
				</nav>
			</div>

			{/* Tab Content */}
			<div className='mt-6'>
				{activeTab === 'api-call' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Initial API Call Results
						</h3>
						<div className='grid grid-cols-3 gap-4 mb-6'>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Total Results</p>
								<p className='text-2xl font-bold'>
									{run?.initial_api_call?.totalHitCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Response Time</p>
								<p className='text-2xl font-bold'>
									{run?.initial_api_call?.responseTime || 0}ms
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>API Endpoint</p>
								<p className='text-sm font-mono truncate'>
									{run?.initial_api_call?.apiEndpoint || 'N/A'}
								</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === 'first-filter' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							First-Stage Filtering Results
						</h3>
						<div className='grid grid-cols-4 gap-4 mb-6'>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Input Count</p>
								<p className='text-2xl font-bold'>
									{run?.first_stage_filter?.inputCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Passed Filter</p>
								<p className='text-2xl font-bold'>
									{run?.first_stage_filter?.passedCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Pass Rate</p>
								<p className='text-2xl font-bold'>
									{run?.first_stage_filter?.inputCount
										? (
												(run.first_stage_filter.passedCount /
													run.first_stage_filter.inputCount) *
												100
										  ).toFixed(1)
										: 0}
									%
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Filtering Time</p>
								<p className='text-2xl font-bold'>
									{run?.first_stage_filter?.processingTime || 0}ms
								</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === 'detail-calls' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Detail API Call Results
						</h3>
						<div className='grid grid-cols-3 gap-4 mb-6'>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>
									Opportunities Requiring Details
								</p>
								<p className='text-2xl font-bold'>
									{run?.detail_api_calls?.opportunitiesRequiringDetails || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Successful Calls</p>
								<p className='text-2xl font-bold'>
									{run?.detail_api_calls?.successfulDetailCalls || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Failed Calls</p>
								<p className='text-2xl font-bold'>
									{run?.detail_api_calls?.failedDetailCalls || 0}
								</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === 'second-filter' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Second-Stage Filtering Results
						</h3>
						<div className='grid grid-cols-4 gap-4 mb-6'>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Input Count</p>
								<p className='text-2xl font-bold'>
									{run?.second_stage_filter?.inputCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Passed Filter</p>
								<p className='text-2xl font-bold'>
									{run?.second_stage_filter?.passedCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Pass Rate</p>
								<p className='text-2xl font-bold'>
									{run?.second_stage_filter?.inputCount
										? (
												(run.second_stage_filter.passedCount /
													run.second_stage_filter.inputCount) *
												100
										  ).toFixed(1)
										: 0}
									%
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Filtering Time</p>
								<p className='text-2xl font-bold'>
									{run?.second_stage_filter?.processingTime || 0}ms
								</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === 'storage' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Database Storage Results
						</h3>
						<div className='grid grid-cols-3 gap-4 mb-6'>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Opportunities to Store</p>
								<p className='text-2xl font-bold'>
									{run?.storage_results?.attemptedCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Total Stored</p>
								<p className='text-2xl font-bold'>
									{run?.storage_results?.storedCount || 0}
								</p>
							</div>
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Updated</p>
								<p className='text-2xl font-bold'>
									{run?.storage_results?.updatedCount || 0}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

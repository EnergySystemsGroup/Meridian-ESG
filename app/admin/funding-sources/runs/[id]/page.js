'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPage() {
	const supabase = createClientComponentClient();
	const router = useRouter();
	const { id } = useParams();
	const [run, setRun] = useState(null);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('api-call');
	const [expandedSamples, setExpandedSamples] = useState({});

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

	const toggleSample = (index) => {
		setExpandedSamples((prev) => ({
			...prev,
			[index]: !prev[index],
		}));
	};

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
	const totalHitCount = run?.initial_api_call?.totalHitCount || 0;
	const retrievedCount = run?.initial_api_call?.totalItemsRetrieved || 0;
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
						<p className='text-sm text-gray-500'>Retrieved Items</p>
						<p className='text-2xl font-bold'>{retrievedCount}</p>
						<span className='text-xs text-gray-500'>
							(of {totalHitCount} total available)
						</span>
					</div>
					<div className='text-center'>
						<p className='text-sm text-gray-500'>First Filter</p>
						<p className='text-2xl font-bold'>{firstFilterCount}</p>
						<span
							className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
								firstFilterCount / retrievedCount < 0.2
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{retrievedCount
								? ((firstFilterCount / retrievedCount) * 100).toFixed(1)
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
								storedCount / retrievedCount < 0.05
									? 'bg-red-100 text-red-800'
									: 'bg-green-100 text-green-800'
							}`}>
							{retrievedCount
								? ((storedCount / retrievedCount) * 100).toFixed(1)
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
									retrievedCount ? (firstFilterCount / retrievedCount) * 100 : 0
								}%`,
							}}
						/>
						<div
							className='bg-green-500 h-full'
							style={{
								width: `${
									retrievedCount
										? (secondFilterCount / retrievedCount) * 100
										: 0
								}%`,
							}}
						/>
						<div
							className='bg-purple-500 h-full'
							style={{
								width: `${
									retrievedCount ? (storedCount / retrievedCount) * 100 : 0
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
								<p className='text-sm text-gray-500'>Retrieved Items</p>
								<p className='text-2xl font-bold'>
									{run?.initial_api_call?.totalItemsRetrieved || 0}
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

						{/* Raw Response Samples Section */}
						{run?.initial_api_call?.rawResponseSamples &&
							run.initial_api_call.rawResponseSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										API Response Samples{' '}
										<span className='text-xs font-normal text-gray-500'>
											(complete data)
										</span>
									</h4>
									<div className='space-y-4'>
										{run.initial_api_call.rawResponseSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg bg-gray-50 overflow-hidden'>
													<div
														className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
														onClick={() => toggleSample(index)}>
														<h5 className='font-semibold'>
															{item.title ||
																item.name ||
																`Raw Sample #${index + 1}`}
														</h5>
														<div className='flex items-center'>
															<span className='text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 mr-2'>
																Complete Raw Data
															</span>
															{expandedSamples[index] ? (
																<ChevronUp className='h-5 w-5 text-gray-500' />
															) : (
																<ChevronDown className='h-5 w-5 text-gray-500' />
															)}
														</div>
													</div>

													{expandedSamples[index] && (
														<div className='p-4 overflow-auto'>
															<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
																{JSON.stringify(
																	item,
																	(key, value) => {
																		// Skip metadata fields in the output
																		if (key.startsWith('_')) return undefined;
																		return value;
																	},
																	2
																)}
															</pre>
														</div>
													)}
												</div>
											))}
									</div>
								</div>
							)}

						{/* API Configuration Section */}
						{run?.initial_api_call?.configuration && (
							<div className='mt-6'>
								<h4 className='text-md font-medium mb-3'>API Configuration</h4>
								<div className='space-y-4'>
									{/* Request Config */}
									<div className='border rounded-lg bg-gray-50 overflow-hidden'>
										<div
											className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
											onClick={() => toggleSample('request-config')}>
											<h5 className='font-semibold'>Request Configuration</h5>
											<div className='flex items-center'>
												<span className='text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 mr-2'>
													{run.initial_api_call.configuration?.method || 'GET'}{' '}
													{run.initial_api_call.apiEndpoint}
												</span>
												{expandedSamples['request-config'] ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
										</div>

										{expandedSamples['request-config'] && (
											<div className='p-4 overflow-auto'>
												<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
													{JSON.stringify(
														{
															method:
																run.initial_api_call.configuration?.method ||
																'GET',
															url: run.initial_api_call.apiEndpoint,
															headers:
																run.initial_api_call.configuration
																	?.requestConfig?.headers || {},
															queryParameters:
																run.initial_api_call.configuration
																	?.queryParameters || {},
															requestBody:
																run.initial_api_call.configuration
																	?.requestBody || {},
														},
														null,
														2
													)}
												</pre>
											</div>
										)}
									</div>

									{/* Pagination Config */}
									{run.initial_api_call.configuration?.paginationConfig && (
										<div className='border rounded-lg bg-gray-50 overflow-hidden'>
											<div
												className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
												onClick={() => toggleSample('pagination-config')}>
												<h5 className='font-semibold'>
													Pagination Configuration
												</h5>
												<div className='flex items-center'>
													<span className='text-xs bg-purple-100 text-purple-800 rounded px-2 py-1 mr-2'>
														{run.initial_api_call.configuration.paginationConfig
															.enabled
															? `${run.initial_api_call.configuration.paginationConfig.type} pagination`
															: 'Pagination disabled'}
													</span>
													{expandedSamples['pagination-config'] ? (
														<ChevronUp className='h-5 w-5 text-gray-500' />
													) : (
														<ChevronDown className='h-5 w-5 text-gray-500' />
													)}
												</div>
											</div>

											{expandedSamples['pagination-config'] && (
												<div className='p-4 overflow-auto'>
													<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
														{JSON.stringify(
															run.initial_api_call.configuration
																.paginationConfig,
															null,
															2
														)}
													</pre>
												</div>
											)}
										</div>
									)}

									{/* Complete Config */}
									<div className='border rounded-lg bg-gray-50 overflow-hidden'>
										<div
											className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
											onClick={() => toggleSample('complete-config')}>
											<h5 className='font-semibold'>Complete Configuration</h5>
											<div className='flex items-center'>
												<span className='text-xs bg-gray-100 text-gray-800 rounded px-2 py-1 mr-2'>
													Raw JSON
												</span>
												{expandedSamples['complete-config'] ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
										</div>

										{expandedSamples['complete-config'] && (
											<div className='p-4 overflow-auto'>
												<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
													{JSON.stringify(
														run.initial_api_call.configuration,
														null,
														2
													)}
												</pre>
											</div>
										)}
									</div>
								</div>
							</div>
						)}
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
									{run?.first_stage_filter?.totalOpportunitiesAnalyzed || 0}
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
									{run?.first_stage_filter?.totalOpportunitiesAnalyzed
										? (
												(run.first_stage_filter.passedCount /
													run.first_stage_filter.totalOpportunitiesAnalyzed) *
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

						{/* Raw Filtered Items Section */}
						{run?.first_stage_filter?.rawFilteredSamples &&
							run.first_stage_filter.rawFilteredSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										Filtered Opportunities{' '}
										<span className='text-xs font-normal text-gray-500'>
											(complete data)
										</span>
									</h4>
									<div className='space-y-4'>
										{run.first_stage_filter.rawFilteredSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg bg-gray-50 overflow-hidden'>
													<div
														className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
														onClick={() => toggleSample(`first-${index}`)}>
														<h5 className='font-semibold'>
															{item.title || `Filtered Item #${index + 1}`}
														</h5>
														<div className='flex items-center'>
															<span className='text-xs bg-green-100 text-green-800 rounded px-2 py-1 mr-2'>
																{item.relevanceScore
																	? `Score: ${item.relevanceScore}/10`
																	: 'Passed Filter'}
															</span>
															{expandedSamples[`first-${index}`] ? (
																<ChevronUp className='h-5 w-5 text-gray-500' />
															) : (
																<ChevronDown className='h-5 w-5 text-gray-500' />
															)}
														</div>
													</div>

													{expandedSamples[`first-${index}`] && (
														<div className='p-4 overflow-auto'>
															<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
																{JSON.stringify(
																	item,
																	(key, value) => {
																		// Skip metadata fields in the output
																		if (key.startsWith('_')) return undefined;
																		return value;
																	},
																	2
																)}
															</pre>
														</div>
													)}
												</div>
											))}
									</div>
								</div>
							)}

						{/* Sample Items Section for First Filter */}
						{run?.first_stage_filter?.responseSamples &&
							run.first_stage_filter.responseSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										Sample Filtered Items
									</h4>
									<div className='space-y-4'>
										{run.first_stage_filter.responseSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg p-4 bg-gray-50'>
													<h5 className='font-semibold mb-2'>
														{item.title || 'Untitled Item'}
													</h5>
													{item.actionableSummary && (
														<p className='text-sm text-gray-600 mb-2'>
															{item.actionableSummary}
														</p>
													)}
													{item.relevanceScore && (
														<div className='mb-2'>
															<span className='inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
																Relevance Score: {item.relevanceScore}/10
															</span>
														</div>
													)}
													<div className='grid grid-cols-2 gap-2 text-xs text-gray-500'>
														{item.id && (
															<div className='col-span-2'>
																<span className='font-medium'>ID:</span>{' '}
																<span className='font-mono'>{item.id}</span>
															</div>
														)}
														{item.source && (
															<div className='col-span-2'>
																<span className='font-medium'>Source:</span>{' '}
																{item.source}
															</div>
														)}
													</div>
												</div>
											))}
									</div>
								</div>
							)}
					</div>
				)}

				{activeTab === 'detail-calls' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Detail API Call Results
						</h3>
						<div className='grid grid-cols-4 gap-4 mb-6'>
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
							<div className='text-center p-4 bg-gray-50 rounded-lg'>
								<p className='text-sm text-gray-500'>Avg Response Time</p>
								<p className='text-2xl font-bold'>
									{run?.detail_api_calls?.averageDetailResponseTime
										? `${Math.round(
												run.detail_api_calls.averageDetailResponseTime
										  )}ms`
										: 'N/A'}
								</p>
							</div>
						</div>

						{/* API Configuration Section */}
						{run?.detail_api_calls?.configuration && (
							<div className='mt-6'>
								<h4 className='text-md font-medium mb-3'>
									Detail API Configuration
								</h4>
								<div className='space-y-4'>
									{/* Detail Config */}
									<div className='border rounded-lg bg-gray-50 overflow-hidden'>
										<div
											className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
											onClick={() => toggleSample('detail-config')}>
											<h5 className='font-semibold'>
												Detail API Configuration
											</h5>
											<div className='flex items-center'>
												<span className='text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 mr-2'>
													{run.detail_api_calls.configuration?.method || 'GET'}{' '}
													{run.detail_api_calls.configuration.endpoint}
												</span>
												{expandedSamples['detail-config'] ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
										</div>

										{expandedSamples['detail-config'] && (
											<div className='p-4 overflow-auto'>
												<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
													{JSON.stringify(
														{
															endpoint:
																run.detail_api_calls.configuration.endpoint,
															method:
																run.detail_api_calls.configuration.method ||
																'GET',
															idParam:
																run.detail_api_calls.configuration.idParam,
															responseDataPath:
																run.detail_api_calls.configuration
																	.responseDataPath || 'data',
															enabled:
																run.detail_api_calls.configuration.enabled,
														},
														null,
														2
													)}
												</pre>
											</div>
										)}
									</div>

									{/* Raw Detail Config */}
									<div className='border rounded-lg bg-gray-50 overflow-hidden'>
										<div
											className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
											onClick={() => toggleSample('raw-detail-config')}>
											<h5 className='font-semibold'>
												Complete Detail Configuration
											</h5>
											<div className='flex items-center'>
												<span className='text-xs bg-gray-100 text-gray-800 rounded px-2 py-1 mr-2'>
													Raw JSON
												</span>
												{expandedSamples['raw-detail-config'] ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
										</div>

										{expandedSamples['raw-detail-config'] && (
											<div className='p-4 overflow-auto'>
												<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
													{JSON.stringify(
														run.detail_api_calls.configuration,
														null,
														2
													)}
												</pre>
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{/* API Response Samples Section */}
						{run?.detail_api_calls?.rawResponseSamples &&
							run.detail_api_calls.rawResponseSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										Detail API Response Samples{' '}
										<span className='text-xs font-normal text-gray-500'>
											(complete data)
										</span>
									</h4>
									<div className='space-y-4'>
										{run.detail_api_calls.rawResponseSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg bg-gray-50 overflow-hidden'>
													<div
														className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
														onClick={() =>
															toggleSample(`detail-sample-${index}`)
														}>
														<h5 className='font-semibold'>
															{item.title ||
																item.name ||
																`Detail Sample #${index + 1}`}
														</h5>
														<div className='flex items-center'>
															<span className='text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 mr-2'>
																Detail API Response
															</span>
															{expandedSamples[`detail-sample-${index}`] ? (
																<ChevronUp className='h-5 w-5 text-gray-500' />
															) : (
																<ChevronDown className='h-5 w-5 text-gray-500' />
															)}
														</div>
													</div>

													{expandedSamples[`detail-sample-${index}`] && (
														<div className='p-4 overflow-auto'>
															<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
																{JSON.stringify(
																	item,
																	(key, value) => {
																		// Skip metadata fields in the output
																		if (key.startsWith('_')) return undefined;
																		return value;
																	},
																	2
																)}
															</pre>
														</div>
													)}
												</div>
											))}
									</div>
								</div>
							)}

						{/* Error Messages Section (if there are failures) */}
						{run?.detail_api_calls?.detailCallErrors &&
							run.detail_api_calls.detailCallErrors.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>Error Messages</h4>
									<div className='bg-red-50 border border-red-100 rounded-lg p-4'>
										<ul className='list-disc pl-5 text-sm text-red-700 space-y-1'>
											{run.detail_api_calls.detailCallErrors
												.slice(0, 5)
												.map((error, index) => (
													<li key={index}>{error}</li>
												))}
											{run.detail_api_calls.detailCallErrors.length > 5 && (
												<li className='font-medium'>
													...and{' '}
													{run.detail_api_calls.detailCallErrors.length - 5}{' '}
													more errors
												</li>
											)}
										</ul>
									</div>
								</div>
							)}
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

						{/* Raw Filtered Items Section for Second Filter */}
						{run?.second_stage_filter?.rawFilteredSamples &&
							run.second_stage_filter.rawFilteredSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										Second-Stage Filtered Opportunities{' '}
										<span className='text-xs font-normal text-gray-500'>
											(complete data)
										</span>
									</h4>
									<div className='space-y-4'>
										{run.second_stage_filter.rawFilteredSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg bg-gray-50 overflow-hidden'>
													<div
														className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
														onClick={() => toggleSample(`second-${index}`)}>
														<h5 className='font-semibold'>
															{item.title || `Second Filter Item #${index + 1}`}
														</h5>
														<div className='flex items-center'>
															<span className='text-xs bg-green-100 text-green-800 rounded px-2 py-1 mr-2'>
																{item.relevanceScore
																	? `Score: ${item.relevanceScore}/10`
																	: 'Passed Second Filter'}
															</span>
															{expandedSamples[`second-${index}`] ? (
																<ChevronUp className='h-5 w-5 text-gray-500' />
															) : (
																<ChevronDown className='h-5 w-5 text-gray-500' />
															)}
														</div>
													</div>

													{expandedSamples[`second-${index}`] && (
														<div className='p-4 overflow-auto'>
															<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
																{JSON.stringify(
																	item,
																	(key, value) => {
																		// Skip metadata fields in the output
																		if (key.startsWith('_')) return undefined;
																		return value;
																	},
																	2
																)}
															</pre>
														</div>
													)}
												</div>
											))}
									</div>
								</div>
							)}

						{/* Sample Items Section for Second Filter */}
						{run?.second_stage_filter?.responseSamples &&
							run.second_stage_filter.responseSamples.length > 0 && (
								<div className='mt-6'>
									<h4 className='text-md font-medium mb-3'>
										Sample Opportunities (Second Filter)
									</h4>
									<div className='space-y-4'>
										{run.second_stage_filter.responseSamples
											.slice(0, 3)
											.map((item, index) => (
												<div
													key={index}
													className='border rounded-lg p-4 bg-gray-50'>
													<h5 className='font-semibold mb-2'>
														{item.title || 'Untitled Item'}
													</h5>
													{item.actionableSummary && (
														<p className='text-sm text-gray-600 mb-2'>
															{item.actionableSummary}
														</p>
													)}
													{item.relevanceScore && (
														<div className='mb-2'>
															<span className='inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
																Relevance Score: {item.relevanceScore}/10
															</span>
														</div>
													)}
													<div className='grid grid-cols-2 gap-2 text-xs text-gray-500'>
														{item.eligibleApplicants &&
															item.eligibleApplicants.length > 0 && (
																<div className='col-span-2'>
																	<span className='font-medium'>
																		Eligible Applicants:
																	</span>{' '}
																	{item.eligibleApplicants.join(', ')}
																</div>
															)}
														{item.totalFundingAvailable && (
															<div>
																<span className='font-medium'>
																	Total Funding:
																</span>{' '}
																$
																{typeof item.totalFundingAvailable === 'number'
																	? item.totalFundingAvailable.toLocaleString()
																	: item.totalFundingAvailable}
															</div>
														)}
														{item.closeDate && (
															<div>
																<span className='font-medium'>Deadline:</span>{' '}
																{new Date(item.closeDate).toLocaleDateString()}
															</div>
														)}
														{item.id && (
															<div className='col-span-2'>
																<span className='font-medium'>ID:</span>{' '}
																<span className='font-mono'>{item.id}</span>
															</div>
														)}
													</div>
												</div>
											))}
									</div>
								</div>
							)}
					</div>
				)}

				{activeTab === 'storage' && (
					<div className='bg-white shadow rounded-lg p-6'>
						<h3 className='text-lg font-medium mb-4'>
							Database Storage Results
						</h3>
						{run?.storage_results ? (
							<div className='mt-4 space-y-4'>
								<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
									<div className='bg-white p-4 rounded-lg shadow'>
										<h3 className='text-xs font-medium text-gray-500'>
											Opportunities Found
										</h3>
										<p className='text-2xl font-bold'>
											{run.storage_results.attemptedCount || 0}
										</p>
									</div>
									<div className='bg-white p-4 rounded-lg shadow'>
										<h3 className='text-xs font-medium text-gray-500'>
											Stored New
										</h3>
										<p className='text-2xl font-bold text-green-500'>
											{run.storage_results.storedCount || 0}
										</p>
									</div>
									<div className='bg-white p-4 rounded-lg shadow'>
										<h3 className='text-xs font-medium text-gray-500'>
											Updated
										</h3>
										<p className='text-2xl font-bold text-blue-500'>
											{run.storage_results.updatedCount || 0}
										</p>
									</div>
									<div className='bg-white p-4 rounded-lg shadow'>
										<h3 className='text-xs font-medium text-gray-500'>
											Skipped
										</h3>
										<p className='text-2xl font-bold text-gray-500'>
											{run.storage_results.skippedCount || 0}
										</p>
									</div>
								</div>

								{/* Funding Source Stats */}
								{(run.storage_results.fundingSourcesCreated > 0 ||
									run.storage_results.fundingSourcesReused > 0) && (
									<div className='mt-4'>
										<h3 className='text-md font-medium mb-2'>
											Funding Sources
										</h3>
										<div className='grid grid-cols-2 gap-4'>
											<div className='bg-white p-4 rounded-lg shadow'>
												<h3 className='text-xs font-medium text-gray-500'>
													New Sources Created
												</h3>
												<p className='text-2xl font-bold text-green-500'>
													{run.storage_results.fundingSourcesCreated || 0}
												</p>
											</div>
											<div className='bg-white p-4 rounded-lg shadow'>
												<h3 className='text-xs font-medium text-gray-500'>
													Existing Sources Used
												</h3>
												<p className='text-2xl font-bold text-blue-500'>
													{run.storage_results.fundingSourcesReused || 0}
												</p>
											</div>
										</div>
									</div>
								)}

								{run.storage_results.storedOpportunities &&
									run.storage_results.storedOpportunities.length > 0 && (
										<div className='mt-4'>
											<h3 className='text-md font-medium mb-2'>
												Sample Stored Opportunities
											</h3>
											<div className='space-y-4'>
												{run.storage_results.storedOpportunities.map(
													(item, index) => (
														<div
															key={index}
															className='border border-gray-200 rounded-lg overflow-hidden'>
															<div className='bg-gray-50 p-3 border-b border-gray-200 flex justify-between'>
																<h4 className='font-medium'>{item.title}</h4>
																<span
																	className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
																		item.operation === 'new'
																			? 'bg-green-100 text-green-800'
																			: 'bg-blue-100 text-blue-800'
																	}`}>
																	{item.operation === 'new' ? 'New' : 'Updated'}
																</span>
															</div>
															<div className='p-3'>
																<div className='text-sm mb-2'>
																	<span className='font-medium'>
																		Opportunity Number:
																	</span>{' '}
																	{item.opportunity_number || 'N/A'}
																</div>
																<div className='text-sm mb-2'>
																	<span className='font-medium'>
																		Funding Agency:
																	</span>{' '}
																	{item.agency_name || 'Unknown'}
																</div>
																<div className='text-sm mb-2'>
																	<span className='font-medium'>
																		Funding Source:
																	</span>{' '}
																	{item.agency_name ||
																		(item.funding_source_name ? (
																			<>
																				{item.funding_source_name}
																				{item.funding_source_type && (
																					<span className='text-xs ml-1 bg-blue-100 text-blue-800 rounded px-1 py-0.5'>
																						{item.funding_source_type}
																					</span>
																				)}
																			</>
																		) : (
																			'Unknown'
																		))}
																</div>
																{(item.funding_source_website ||
																	item.agency_website) && (
																	<div className='text-sm mb-2'>
																		<span className='font-medium'>
																			Website:
																		</span>{' '}
																		<a
																			href={
																				item.funding_source_website ||
																				item.agency_website
																			}
																			target='_blank'
																			rel='noopener noreferrer'
																			className='text-blue-600 hover:underline truncate inline-block max-w-[250px]'>
																			{item.funding_source_website ||
																				item.agency_website}
																		</a>
																	</div>
																)}
																{item.actionable_summary && (
																	<div className='text-sm mb-2'>
																		<span className='font-medium'>
																			Summary:
																		</span>{' '}
																		{item.actionable_summary}
																	</div>
																)}
																{item._changedFields &&
																	item._changedFields.length > 0 && (
																		<div className='mt-2'>
																			<h5 className='text-sm font-medium mb-1'>
																				Changes:
																			</h5>
																			<ul className='text-xs text-gray-600 space-y-1'>
																				{item._changedFields.map(
																					(change, i) => (
																						<li key={i}>
																							<span className='font-medium'>
																								{change.field}:
																							</span>
																							{change.note ? (
																								<span> {change.note}</span>
																							) : (
																								<span>
																									{' '}
																									{JSON.stringify(
																										change.oldValue
																									)}{' '}
																									→{' '}
																									{JSON.stringify(
																										change.newValue
																									)}
																								</span>
																							)}
																						</li>
																					)
																				)}
																			</ul>
																		</div>
																	)}
															</div>
														</div>
													)
												)}
											</div>
										</div>
									)}

								{!run.storage_results.storedOpportunities ||
								run.storage_results.storedOpportunities.length === 0 ? (
									<div className='text-gray-500 text-sm mt-4'>
										No sample opportunities available
									</div>
								) : null}

								<div className='mt-4'>
									<h3 className='text-md font-medium mb-2'>Processing Time</h3>
									<p className='text-lg'>
										{run.storage_results.processingTime
											? `${(run.storage_results.processingTime / 1000).toFixed(
													2
											  )} seconds`
											: 'Not available'}
									</p>
								</div>
							</div>
						) : (
							<div className='flex flex-col items-center justify-center p-8'>
								<div className='text-gray-500 text-center'>
									<p className='mb-2'>Storage results not available</p>
									<p className='text-sm'>
										This could be because the run is still in progress or there
										was an error during processing.
									</p>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

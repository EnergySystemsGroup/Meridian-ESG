'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Zap, Target, Database, Filter, Brain, Shuffle } from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPageV2() {
	const supabase = createClientComponentClient();
	const router = useRouter();
	const { id } = useParams();
	const [run, setRun] = useState(null);
	const [stages, setStages] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('pipeline');
	const [expandedSamples, setExpandedSamples] = useState({});

	useEffect(() => {
		fetchV2Run();
		subscribeToV2Run();
	}, [id]);

	async function fetchV2Run() {
		try {
			// Try to fetch V2 run data first
			const { data: v2Run, error: v2Error } = await supabase
				.from('pipeline_runs')
				.select(`
					*,
					api_sources!pipeline_runs_api_source_id_fkey(*)
				`)
				.eq('id', id)
				.single();

			if (v2Run && !v2Error) {
				setRun(v2Run);
				
				// Fetch V2 pipeline stages
				const { data: v2Stages, error: stagesError } = await supabase
					.from('pipeline_stages')
					.select('*')
					.eq('run_id', id)
					.order('stage_order');

				if (!stagesError) {
					setStages(v2Stages || []);
				}
			} else {
				// Fallback to V1 data if V2 not found
				const { data: v1Run, error: v1Error } = await supabase
					.from('api_source_runs')
					.select('*, api_sources(*)')
					.eq('id', id)
					.single();

				if (v1Error) throw v1Error;
				setRun(v1Run);
				setStages([]); // No V2 stages for V1 runs
			}
		} catch (error) {
			console.error('Error fetching run:', error);
		} finally {
			setLoading(false);
		}
	}

	function subscribeToV2Run() {
		// Subscribe to V2 pipeline_runs table
		const runChannel = supabase
			.channel('v2_run_updates')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pipeline_runs',
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

		// Subscribe to V2 pipeline_stages table
		const stagesChannel = supabase
			.channel('v2_stages_updates')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pipeline_stages',
					filter: `run_id=eq.${id}`,
				},
				() => {
					// Refetch stages when any stage updates
					fetchV2Stages();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(runChannel);
			supabase.removeChannel(stagesChannel);
		};
	}

	async function fetchV2Stages() {
		const { data: v2Stages, error } = await supabase
			.from('pipeline_stages')
			.select('*')
			.eq('run_id', id)
			.order('stage_order');

		if (!error) {
			setStages(v2Stages || []);
		}
	}

	const toggleSample = (index) => {
		setExpandedSamples((prev) => ({
			...prev,
			[index]: !prev[index],
		}));
	};

	const getStageIcon = (stageName) => {
		const icons = {
			'source_orchestrator': Target,
			'data_extraction': Database,
			'early_duplicate_detector': Shuffle,
			'analysis': Brain,
			'filter': Filter,
			'storage': Database,
			'direct_update': Zap
		};
		return icons[stageName] || Target;
	};

	const getStageStatus = (stage) => {
		if (!stage) return 'pending';
		return stage.status;
	};

	const getStageProgress = () => {
		if (stages.length === 0) return 0;
		const completedStages = stages.filter(stage => stage.status === 'completed').length;
		return Math.round((completedStages / stages.length) * 100);
	};

	const formatDuration = (ms) => {
		if (!ms) return 'N/A';
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
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

	// V2 Enhanced metrics
	const isV2Run = run?.pipeline_version === 'v2.0' || stages.length > 0;
	const optimizationMetrics = {
		totalOpportunities: run?.total_opportunities_processed || 0,
		bypassedLLM: run?.opportunities_bypassed_llm || 0,
		opportunitiesPerMinute: run?.opportunities_per_minute || 0,
		tokensPerOpportunity: run?.tokens_per_opportunity || 0,
		successRate: run?.success_rate_percentage || 0
	};

	return (
		<div className='container mx-auto py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href={`/admin/funding-sources/${run?.api_source_id || run?.source_id}`}>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Source
					</Link>
				</Button>
				<Badge variant={isV2Run ? 'default' : 'secondary'}>
					{isV2Run ? 'Optimized Pipeline' : 'Legacy Pipeline'}
				</Badge>
			</div>

			<h1 className='text-2xl font-bold mb-6'>Run Details</h1>

			{/* Performance Metrics */}
			{isV2Run && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Zap className='h-5 w-5 text-yellow-500' />
							Performance Metrics
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
							<div className='text-center'>
								<p className='text-2xl font-bold text-blue-600'>{optimizationMetrics.totalOpportunities}</p>
								<p className='text-sm text-gray-500'>Total Opportunities</p>
							</div>
							<div className='text-center'>
								<p className='text-2xl font-bold text-green-600'>{optimizationMetrics.bypassedLLM}</p>
								<p className='text-sm text-gray-500'>Bypassed LLM</p>
							</div>
							<div className='text-center'>
								<p className='text-2xl font-bold text-purple-600'>{optimizationMetrics.opportunitiesPerMinute || 'N/A'}</p>
								<p className='text-sm text-gray-500'>Opportunities/Min</p>
							</div>
							<div className='text-center'>
								<p className='text-2xl font-bold text-orange-600'>{optimizationMetrics.tokensPerOpportunity || 'N/A'}</p>
								<p className='text-sm text-gray-500'>Tokens/Opportunity</p>
							</div>
							<div className='text-center'>
								<p className='text-2xl font-bold text-indigo-600'>{optimizationMetrics.successRate || 'N/A'}%</p>
								<p className='text-sm text-gray-500'>Success Rate</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Pipeline Visualization */}
			{isV2Run && stages.length > 0 ? (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Target className='h-5 w-5 text-blue-500' />
							Pipeline Progress
						</CardTitle>
						<div className='flex items-center gap-4'>
							<Progress value={getStageProgress()} className='flex-1' />
							<span className='text-sm text-gray-500'>{getStageProgress()}% Complete</span>
						</div>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 md:grid-cols-7 gap-4'>
							{[
								'source_orchestrator',
								'data_extraction', 
								'early_duplicate_detector',
								'analysis',
								'filter',
								'storage',
								'direct_update'
							].map((stageName, index) => {
								const stage = stages.find(s => s.stage_name === stageName);
								const status = getStageStatus(stage);
								const Icon = getStageIcon(stageName);
								
								return (
									<div key={stageName} className='text-center'>
										<div className={`
											w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center
											${status === 'completed' ? 'bg-green-100 text-green-600' : 
											  status === 'processing' ? 'bg-blue-100 text-blue-600' : 
											  status === 'failed' ? 'bg-red-100 text-red-600' :
											  'bg-gray-100 text-gray-400'}
										`}>
											<Icon className='h-6 w-6' />
										</div>
										<p className='text-xs font-medium mb-1'>
											{stageName.split('_').map(word => 
												word.charAt(0).toUpperCase() + word.slice(1)
											).join(' ')}
										</p>
										<Badge 
											variant={status === 'completed' ? 'default' : 
													status === 'processing' ? 'secondary' : 
													status === 'failed' ? 'destructive' : 'outline'}
											className='text-xs'
										>
											{status}
										</Badge>
										{stage?.execution_time_ms && (
											<p className='text-xs text-gray-500 mt-1'>
												{formatDuration(stage.execution_time_ms)}
											</p>
										)}
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			) : (
				// V1 Pipeline Overview (fallback)
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle>V1 Pipeline Overview</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-5 gap-4 mb-6'>
							<div className='text-center'>
								<p className='text-sm text-gray-500'>Retrieved Items</p>
								<p className='text-2xl font-bold'>{run?.initial_api_call?.totalItemsRetrieved || 0}</p>
							</div>
							<div className='text-center'>
								<p className='text-sm text-gray-500'>First Filter</p>
								<p className='text-2xl font-bold'>{run?.first_stage_filter?.passedCount || 0}</p>
							</div>
							<div className='text-center'>
								<p className='text-sm text-gray-500'>Detail Calls</p>
								<p className='text-2xl font-bold'>{run?.detail_api_calls?.successfulDetailCalls || 0}</p>
							</div>
							<div className='text-center'>
								<p className='text-sm text-gray-500'>Second Filter</p>
								<p className='text-2xl font-bold'>{run?.second_stage_filter?.passedCount || 0}</p>
							</div>
							<div className='text-center'>
								<p className='text-sm text-gray-500'>Stored</p>
								<p className='text-2xl font-bold'>{run?.storage_results?.storedCount || 0}</p>
							</div>
						</div>
						<div className='text-sm text-gray-500'>
							Processing {run?.status === 'completed' ? 'completed' : 'in progress'}{' '}
							{run?.total_processing_time
								? `in ${(run.total_processing_time / 1000).toFixed(3)}s`
								: run?.total_execution_time_ms 
								? `in ${(run.total_execution_time_ms / 1000).toFixed(3)}s`
								: ''}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Enhanced Tab Navigation */}
			<div className='border-b border-gray-200'>
				<nav className='-mb-px flex space-x-8' aria-label='Tabs'>
					{[
						{ key: 'pipeline', label: 'Pipeline Details', icon: Target },
						{ key: 'optimization', label: 'Optimization', icon: Zap },
						{ key: 'stages', label: 'Stage Details', icon: Clock },
						{ key: 'raw-data', label: 'Raw Data', icon: Database }
					].map((tab) => {
						const Icon = tab.icon;
						return (
							<button
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={`
									whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
									${
										activeTab === tab.key
											? 'border-blue-500 text-blue-600'
											: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
									}
								`}>
								<Icon className='h-4 w-4' />
								{tab.label}
							</button>
						);
					})}
				</nav>
			</div>

			{/* Enhanced Tab Content */}
			<div className='mt-6'>
				{activeTab === 'pipeline' && (
					<div className='space-y-6'>
						{isV2Run && stages.map((stage) => (
							<Card key={stage.id}>
								<CardHeader>
									<CardTitle className='flex items-center gap-2'>
										{React.createElement(getStageIcon(stage.stage_name), { className: 'h-5 w-5' })}
										{stage.stage_name.split('_').map(word => 
											word.charAt(0).toUpperCase() + word.slice(1)
										).join(' ')}
										<Badge variant={stage.status === 'completed' ? 'default' : 
												stage.status === 'processing' ? 'secondary' : 
												stage.status === 'failed' ? 'destructive' : 'outline'}>
											{stage.status}
										</Badge>
									</CardTitle>
									{stage.execution_time_ms && (
										<p className='text-sm text-gray-500'>
											Execution Time: {formatDuration(stage.execution_time_ms)}
										</p>
									)}
								</CardHeader>
								<CardContent>
									{stage.performance_metrics && Object.keys(stage.performance_metrics).length > 0 && (
										<div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
											{Object.entries(stage.performance_metrics).map(([key, value]) => (
												<div key={key} className='text-center p-3 bg-gray-50 rounded-lg'>
													<p className='text-sm text-gray-500 mb-1'>
														{key.split(/(?=[A-Z])/).join(' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
													</p>
													<p className='text-lg font-semibold'>
														{typeof value === 'number' ? 
															(key.includes('time') || key.includes('Time') ? formatDuration(value) : value.toLocaleString()) 
															: String(value)}
													</p>
												</div>
											))}
										</div>
									)}
									
									{stage.tokens_used > 0 && (
										<div className='bg-blue-50 p-3 rounded-lg mb-4'>
											<p className='text-sm font-medium text-blue-800'>
												Tokens Used: {stage.tokens_used.toLocaleString()}
											</p>
											{stage.api_calls_made > 0 && (
												<p className='text-sm text-blue-600'>
													API Calls: {stage.api_calls_made}
												</p>
											)}
										</div>
									)}
									
									{stage.stage_results && Object.keys(stage.stage_results).length > 0 && (
										<div className='border rounded-lg bg-gray-50 overflow-hidden'>
											<div
												className='flex justify-between items-center p-3 cursor-pointer border-b border-gray-200 bg-white'
												onClick={() => toggleSample(`stage-${stage.id}`)}>
												<h5 className='font-semibold'>Stage Results</h5>
												{expandedSamples[`stage-${stage.id}`] ? (
													<ChevronUp className='h-5 w-5 text-gray-500' />
												) : (
													<ChevronDown className='h-5 w-5 text-gray-500' />
												)}
											</div>
											{expandedSamples[`stage-${stage.id}`] && (
												<div className='p-3 overflow-auto'>
													<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto'>
														{JSON.stringify(stage.stage_results, null, 2)}
													</pre>
												</div>
											)}
										</div>
									)}
								</CardContent>
							</Card>
						))}
						
						{!isV2Run && (
							<Card>
								<CardHeader>
									<CardTitle>Legacy V1 Pipeline</CardTitle>
								</CardHeader>
								<CardContent>
									<p className='text-gray-500'>
										This run used the legacy V1 pipeline. Switch to the "Raw Data" tab to view V1 stage details.
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{activeTab === 'optimization' && (
					<div className='space-y-6'>
						{isV2Run ? (
							<>
								<Card>
									<CardHeader>
										<CardTitle>Optimization Impact</CardTitle>
									</CardHeader>
									<CardContent>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
											<div className='space-y-4'>
												<h4 className='font-semibold'>Performance Gains</h4>
												<div className='space-y-3'>
													<div className='flex justify-between items-center'>
														<span className='text-sm'>Opportunities/Min</span>
														<div className='flex items-center gap-2'>
															<span className='text-sm font-medium'>{optimizationMetrics.opportunitiesPerMinute || 'N/A'}</span>
														</div>
													</div>
													<div className='flex justify-between items-center'>
														<span className='text-sm'>Tokens/Opportunity</span>
														<div className='flex items-center gap-2'>
															<span className='text-sm font-medium'>{optimizationMetrics.tokensPerOpportunity || 'N/A'}</span>
														</div>
													</div>
													<div className='flex justify-between items-center'>
														<span className='text-sm'>Success Rate</span>
														<div className='flex items-center gap-2'>
															<div className='w-32 bg-gray-200 rounded-full h-2'>
																<div 
																	className='bg-indigo-600 h-2 rounded-full'
																	style={{ width: `${Math.min(optimizationMetrics.successRate || 0, 100)}%` }}
																/>
															</div>
															<span className='text-sm font-medium'>{optimizationMetrics.successRate || 'N/A'}%</span>
														</div>
													</div>
												</div>
											</div>
											
											<div className='space-y-4'>
												<h4 className='font-semibold'>Pipeline Efficiency</h4>
												<div className='space-y-3'>
													<div className='bg-green-50 p-3 rounded-lg'>
														<p className='text-sm font-medium text-green-800'>
															Opportunities Bypassed LLM
														</p>
														<p className='text-2xl font-bold text-green-600'>
															{optimizationMetrics.bypassedLLM}
														</p>
														<p className='text-xs text-green-600'>
															Out of {optimizationMetrics.totalOpportunities} total
														</p>
													</div>
													
													{run?.total_tokens_used && (
														<div className='bg-blue-50 p-3 rounded-lg'>
															<p className='text-sm font-medium text-blue-800'>
																Total Tokens Used
															</p>
															<p className='text-2xl font-bold text-blue-600'>
																{run.total_tokens_used.toLocaleString()}
															</p>
															{run?.estimated_cost_usd && (
																<p className='text-xs text-blue-600'>
																	Est. Cost: ${run.estimated_cost_usd.toFixed(4)}
																</p>
															)}
														</div>
													)}
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
								
								<Card>
									<CardHeader>
										<CardTitle>Duplicate Detection Analytics</CardTitle>
									</CardHeader>
									<CardContent>
										<p className='text-gray-500'>
											Detailed duplicate detection metrics will be displayed here when available.
										</p>
									</CardContent>
								</Card>
							</>
						) : (
							<Card>
								<CardHeader>
									<CardTitle>V1 Pipeline</CardTitle>
								</CardHeader>
								<CardContent>
									<p className='text-gray-500'>
										Optimization metrics are only available for enhanced pipeline runs.
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{activeTab === 'stages' && (
					<div className='space-y-6'>
						{isV2Run && stages.length > 0 ? (
							stages.map((stage, index) => (
								<Card key={stage.id}>
									<CardHeader>
										<CardTitle className='flex items-center gap-2'>
											<span className='bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold'>
												{index + 1}
											</span>
											{stage.stage_name.split('_').map(word => 
												word.charAt(0).toUpperCase() + word.slice(1)
											).join(' ')}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
											<div className='text-center p-3 bg-gray-50 rounded-lg'>
												<p className='text-sm text-gray-500'>Status</p>
												<Badge variant={stage.status === 'completed' ? 'default' : 
														stage.status === 'processing' ? 'secondary' : 
														stage.status === 'failed' ? 'destructive' : 'outline'}>
													{stage.status}
												</Badge>
											</div>
											<div className='text-center p-3 bg-gray-50 rounded-lg'>
												<p className='text-sm text-gray-500'>Duration</p>
												<p className='text-lg font-semibold'>
													{formatDuration(stage.execution_time_ms)}
												</p>
											</div>
											<div className='text-center p-3 bg-gray-50 rounded-lg'>
												<p className='text-sm text-gray-500'>Tokens</p>
												<p className='text-lg font-semibold'>
													{stage.tokens_used?.toLocaleString() || '0'}
												</p>
											</div>
											<div className='text-center p-3 bg-gray-50 rounded-lg'>
												<p className='text-sm text-gray-500'>API Calls</p>
												<p className='text-lg font-semibold'>
													{stage.api_calls_made || '0'}
												</p>
											</div>
										</div>
										
										{stage.started_at && (
											<div className='mt-4 text-sm text-gray-500'>
												<p>Started: {new Date(stage.started_at).toLocaleString()}</p>
												{stage.completed_at && (
													<p>Completed: {new Date(stage.completed_at).toLocaleString()}</p>
												)}
											</div>
										)}
									</CardContent>
								</Card>
							))
						) : (
							<Card>
								<CardHeader>
									<CardTitle>Stage Details</CardTitle>
								</CardHeader>
								<CardContent>
									<p className='text-gray-500'>
										{isV2Run ? 'No stage data available for this run.' : 'Stage details are only available for enhanced pipeline runs.'}
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				)}

				{activeTab === 'raw-data' && (
					<div className='space-y-6'>
						<Card>
							<CardHeader>
								<CardTitle>Raw Run Data</CardTitle>
							</CardHeader>
							<CardContent>
								<div className='border rounded-lg bg-gray-50 overflow-hidden'>
									<div
										className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
										onClick={() => toggleSample('raw-run-data')}>
										<h5 className='font-semibold'>Complete Run Information</h5>
										{expandedSamples['raw-run-data'] ? (
											<ChevronUp className='h-5 w-5 text-gray-500' />
										) : (
											<ChevronDown className='h-5 w-5 text-gray-500' />
										)}
									</div>
									{expandedSamples['raw-run-data'] && (
										<div className='p-4 overflow-auto'>
											<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
												{JSON.stringify(run, null, 2)}
											</pre>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						{isV2Run && stages.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle>Pipeline Stages Data</CardTitle>
								</CardHeader>
								<CardContent>
									<div className='border rounded-lg bg-gray-50 overflow-hidden'>
										<div
											className='flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 bg-white'
											onClick={() => toggleSample('raw-stages-data')}>
											<h5 className='font-semibold'>All Pipeline Stages</h5>
											{expandedSamples['raw-stages-data'] ? (
												<ChevronUp className='h-5 w-5 text-gray-500' />
											) : (
												<ChevronDown className='h-5 w-5 text-gray-500' />
											)}
										</div>
										{expandedSamples['raw-stages-data'] && (
											<div className='p-4 overflow-auto'>
												<pre className='text-xs font-mono whitespace-pre-wrap bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto'>
													{JSON.stringify(stages, null, 2)}
												</pre>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
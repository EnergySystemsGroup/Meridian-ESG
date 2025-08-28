'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Zap, Target, Database, Filter, Brain, Shuffle, BarChart3, PieChart } from 'lucide-react';
import Link from 'next/link';
import { StagePerformanceChart, OpportunityFlowChart } from '@/components/admin/charts';
import { JobSelector } from '@/components/admin/JobSelector';
import { isJobBasedRun, extractJobList, aggregateJobData, filterStagesByJob } from '@/lib/utils/jobAggregation';

export default function RunDetailPageV3() {
	const supabase = createClient();
	const router = useRouter();
	const { id } = useParams();
	const [run, setRun] = useState(null);
	const [stages, setStages] = useState([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState('optimization');
	const [expandedSamples, setExpandedSamples] = useState({});
	
	// V3 Unified View Selector State
	const [viewMode, setViewMode] = useState('aggregated'); // 'aggregated' or 'per-job'
	const [selectedJobId, setSelectedJobId] = useState(null);
	
	// Memory leak prevention - track if component is mounted
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		fetchV2Run();
		subscribeToV2Run();
		
		// Cleanup function to prevent memory leaks
		return () => {
			isMountedRef.current = false;
		};
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
				if (!isMountedRef.current) return;
				setRun(v2Run);
				
				// Fetch V2 pipeline stages
				const { data: v2Stages, error: stagesError } = await supabase
					.from('pipeline_stages')
					.select('*')
					.eq('run_id', id)
					.order('stage_order');

				if (!stagesError && isMountedRef.current) {
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
				if (!isMountedRef.current) return;
				setRun(v1Run);
				setStages([]); // No V2 stages for V1 runs
			}
		} catch (error) {
			console.error('Error fetching run:', error);
		} finally {
			if (isMountedRef.current) {
				setLoading(false);
			}
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
		const stagesToUse = (viewMode === 'per-job' && selectedJobId) 
			? stages.filter(stage => stage.job_id === selectedJobId)
			: (viewMode === 'aggregated' && isV3JobBasedRun) 
			? stages // We'll calculate this dynamically
			: stages;
		
		if (stagesToUse.length === 0) return 0;
		const completedStages = stagesToUse.filter(stage => stage.status === 'completed').length;
		return Math.round((completedStages / stagesToUse.length) * 100);
	};

	const formatDuration = (ms) => {
		if (!ms) return 'N/A';
		if (ms < MILLISECONDS_PER_SECOND) return `${ms}ms`;
		if (ms < MILLISECONDS_PER_MINUTE) return `${(ms / MILLISECONDS_PER_SECOND).toFixed(PRECISION_DECIMAL_PLACES)}s`;
		return `${(ms / MILLISECONDS_PER_MINUTE).toFixed(PRECISION_DECIMAL_PLACES)}m`;
	};

	// Extract opportunity flow from pipeline stages - defined early to be used in useMemo
	const extractOpportunityFlow = (stages) => {
		// For job-based runs, we need to aggregate across ALL stages of each type, not just find the first one
		const dataExtractionStages = stages.filter(stage => stage.stage_name === 'data_extraction');
		const duplicateDetectorStages = stages.filter(stage => stage.stage_name === 'early_duplicate_detector');
		const analysisStages = stages.filter(stage => stage.stage_name === 'analysis');
		const storageStages = stages.filter(stage => stage.stage_name === 'storage');
		const directUpdateStages = stages.filter(stage => stage.stage_name === 'direct_update');
		const apiFetchStages = stages.filter(stage => stage.stage_name === 'api_fetch');
		
		// Get total available from api_fetch stage (V3) or data_extraction stages (V2/V1)
		let totalAvailable = 0;      // Total available according to API
		let apiFetchedResults = 0;   // What we actually fetched from the API
		let opportunityInput = dataExtractionStages.reduce((sum, stage) => sum + (stage.output_count || 0), 0);  // Successfully extracted opportunities
		
		// For V3: Get total available from api_fetch stage's performance_metrics
		if (apiFetchStages.length > 0) {
			const apiFetchStage = apiFetchStages[0]; // Should only be one api_fetch stage per run
			try {
				const metrics = typeof apiFetchStage.performance_metrics === 'string' 
					? JSON.parse(apiFetchStage.performance_metrics)
					: apiFetchStage.performance_metrics;
				
				if (metrics && typeof metrics === 'object') {
					totalAvailable = metrics.totalFound || 0; // Total opportunities available from API
					apiFetchedResults = metrics.totalRetrieved || 0; // Actual opportunities fetched
				}
			} catch (error) {
				console.warn(`Failed to parse api_fetch stage performance_metrics:`, error);
			}
		}
		
		// Fallback: If no api_fetch stage or missing data, aggregate from data extraction stages (V2/V1 behavior)
		if (totalAvailable === 0 && apiFetchedResults === 0) {
			dataExtractionStages.forEach(stage => {
				if (!stage?.stage_results) return;
				
				try {
					const results = typeof stage.stage_results === 'string' 
						? JSON.parse(stage.stage_results)
						: stage.stage_results;
					
					if (!results || typeof results !== 'object') return;
						
					// For V2/V1: Extract from data extraction stage results
					totalAvailable += results?.totalAvailable ?? 
					                results?.totalFound ?? 
					                results?.extractionMetrics?.totalFound ?? 0;
					                
					apiFetchedResults += results?.apiFetchedResults ?? 
					                   results?.totalRetrieved ?? 
					                   results?.extractionMetrics?.totalRetrieved ??
					                   results?.extractedOpportunities ?? 
					                   stage?.output_count ?? 0;
				} catch (error) {
					console.warn(`Failed to parse data extraction stage ${stage?.id || 'unknown'} results:`, error);
				}
			});
		}
		
		// Extract breakdown from ALL Early Duplicate Detector stages and aggregate
		let opportunitiesNew = 0;
		let opportunitiesSkipped = 0;
		let opportunitiesUpdated = 0;
		let opportunitiesStored = 0;
		let opportunitiesDuplicates = 0;  // Track pure duplicates separately
		
		duplicateDetectorStages.forEach(stage => {
			if (!stage?.stage_results) return;
			
			try {
				const results = typeof stage.stage_results === 'string' 
					? JSON.parse(stage.stage_results)
					: stage.stage_results;
				
				if (!results || typeof results !== 'object') return;
				
				// Extract counts from the detector results arrays (using safe array checks)
				// These are the pure duplicates that were filtered out entirely
				if (Array.isArray(results?.opportunitiesToSkip)) {
					opportunitiesDuplicates += results.opportunitiesToSkip.length;
				}
				
				// These are opportunities that were marked for updates  
				if (Array.isArray(results?.opportunitiesToUpdate)) {
					opportunitiesUpdated += results.opportunitiesToUpdate.length;
				}
				
				// These would be truly new opportunities (if any)
				if (Array.isArray(results?.newOpportunities)) {
					opportunitiesNew += results.newOpportunities.length;
				}
			} catch (error) {
				console.warn(`Failed to parse duplicate detector stage ${stage?.id || 'unknown'} results:`, error);
			}
		});
		
		// Extract results from direct_update stages 
		let actualUpdatesApplied = 0;
		directUpdateStages.forEach(stage => {
			if (!stage?.stage_results) return;
			
			try {
				const results = typeof stage.stage_results === 'string' 
					? JSON.parse(stage.stage_results)
					: stage.stage_results;
				
				if (!results || typeof results !== 'object') return;
				
				// Count items that were actually updated (output > 0)
				const outputCount = stage?.output_count ?? 0;
				const inputCount = stage?.input_count ?? 0;
				
				if (outputCount > 0) {
					actualUpdatesApplied += outputCount;
				}
				
				// Count items that were skipped during direct update (input > output)
				if (inputCount > outputCount) {
					opportunitiesSkipped += inputCount - outputCount;
				}
			} catch (error) {
				console.warn(`Failed to parse direct update stage ${stage?.id || 'unknown'} results:`, error);
			}
		});
		
		// Get newly stored count from ALL storage agent stages and aggregate
		storageStages.forEach(stage => {
			if (stage?.stage_results) {
				try {
					const results = typeof stage.stage_results === 'string' 
						? JSON.parse(stage.stage_results)
						: stage.stage_results;
					
					if (!results || typeof results !== 'object') return;
					
					// Get the count of newly stored opportunities and aggregate
					if (results?.metrics?.newOpportunities) {
						opportunitiesStored += results.metrics.newOpportunities;
					} else if (typeof results?.newOpportunities === 'number') {
						opportunitiesStored += results.newOpportunities;
					}
				} catch (error) {
					console.warn(`Failed to parse storage stage ${stage?.id || 'unknown'} results:`, error);
				}
			} else if (typeof stage?.output_count === 'number') {
				// Fallback to output_count if stage_results not available
				opportunitiesStored += stage.output_count;
			}
		});
		
		// Calculate total duplicates (all opportunities that already existed in database)
		const totalDuplicates = opportunitiesDuplicates + opportunitiesUpdated; // 27 pure duplicates + 8 update attempts = 35 total duplicates
		
		// Calculate total skipped (all opportunities that were ultimately not processed)
		const totalSkipped = opportunitiesDuplicates + opportunitiesSkipped; // 27 immediately skipped + 8 skipped after direct_update = 35 total skipped
		
		// For failed runs, we may not have stored anything but still have processed some
		const totalProcessed = opportunitiesNew + totalSkipped + opportunitiesUpdated;
		// Successfully processed includes all opportunities that were handled (new stored + updates + skipped)
		const successfullyProcessed = opportunitiesStored + opportunitiesUpdated + totalSkipped;
		
		return {
			apiFetchedResults,
			totalAvailable,
			opportunityInput,
			opportunitiesNew,
			opportunitiesSkipped: totalSkipped, // Total skipped (27 immediate + 8 after direct_update) 
			opportunitiesUpdated: actualUpdatesApplied, // Actual updates that happened (calculated from direct_update output_count)
			opportunitiesStored,
			opportunitiesDuplicates: totalDuplicates,  // Total duplicates (27 pure + 8 update attempts = 35)
			totalProcessed,
			successfullyProcessed,
			// Success rate: (Skipped + Updated + New Stored) / API Results × 100
			// Measures pipeline efficiency from API fetch to final disposition
			successRate: apiFetchedResults > 0 && !isNaN(totalSkipped + actualUpdatesApplied + opportunitiesStored) 
				? Math.round(((totalSkipped + actualUpdatesApplied + opportunitiesStored) / apiFetchedResults) * 100) 
				: 0
		};
	};

	// Constants for calculations and UI
	const MILLISECONDS_PER_SECOND = 1000;
	const MILLISECONDS_PER_MINUTE = 60000;
	const SECONDS_PER_MINUTE = 60;
	const MAX_PERCENTAGE = 100;
	const DEFAULT_ZERO = 0;
	const PRECISION_DECIMAL_PLACES = 1;
	const TOKEN_PRECISION_PLACES = 0;
	
	// Memoize expensive opportunity flow calculations - hooks must be called before any returns
	const opportunityFlow = useMemo(() => extractOpportunityFlow(stages), [stages]);

	// V2 Enhanced metrics - needed for currentStages calculation
	const isV2Run = run?.pipeline_version === 'v2.0' || stages.length > 0;
	const isV3JobBasedRun = run ? isJobBasedRun(run) : false;

	// V3 Job-based processing - moved here to be available for calculateJobMetrics
	const availableJobs = useMemo(() => extractJobList(stages), [stages]);
	const currentStages = useMemo(() => {
		if (viewMode === 'per-job' && selectedJobId) {
			return filterStagesByJob(stages, selectedJobId);
		}
		return viewMode === 'aggregated' && isV3JobBasedRun ? aggregateJobData(stages) : stages;
	}, [stages, viewMode, selectedJobId, isV3JobBasedRun]);

	// Extract current opportunity flow based on view mode - needed for calculateJobMetrics
	const currentOpportunityFlow = useMemo(() => extractOpportunityFlow(currentStages), [currentStages]);
	
	// Calculate per-job metrics when in per-job mode  
	const calculateJobMetrics = useMemo(() => {
		// Get job-specific stages when in per-job mode
		const jobStages = viewMode === 'per-job' && selectedJobId 
			? stages.filter(stage => stage.job_id === selectedJobId)
			: [];
			
		if (viewMode !== 'per-job' || !selectedJobId || !jobStages.length) {
			return null;
		}
		
		// Calculate job processing time
		const startTimes = jobStages.map(s => new Date(s.started_at || s.created_at)).filter(d => !isNaN(d));
		const endTimes = jobStages.map(s => new Date(s.completed_at)).filter(d => !isNaN(d));
		const jobStartTime = startTimes.length > 0 ? Math.min(...startTimes) : null;
		const jobEndTime = endTimes.length > 0 ? Math.max(...endTimes) : null;
		const jobDurationMs = jobStartTime && jobEndTime ? jobEndTime - jobStartTime : 0;
		
		// Calculate job token usage
		const jobTokensUsed = jobStages.reduce((total, stage) => total + (stage.tokens_used || 0), 0);
		
		// Calculate job opportunity throughput
		const jobOpportunitiesProcessed = currentOpportunityFlow?.opportunityInput || 0;
		const jobOpportunitiesPerMinute = jobDurationMs > 0 && jobOpportunitiesProcessed > 0 
			? Math.round((jobOpportunitiesProcessed / (jobDurationMs / MILLISECONDS_PER_MINUTE)) * 10) / 10 
			: 0;
			
		// Calculate job tokens per opportunity
		const jobTokensPerOpportunity = jobOpportunitiesProcessed > 0 && jobTokensUsed > 0
			? Math.round(jobTokensUsed / jobOpportunitiesProcessed)
			: 0;
			
		return {
			durationMs: jobDurationMs,
			tokensUsed: jobTokensUsed,
			opportunitiesProcessed: jobOpportunitiesProcessed,
			opportunitiesPerMinute: jobOpportunitiesPerMinute,
			tokensPerOpportunity: jobTokensPerOpportunity
		};
	}, [viewMode, selectedJobId, stages, currentOpportunityFlow]);

	// Memoize optimization metrics to avoid recalculation on every render
	const optimizationMetrics = useMemo(() => ({
		// API and extraction metrics - use current view context
		apiFetchedResults: currentOpportunityFlow?.apiFetchedResults || 0,
		totalAvailable: currentOpportunityFlow?.totalAvailable || 0,
		opportunityInput: currentOpportunityFlow?.opportunityInput || 0,
		// Processing breakdown
		opportunitiesSkipped: currentOpportunityFlow?.opportunitiesSkipped || 0,
		opportunitiesUpdated: currentOpportunityFlow?.opportunitiesUpdated || 0, 
		opportunitiesStored: currentOpportunityFlow?.opportunitiesStored || 0,
		opportunitiesDuplicates: currentOpportunityFlow?.opportunitiesDuplicates || 0,  // Add duplicates
		// Use job-specific metrics when in per-job mode, otherwise use run-level metrics
		opportunitiesPerMinute: viewMode === 'per-job' && calculateJobMetrics
			? calculateJobMetrics.opportunitiesPerMinute || 'N/A'
			: run?.opportunities_per_minute || 'N/A',
		tokensPerOpportunity: viewMode === 'per-job' && calculateJobMetrics
			? calculateJobMetrics.tokensPerOpportunity || 'N/A'
			: currentOpportunityFlow?.opportunityInput > 0 && run?.total_tokens_used 
				? Math.round(run.total_tokens_used / currentOpportunityFlow.opportunityInput) 
				: 'N/A',
		// Use the pipeline success rate calculated in extractOpportunityFlow
		successRate: currentOpportunityFlow?.successRate || 0
	}), [currentOpportunityFlow, run?.opportunities_per_minute, run?.total_tokens_used, viewMode, calculateJobMetrics, isV3JobBasedRun, availableJobs]);
	
	// V2 Enhanced metrics - already defined above to avoid conditional hook calls
	

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

	return (
		<div className='container mx-auto py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href={`/admin/funding-sources/${run?.api_source_id || run?.source_id}`}>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Source
					</Link>
				</Button>
				<Badge variant={isV3JobBasedRun ? 'default' : isV2Run ? 'default' : 'secondary'}>
					{isV3JobBasedRun ? 'Job Queue Pipeline' : isV2Run ? 'Optimized Pipeline' : 'Legacy Pipeline'}
				</Badge>
			</div>

			<h1 className='text-2xl font-bold mb-6'>Run Details</h1>

			{/* V3 Unified View Selector */}
			{isV3JobBasedRun && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Target className='h-5 w-5 text-blue-500' />
							View Mode
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className='flex flex-col space-y-4'>
							{/* View Mode Selector */}
							<div className='flex items-center gap-4'>
								<label htmlFor='view-mode-selector' className='text-sm font-medium min-w-[60px]'>
									View:
								</label>
								<Select value={viewMode} onValueChange={setViewMode}>
									<SelectTrigger id='view-mode-selector' className='w-[200px]'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='aggregated'>Aggregated</SelectItem>
										<SelectItem value='per-job'>Per Job</SelectItem>
									</SelectContent>
								</Select>
								{viewMode === 'aggregated' && (
									<Badge variant='outline' className='text-blue-600'>
										{availableJobs.length} jobs aggregated
									</Badge>
								)}
							</div>

							{/* Job Selector - Only show when in per-job mode */}
							{viewMode === 'per-job' && (
								<JobSelector
									jobs={availableJobs}
									selectedJobId={selectedJobId}
									onJobChange={setSelectedJobId}
									defaultToLatest={true}
									className='border-t pt-4'
								/>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Performance Metrics */}
			{(isV2Run || isV3JobBasedRun) && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Zap className='h-5 w-5 text-yellow-500' />
							Performance Metrics
							{isV3JobBasedRun && viewMode === 'per-job' && (
								<Badge variant='outline'>Job Level</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{/* First row - Input and Processing */}
						<div className='grid grid-cols-6 gap-4 max-w-7xl mx-auto'>
								<div className='text-center'>
									<p className='text-2xl font-bold text-purple-600'>{optimizationMetrics.apiFetchedResults || 0}</p>
									<p className='text-sm text-gray-500'>
										API Results
										<span className='block text-xs text-gray-400'>
											({optimizationMetrics.totalAvailable || 0} total available)
										</span>
									</p>
								</div>
								<div className='text-center'>
									<p className='text-2xl font-bold text-blue-600'>{optimizationMetrics.opportunityInput}</p>
									<p className='text-sm text-gray-500'>Extracted</p>
								</div>
								<div className='text-center'>
									<p className='text-2xl font-bold text-orange-600'>{optimizationMetrics.opportunitiesDuplicates}</p>
									<p className='text-sm text-gray-500'>Duplicates</p>
								</div>
								<div className='text-center'>
									<p className='text-2xl font-bold text-gray-600'>{optimizationMetrics.opportunitiesSkipped}</p>
									<p className='text-sm text-gray-500'>Skipped</p>
								</div>
								<div className='text-center'>
									<p className='text-2xl font-bold text-yellow-600'>{optimizationMetrics.opportunitiesUpdated}</p>
									<p className='text-sm text-gray-500'>Updated</p>
								</div>
								<div className='text-center'>
									<p className='text-2xl font-bold text-green-600'>{optimizationMetrics.opportunitiesStored}</p>
									<p className='text-sm text-gray-500'>New Stored</p>
								</div>
						</div>
						
						{/* Second row - Performance Metrics */}
						<div className='grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-4 pt-4 border-t'>
							<div className='text-center'>
								<p className='text-xl font-bold text-orange-600'>{optimizationMetrics.opportunitiesPerMinute}</p>
								<p className='text-sm text-gray-500'>Opportunities/Min</p>
							</div>
							<div className='text-center'>
								<p className='text-xl font-bold text-cyan-600'>{optimizationMetrics.tokensPerOpportunity}</p>
								<p className='text-sm text-gray-500'>Tokens/Opportunity</p>
							</div>
							<div className='text-center'>
								<p className='text-xl font-bold text-indigo-600'>{optimizationMetrics.successRate}%</p>
								<p className='text-sm text-gray-500'>Success Rate</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Pipeline Visualization */}
			{(isV2Run || isV3JobBasedRun) && currentStages.length > 0 ? (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<Target className='h-5 w-5 text-blue-500' />
							Pipeline Progress
							{isV3JobBasedRun && viewMode === 'per-job' && (
								<Badge variant='outline'>Job Level</Badge>
							)}
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
								const stage = currentStages.find(s => s.stage_name === stageName);
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
						{(isV2Run || isV3JobBasedRun) && currentStages.map((stage) => (
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
										{/* Show job info for master view */}
										{viewMode === 'aggregated' && stage.job_count > 1 && (
											<Badge variant='outline' className='text-purple-600'>
												{stage.job_count} jobs
											</Badge>
										)}
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
						
						{!isV2Run && !isV3JobBasedRun && (
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
						{(isV2Run || isV3JobBasedRun) ? (
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
																	style={{ width: `${Math.min(optimizationMetrics.successRate || DEFAULT_ZERO, MAX_PERCENTAGE)}%` }}
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
								
								{/* Opportunity Flow Visualization */}
								<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
									<Card>
										<CardHeader>
											<CardTitle className='flex items-center gap-2'>
												<PieChart className='h-5 w-5 text-purple-500' />
												Opportunity Flow Distribution
											</CardTitle>
										</CardHeader>
										<CardContent>
											<OpportunityFlowChart
												data={[
													{
														name: 'New Opportunities',
														value: optimizationMetrics.totalOpportunities - optimizationMetrics.bypassedLLM,
														total: optimizationMetrics.totalOpportunities
													},
													{
														name: 'Bypassed LLM',
														value: optimizationMetrics.bypassedLLM,
														total: optimizationMetrics.totalOpportunities
													}
												].filter(item => item.value > 0)}
												height={300}
												colors={['#22c55e', '#f59e0b']}
											/>
										</CardContent>
									</Card>

									<Card>
										<CardHeader>
											<CardTitle>Processing Efficiency</CardTitle>
										</CardHeader>
										<CardContent>
											<div className='space-y-4'>
												<div className='bg-green-50 p-4 rounded-lg'>
													<div className='flex items-center justify-between'>
														<span className='text-sm font-medium text-green-800'>LLM Bypass Rate</span>
														<span className='text-2xl font-bold text-green-600'>
															{optimizationMetrics.totalOpportunities > 0 
																? Math.round((optimizationMetrics.bypassedLLM / optimizationMetrics.totalOpportunities) * 100)
																: 0}%
														</span>
													</div>
													<p className='text-xs text-green-600 mt-1'>
														{optimizationMetrics.bypassedLLM} out of {optimizationMetrics.totalOpportunities} opportunities
													</p>
												</div>
												
												{run?.tokens_per_opportunity && (
													<div className='bg-blue-50 p-4 rounded-lg'>
														<div className='flex items-center justify-between'>
															<span className='text-sm font-medium text-blue-800'>Avg Tokens/Opportunity</span>
															<span className='text-2xl font-bold text-blue-600'>
																{Math.round(run.tokens_per_opportunity)}
															</span>
														</div>
														<p className='text-xs text-blue-600 mt-1'>
															Token efficiency measure
														</p>
													</div>
												)}
												
												{run?.success_rate_percentage && (
													<div className='bg-purple-50 p-4 rounded-lg'>
														<div className='flex items-center justify-between'>
															<span className='text-sm font-medium text-purple-800'>Success Rate</span>
															<span className='text-2xl font-bold text-purple-600'>
																{Math.round(run.success_rate_percentage)}%
															</span>
														</div>
														<p className='text-xs text-purple-600 mt-1'>
															Overall processing success
														</p>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								</div>
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
						{/* Stage Performance Charts */}
						{(isV2Run || isV3JobBasedRun) && currentStages.length > 0 && (
							<div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
								<Card>
									<CardHeader>
										<CardTitle className='flex items-center gap-2'>
											<BarChart3 className='h-5 w-5 text-blue-500' />
											Execution Time by Stage
											{viewMode === 'per-job' && (
												<Badge variant='outline'>Job Level</Badge>
											)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<StagePerformanceChart
											data={currentStages.map(stage => ({
												name: stage.stage_name.split('_').map(word => 
													word.charAt(0).toUpperCase() + word.slice(1)
												).join(' '),
												value: stage.execution_time_ms || 0
											}))}
											dataKey="value"
											yAxisLabel="Milliseconds"
											color="#3b82f6"
											formatValue={(value) => `${value}ms`}
											height={250}
										/>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle className='flex items-center gap-2'>
											<BarChart3 className='h-5 w-5 text-green-500' />
											Token Usage by Stage
											{viewMode === 'per-job' && (
												<Badge variant='outline'>Job Level</Badge>
											)}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<StagePerformanceChart
											data={currentStages.map(stage => ({
												name: stage.stage_name.split('_').map(word => 
													word.charAt(0).toUpperCase() + word.slice(1)
												).join(' '),
												value: stage.tokens_used || 0
											}))}
											dataKey="value"
											yAxisLabel="Tokens"
											color="#22c55e"
											formatValue={(value) => `${value.toLocaleString()} tokens`}
											height={250}
										/>
									</CardContent>
								</Card>
							</div>
						)}

						{/* Individual Stage Details */}
						{(isV2Run || isV3JobBasedRun) && currentStages.length > 0 ? (
							currentStages.map((stage, index) => (
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
										<div className='grid grid-cols-3 gap-4'>
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
										{(isV2Run || isV3JobBasedRun) ? 'No stage data available for this run.' : 'Stage details are only available for enhanced pipeline runs.'}
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

						{(isV2Run || isV3JobBasedRun) && stages.length > 0 && (
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
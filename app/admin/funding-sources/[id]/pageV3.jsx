'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2, Play, Zap, TrendingUp, Clock, Target, BarChart3, AlertTriangle, Shield, List } from 'lucide-react';
import Link from 'next/link';
import { RunsTable } from '@/components/admin/RunsTable';
import { TrendChart } from '@/components/admin/charts';
import { isJobBasedRun, getJobProgress, formatJobProgress } from '@/lib/utils/jobAggregation';

export default function FundingSourceDetailV3() {
	const params = useParams();
	const router = useRouter();
	const supabase = createClient();
	const [source, setSource] = useState(null);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [runs, setRuns] = useState([]);
	const [v2Runs, setV2Runs] = useState([]);
	const [loadingRuns, setLoadingRuns] = useState(true);
	const [v2Metrics, setV2Metrics] = useState(null);
	const [historicalData, setHistoricalData] = useState([]);

	useEffect(() => {
		fetchSource();
		fetchRuns();
		fetchV2Metrics();
		fetchHistoricalData();

		// Subscribe to changes in both V1 and V2 runs tables
		const runsChannel = supabase
			.channel('runs-changes')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'api_source_runs',
					filter: `source_id=eq.${params.id}`,
				},
				(payload) => {
					console.log('V1 Runs change received:', payload);
					fetchRuns();
				}
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'pipeline_runs',
					filter: `api_source_id=eq.${params.id}`,
				},
				(payload) => {
					console.log('V2 Runs change received:', payload);
					fetchRuns();
					fetchV2Metrics();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(runsChannel);
		};
	}, [params.id]);

	async function fetchSource() {
		try {
			setLoading(true);
			const { data, error } = await supabase
				.from('api_sources')
				.select('*')
				.eq('id', params.id)
				.single();

			if (error) throw error;
			setSource(data);
		} catch (error) {
			console.error('Error fetching funding source:', error);
			toast.error('Failed to load funding source');
		} finally {
			setLoading(false);
		}
	}

	async function fetchRuns() {
		try {
			setLoadingRuns(true);
			
			// Fetch V1 runs
			const { data: v1Runs, error: v1Error } = await supabase
				.from('api_source_runs')
				.select('*')
				.eq('source_id', params.id)
				.order('created_at', { ascending: false });

			if (v1Error) throw v1Error;

			// Fetch V2/V3 runs with job queue data
			const { data: v2RunsData, error: v2Error } = await supabase
				.from('pipeline_runs')
				.select('*')
				.eq('api_source_id', params.id)
				.order('started_at', { ascending: false });

			if (v2Error) throw v2Error;

			setRuns(v1Runs || []);
			setV2Runs(v2RunsData || []);
		} catch (error) {
			console.error('Error fetching runs:', error);
			toast.error('Failed to load processing runs');
		} finally {
			setLoadingRuns(false);
		}
	}

	async function fetchV2Metrics() {
		try {
			// Calculate aggregate V2/V3 metrics for this source
			const { data: v2RunsData, error } = await supabase
				.from('pipeline_runs')
				.select(`
					total_opportunities_processed,
					opportunities_bypassed_llm,
					opportunities_per_minute,
					tokens_per_opportunity,
					success_rate_percentage,
					total_tokens_used,
					estimated_cost_usd,
					total_execution_time_ms,
					status,
					pipeline_version
				`)
				.eq('api_source_id', params.id);
				// Don't filter by pipeline_version to be more inclusive

			if (error) {
				console.error('Error fetching V2/V3 metrics:', error);
				return; // Exit early if error
			}

			if (v2RunsData && v2RunsData.length > 0) {
				const metrics = v2RunsData.reduce((acc, run) => {
					// Track all runs for comprehensive analysis
					if (run.status === 'completed') {
						acc.totalOpportunities += run.total_opportunities_processed || 0;
						acc.totalBypassedLLM += run.opportunities_bypassed_llm || 0;
						acc.totalTokens += run.total_tokens_used || 0;
						acc.totalCost += run.estimated_cost_usd || 0;
						acc.opportunitiesPerMinute.push(run.opportunities_per_minute || 0);
						acc.tokensPerOpportunity.push(run.tokens_per_opportunity || 0);
						acc.successRates.push(run.success_rate_percentage || 0);
						acc.completedRuns++;
						
						// Track job-based runs
						if (isJobBasedRun(run)) {
							acc.jobBasedRuns++;
							// Job-specific metrics will be added once database schema is updated
							acc.totalJobsProcessed += 0;
							acc.totalJobsSuccessful += 0;
							acc.totalJobsFailed += 0;
						}
					} else if (run.status === 'failed') {
						// Track failure costs and waste
						acc.failedRuns++;
						acc.wastedTokens += run.total_tokens_used || 0;
						acc.wastedCost += run.estimated_cost_usd || 0;
						acc.wastedTime += run.total_execution_time_ms || 0;
						acc.complianceFailures++;
						if (run.sla_grade) {
							acc.worstSLAGrade = acc.worstSLAGrade === 'F' ? 'F' : run.sla_grade;
						}
					} else if (run.status === 'processing') {
						acc.processingRuns++;
						// Track job progress for processing runs
						if (isJobBasedRun(run)) {
							const progress = getJobProgress(run);
							if (progress) {
								acc.processingJobsTotal += progress.total;
								acc.processingJobsCompleted += progress.completed;
							}
						}
					}
					return acc;
				}, {
					totalOpportunities: 0,
					totalBypassedLLM: 0,
					totalTokens: 0,
					totalCost: 0,
					opportunitiesPerMinute: [],
					tokensPerOpportunity: [],
					successRates: [],
					completedRuns: 0,
					failedRuns: 0,
					processingRuns: 0,
					wastedTokens: 0,
					wastedCost: 0,
					wastedTime: 0,
					complianceFailures: 0,
					worstSLAGrade: null,
					jobBasedRuns: 0,
					totalJobsProcessed: 0,
					totalJobsSuccessful: 0,
					totalJobsFailed: 0,
					processingJobsTotal: 0,
					processingJobsCompleted: 0
				});

				setV2Metrics({
					totalRuns: v2RunsData.length,
					totalOpportunities: metrics.totalOpportunities,
					totalBypassedLLM: metrics.totalBypassedLLM,
					avgOpportunitiesPerMinute: metrics.opportunitiesPerMinute.length > 0 ? 
						Math.round(metrics.opportunitiesPerMinute.reduce((a, b) => a + b, 0) / metrics.opportunitiesPerMinute.length) : 0,
					avgTokensPerOpportunity: metrics.tokensPerOpportunity.length > 0 ? 
						Math.round(metrics.tokensPerOpportunity.reduce((a, b) => a + b, 0) / metrics.tokensPerOpportunity.length) : 0,
					avgSuccessRate: metrics.successRates.length > 0 ? 
						Math.round(metrics.successRates.reduce((a, b) => a + b, 0) / metrics.successRates.length) : 0,
					totalTokens: metrics.totalTokens,
					totalCost: metrics.totalCost,
					// Failure analysis metrics
					completedRuns: metrics.completedRuns,
					failedRuns: metrics.failedRuns,
					processingRuns: metrics.processingRuns,
					wastedTokens: metrics.wastedTokens,
					wastedCost: metrics.wastedCost,
					wastedTime: metrics.wastedTime,
					runSuccessRate: v2RunsData.length > 0 ? Math.round((metrics.completedRuns / v2RunsData.length) * 100) : 0,
					complianceFailures: metrics.complianceFailures,
					worstSLAGrade: metrics.worstSLAGrade || (metrics.failedRuns > 0 ? 'F' : null),
					// Job queue metrics
					jobBasedRuns: metrics.jobBasedRuns,
					totalJobsProcessed: metrics.totalJobsProcessed,
					totalJobsSuccessful: metrics.totalJobsSuccessful,
					totalJobsFailed: metrics.totalJobsFailed,
					processingJobsTotal: metrics.processingJobsTotal,
					processingJobsCompleted: metrics.processingJobsCompleted
				});
			}
		} catch (error) {
			console.error('Error fetching V2 metrics:', error);
			// Set empty metrics to prevent crashes
			setV2Metrics(null);
		}
	}

	async function fetchHistoricalData() {
		try {
			// Fetch last 30 runs (completed and failed) for historical trends
			const { data: historicalRuns, error } = await supabase
				.from('pipeline_runs')
				.select(`
					id,
					started_at,
					completed_at,
					total_opportunities_processed,
					opportunities_per_minute,
					tokens_per_opportunity,
					success_rate_percentage,
					total_execution_time_ms,
					estimated_cost_usd,
					status,
					sla_compliance_percentage,
					sla_grade,
					pipeline_version
				`)
				.eq('api_source_id', params.id)
				.in('status', ['completed', 'failed'])
				.order('started_at', { ascending: true })
				.limit(30);

			if (error) {
				console.error('Error fetching historical data:', error);
				return; // Exit early if error
			}

			if (historicalRuns && historicalRuns.length > 0) {
				// Format data for charts, including job-based metrics
				const formattedData = historicalRuns.map((run, index) => ({
					name: `Run ${index + 1}`,
					date: new Date(run.started_at).toLocaleDateString(),
					opportunities: run.total_opportunities_processed || 0,
					throughput: run.opportunities_per_minute || 0,
					efficiency: run.tokens_per_opportunity || 0,
					successRate: run.success_rate_percentage !== null ? run.success_rate_percentage : (run.status === 'failed' ? 0 : 0),
					processingTime: run.total_execution_time_ms ? Math.round(run.total_execution_time_ms / 1000 / 60) : 0,
					cost: run.estimated_cost_usd || 0,
					status: run.status,
					isFailed: run.status === 'failed',
					compliance: run.sla_compliance_percentage !== null ? run.sla_compliance_percentage : (run.status === 'failed' ? 0 : null),
					slaGrade: run.sla_grade || (run.status === 'failed' ? 'F' : null),
					// Job-based metrics
					isJobBased: isJobBasedRun(run),
					jobsProcessed: 0, // Will be populated once job columns are added
					jobSuccessRate: null // Will be calculated once job columns are added
				}));
				
				setHistoricalData(formattedData);
			}
		} catch (error) {
			console.error('Error fetching historical data:', error);
			// Set empty data to prevent crashes
			setHistoricalData([]);
		}
	}

	async function processSource() {
		setProcessing(true);

		try {
			// Use V3 process endpoint for job queue processing
			const response = await fetch(
				`/api/admin/funding-sources/${params.id}/process`,
				{
					method: 'POST',
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to process source');
			}

			const result = await response.json();
			toast.success('Source processing started with job queue');

			// Refresh runs after a short delay
			setTimeout(() => {
				fetchRuns();
				fetchV2Metrics();
			}, 2000);
		} catch (error) {
			console.error('Error processing source:', error);
			toast.error(error.message || 'Failed to process source');
		} finally {
			setProcessing(false);
		}
	}

	const handleDelete = async () => {
		if (
			!confirm(
				'Are you sure you want to delete this funding source? This action cannot be undone.'
			)
		) {
			return;
		}

		try {
			setDeleting(true);
			const { error } = await supabase
				.from('api_sources')
				.delete()
				.eq('id', params.id);

			if (error) throw error;
			toast.success('Funding source deleted successfully');
			router.push('/admin/funding-sources');
		} catch (error) {
			console.error('Error deleting funding source:', error);
			toast.error('Failed to delete funding source');
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/admin/funding-sources'>
							<ArrowLeft className='mr-2 h-4 w-4' />
							Back to Funding Sources
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<Skeleton className='h-8 w-1/3 mb-2' />
						<Skeleton className='h-4 w-1/2' />
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<Skeleton className='h-4 w-full' />
							<Skeleton className='h-4 w-full' />
							<Skeleton className='h-4 w-2/3' />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!source) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/admin/funding-sources'>
							<ArrowLeft className='mr-2 h-4 w-4' />
							Back to Funding Sources
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Funding Source Not Found</CardTitle>
						<CardDescription>
							The requested funding source could not be found.
						</CardDescription>
					</CardHeader>
					<CardFooter>
						<Button asChild>
							<Link href='/admin/funding-sources'>
								Return to Funding Sources
							</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	// Enhance runs with job progress information
	const enhancedV2Runs = v2Runs.map(run => {
		const progress = isJobBasedRun(run) ? getJobProgress(run) : null;
		return {
			...run,
			jobProgress: progress,
			jobProgressText: formatJobProgress(progress)
		};
	});

	// Combine and sort all runs for display
	const allRuns = [
		...runs.map(run => ({ ...run, version: 'v1', id: `v1-${run.id}`, display_id: run.id })),
		...enhancedV2Runs.map(run => ({ 
			...run, 
			version: isJobBasedRun(run) ? 'v3' : 'v2', 
			id: `v2-${run.id}`, 
			display_id: run.id,
			// Map V2/V3 fields to V1 structure for RunsTable compatibility
			started_at: run.started_at,
			completed_at: run.completed_at,
			total_processing_time: run.total_execution_time_ms ? run.total_execution_time_ms / 1000 : null,
			storage_results: {
				storedCount: run.total_opportunities_processed || 0,
				updatedCount: run.opportunities_bypassed_llm || 0
			}
		}))
	].sort((a, b) => new Date(b.started_at || b.created_at) - new Date(a.started_at || a.created_at));

	return (
		<div className='container py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href='/admin/funding-sources'>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Funding Sources
					</Link>
				</Button>
				<div className='flex items-center space-x-2'>
					<Badge variant='default' className='bg-gradient-to-r from-blue-500 to-purple-600 text-white'>
						Job Queue Processing
					</Badge>
					<Button
						variant='default'
						size='sm'
						onClick={processSource}
						disabled={processing}
						className='bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'>
						<List className='mr-2 h-4 w-4' />
						{processing ? 'Queuing Jobs...' : 'Process with Job Queue'}
					</Button>
					<Button variant='outline' size='sm' asChild>
						<Link href={`/admin/funding-sources/${params.id}/edit`}>
							<Edit className='mr-2 h-4 w-4' />
							Edit
						</Link>
					</Button>
					<Button
						variant='destructive'
						size='sm'
						onClick={handleDelete}
						disabled={deleting}>
						<Trash2 className='mr-2 h-4 w-4' />
						{deleting ? 'Deleting...' : 'Delete'}
					</Button>
				</div>
			</div>

			{/* Enhanced Performance Metrics with Job Queue data */}
			{v2Metrics && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<TrendingUp className='h-5 w-5 text-green-500' />
							Pipeline Performance Dashboard
							{v2Metrics.jobBasedRuns > 0 && (
								<Badge variant='secondary' className='bg-purple-100 text-purple-800'>
									{v2Metrics.jobBasedRuns} Job Queue Runs
								</Badge>
							)}
						</CardTitle>
						<CardDescription>
							Aggregate metrics from {v2Metrics.totalRuns} processing runs ({v2Metrics.completedRuns} completed, {v2Metrics.failedRuns} failed, {v2Metrics.processingRuns} processing)
							{v2Metrics.jobBasedRuns > 0 && (
								<span className='block text-sm text-purple-600 mt-1'>
									Job Queue: {v2Metrics.totalJobsProcessed} total jobs ({v2Metrics.totalJobsSuccessful} successful, {v2Metrics.totalJobsFailed} failed)
								</span>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className={`grid gap-4 ${v2Metrics.failedRuns > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
							<div className='text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg'>
								<div className='flex items-center justify-center mb-2'>
									<Target className='h-5 w-5 text-blue-600 mr-1' />
									<p className='text-sm font-medium text-blue-800'>Total Opportunities</p>
								</div>
								<p className='text-2xl font-bold text-blue-600'>{v2Metrics.totalOpportunities}</p>
								<p className='text-xs text-blue-500'>
									{v2Metrics.totalBypassedLLM} bypassed LLM processing
								</p>
							</div>
							
							<div className='text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg'>
								<div className='flex items-center justify-center mb-2'>
									<Zap className='h-5 w-5 text-green-600 mr-1' />
									<p className='text-sm font-medium text-green-800'>Avg Opportunities/Min</p>
								</div>
								<p className='text-2xl font-bold text-green-600'>{v2Metrics.avgOpportunitiesPerMinute || 'N/A'}</p>
								<p className='text-xs text-green-500'>
									{v2Metrics.totalTokens.toLocaleString()} total tokens
								</p>
							</div>
							
							<div className='text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg'>
								<div className='flex items-center justify-center mb-2'>
									<Clock className='h-5 w-5 text-purple-600 mr-1' />
									<p className='text-sm font-medium text-purple-800'>Avg Tokens/Opportunity</p>
								</div>
								<p className='text-2xl font-bold text-purple-600'>{v2Metrics.avgTokensPerOpportunity || 'N/A'}</p>
								<p className='text-xs text-purple-500'>Token efficiency</p>
							</div>
							
							<div className='text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg'>
								<div className='flex items-center justify-center mb-2'>
									<TrendingUp className='h-5 w-5 text-orange-600 mr-1' />
									<p className='text-sm font-medium text-orange-800'>Avg Success Rate</p>
								</div>
								<p className='text-2xl font-bold text-orange-600'>{v2Metrics.avgSuccessRate || 'N/A'}%</p>
								<p className='text-xs text-orange-500'>
									${v2Metrics.totalCost.toFixed(4)} total cost
								</p>
							</div>
							
							{/* Failure Cost Analysis Card */}
							{v2Metrics.failedRuns > 0 && (
								<div className='text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200'>
									<div className='flex items-center justify-center mb-2'>
										<AlertTriangle className='h-5 w-5 text-red-600 mr-1' />
										<p className='text-sm font-medium text-red-800'>Failure Cost Analysis</p>
									</div>
									<p className='text-2xl font-bold text-red-600'>{v2Metrics.failedRuns}</p>
									<p className='text-xs text-red-500'>
										failed runs ({v2Metrics.runSuccessRate}% run success)
									</p>
									<div className='mt-2 text-xs text-red-600 space-y-1'>
										<div>${v2Metrics.wastedCost.toFixed(4)} wasted</div>
										<div>{v2Metrics.wastedTokens.toLocaleString()} wasted tokens</div>
										{v2Metrics.worstSLAGrade && (
											<div className='flex items-center justify-center gap-1 mt-1'>
												<Shield className='h-3 w-3 text-red-500' />
												<span>SLA Grade: {v2Metrics.worstSLAGrade}</span>
											</div>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Real-time Job Queue Status */}
						{v2Metrics.processingRuns > 0 && v2Metrics.processingJobsTotal > 0 && (
							<div className='mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200'>
								<div className='flex items-center justify-between'>
									<div>
										<h4 className='text-sm font-medium text-blue-800'>Active Job Queue Processing</h4>
										<p className='text-xs text-blue-600 mt-1'>
											{v2Metrics.processingRuns} run{v2Metrics.processingRuns !== 1 ? 's' : ''} currently processing
										</p>
									</div>
									<div className='text-right'>
										<p className='text-lg font-bold text-purple-600'>
											{v2Metrics.processingJobsCompleted}/{v2Metrics.processingJobsTotal}
										</p>
										<p className='text-xs text-purple-500'>jobs completed</p>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Historical Performance Trends */}
			{v2Metrics && historicalData.length >= 2 && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<BarChart3 className='h-5 w-5 text-blue-500' />
							Performance Trends
						</CardTitle>
						<CardDescription>
							Historical performance trends over the last {historicalData.length} completed runs
							{historicalData.filter(d => d.isJobBased).length > 0 && (
								<span className='text-purple-600 ml-2'>
									({historicalData.filter(d => d.isJobBased).length} job queue runs)
								</span>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
							<TrendChart
								data={historicalData}
								dataKey="throughput"
								title="Opportunities per Minute"
								yAxisLabel="Opp/Min"
								color="#22c55e"
								formatValue={(value) => `${value}/min`}
							/>
							<TrendChart
								data={historicalData}
								dataKey="successRate"
								title="Success Rate"
								yAxisLabel="Success %"
								color="#3b82f6"
								formatValue={(value) => `${value}%`}
							/>
							<TrendChart
								data={historicalData}
								dataKey="efficiency"
								title="Token Efficiency"
								yAxisLabel="Tokens/Opp"
								color="#8b5cf6"
								formatValue={(value) => `${value} tokens`}
							/>
							<TrendChart
								data={historicalData}
								dataKey="processingTime"
								title="Processing Time"
								yAxisLabel="Minutes"
								color="#f59e0b"
								formatValue={(value) => `${value} min`}
							/>
						</div>
					</CardContent>
				</Card>
			)}

			<Card className='mb-6'>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						{source.name}
						<Badge variant='outline'>
							{v2Runs.length > 0 ? 'Job Queue Enabled' : 'Legacy'}
						</Badge>
					</CardTitle>
					<CardDescription>Enhanced Funding Source Details</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
						<div className='space-y-4'>
							<div>
								<h3 className='text-sm font-medium'>Type</h3>
								<p className='text-sm text-muted-foreground capitalize'>
									{source.type || 'Not specified'}
								</p>
							</div>
							<div>
								<h3 className='text-sm font-medium'>Agency Type</h3>
								<p className='text-sm text-muted-foreground capitalize'>
									{source.agency_type || 'Not specified'}
								</p>
							</div>
							<div>
								<h3 className='text-sm font-medium'>Description</h3>
								<p className='text-sm text-muted-foreground'>
									{source.description || 'No description provided'}
								</p>
							</div>
						</div>
						
						<div className='space-y-4'>
							{source.website && (
								<div>
									<h3 className='text-sm font-medium'>Website</h3>
									<p className='text-sm text-muted-foreground'>
										<a
											href={source.website}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-600 hover:underline'>
											{source.website}
										</a>
									</p>
								</div>
							)}
							{source.contact_email && (
								<div>
									<h3 className='text-sm font-medium'>Contact Email</h3>
									<p className='text-sm text-muted-foreground'>
										<a
											href={`mailto:${source.contact_email}`}
											className='text-blue-600 hover:underline'>
											{source.contact_email}
										</a>
									</p>
								</div>
							)}
							{source.contact_phone && (
								<div>
									<h3 className='text-sm font-medium'>Contact Phone</h3>
									<p className='text-sm text-muted-foreground'>
										{source.contact_phone}
									</p>
								</div>
							)}
							
							{/* Enhanced Processing Stats with Job Queue info */}
							<div className='bg-blue-50 p-3 rounded-lg'>
								<h4 className='text-sm font-medium text-blue-800 mb-2'>Processing Statistics</h4>
								<div className='grid grid-cols-2 gap-2 text-xs'>
									<div>
										<span className='text-blue-600'>V1 Runs:</span>
										<span className='font-medium ml-1'>{runs.length}</span>
									</div>
									<div>
										<span className='text-blue-600'>Enhanced Runs:</span>
										<span className='font-medium ml-1'>{v2Runs.length}</span>
									</div>
									{v2Metrics && v2Metrics.jobBasedRuns > 0 && (
										<>
											<div>
												<span className='text-purple-600'>Job Queue Runs:</span>
												<span className='font-medium ml-1'>{v2Metrics.jobBasedRuns}</span>
											</div>
											<div>
												<span className='text-purple-600'>Total Jobs:</span>
												<span className='font-medium ml-1'>{v2Metrics.totalJobsProcessed}</span>
											</div>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						Processing Runs
						{allRuns.length > 0 && (
							<Badge variant='secondary'>
								{allRuns.length} total runs
							</Badge>
						)}
						{v2Metrics && v2Metrics.jobBasedRuns > 0 && (
							<Badge variant='outline' className='text-purple-600 border-purple-200'>
								{v2Metrics.jobBasedRuns} job queue
							</Badge>
						)}
					</CardTitle>
					<CardDescription>
						Combined history of all processing runs for this source, including job queue processing
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RunsTable runs={allRuns} loading={loadingRuns} showJobProgress={true} />
				</CardContent>
			</Card>
		</div>
	);
}
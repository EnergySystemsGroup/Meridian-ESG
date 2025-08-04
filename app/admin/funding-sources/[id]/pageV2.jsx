'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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
import { ArrowLeft, Edit, Trash2, Play, Zap, TrendingUp, Clock, Target } from 'lucide-react';
import Link from 'next/link';
import { RunsTable } from '@/components/admin/RunsTable';

export default function FundingSourceDetailV2() {
	const params = useParams();
	const router = useRouter();
	const supabase = createClientComponentClient();
	const [source, setSource] = useState(null);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [runs, setRuns] = useState([]);
	const [v2Runs, setV2Runs] = useState([]);
	const [loadingRuns, setLoadingRuns] = useState(true);
	const [v2Metrics, setV2Metrics] = useState(null);

	useEffect(() => {
		fetchSource();
		fetchRuns();
		fetchV2Metrics();

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

			// Fetch V2 runs
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
			// Calculate aggregate V2 metrics for this source
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
					status
				`)
				.eq('api_source_id', params.id)
				.eq('status', 'completed');

			if (error) throw error;

			if (v2RunsData && v2RunsData.length > 0) {
				const metrics = v2RunsData.reduce((acc, run) => {
					acc.totalOpportunities += run.total_opportunities_processed || 0;
					acc.totalBypassedLLM += run.opportunities_bypassed_llm || 0;
					acc.totalTokens += run.total_tokens_used || 0;
					acc.totalCost += run.estimated_cost_usd || 0;
					acc.opportunitiesPerMinute.push(run.opportunities_per_minute || 0);
					acc.tokensPerOpportunity.push(run.tokens_per_opportunity || 0);
					acc.successRates.push(run.success_rate_percentage || 0);
					return acc;
				}, {
					totalOpportunities: 0,
					totalBypassedLLM: 0,
					totalTokens: 0,
					totalCost: 0,
					opportunitiesPerMinute: [],
					tokensPerOpportunity: [],
					successRates: []
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
					totalCost: metrics.totalCost
				});
			}
		} catch (error) {
			console.error('Error fetching V2 metrics:', error);
		}
	}

	async function processSource() {
		setProcessing(true);

		try {
			// Use main process endpoint (now hardcoded to V2)
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
			toast.success('Source processing started');

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

	// Combine and sort all runs for display
	const allRuns = [
		...runs.map(run => ({ ...run, version: 'v1', id: `v1-${run.id}`, display_id: run.id })),
		...v2Runs.map(run => ({ 
			...run, 
			version: 'v2', 
			id: `v2-${run.id}`, 
			display_id: run.id,
			// Map V2 fields to V1 structure for RunsTable compatibility
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
					<Badge variant='default' className='bg-blue-100 text-blue-800'>
						Enhanced Processing
					</Badge>
					<Button
						variant='default'
						size='sm'
						onClick={processSource}
						disabled={processing}
						className='bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'>
						<Zap className='mr-2 h-4 w-4' />
						{processing ? 'Processing...' : 'Process Source'}
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

			{/* Performance Metrics */}
			{v2Metrics && (
				<Card className='mb-6'>
					<CardHeader>
						<CardTitle className='flex items-center gap-2'>
							<TrendingUp className='h-5 w-5 text-green-500' />
							Pipeline Performance Dashboard
						</CardTitle>
						<CardDescription>
							Aggregate metrics from {v2Metrics.totalRuns} completed processing runs
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
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
						</div>
					</CardContent>
				</Card>
			)}

			<Card className='mb-6'>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						{source.name}
						<Badge variant='outline'>
							{v2Runs.length > 0 ? 'Optimized' : 'Legacy'}
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
							
							{/* Processing Stats */}
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
					</CardTitle>
					<CardDescription>
						Combined history of all processing runs for this source
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RunsTable runs={allRuns} loading={loadingRuns} />
				</CardContent>
			</Card>
		</div>
	);
}
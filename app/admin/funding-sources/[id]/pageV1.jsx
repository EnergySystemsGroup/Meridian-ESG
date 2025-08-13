'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
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
import { ArrowLeft, Edit, Trash2, Play } from 'lucide-react';
import Link from 'next/link';
import { RunsTable } from '@/components/admin/RunsTable';

export default function FundingSourceDetailV1() {
	const params = useParams();
	const router = useRouter();
	const supabase = createClient();
	const [source, setSource] = useState(null);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [runs, setRuns] = useState([]);
	const [loadingRuns, setLoadingRuns] = useState(true);

	useEffect(() => {
		fetchSource();
		fetchRuns();

		// Subscribe to changes in the runs table
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
					console.log('Runs change received:', payload);
					fetchRuns();
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
			const { data, error } = await supabase
				.from('api_source_runs')
				.select('*')
				.eq('source_id', params.id)
				.order('created_at', { ascending: false });

			if (error) throw error;
			setRuns(data || []);
		} catch (error) {
			console.error('Error fetching runs:', error);
			toast.error('Failed to load processing runs');
		} finally {
			setLoadingRuns(false);
		}
	}

	async function processSource() {
		setProcessing(true);

		try {
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
			setTimeout(fetchRuns, 2000);
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

	return (
		<div className='container py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href='/admin/funding-sources'>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Funding Sources
					</Link>
				</Button>
				<div className='flex space-x-2'>
					<Button
						variant='default'
						size='sm'
						onClick={processSource}
						disabled={processing}>
						<Play className='mr-2 h-4 w-4' />
						{processing ? 'Processing...' : 'Process Now'}
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

			<Card className='mb-6'>
				<CardHeader>
					<CardTitle>{source.name}</CardTitle>
					<CardDescription>Funding Source Details (V1)</CardDescription>
				</CardHeader>
				<CardContent>
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
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Processing Runs</CardTitle>
					<CardDescription>
						History of processing runs for this source
					</CardDescription>
				</CardHeader>
				<CardContent>
					<RunsTable runs={runs} loading={loadingRuns} />
				</CardContent>
			</Card>
		</div>
	);
}
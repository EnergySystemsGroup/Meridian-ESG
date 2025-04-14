'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { RunMetricsCard } from '@/app/components/funding/RunMetricsCard';
import { toast } from '@/app/components/ui/use-toast';

export default function SourceDetailPage({ params }) {
	const { id } = params;
	const [source, setSource] = useState(null);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [latestRun, setLatestRun] = useState(null);
	const [loadingRun, setLoadingRun] = useState(true);
	const supabase = createClientComponentClient();

	useEffect(() => {
		fetchSource();
		fetchLatestRun();
	}, [id]);

	async function fetchSource() {
		setLoading(true);
		const { data, error } = await supabase
			.from('api_sources')
			.select('*')
			.eq('id', id)
			.single();

		if (error) {
			console.error('Error fetching source:', error);
		} else {
			setSource(data);
		}

		setLoading(false);
	}

	async function fetchLatestRun() {
		setLoadingRun(true);
		const { data, error } = await supabase
			.from('api_source_runs')
			.select('*')
			.eq('source_id', id)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code !== 'PGRST116') {
				// No rows returned
				console.error('Error fetching latest run:', error);
			}
		} else {
			setLatestRun(data);
		}

		setLoadingRun(false);
	}

	async function processSource() {
		setProcessing(true);

		try {
			const response = await fetch(`/api/funding/sources/${id}/process`, {
				method: 'POST',
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to process source');
			}

			const result = await response.json();

			toast({
				title: 'Source processing started',
				description:
					'The source is being processed. Check back soon for results.',
			});

			// Refresh the latest run after a short delay
			setTimeout(() => {
				fetchLatestRun();
			}, 2000);
		} catch (error) {
			console.error('Error processing source:', error);
			toast({
				title: 'Error processing source',
				description: error.message,
				variant: 'destructive',
			});
		} finally {
			setProcessing(false);
		}
	}

	if (loading) {
		return (
			<div className='container mx-auto py-6'>
				<div className='space-y-4'>
					<Skeleton className='h-10 w-1/3' />
					<Skeleton className='h-6 w-1/4' />
					<div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-6'>
						<Skeleton className='h-[300px]' />
						<Skeleton className='h-[300px]' />
						<Skeleton className='h-[300px]' />
					</div>
				</div>
			</div>
		);
	}

	if (!source) {
		return (
			<div className='container mx-auto py-6'>
				<h1 className='text-3xl font-bold'>Source not found</h1>
				<p className='text-muted-foreground'>
					The requested source could not be found.
				</p>
			</div>
		);
	}

	return (
		<div className='container mx-auto py-6'>
			<div className='flex justify-between items-center mb-6'>
				<div>
					<h1 className='text-3xl font-bold'>{source.name}</h1>
					<p className='text-muted-foreground'>{source.organization}</p>
				</div>
				<Button onClick={processSource} disabled={processing}>
					{processing ? 'Processing...' : 'Process Now'}
				</Button>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
				<div className='md:col-span-2'>
					<Card>
						<CardHeader>
							<CardTitle>Source Details</CardTitle>
							<CardDescription>
								API Source information and configuration
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='space-y-4'>
								<div>
									<h3 className='text-sm font-medium text-muted-foreground'>
										Source Type
									</h3>
									<p>{source.type || 'Not specified'}</p>
								</div>
								<div>
									<h3 className='text-sm font-medium text-muted-foreground'>
										Base URL
									</h3>
									<p>{source.base_url || 'Not specified'}</p>
								</div>
								<div>
									<h3 className='text-sm font-medium text-muted-foreground'>
										Description
									</h3>
									<p>{source.description || 'No description provided'}</p>
								</div>
								<div>
									<h3 className='text-sm font-medium text-muted-foreground'>
										Last Processed
									</h3>
									<p>
										{source.last_processed
											? new Date(source.last_processed).toLocaleString()
											: 'Never'}
									</p>
								</div>
								<div>
									<h3 className='text-sm font-medium text-muted-foreground'>
										Last Checked
									</h3>
									<p>
										{source.last_checked
											? new Date(source.last_checked).toLocaleString()
											: 'Never'}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div>
					<RunMetricsCard run={latestRun} loading={loadingRun} />
				</div>
			</div>
		</div>
	);
}

'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function RunsPage() {
	const [runs, setRuns] = useState([]);
	const [loading, setLoading] = useState(true);
	const [selectedRun, setSelectedRun] = useState(null);
	const [selectedTab, setSelectedTab] = useState('all');
	const supabase = createClientComponentClient();

	useEffect(() => {
		fetchRuns();
	}, [selectedTab]);

	async function fetchRuns() {
		setLoading(true);

		let query = supabase
			.from('api_source_runs')
			.select('*, api_sources(name, organization)')
			.order('created_at', { ascending: false });

		if (selectedTab === 'completed') {
			query = query.eq('status', 'completed');
		} else if (selectedTab === 'in-progress') {
			query = query.eq('status', 'in_progress');
		} else if (selectedTab === 'error') {
			query = query.eq('status', 'error');
		}

		const { data, error } = await query.limit(50);

		if (error) {
			console.error('Error fetching runs:', error);
		} else {
			setRuns(data || []);
		}

		setLoading(false);
	}

	function getStatusBadge(status) {
		switch (status) {
			case 'in_progress':
				return (
					<Badge
						variant='outline'
						className='bg-blue-50 text-blue-700 border-blue-200'>
						In Progress
					</Badge>
				);
			case 'completed':
				return (
					<Badge
						variant='outline'
						className='bg-green-50 text-green-700 border-green-200'>
						Completed
					</Badge>
				);
			case 'error':
				return (
					<Badge
						variant='outline'
						className='bg-red-50 text-red-700 border-red-200'>
						Error
					</Badge>
				);
			default:
				return <Badge variant='outline'>{status}</Badge>;
		}
	}

	function formatDuration(ms) {
		if (!ms) return 'N/A';

		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;

		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}

	async function viewRunDetails(run) {
		setSelectedRun(run);
	}

	return (
		<div className='container mx-auto py-6'>
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-3xl font-bold'>API Source Runs</h1>
				<Button onClick={fetchRuns}>Refresh</Button>
			</div>

			<Tabs
				defaultValue='all'
				value={selectedTab}
				onValueChange={setSelectedTab}>
				<TabsList className='mb-4'>
					<TabsTrigger value='all'>All Runs</TabsTrigger>
					<TabsTrigger value='in-progress'>In Progress</TabsTrigger>
					<TabsTrigger value='completed'>Completed</TabsTrigger>
					<TabsTrigger value='error'>Errors</TabsTrigger>
				</TabsList>

				<TabsContent value={selectedTab} className='space-y-4'>
					{loading ? (
						<Card>
							<CardContent className='pt-6'>
								<div className='space-y-2'>
									{[1, 2, 3, 4, 5].map((i) => (
										<Skeleton key={i} className='h-12 w-full' />
									))}
								</div>
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>Recent Runs</CardTitle>
								<CardDescription>
									Showing the most recent API source processing runs
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Source</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Started</TableHead>
											<TableHead>Duration</TableHead>
											<TableHead>Results</TableHead>
											<TableHead>Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{runs.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={6}
													className='text-center py-4 text-muted-foreground'>
													No runs found
												</TableCell>
											</TableRow>
										) : (
											runs.map((run) => (
												<TableRow key={run.id}>
													<TableCell>
														<div className='font-medium'>
															{run.api_sources?.name || 'Unknown'}
														</div>
														<div className='text-sm text-muted-foreground'>
															{run.api_sources?.organization || ''}
														</div>
													</TableCell>
													<TableCell>{getStatusBadge(run.status)}</TableCell>
													<TableCell>
														<div className='font-medium'>
															{new Date(run.created_at).toLocaleString()}
														</div>
														<div className='text-sm text-muted-foreground'>
															{formatDistanceToNow(new Date(run.created_at), {
																addSuffix: true,
															})}
														</div>
													</TableCell>
													<TableCell>
														{formatDuration(run.execution_time)}
													</TableCell>
													<TableCell>
														{run.status === 'completed' && (
															<div>
																<div className='text-sm'>
																	<span className='font-medium'>
																		{run.initial_api_metrics?.retrievedCount ||
																			0}
																	</span>{' '}
																	retrieved
																</div>
																<div className='text-sm'>
																	<span className='font-medium'>
																		{run.storage_metrics?.storedCount || 0}
																	</span>{' '}
																	stored
																</div>
															</div>
														)}
														{run.status === 'error' && (
															<div className='text-sm text-red-600 truncate max-w-[200px]'>
																{run.error_message || 'Unknown error'}
															</div>
														)}
													</TableCell>
													<TableCell>
														<Button
															variant='outline'
															size='sm'
															onClick={() => viewRunDetails(run)}>
															View Details
														</Button>
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>

			{selectedRun && (
				<div className='mt-8'>
					<Card>
						<CardHeader>
							<CardTitle>
								Run Details: {selectedRun.api_sources?.name}
							</CardTitle>
							<CardDescription>
								Run ID: {selectedRun.id} • Started:{' '}
								{new Date(selectedRun.created_at).toLocaleString()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='space-y-6'>
								<div>
									<h3 className='text-lg font-medium mb-2'>Initial API Call</h3>
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.initial_api_metrics?.totalHitCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Total Hits
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.initial_api_metrics?.retrievedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Retrieved Items
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{formatDuration(
														selectedRun.initial_api_metrics?.processingTime
													)}
												</div>
												<p className='text-sm text-muted-foreground'>
													Processing Time
												</p>
											</CardContent>
										</Card>
									</div>
								</div>

								<div>
									<h3 className='text-lg font-medium mb-2'>
										First Stage Filter
									</h3>
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.first_stage_filter_metrics?.inputCount ||
														0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Input Count
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.first_stage_filter_metrics
														?.passedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Passed Filter
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{formatDuration(
														selectedRun.first_stage_filter_metrics
															?.processingTime
													)}
												</div>
												<p className='text-sm text-muted-foreground'>
													Processing Time
												</p>
											</CardContent>
										</Card>
									</div>
								</div>

								<div>
									<h3 className='text-lg font-medium mb-2'>
										Second Stage Filter
									</h3>
									<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.second_stage_filter_metrics
														?.inputCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Input Count
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.second_stage_filter_metrics
														?.passedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Passed Filter
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{formatDuration(
														selectedRun.second_stage_filter_metrics
															?.processingTime
													)}
												</div>
												<p className='text-sm text-muted-foreground'>
													Processing Time
												</p>
											</CardContent>
										</Card>
									</div>
								</div>

								<div>
									<h3 className='text-lg font-medium mb-2'>Storage Results</h3>
									<div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.storage_metrics?.attemptedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>
													Attempted
												</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.storage_metrics?.storedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>Stored</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.storage_metrics?.updatedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>Updated</p>
											</CardContent>
										</Card>
										<Card>
											<CardContent className='pt-6'>
												<div className='text-2xl font-bold'>
													{selectedRun.storage_metrics?.skippedCount || 0}
												</div>
												<p className='text-sm text-muted-foreground'>Skipped</p>
											</CardContent>
										</Card>
									</div>
								</div>

								{selectedRun.status === 'error' && (
									<div>
										<h3 className='text-lg font-medium mb-2 text-red-600'>
											Error Details
										</h3>
										<Card className='bg-red-50'>
											<CardContent className='pt-6'>
												<p className='text-red-700'>
													{selectedRun.error_message}
												</p>
												{selectedRun.error_stack && (
													<pre className='mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-[200px]'>
														{selectedRun.error_stack}
													</pre>
												)}
											</CardContent>
										</Card>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}

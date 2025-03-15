import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export function RunMetricsCard({ run, loading }) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>
						<Skeleton className='h-6 w-32' />
					</CardTitle>
					<CardDescription>
						<Skeleton className='h-4 w-48' />
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='space-y-2'>
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!run) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Latest Run</CardTitle>
					<CardDescription>No runs found for this source</CardDescription>
				</CardHeader>
				<CardContent>
					<p className='text-muted-foreground'>
						This source has not been processed yet.
					</p>
				</CardContent>
			</Card>
		);
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

	return (
		<Card>
			<CardHeader>
				<div className='flex justify-between items-center'>
					<div>
						<CardTitle>Latest Run</CardTitle>
						<CardDescription>
							{formatDistanceToNow(new Date(run.created_at), {
								addSuffix: true,
							})}
						</CardDescription>
					</div>
					{getStatusBadge(run.status)}
				</div>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<p className='text-sm text-muted-foreground'>Retrieved</p>
							<p className='text-xl font-bold'>
								{run.initial_api_metrics?.retrievedCount || 0}
							</p>
						</div>
						<div>
							<p className='text-sm text-muted-foreground'>Stored</p>
							<p className='text-xl font-bold'>
								{run.storage_metrics?.storedCount || 0}
							</p>
						</div>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div>
							<p className='text-sm text-muted-foreground'>Duration</p>
							<p className='text-xl font-bold'>
								{formatDuration(run.execution_time)}
							</p>
						</div>
						<div>
							<p className='text-sm text-muted-foreground'>Completed</p>
							<p className='text-xl font-bold'>
								{run.completed_at
									? new Date(run.completed_at).toLocaleString()
									: 'N/A'}
							</p>
						</div>
					</div>

					{run.status === 'error' && (
						<div className='mt-2 p-2 bg-red-50 rounded border border-red-200'>
							<p className='text-sm font-medium text-red-700'>Error</p>
							<p className='text-sm text-red-600 truncate'>
								{run.error_message}
							</p>
						</div>
					)}

					<div className='mt-4'>
						<Link
							href={`/dashboard/funding/sources/runs?id=${run.id}`}
							passHref>
							<Button variant='outline' className='w-full'>
								View Details
							</Button>
						</Link>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

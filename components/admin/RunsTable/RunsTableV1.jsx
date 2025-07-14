'use client';

import { useRouter } from 'next/navigation';
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

function getStatusBadgeColor(status) {
	switch (status) {
		case 'started':
			return 'bg-blue-100 text-blue-800';
		case 'processing':
			return 'bg-yellow-100 text-yellow-800';
		case 'completed':
			return 'bg-green-100 text-green-800';
		case 'failed':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

export function RunsTableV1({ runs, loading }) {
	const router = useRouter();

	if (loading) {
		return (
			<div className='space-y-4'>
				<Skeleton className='h-8 w-full' />
				<Skeleton className='h-8 w-full' />
				<Skeleton className='h-8 w-full' />
			</div>
		);
	}

	if (!runs || runs.length === 0) {
		return (
			<div className='text-center py-6 text-muted-foreground'>
				No runs found for this source.
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Status</TableHead>
					<TableHead>Started</TableHead>
					<TableHead>Completed</TableHead>
					<TableHead>Processing Time</TableHead>
					<TableHead>Results</TableHead>
					<TableHead className='text-right'>Action</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{runs.map((run) => (
					<TableRow key={run.id}>
						<TableCell>
							<Badge className={getStatusBadgeColor(run.status)}>
								{run.status}
							</Badge>
						</TableCell>
						<TableCell>{new Date(run.started_at).toLocaleString()}</TableCell>
						<TableCell>
							{run.completed_at
								? new Date(run.completed_at).toLocaleString()
								: '-'}
						</TableCell>
						<TableCell>
							{run.total_processing_time
								? `${run.total_processing_time.toFixed(2)}s`
								: '-'}
						</TableCell>
						<TableCell>
							{run.storage_results?.storedCount || 0} stored,{' '}
							{run.storage_results?.updatedCount || 0} updated
						</TableCell>
						<TableCell className='text-right'>
							<Button
								variant='ghost'
								onClick={() =>
									router.push(`/admin/funding-sources/runs/${run.display_id || run.id}`)
								}>
								View Details
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
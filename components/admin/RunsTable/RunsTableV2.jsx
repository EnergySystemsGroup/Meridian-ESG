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
import { Progress } from '@/components/ui/progress';
import { Zap, Clock, TrendingUp, Target } from 'lucide-react';

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

function getVersionBadgeColor(version) {
	return version === 'v2' 
		? 'bg-purple-100 text-purple-800' 
		: 'bg-gray-100 text-gray-600';
}

function formatDuration(ms) {
	if (!ms) return 'N/A';
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	return `${(ms / 60000).toFixed(1)}m`;
}

export function RunsTableV2({ runs, loading }) {
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
					<TableHead>Version</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Started</TableHead>
					<TableHead>Duration</TableHead>
					<TableHead>Results</TableHead>
					<TableHead>Optimization</TableHead>
					<TableHead className='text-right'>Action</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{runs.map((run) => (
					<TableRow key={run.id}>
						<TableCell>
							<Badge className={getVersionBadgeColor(run.version)}>
								{run.version?.toUpperCase() || 'V1'}
							</Badge>
						</TableCell>
						<TableCell>
							<Badge className={getStatusBadgeColor(run.status)}>
								{run.status}
							</Badge>
						</TableCell>
						<TableCell>
							<div className='text-sm'>
								{new Date(run.started_at || run.created_at).toLocaleString()}
							</div>
							{run.completed_at && (
								<div className='text-xs text-gray-500'>
									Completed: {new Date(run.completed_at).toLocaleString()}
								</div>
							)}
						</TableCell>
						<TableCell>
							<div className='flex items-center gap-2'>
								<Clock className='h-4 w-4 text-gray-400' />
								<span className='text-sm'>
									{formatDuration(run.total_execution_time_ms || (run.total_processing_time * 1000))}
								</span>
							</div>
						</TableCell>
						<TableCell>
							<div className='space-y-1'>
								<div className='flex items-center gap-2 text-sm'>
									<Target className='h-3 w-3 text-green-600' />
									<span>{run.storage_results?.storedCount || run.total_opportunities_processed || 0} processed</span>
								</div>
								{run.version === 'v2' && run.opportunities_bypassed_llm > 0 && (
									<div className='flex items-center gap-2 text-xs text-purple-600'>
										<Zap className='h-3 w-3' />
										<span>{run.opportunities_bypassed_llm} bypassed</span>
									</div>
								)}
							</div>
						</TableCell>
						<TableCell>
							{run.version === 'v2' ? (
								<div className='space-y-1'>
									{run.opportunities_per_minute > 0 && (
										<div className='flex items-center gap-2'>
											<TrendingUp className='h-3 w-3 text-green-600' />
											<span className='text-xs font-medium text-green-600'>
												{run.opportunities_per_minute} opp/min
											</span>
										</div>
									)}
									{run.success_rate_percentage && (
										<div className='flex items-center gap-2'>
											<div className='w-12 bg-gray-200 rounded-full h-1'>
												<div 
													className='bg-blue-600 h-1 rounded-full'
													style={{ width: `${Math.min(run.success_rate_percentage, 100)}%` }}
												/>
											</div>
											<span className='text-xs text-gray-600'>{run.success_rate_percentage}% success</span>
										</div>
									)}
								</div>
							) : (
								<span className='text-xs text-gray-500'>Legacy pipeline</span>
							)}
						</TableCell>
						<TableCell className='text-right'>
							<Button
								variant='ghost'
								size='sm'
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
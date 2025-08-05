'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import PropTypes from 'prop-types';
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { Zap, Clock, TrendingUp, Target, DollarSign, Shield, AlertTriangle } from 'lucide-react';
import { getSLAComplianceColor, getSLAComplianceBadgeColor } from '@/lib/utils/metricsCalculator';

// Time conversion constants
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;

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
	if (ms < MS_PER_SECOND) return `${ms}ms`;
	if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
	return `${(ms / MS_PER_MINUTE).toFixed(1)}m`;
}

function RunsTableV2Component({ runs, loading }) {
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
		<TooltipProvider>
			<Table role="table" aria-label="Pipeline runs table">
				<TableHeader>
					<TableRow>
					<TableHead>Version</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Started</TableHead>
					<TableHead>Duration</TableHead>
					<TableHead>Results</TableHead>
					<TableHead>Performance</TableHead>
					<TableHead>Efficiency</TableHead>
					<TableHead>Compliance</TableHead>
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
									{run.opportunities_per_minute != null && (
										<div className='flex items-center gap-2'>
											<TrendingUp className='h-3 w-3 text-green-600' />
											<span className='text-sm font-medium'>
												{run.opportunities_per_minute.toFixed(1)} opp/min
											</span>
										</div>
									)}
									{run.success_rate_percentage != null ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<div className='flex items-center gap-2 cursor-help'>
													{run.success_rate_percentage < 95 && (
														<AlertTriangle className='h-3 w-3 text-yellow-500' />
													)}
													<span className={`text-xs ${run.success_rate_percentage >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
														{run.success_rate_percentage.toFixed(1)}% success
													</span>
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<div className='text-sm'>
													<div className='font-medium mb-2'>Failure Breakdown</div>
													{run.failure_breakdown && Object.keys(run.failure_breakdown).length > 0 && 
													 Object.values(run.failure_breakdown).some(value => value > 0) ? (
														<div className='space-y-1'>
															{Object.entries(run.failure_breakdown).map(([key, value]) => (
																value > 0 && (
																	<div key={key} className='flex justify-between'>
																		<span className='capitalize'>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
																		<span className='font-mono ml-2'>{value}</span>
																	</div>
																)
															))}
															<div className='border-t pt-1 mt-2 text-xs text-gray-300'>
																Total processed: {run.total_opportunities_processed || 0}
															</div>
														</div>
													) : (
														<div className='text-gray-300'>No failures recorded - all opportunities processed successfully</div>
													)}
												</div>
											</TooltipContent>
										</Tooltip>
									) : run.opportunities_per_minute != null ? (
										<div className='text-xs text-gray-400'>Success rate N/A</div>
									) : null}
									{run.opportunities_per_minute == null && run.success_rate_percentage == null && (
										<span className='text-xs text-gray-400'>-</span>
									)}
								</div>
							) : (
								<span className='text-xs text-gray-500'>N/A</span>
							)}
						</TableCell>
						<TableCell>
							{run.version === 'v2' ? (
								<div className='space-y-1'>
									{run.cost_per_opportunity_usd != null && (
										<div className='flex items-center gap-2'>
											<DollarSign className='h-3 w-3 text-blue-600' />
											<span className='text-sm font-medium'>
												${run.cost_per_opportunity_usd.toFixed(3)}/opp
											</span>
										</div>
									)}
									{run.tokens_per_opportunity != null && (
										<div className='text-xs text-muted-foreground'>
											{run.tokens_per_opportunity.toFixed(0)} tokens/opp
										</div>
									)}
									{run.cost_per_opportunity_usd == null && run.tokens_per_opportunity == null && (
										<span className='text-xs text-gray-400'>-</span>
									)}
								</div>
							) : (
								<span className='text-xs text-gray-500'>N/A</span>
							)}
						</TableCell>
						<TableCell>
							{run.version === 'v2' ? (
								<div className='space-y-1'>
									{run.sla_compliance_percentage != null ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<div className='cursor-help space-y-1'>
													<div className='flex items-center gap-2'>
														<Shield className={`h-3 w-3 ${getSLAComplianceColor(run.sla_compliance_percentage)}`} />
														<span className={`text-sm font-medium ${getSLAComplianceColor(run.sla_compliance_percentage)}`}>
															{run.sla_compliance_percentage.toFixed(0)}% SLA
														</span>
														{run.sla_grade && (
															<Badge className={`text-xs px-1.5 py-0.5 ${getSLAComplianceBadgeColor(run.sla_compliance_percentage)}`}>
																{run.sla_grade}
															</Badge>
														)}
													</div>
													<Progress 
														value={run.sla_compliance_percentage} 
														className='h-1.5 w-16'
														aria-label={`SLA compliance: ${run.sla_compliance_percentage}%`}
													/>
												</div>
											</TooltipTrigger>
											<TooltipContent>
												<div className='text-sm'>
													<div className='font-medium mb-1'>SLA Compliance Breakdown</div>
													{run.sla_breakdown && Object.keys(run.sla_breakdown).length > 0 ? (
														<div className='space-y-1'>
															<div className='flex justify-between'>
																<span>Time Compliance:</span>
																<span className='font-mono ml-2'>{run.sla_breakdown.timeCompliance || 0}%</span>
															</div>
															<div className='flex justify-between'>
																<span>Success Compliance:</span>
																<span className='font-mono ml-2'>{run.sla_breakdown.successCompliance || 0}%</span>
															</div>
															<div className='flex justify-between'>
																<span>Cost Compliance:</span>
																<span className='font-mono ml-2'>{run.sla_breakdown.costCompliance || 0}%</span>
															</div>
															<div className='flex justify-between'>
																<span>Throughput Compliance:</span>
																<span className='font-mono ml-2'>{run.sla_breakdown.throughputCompliance || 0}%</span>
															</div>
														</div>
													) : (
														<div className='text-gray-300'>No SLA breakdown available</div>
													)}
												</div>
											</TooltipContent>
										</Tooltip>
									) : (
										<span className='text-xs text-gray-400'>-</span>
									)}
								</div>
							) : (
								<span className='text-xs text-gray-500'>N/A</span>
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
		</TooltipProvider>
	);
}

RunsTableV2Component.propTypes = {
	runs: PropTypes.arrayOf(
		PropTypes.shape({
			id: PropTypes.string.isRequired,
			display_id: PropTypes.string,
			version: PropTypes.string,
			status: PropTypes.oneOf(['started', 'processing', 'completed', 'failed']),
			started_at: PropTypes.string,
			created_at: PropTypes.string,
			completed_at: PropTypes.string,
			total_execution_time_ms: PropTypes.number,
			total_processing_time: PropTypes.number,
			storage_results: PropTypes.shape({
				storedCount: PropTypes.number
			}),
			total_opportunities_processed: PropTypes.number,
			opportunities_bypassed_llm: PropTypes.number,
			opportunities_per_minute: PropTypes.number,
			success_rate_percentage: PropTypes.number,
			cost_per_opportunity_usd: PropTypes.number,
			tokens_per_opportunity: PropTypes.number,
			sla_compliance_percentage: PropTypes.number,
			sla_grade: PropTypes.string,
			failure_breakdown: PropTypes.object,
			sla_breakdown: PropTypes.object
		})
	),
	loading: PropTypes.bool
};

export const RunsTableV2 = React.memo(RunsTableV2Component);
import React, { useCallback } from 'react';
import {
	Card,
	CardHeader,
	CardContent,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, MapPin, Star, Sparkles, ArrowRight } from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/lib/supabase';
import { useTrackedOpportunitiesStore } from '@/lib/stores';
import Link from 'next/link';
import {
	getProjectTypeColor,
	prioritizeProjectTypes,
} from '@/lib/utils/uiHelpers';

// Status badge styles — border-only pills with tinted backgrounds
const statusStyles = {
	open: {
		classes: 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:bg-blue-950/50',
		display: 'Open',
	},
	upcoming: {
		classes: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/50',
		display: 'Upcoming',
	},
	closed: {
		classes: 'border-neutral-300 text-neutral-500 bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:bg-neutral-800/50',
		display: 'Closed',
	},
};

const getStatusStyle = (status) => {
	if (!status) return statusStyles.open;
	return statusStyles[status.toLowerCase()] || statusStyles.open;
};

const formatStatusForDisplay = (status) => {
	if (!status) return '';
	const key = status.toLowerCase();
	return statusStyles[key]?.display || status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

// Relevance score colors and labels
const getRelevanceConfig = (score) => {
	const s = Math.min(10, Math.max(0, score));
	if (s >= 8) return {
		color: '#059669', barColor: '#10b981',
		chipClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
		barBg: 'bg-emerald-100 dark:bg-emerald-900/30',
	};
	if (s >= 6) return {
		color: '#d97706', barColor: '#f59e0b',
		chipClasses: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
		barBg: 'bg-amber-100 dark:bg-amber-900/30',
	};
	return {
		color: '#6b7280', barColor: '#9ca3af',
		chipClasses: 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
		barBg: 'bg-neutral-100 dark:bg-neutral-800',
	};
};

// Top accent bar — consistent brand color
const ACCENT_BAR_COLOR = 'bg-blue-500 dark:bg-blue-400';

// Format location eligibility
const formatLocationEligibility = (opportunity) => {
	if (opportunity.is_national) return 'National';
	if (opportunity.coverage_state_codes?.length > 0) {
		if (opportunity.coverage_state_codes.length > 3) {
			return `${opportunity.coverage_state_codes.slice(0, 3).join(', ')} +${opportunity.coverage_state_codes.length - 3} more`;
		}
		return opportunity.coverage_state_codes.join(', ');
	}
	if (opportunity.eligible_locations?.length > 0) {
		if (opportunity.eligible_locations.includes('National')) return 'National';
		if (opportunity.eligible_locations.length > 3) {
			return `${opportunity.eligible_locations.slice(0, 3).join(', ')} +${opportunity.eligible_locations.length - 3} more`;
		}
		return opportunity.eligible_locations.join(', ');
	}
	return 'Location not specified';
};

const OpportunityCard = ({ opportunity, badgeOverride }) => {
	const trackedIds = useTrackedOpportunitiesStore((s) => s.trackedOpportunityIds);
	const toggleTracked = useTrackedOpportunitiesStore((s) => s.toggleTracked);
	const opportunityIsTracked = trackedIds.includes(opportunity.id);

	// Derived data
	const title = opportunity.title;
	const fundingType = opportunity.funding_type || null;

	const amount =
		opportunity.minimum_award && opportunity.maximum_award
			? `$${opportunity.minimum_award.toLocaleString()} - $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.maximum_award
			? `Up to $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.minimum_award
			? `From $${opportunity.minimum_award.toLocaleString()}`
			: opportunity.total_funding_available
			? `$${opportunity.total_funding_available.toLocaleString()} total`
			: 'Amount not specified';

	const closeDate = opportunity.close_date
		? new Date(opportunity.close_date).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
		  })
		: 'No deadline';

	const locationEligibility = formatLocationEligibility(opportunity);

	const status =
		opportunity.status ||
		determineStatus(opportunity.open_date, opportunity.close_date);
	const statusStyle = getStatusStyle(status);
	const displayStatus = formatStatusForDisplay(status);

	const summary =
		opportunity.program_overview ||
		opportunity.description ||
		'No description available';

	// Freshness badges
	const isNew =
		opportunity.created_at &&
		(new Date() - new Date(opportunity.created_at)) / (1000 * 60 * 60 * 24) <= 6;

	const isNewlyUpdated =
		!isNew &&
		opportunity.updated_at &&
		opportunity.created_at !== opportunity.updated_at &&
		(new Date() - new Date(opportunity.updated_at)) / (1000 * 60 * 60 * 24) <= 7;

	const getDaysAgo = (dateStr) => {
		if (!dateStr) return null;
		const now = new Date();
		const date = new Date(dateStr);
		now.setHours(0, 0, 0, 0);
		date.setHours(0, 0, 0, 0);
		return Math.round((now - date) / (1000 * 60 * 60 * 24));
	};

	const addedDaysAgo = isNew ? getDaysAgo(opportunity.created_at) : null;
	const updatedDaysAgo = isNewlyUpdated ? getDaysAgo(opportunity.updated_at) : null;

	const formatDaysAgo = (days) =>
		days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;

	// New match detection (from client matching) — use last_matched_at for recency
	const matchTimestamp = opportunity.last_matched_at || opportunity.first_matched_at;
	const isNewMatch =
		opportunity.is_new === true &&
		matchTimestamp &&
		(new Date() - new Date(matchTimestamp)) / (1000 * 60 * 60 * 24) <= 7;

	const matchedDaysAgo = isNewMatch ? getDaysAgo(matchTimestamp) : null;

	// Relevance score
	const relevanceScore =
		opportunity.relevance_score ||
		opportunity.scoring?.finalScore ||
		opportunity.scoring?.overallScore ||
		null;

	// Project types — top 3 by taxonomy tier
	const projectTypes = prioritizeProjectTypes(opportunity.eligible_project_types || [], 3);

	const handleTrackToggle = useCallback(
		(e) => {
			e.preventDefault();
			e.stopPropagation();
			e.nativeEvent.stopImmediatePropagation();
			toggleTracked(opportunity.id);
		},
		[toggleTracked, opportunity.id]
	);

	return (
		<Link href={`/funding/opportunities/${opportunity.id}`} className='block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg'>
		<Card className='overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 flex flex-col h-full relative border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm group cursor-pointer'>
			{/* Brand accent bar */}
			<div className={`h-1.5 w-full ${ACCENT_BAR_COLOR}`} />

			<CardHeader className='px-4 pt-3 pb-2'>
				{/* Title + Status row */}
				<div className='flex justify-between items-start gap-2'>
					<CardTitle className='text-base font-semibold leading-snug tracking-tight line-clamp-2 text-neutral-900 dark:text-neutral-50' title={title}>
						{title}
					</CardTitle>

					{badgeOverride || (
						<span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 whitespace-nowrap ${statusStyle.classes}`}>
							{displayStatus}
						</span>
					)}
				</div>

				{/* Meta row: funding type + freshness badges */}
				<div className='flex items-center gap-1.5 flex-wrap mt-1.5'>
					{fundingType && (
						<span className='text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-neutral-300 text-neutral-700 bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:bg-neutral-800/50'>
							{fundingType}
						</span>
					)}
					{isNew && (
						<span className='flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400'>
							<span className='w-1.5 h-1.5 rounded-full bg-blue-500' />
							New {formatDaysAgo(addedDaysAgo)}
						</span>
					)}
					{isNewlyUpdated && (
						<span className='flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400'>
							<span className='w-1.5 h-1.5 rounded-full bg-sky-500' />
							Updated {formatDaysAgo(updatedDaysAgo)}
						</span>
					)}
					{isNewMatch && (
						<span className='flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400'>
							<span className='w-1.5 h-1.5 rounded-full bg-blue-500' />
							New Match {formatDaysAgo(matchedDaysAgo)}
						</span>
					)}
				</div>
			</CardHeader>

			<CardContent className='flex-grow flex flex-col pt-0 px-4 pb-4'>
				<div className='space-y-3 flex-grow'>
					{/* Summary — truncated to 3 lines */}
					<p className='text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed'>
						{summary}
					</p>

					{/* Project type pills — left-edge color stripe */}
					<div className='flex flex-wrap gap-1.5' role='list'>
						{projectTypes.map((projectType, index) => {
							const typeColor = getProjectTypeColor(projectType);
							return (
								<span
									key={index}
									role='listitem'
									className='text-[11px] font-medium px-2 py-0.5 rounded-md border border-l-2 bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-800/50 dark:text-neutral-300 dark:border-neutral-700'
									style={{ borderLeftColor: typeColor.color }}>
									{projectType}
								</span>
							);
						})}
					</div>

					{/* Key details — compact */}
					<div className='space-y-1.5'>
						<div className='flex items-center gap-2'>
							<DollarSign size={14} className='text-neutral-400 dark:text-neutral-500 flex-shrink-0' />
							<span className='text-sm font-medium text-neutral-700 dark:text-neutral-300'>{amount}</span>
						</div>
						<div className='flex items-center gap-2'>
							<Calendar size={14} className='text-neutral-400 dark:text-neutral-500 flex-shrink-0' />
							<span className='text-xs text-neutral-500 dark:text-neutral-400'>{closeDate}</span>
						</div>
						<div className='flex items-center gap-2'>
							<MapPin size={14} className='text-neutral-400 dark:text-neutral-500 flex-shrink-0' />
							<span className='text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1'>{locationEligibility}</span>
						</div>
					</div>
				</div>

				{/* Footer: Relevance score + actions */}
				<div className='pt-3 mt-auto border-t border-neutral-100 dark:border-neutral-800'>
					{/* Relevance score — labeled module */}
					{relevanceScore !== null && relevanceScore !== undefined && (() => {
						const config = getRelevanceConfig(relevanceScore);
						const normalizedScore = Math.min(10, relevanceScore);
						const percentage = Math.max(0, Math.min(100, (normalizedScore / 10) * 100));
						return (
							<div
								className='flex items-center gap-2 mb-3'
								aria-label={`Relevance score: ${normalizedScore.toFixed(1)} out of 10`}
							>
								<div className='flex items-center gap-1'>
									<Sparkles size={12} style={{ color: config.color }} />
									<span className='text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400'>
										Relevance
									</span>
								</div>
								<span className={`text-xs font-bold px-2 py-0.5 rounded border ${config.chipClasses}`}>
									{normalizedScore.toFixed(1)}
								</span>
								<div className={`flex-grow h-1.5 rounded-full overflow-hidden ${config.barBg}`}>
									<div
										className='h-full rounded-full transition-all duration-300'
										style={{
											width: `${percentage}%`,
											backgroundColor: config.barColor,
										}}
									/>
								</div>
							</div>
						);
					})()}

					{/* Footer actions — quiet text link + compact Track */}
					<div className='flex items-center justify-between'>
						<span className='text-sm text-neutral-500 group-hover:text-primary dark:text-neutral-400 dark:group-hover:text-primary transition-colors flex items-center gap-1'>
							View Details
							<ArrowRight className='h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200' />
						</span>
						<Button
							variant='ghost'
							size='sm'
							className={`h-7 text-xs px-2 ${
								opportunityIsTracked
									? 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
									: 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
							}`}
							onClick={handleTrackToggle}
							onMouseDown={(e) => e.stopPropagation()}
							onTouchStart={(e) => e.stopPropagation()}
							data-track-button='true'
							aria-label={opportunityIsTracked ? 'Remove from tracked opportunities' : 'Add to tracked opportunities'}
							aria-pressed={opportunityIsTracked}
						>
							<Star
								className={`h-3.5 w-3.5 mr-1 ${
									opportunityIsTracked
										? 'fill-amber-500 text-amber-500'
										: 'fill-none text-neutral-400'
								}`}
							/>
							{opportunityIsTracked ? 'Tracked' : 'Track'}
						</Button>
					</div>
				</div>
			</CardContent>
			{/* Bottom accent bar — bookend */}
			<div className={`h-1.5 w-full mt-auto ${ACCENT_BAR_COLOR}`} />
		</Card>
		</Link>
	);
};

export default OpportunityCard;

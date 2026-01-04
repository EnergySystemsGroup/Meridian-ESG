import React, { useCallback, useEffect } from 'react';
import {
	Card,
	CardHeader,
	CardContent,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Calendar, Map, Star, Tag, Info } from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/lib/supabase';
import { useTrackedOpportunities } from '@/hooks/useTrackedOpportunities';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
	getCategoryColor,
	formatCategoryForDisplay,
	getProjectTypeColor,
	prioritizeProjectTypes,
} from '@/lib/utils/uiHelpers';

// Status indicators with colors for badges
const statusIndicator = {
	open: { color: '#2563EB', bgColor: '#EFF6FF', display: 'Open' },
	upcoming: { color: '#4CAF50', bgColor: '#E8F5E9', display: 'Upcoming' },
	closed: { color: '#EF4444', bgColor: '#FEF2F2', display: 'Closed' },
};

// Helper to get status color regardless of case
const getStatusColor = (status) => {
	if (!status) return '#9E9E9E';
	const statusKey = status.toLowerCase();
	return statusIndicator[statusKey]?.color || '#9E9E9E';
};

// Helper to format status for display
const formatStatusForDisplay = (status) => {
	if (!status) return '';
	const statusKey = status.toLowerCase();
	return (
		statusIndicator[statusKey]?.display ||
		status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
	);
};

// Get relevance color based on the raw relevance score (0-10 scale)
const getRelevanceColor = (score) => {
	// Normalize score to 0-10 range
	const normalizedScore = Math.min(10, Math.max(0, score));

	if (normalizedScore >= 8) return '#4CAF50'; // High relevance - green
	if (normalizedScore >= 6) return '#FF9800'; // Medium relevance - orange
	return '#9E9E9E'; // Low relevance - gray
};

// Helper to format location eligibility for display
const formatLocationEligibility = (opportunity) => {
	// Check if opportunity is national
	if (opportunity.is_national) {
		return 'National';
	}

	// Check for coverage_state_codes array from coverage_areas system
	if (opportunity.coverage_state_codes && opportunity.coverage_state_codes.length > 0) {
		if (opportunity.coverage_state_codes.length > 3) {
			return `${opportunity.coverage_state_codes.slice(0, 3).join(', ')} +${
				opportunity.coverage_state_codes.length - 3
			} more`;
		}
		return opportunity.coverage_state_codes.join(', ');
	}

	// Fallback to eligible_locations array
	if (
		opportunity.eligible_locations &&
		opportunity.eligible_locations.length > 0
	) {
		// If it contains 'National', show that
		if (opportunity.eligible_locations.includes('National')) {
			return 'National';
		}

		// Otherwise, show the list of locations
		if (opportunity.eligible_locations.length > 3) {
			return `${opportunity.eligible_locations.slice(0, 3).join(', ')} +${
				opportunity.eligible_locations.length - 3
			} more`;
		}
		return opportunity.eligible_locations.join(', ');
	}

	// Default if no location data
	return 'Location not specified';
};

// Badge colors are now handled via Tailwind classes for dark mode support

const OpportunityCard = ({ opportunity, badgeOverride }) => {
	// Use Next.js router and search params
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Use our custom hook for tracking opportunities
	const { isTracked, toggleTracked, trackedCount } = useTrackedOpportunities();

	// Check if this opportunity is being tracked
	const opportunityIsTracked = isTracked(opportunity.id);

	// Format the data from our database to match the UI expectations
	const title = opportunity.title;

	// Format amount display
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

	// Format close date
	const closeDate = opportunity.close_date
		? new Date(opportunity.close_date).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
		  })
		: 'No deadline specified';

	// Format location eligibility
	const locationEligibility = formatLocationEligibility(opportunity);

	// Determine status
	const status =
		opportunity.status ||
		determineStatus(opportunity.open_date, opportunity.close_date);

	// Format status for display (ensuring correct capitalization)
	const displayStatus = formatStatusForDisplay(status);

	// Use program overview if available, fall back to description
	const summary =
		opportunity.program_overview ||
		opportunity.description ||
		'No description available';

	// Get tags
	const tags = opportunity.tags || [];

	// Determine if opportunity is new (added in the last 6 days)
	const isNew =
		opportunity.created_at &&
		(new Date() - new Date(opportunity.created_at)) / (1000 * 60 * 60 * 24) <=
			6;

	// Determine if opportunity was recently updated (within last 7 days, but not new)
	const isNewlyUpdated =
		!isNew &&
		opportunity.updated_at &&
		opportunity.created_at !== opportunity.updated_at &&
		(new Date() - new Date(opportunity.updated_at)) / (1000 * 60 * 60 * 24) <=
			7;

	// Calculate days since creation if it's new
	const addedDaysAgo =
		isNew && opportunity.created_at
			? (() => {
					const today = new Date();
					const createdDate = new Date(opportunity.created_at);

					// Reset hours to compare calendar days only
					today.setHours(0, 0, 0, 0);
					createdDate.setHours(0, 0, 0, 0);

					// Calculate difference in days
					return Math.round((today - createdDate) / (1000 * 60 * 60 * 24));
			  })()
			: null;

	// Calculate days since update if it was newly updated
	const updatedDaysAgo =
		isNewlyUpdated && opportunity.updated_at
			? (() => {
					const today = new Date();
					const updatedDate = new Date(opportunity.updated_at);

					// Reset hours to compare calendar days only
					today.setHours(0, 0, 0, 0);
					updatedDate.setHours(0, 0, 0, 0);

					// Calculate difference in days
					return Math.round((today - updatedDate) / (1000 * 60 * 60 * 24));
			  })()
			: null;

	// Get relevance score if available - handle both old and new scoring formats
	const relevanceScore = opportunity.relevance_score ||
		opportunity.scoring?.finalScore ||
		opportunity.scoring?.overallScore ||
		null;

	// Extract categories - for now, we'll use tags as categories if categories aren't available
	const categories =
		opportunity.categories || (tags.length > 0 ? [tags[0]] : ['Other']);

	// Get prioritized project types (top 3 based on taxonomy)
	const projectTypes = prioritizeProjectTypes(opportunity.eligible_project_types || [], 3);

	// Function to handle tracking
	const handleTrackToggle = useCallback(
		(e) => {
			e.preventDefault(); // Prevent link navigation
			e.stopPropagation(); // Prevent event bubbling up to parent elements
			e.nativeEvent.stopImmediatePropagation(); // Stop all other event handlers

			// Toggle the tracked status
			toggleTracked(opportunity.id);
		},
		[toggleTracked, opportunity.id]
	);

	return (
		<Card className='overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full relative'>
			{/* Thin blue bar at the top */}
			<div className='h-1.5 w-full bg-blue-600 rounded-t-lg' />

			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg line-clamp-2'>{title}</CardTitle>

					{/* Status badge OR custom badge override */}
					{badgeOverride ? (
						badgeOverride
					) : (
						<span
							className='text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 font-medium'
							style={{
								backgroundColor: getStatusColor(status),
								color: 'white',
							}}>
							{displayStatus}
						</span>
					)}
				</div>

				{/* NEW badge if applicable - updated to match category pill styling */}
				{isNew && (
					<div className='mt-2'>
						<span className='text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'>
							NEW •{' '}
							{addedDaysAgo === 0
								? 'Today'
								: addedDaysAgo === 1
								? 'Yesterday'
								: `${addedDaysAgo} days ago`}
						</span>
					</div>
				)}

				{/* NEWLY UPDATED badge if applicable */}
				{isNewlyUpdated && (
					<div className='mt-2'>
						<span className='text-xs font-medium px-2 py-1 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'>
							UPDATED •{' '}
							{updatedDaysAgo === 0
								? 'Today'
								: updatedDaysAgo === 1
								? 'Yesterday'
								: `${updatedDaysAgo} days ago`}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent className='flex-grow flex flex-col pt-0'>
				<div className='space-y-4 flex-grow'>
					{/* Summary */}
					<p className='text-sm text-neutral-600 dark:text-neutral-400'>{summary}</p>

					{/* Project type pills */}
					<div className='flex flex-wrap gap-1'>
						{projectTypes.map((projectType, index) => {
							const projectTypeColor = getProjectTypeColor(projectType);
							return (
								<span
									key={index}
									className='project-type-tag text-xs px-2 py-1 rounded'
									style={{
										backgroundColor: projectTypeColor.bgColor,
										color: projectTypeColor.color,
									}}>
									{projectType}
								</span>
							);
						})}
					</div>

					{/* Key details */}
					<div className='space-y-2 text-sm'>
						<div className='flex items-center gap-2'>
							<DollarSign size={16} className='text-neutral-500 dark:text-neutral-400' />
							<span>{amount}</span>
						</div>

						<div className='flex items-center gap-2'>
							<Calendar size={16} className='text-neutral-500 dark:text-neutral-400' />
							<span>{closeDate}</span>
						</div>

						<div className='flex items-center gap-2'>
							<Map size={16} className='text-neutral-500 dark:text-neutral-400' />
							<span className='line-clamp-1'>{locationEligibility}</span>
						</div>
					</div>
				</div>

				{/* Footer section with relevance score and buttons - fixed at bottom */}
				<div className='pt-4 mt-auto'>
					{/* Relevance score if available */}
					{relevanceScore !== null && relevanceScore !== undefined && (
						<div className='flex items-center gap-2 mb-4'>
							<div className='flex-grow bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden'>
								<div
									className='h-full rounded-full'
									style={{
										width: `${Math.max(
											0,
											Math.min(100, (Math.min(10, relevanceScore) / 10) * 100)
										)}%`, // Ensure max is 100%
										backgroundColor: getRelevanceColor(relevanceScore),
									}}></div>
							</div>
							<span
								className='text-xs font-medium whitespace-nowrap'
								style={{ color: getRelevanceColor(relevanceScore) }}>
								{Math.min(10, relevanceScore).toFixed(1)}/10
							</span>
						</div>
					)}

					{/* Button row with View Details and Track buttons */}
					<div className='flex gap-2'>
						<Button className='flex-1' asChild>
							<Link href={`/funding/opportunities/${opportunity.id}`}>
								View Details
							</Link>
						</Button>

						<Button
							variant={opportunityIsTracked ? 'outline' : 'outline'}
							className={
								opportunityIsTracked
									? 'border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 flex-1'
									: 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex-1'
							}
							onClick={handleTrackToggle}
							onMouseDown={(e) => e.stopPropagation()}
							onTouchStart={(e) => e.stopPropagation()}
							data-track-button='true'
							title={
								opportunityIsTracked
									? 'Remove from tracked opportunities'
									: 'Add to tracked opportunities'
							}>
							<Star
								className={`h-4 w-4 mr-2 ${
									opportunityIsTracked
										? 'fill-amber-500 text-amber-500'
										: 'fill-none text-slate-500'
								}`}
							/>
							{opportunityIsTracked ? 'Untrack' : 'Track'}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default OpportunityCard;

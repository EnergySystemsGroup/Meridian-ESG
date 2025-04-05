import React from 'react';
import {
	Card,
	CardHeader,
	CardContent,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { DollarSign, Calendar, Clock } from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';

// Status indicators with colors for badges
const statusIndicator = {
	Open: { color: '#4CAF50', bgColor: '#E8F5E9' },
	Upcoming: { color: '#2196F3', bgColor: '#E3F2FD' },
	Anticipated: { color: '#2196F3', bgColor: '#E3F2FD' },
	Active: { color: '#FF9800', bgColor: '#FFF3E0' },
	Closed: { color: '#9E9E9E', bgColor: '#F5F5F5' },
};

// Helper function to get a consistent color for a category (from original code)
const getCategoryColor = (categoryName) => {
	// Define a color map for the standard categories from taxonomies
	const categoryColors = {
		// Energy categories with orange-yellow hues
		'Energy Efficiency': { color: '#F57C00', bgColor: '#FFF3E0' },
		'Renewable Energy': { color: '#FF9800', bgColor: '#FFF8E1' },

		// Environmental/Water with blue-green hues
		'Water Conservation': { color: '#0288D1', bgColor: '#E1F5FE' },
		Environmental: { color: '#00796B', bgColor: '#E0F2F1' },
		Sustainability: { color: '#43A047', bgColor: '#E8F5E9' },

		// Infrastructure/Facilities with gray-blue hues
		Infrastructure: { color: '#546E7A', bgColor: '#ECEFF1' },
		Transportation: { color: '#455A64', bgColor: '#E0E6EA' },
		'Facility Improvements': { color: '#607D8B', bgColor: '#F5F7F8' },

		// Education/Development with purple hues
		Education: { color: '#7B1FA2', bgColor: '#F3E5F5' },
		'Research & Development': { color: '#9C27B0', bgColor: '#F5E9F7' },
		'Economic Development': { color: '#6A1B9A', bgColor: '#EFE5F7' },

		// Community/Health with red-pink hues
		'Community Development': { color: '#C62828', bgColor: '#FFEBEE' },
		'Health & Safety': { color: '#D32F2F', bgColor: '#FFEBEE' },
		'Disaster Recovery': { color: '#E53935', bgColor: '#FFEBEE' },

		// Planning with neutral hues
		'Planning & Assessment': { color: '#5D4037', bgColor: '#EFEBE9' },
	};

	// Check if it's one of our standard categories
	if (categoryColors[categoryName]) {
		return categoryColors[categoryName];
	}

	// For non-standard categories, generate a color using the hash function
	let hash = 0;
	for (let i = 0; i < categoryName.length; i++) {
		hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Multiply by a prime number to better distribute the hue values
	const hue = (hash * 13) % 360;

	return {
		color: `hsl(${hue}, 65%, 45%)`,
		bgColor: `hsl(${hue}, 65%, 95%)`,
	};
};

// Get relevance color based on a 1-10 scale
const getRelevanceColor = (score) => {
	const percentScore = score * 10; // Convert 1-10 scale to percentage
	if (percentScore >= 80) return '#4CAF50'; // High relevance - green
	if (percentScore >= 60) return '#FF9800'; // Medium relevance - orange
	return '#9E9E9E'; // Low relevance - gray
};

const OpportunityCard = ({ opportunity }) => {
	// Format the data from our database to match the UI expectations
	const title = opportunity.title;
	const source =
		opportunity.agency_name ||
		opportunity.source_display_name ||
		'Unknown Source';

	// Format amount display
	const amount =
		opportunity.minimum_award && opportunity.maximum_award
			? `$${opportunity.minimum_award.toLocaleString()} - $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.maximum_award
			? `Up to $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.minimum_award
			? `From $${opportunity.minimum_award.toLocaleString()}`
			: 'Amount not specified';

	// Format close date
	const closeDate = opportunity.close_date
		? new Date(opportunity.close_date).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
		  })
		: 'No deadline specified';

	// Calculate days remaining
	const daysLeft = opportunity.close_date
		? calculateDaysLeft(opportunity.close_date)
		: null;

	// Determine status
	const status =
		opportunity.status ||
		determineStatus(opportunity.open_date, opportunity.close_date);

	// Use actionable summary if available, fall back to description
	const summary =
		opportunity.actionable_summary ||
		opportunity.description ||
		'No description available';

	// Get tags
	const tags = opportunity.tags || [];

	// Determine if opportunity is new (added in the last 6 days)
	const isNew =
		opportunity.created_at &&
		(new Date() - new Date(opportunity.created_at)) / (1000 * 60 * 60 * 24) <=
			6;

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

	// Get relevance score if available
	const relevanceScore = opportunity.relevance_score || null;

	// Extract categories - for now, we'll use tags as categories if categories aren't available
	const categories =
		opportunity.categories || (tags.length > 0 ? [tags[0]] : ['Other']);

	return (
		<Card className='overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full'>
			{/* Thin blue bar at the top */}
			<div className='h-1.5 w-full bg-blue-600 rounded-t-lg' />

			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg line-clamp-2'>{title}</CardTitle>

					{/* Status badge with appropriate colors */}
					<span
						className='text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 font-medium'
						style={{
							backgroundColor: statusIndicator[status]?.color || '#9E9E9E',
							color: 'white',
						}}>
						{status}
					</span>
				</div>

				{/* Source attribution */}
				<div className='text-xs text-gray-500 mt-1'>{source}</div>

				{/* NEW badge if applicable */}
				{isNew && (
					<div className='mt-2'>
						<span className='bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded'>
							NEW •{' '}
							{addedDaysAgo === 0
								? 'Today'
								: addedDaysAgo === 1
								? 'Yesterday'
								: `${addedDaysAgo} days ago`}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent className='flex-grow flex flex-col pt-0'>
				<div className='space-y-4 flex-grow'>
					{/* Summary */}
					<p className='text-sm text-gray-600'>{summary}</p>

					{/* Category pills */}
					<div className='flex flex-wrap gap-1'>
						{categories.map((category, index) => {
							const categoryColor = getCategoryColor(category);
							return (
								<span
									key={index}
									className='text-xs px-2 py-1 rounded'
									style={{
										backgroundColor: categoryColor.bgColor,
										color: categoryColor.color,
									}}>
									{category}
								</span>
							);
						})}
					</div>

					{/* Key details */}
					<div className='space-y-2 text-sm'>
						<div className='flex items-center gap-2'>
							<DollarSign size={16} className='text-gray-500' />
							<span>{amount}</span>
						</div>

						<div className='flex items-center gap-2'>
							<Calendar size={16} className='text-gray-500' />
							<span>{closeDate}</span>
						</div>

						{daysLeft !== null && daysLeft > 0 && (
							<div className='flex items-center gap-2'>
								<Clock size={16} className='text-gray-500' />
								<span>{daysLeft} days remaining</span>
							</div>
						)}
					</div>
				</div>

				{/* Footer section with relevance score and button - fixed at bottom */}
				<div className='pt-4 mt-auto'>
					{/* Relevance score if available */}
					{relevanceScore !== null && relevanceScore !== undefined && (
						<div className='flex items-center gap-2 mb-4'>
							<div className='flex-grow bg-gray-200 h-2 rounded-full overflow-hidden'>
								<div
									className='h-full rounded-full'
									style={{
										width: `${Math.max(
											0,
											Math.min(100, relevanceScore * 10)
										)}%`, // Convert 1-10 scale to percentage (0-100%)
										backgroundColor: getRelevanceColor(relevanceScore),
									}}></div>
							</div>
							<span
								className='text-xs font-medium whitespace-nowrap'
								style={{ color: getRelevanceColor(relevanceScore) }}>
								{Math.round(relevanceScore * 10)}% relevance
							</span>
						</div>
					)}

					<Button className='w-full' asChild>
						<a href={`/funding/opportunities/${opportunity.id}`}>
							View Details
						</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};

export default OpportunityCard;

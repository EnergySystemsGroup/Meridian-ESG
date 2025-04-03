'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
	Search,
	Calendar,
	DollarSign,
	Clock,
	Filter,
	Tag,
	X,
	ChevronDown,
	Download,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';

// Helper function to get a consistent color for a category
function getCategoryColor(categoryName) {
	// Generate a hash from the string
	let hash = 0;
	for (let i = 0; i < categoryName.length; i++) {
		hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Convert to HSL color with fixed saturation and lightness
	const hue = hash % 360;
	return {
		color: `hsl(${hue}, 65%, 45%)`, // Primary color
		bgColor: `hsl(${hue}, 65%, 95%)`, // Background color (lighter version)
	};
}

// Status indicators
const statusIndicator = {
	Open: { color: '#4CAF50', bgColor: '#E8F5E9' },
	Upcoming: { color: '#2196F3', bgColor: '#E3F2FD' },
	Anticipated: { color: '#2196F3', bgColor: '#E3F2FD' },
	Active: { color: '#FF9800', bgColor: '#FFF3E0' },
	Closed: { color: '#9E9E9E', bgColor: '#F5F5F5' },
};

export default function OpportunitiesPage() {
	const [opportunities, setOpportunities] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [openFilterSection, setOpenFilterSection] = useState(null);
	const [filters, setFilters] = useState({
		status: null,
		source_type: null,
		tags: [],
		categories: [],
		page: 1,
		page_size: 9,
	});
	const [availableTags, setAvailableTags] = useState([]);
	const [availableCategories, setAvailableCategories] = useState([]);
	const [sortOption, setSortOption] = useState('relevance');

	// Extract all unique tags and categories from opportunities
	useEffect(() => {
		if (opportunities.length > 0) {
			// Extract all unique tags
			const allTags = [
				...new Set(opportunities.flatMap((opp) => opp.tags || [])),
			];
			setAvailableTags(allTags);

			// Extract all unique categories
			const allCategories = [
				...new Set(opportunities.flatMap((opp) => opp.categories || [])),
			];
			setAvailableCategories(allCategories);
		}
	}, [opportunities]);

	useEffect(() => {
		async function fetchOpportunities() {
			try {
				setLoading(true);

				// Build query string from filters
				const queryParams = new URLSearchParams();

				if (filters.status) {
					queryParams.append('status', filters.status);
				}

				if (filters.source_type) {
					queryParams.append('source_type', filters.source_type);
				}

				if (filters.tags.length > 0) {
					queryParams.append('tags', filters.tags.join(','));
				}

				queryParams.append('page', filters.page.toString());
				queryParams.append('page_size', filters.page_size.toString());

				// Add sort option
				if (sortOption === 'deadline') {
					queryParams.append('sort_by', 'close_date');
					queryParams.append('sort_direction', 'asc');
				} else if (sortOption === 'amount') {
					queryParams.append('sort_by', 'maximum_award');
					queryParams.append('sort_direction', 'desc');
				} else if (sortOption === 'recent') {
					queryParams.append('sort_by', 'posted_date');
					queryParams.append('sort_direction', 'desc');
				} else {
					// Default to relevance if available
					queryParams.append('sort_by', 'relevance_score');
					queryParams.append('sort_direction', 'desc');
				}

				// Fetch data from our API
				const response = await fetch(`/api/funding?${queryParams.toString()}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch opportunities');
				}

				setOpportunities(result.data);
			} catch (err) {
				console.error('Error fetching opportunities:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchOpportunities();
	}, [filters, sortOption]);

	// Toggle filter section
	const toggleFilterSection = (section) => {
		setOpenFilterSection(openFilterSection === section ? null : section);
	};

	// Handle filter selection
	const handleFilterSelect = (type, value) => {
		setFilters((prev) => {
			const newFilters = { ...prev };

			if (type === 'tags' || type === 'categories') {
				if (newFilters[type].includes(value)) {
					newFilters[type] = newFilters[type].filter((item) => item !== value);
				} else {
					newFilters[type] = [...newFilters[type], value];
				}
			} else {
				newFilters[type] = newFilters[type] === value ? null : value;
			}

			// Reset page when changing filters
			newFilters.page = 1;

			return newFilters;
		});
	};

	// Clear all filters
	const clearAllFilters = () => {
		setFilters({
			status: null,
			source_type: null,
			tags: [],
			categories: [],
			page: 1,
			page_size: 9,
		});
		setSearchQuery('');
	};

	// Filter opportunities based on search query
	const filteredOpportunities = opportunities.filter((opportunity) => {
		if (!searchQuery) return true;

		const searchLower = searchQuery.toLowerCase();
		return (
			(opportunity.title &&
				opportunity.title.toLowerCase().includes(searchLower)) ||
			(opportunity.description &&
				opportunity.description.toLowerCase().includes(searchLower)) ||
			(opportunity.actionable_summary &&
				opportunity.actionable_summary.toLowerCase().includes(searchLower))
		);
	});

	// Check if any filters are applied
	const hasActiveFilters = () => {
		return (
			filters.status !== null ||
			filters.source_type !== null ||
			filters.tags.length > 0 ||
			filters.categories.length > 0 ||
			searchQuery !== ''
		);
	};

	// Handle export functionality
	const handleExport = () => {
		// Export functionality would be implemented here
		alert('Export functionality will be implemented here');
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Funding Opportunities</h1>
					<div className='flex gap-2'>
						<Button variant='outline' onClick={handleExport}>
							<Download size={16} className='mr-2' />
							Export
						</Button>
					</div>
				</div>

				{/* Search and filter bar */}
				<div className='bg-white rounded-xl shadow-sm p-4 mb-6'>
					<div className='flex flex-col md:flex-row gap-4'>
						{/* Search input */}
						<div className='relative flex-grow'>
							<div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
								<Search size={18} className='text-gray-400' />
							</div>
							<Input
								type='text'
								className='pl-10'
								placeholder='Search opportunities...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>

						{/* Filter dropdown buttons */}
						<div className='flex flex-wrap gap-2'>
							{/* Status filter */}
							<div className='relative'>
								<Button
									variant={filters.status ? 'secondary' : 'outline'}
									onClick={() => toggleFilterSection('status')}
									className='flex items-center gap-2'>
									<Filter size={16} />
									<span>Status</span>
									{filters.status && (
										<span className='ml-1 bg-primary-foreground text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
											1
										</span>
									)}
									<ChevronDown size={16} />
								</Button>

								{openFilterSection === 'status' && (
									<div className='absolute z-10 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-2'>
										{['Open', 'Upcoming', 'Active', 'Closed'].map((status) => (
											<div
												key={status}
												className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
												onClick={() => handleFilterSelect('status', status)}>
												<input
													type='checkbox'
													className='mr-2'
													checked={filters.status === status}
													onChange={() => {}}
												/>
												<span
													className='w-3 h-3 rounded-full mr-2'
													style={{
														backgroundColor: statusIndicator[status].color,
													}}
												/>
												<span>{status}</span>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Source type filter */}
							<div className='relative'>
								<Button
									variant={filters.source_type ? 'secondary' : 'outline'}
									onClick={() => toggleFilterSection('source_type')}
									className='flex items-center gap-2'>
									<Filter size={16} />
									<span>Source</span>
									{filters.source_type && (
										<span className='ml-1 bg-primary-foreground text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
											1
										</span>
									)}
									<ChevronDown size={16} />
								</Button>

								{openFilterSection === 'source_type' && (
									<div className='absolute z-10 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-2'>
										{['Federal', 'State', 'Local', 'Foundation', 'Private'].map(
											(type) => (
												<div
													key={type}
													className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
													onClick={() =>
														handleFilterSelect('source_type', type)
													}>
													<input
														type='checkbox'
														className='mr-2'
														checked={filters.source_type === type}
														onChange={() => {}}
													/>
													<span>{type}</span>
												</div>
											)
										)}
									</div>
								)}
							</div>

							{/* Tags filter */}
							<div className='relative'>
								<Button
									variant={filters.tags.length > 0 ? 'secondary' : 'outline'}
									onClick={() => toggleFilterSection('tags')}
									className='flex items-center gap-2'>
									<Tag size={16} />
									<span>Tags</span>
									{filters.tags.length > 0 && (
										<span className='ml-1 bg-primary-foreground text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
											{filters.tags.length}
										</span>
									)}
									<ChevronDown size={16} />
								</Button>

								{openFilterSection === 'tags' && (
									<div className='absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-64 overflow-y-auto'>
										{availableTags.map((tag) => (
											<div
												key={tag}
												className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
												onClick={() => handleFilterSelect('tags', tag)}>
												<input
													type='checkbox'
													className='mr-2'
													checked={filters.tags.includes(tag)}
													onChange={() => {}}
												/>
												<span>{tag}</span>
											</div>
										))}
										{availableTags.length === 0 && (
											<div className='p-2 text-gray-500'>No tags available</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Active filters */}
					{hasActiveFilters() && (
						<div className='mt-4 pt-4 border-t border-gray-200'>
							<div className='flex justify-between items-center mb-2'>
								<h3 className='font-medium text-gray-700'>Active Filters</h3>
								<Button
									variant='link'
									className='h-auto p-0 text-sm'
									onClick={clearAllFilters}>
									Clear All
								</Button>
							</div>

							<div className='flex flex-wrap gap-2'>
								{/* Search query filter */}
								{searchQuery && (
									<div className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
										<Search size={14} />
										<span>{searchQuery}</span>
										<button onClick={() => setSearchQuery('')} className='ml-1'>
											<X size={14} />
										</button>
									</div>
								)}

								{/* Status filter */}
								{filters.status && (
									<div className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
										<span
											className='w-2 h-2 rounded-full'
											style={{
												backgroundColor: statusIndicator[filters.status].color,
											}}
										/>
										<span>{filters.status}</span>
										<button
											onClick={() =>
												handleFilterSelect('status', filters.status)
											}
											className='ml-1'>
											<X size={14} />
										</button>
									</div>
								)}

								{/* Source type filter */}
								{filters.source_type && (
									<div className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
										<span>{filters.source_type}</span>
										<button
											onClick={() =>
												handleFilterSelect('source_type', filters.source_type)
											}
											className='ml-1'>
											<X size={14} />
										</button>
									</div>
								)}

								{/* Tag filters */}
								{filters.tags.map((tag) => (
									<div
										key={`tag-${tag}`}
										className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
										<Tag size={14} />
										<span>{tag}</span>
										<button
											onClick={() => handleFilterSelect('tags', tag)}
											className='ml-1'>
											<X size={14} />
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Results count and sort */}
				<div className='flex justify-between items-center mb-4'>
					<h2 className='text-lg font-medium text-gray-700'>
						{filteredOpportunities.length}{' '}
						{filteredOpportunities.length === 1 ? 'result' : 'results'}
					</h2>

					<div className='flex items-center gap-2'>
						<span className='text-sm text-gray-500'>Sort by:</span>
						<select
							className='text-sm border-gray-300 rounded-md p-1'
							value={sortOption}
							onChange={(e) => setSortOption(e.target.value)}>
							<option value='relevance'>Relevance</option>
							<option value='deadline'>Deadline (soonest)</option>
							<option value='amount'>Amount (highest)</option>
							<option value='recent'>Recently added</option>
						</select>
					</div>
				</div>

				{loading ? (
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
					</div>
				) : error ? (
					<div className='bg-red-50 text-red-800 p-4 rounded-md'>
						<p>Error: {error}</p>
						<Button
							variant='outline'
							className='mt-2'
							onClick={() => {
								setError(null);
								setFilters({ ...filters });
							}}>
							Retry
						</Button>
					</div>
				) : filteredOpportunities.length === 0 ? (
					<div className='text-center py-12'>
						<h3 className='text-xl font-medium mb-2'>No opportunities found</h3>
						<p className='text-muted-foreground mb-4'>
							Try adjusting your filters or check back later.
						</p>
						<Button onClick={clearAllFilters}>Clear Filters</Button>
					</div>
				) : (
					<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
						{filteredOpportunities.map((opportunity) => (
							<OpportunityCard key={opportunity.id} opportunity={opportunity} />
						))}
					</div>
				)}

				{!loading && !error && filteredOpportunities.length > 0 && (
					<div className='flex justify-center mt-6'>
						<Button
							variant='outline'
							className='mr-2'
							disabled={filters.page === 1}
							onClick={() =>
								setFilters({ ...filters, page: filters.page - 1 })
							}>
							Previous
						</Button>
						<Button
							variant='outline'
							onClick={() =>
								setFilters({ ...filters, page: filters.page + 1 })
							}>
							Next
						</Button>
					</div>
				)}
			</div>
		</MainLayout>
	);
}

function OpportunityCard({ opportunity }) {
	// Format the data from our database to match the UI expectations
	const title = opportunity.title;
	const source =
		opportunity.source_display_name ||
		opportunity.source_name ||
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

	// Determine if opportunity is new (added in the last 7 days)
	const isNew =
		opportunity.created_at &&
		(new Date() - new Date(opportunity.created_at)) / (1000 * 60 * 60 * 24) <=
			7;

	// Calculate days since creation if it's new
	const addedDaysAgo =
		isNew && opportunity.created_at
			? Math.floor(
					(new Date() - new Date(opportunity.created_at)) /
						(1000 * 60 * 60 * 24)
			  )
			: null;

	// Get relevance score if available
	const relevanceScore = opportunity.relevance_score || null;

	// Extract categories - for now, we'll use tags as categories if categories aren't available
	const categories =
		opportunity.categories || (tags.length > 0 ? [tags[0]] : ['Other']);

	// Get relevance color
	const getRelevanceColor = (score) => {
		if (score >= 80) return '#4CAF50'; // High relevance - green
		if (score >= 60) return '#FF9800'; // Medium relevance - orange
		return '#9E9E9E'; // Low relevance - gray
	};

	// Multi-category bar component
	const CategoryColorBar = ({ categories }) => {
		const segmentWidth = 100 / categories.length;

		return (
			<div className='flex h-1.5 w-full rounded-t-lg overflow-hidden'>
				{categories.map((category, index) => {
					const categoryColor = getCategoryColor(category);
					return (
						<div
							key={index}
							className='h-full'
							style={{
								backgroundColor: categoryColor.color,
								width: `${segmentWidth}%`,
							}}
						/>
					);
				})}
			</div>
		);
	};

	return (
		<Card className='overflow-hidden hover:shadow-md transition-shadow duration-200'>
			{/* Category color bar */}
			<CategoryColorBar categories={categories} />

			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{title}</CardTitle>
					<span
						className={`text-xs px-2 py-1 rounded-full`}
						style={{
							backgroundColor: statusIndicator[status]?.bgColor || '#F5F5F5',
							color: statusIndicator[status]?.color || '#9E9E9E',
						}}>
						{status}
					</span>
				</div>
				<CardDescription>{source}</CardDescription>

				{/* NEW badge if applicable */}
				{isNew && (
					<div className='mt-1'>
						<span className='bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded'>
							NEW • {addedDaysAgo === 0 ? 'Today' : `${addedDaysAgo} days ago`}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent>
				<div className='space-y-4'>
					{/* Summary with truncation */}
					<p className='text-sm text-muted-foreground line-clamp-3'>
						{summary}
					</p>

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

					{/* Tags */}
					<div className='flex flex-wrap gap-1'>
						{tags.slice(0, 3).map((tag, index) => (
							<span
								key={index}
								className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
						{tags.length > 3 && (
							<span className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
								+{tags.length - 3} more
							</span>
						)}
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

						{daysLeft !== null && (
							<div className='flex items-center gap-2'>
								<Clock size={16} className='text-gray-500' />
								<span>{daysLeft} days remaining</span>
							</div>
						)}
					</div>

					{/* Relevance score if available */}
					{relevanceScore !== null && (
						<div className='flex items-center gap-2'>
							<div className='flex-grow bg-gray-200 h-2 rounded-full overflow-hidden'>
								<div
									className='h-full rounded-full'
									style={{
										width: `${relevanceScore}%`,
										backgroundColor: getRelevanceColor(relevanceScore),
									}}></div>
							</div>
							<span
								className='text-xs font-medium'
								style={{ color: getRelevanceColor(relevanceScore) }}>
								{relevanceScore}% match
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
}

// Fallback data in case the API is not available
const fallbackOpportunities = [
	{
		id: 1,
		title: 'Building Energy Efficiency Grant',
		source_name: 'Department of Energy',
		min_amount: 500000,
		max_amount: 2000000,
		close_date: '2023-04-15',
		status: 'Open',
		description:
			'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.',
		tags: ['Energy Efficiency', 'Commercial', 'Federal'],
	},
	// ... other opportunities can be added here
];

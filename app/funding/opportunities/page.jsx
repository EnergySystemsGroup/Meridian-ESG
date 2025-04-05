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
	Briefcase,
	Map,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';
import TAXONOMIES from '@/app/lib/constants/taxonomies';
import OpportunityCard from '@/app/components/opportunities/OpportunityCard';

// Helper function to get a consistent color for a category
function getCategoryColor(categoryName) {
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

	// Check if it's one of our standard categories (accounting for case differences)
	const standardCategories = TAXONOMIES.CATEGORIES.map((c) => c.toLowerCase());
	const normalizedCategoryName = categoryName.toLowerCase();

	if (standardCategories.includes(normalizedCategoryName)) {
		// Find the exact match in the original case
		const matchedCategory = TAXONOMIES.CATEGORIES.find(
			(c) => c.toLowerCase() === normalizedCategoryName
		);

		// Return the predefined color if available
		if (matchedCategory && categoryColors[matchedCategory]) {
			return categoryColors[matchedCategory];
		}
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
}

// Status indicators
const statusIndicator = {
	Open: { color: '#4CAF50', bgColor: '#E8F5E9' },
	Upcoming: { color: '#2196F3', bgColor: '#E3F2FD' },
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
		categories: [],
		states: [],
		page: 1,
		page_size: 9,
	});
	const [availableTags, setAvailableTags] = useState([]);
	const [availableCategories, setAvailableCategories] = useState(
		TAXONOMIES.CATEGORIES
	);
	const [availableStates, setAvailableStates] = useState(
		TAXONOMIES.ELIGIBLE_LOCATIONS.filter(
			(location) =>
				location !== 'National' &&
				location !== 'Regional' &&
				![
					'Tribal Lands',
					'Rural Communities',
					'Urban Areas',
					'Underserved Communities',
					'Opportunity Zones',
				].includes(location)
		)
	);
	const [sortOption, setSortOption] = useState('relevance');
	const [categorySearchQuery, setCategorySearchQuery] = useState('');
	const [stateSearchQuery, setStateSearchQuery] = useState('');

	// Extract all unique tags and categories from opportunities
	useEffect(() => {
		if (opportunities.length > 0) {
			// If we want to use dynamically detected categories instead of taxonomy
			// const allCategories = [...new Set(opportunities.flatMap((opp) => opp.categories || []))];
			// setAvailableCategories(allCategories);
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

				if (filters.categories.length > 0) {
					queryParams.append('categories', filters.categories.join(','));
				}

				if (filters.states.length > 0) {
					queryParams.append('states', filters.states.join(','));
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

			if (type === 'categories' || type === 'states') {
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
			categories: [],
			states: [],
			page: 1,
			page_size: 9,
		});
		setSearchQuery('');
		setCategorySearchQuery('');
		setStateSearchQuery('');
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
			filters.categories.length > 0 ||
			filters.states.length > 0 ||
			searchQuery !== ''
		);
	};

	// Filter categories for search
	const filteredCategories = categorySearchQuery
		? availableCategories.filter((category) =>
				category.toLowerCase().includes(categorySearchQuery.toLowerCase())
		  )
		: availableCategories;

	// Filter states for search
	const filteredStates = stateSearchQuery
		? availableStates.filter((state) =>
				state.toLowerCase().includes(stateSearchQuery.toLowerCase())
		  )
		: availableStates;

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
							{/* Category filter */}
							<div className='relative'>
								<Button
									variant={
										filters.categories.length > 0 ? 'secondary' : 'outline'
									}
									onClick={() => toggleFilterSection('categories')}
									className='flex items-center gap-2'>
									<Briefcase size={16} />
									<span>Categories</span>
									{filters.categories.length > 0 && (
										<span className='ml-1 bg-primary-foreground text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
											{filters.categories.length}
										</span>
									)}
									<ChevronDown size={16} />
								</Button>

								{openFilterSection === 'categories' && (
									<div className='absolute z-10 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-96 overflow-y-auto'>
										{/* Category search */}
										<div className='relative mb-2'>
											<Input
												type='text'
												placeholder='Search categories...'
												value={categorySearchQuery}
												onChange={(e) => setCategorySearchQuery(e.target.value)}
												className='pl-8 py-1 h-8 text-sm'
											/>
											<Search
												size={14}
												className='absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400'
											/>
										</div>
										{filteredCategories.length > 0 ? (
											filteredCategories.map((category) => {
												const categoryColor = getCategoryColor(category);
												return (
													<div
														key={category}
														className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
														onClick={() =>
															handleFilterSelect('categories', category)
														}>
														<input
															type='checkbox'
															className='mr-2'
															checked={filters.categories.includes(category)}
															onChange={() => {}}
														/>
														<span
															className='w-3 h-3 rounded-full mr-2'
															style={{
																backgroundColor: categoryColor.color,
															}}
														/>
														<span>{category}</span>
													</div>
												);
											})
										) : (
											<div className='p-2 text-gray-500'>
												No matching categories
											</div>
										)}
									</div>
								)}
							</div>

							{/* Status filter */}
							<div className='relative'>
								<Button
									variant={filters.status ? 'secondary' : 'outline'}
									onClick={() => toggleFilterSection('status')}
									className='flex items-center gap-2'>
									<Clock size={16} />
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
										{Object.keys(statusIndicator).map((status) => (
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

							{/* State filter */}
							<div className='relative'>
								<Button
									variant={filters.states.length > 0 ? 'secondary' : 'outline'}
									onClick={() => toggleFilterSection('states')}
									className='flex items-center gap-2'>
									<Map size={16} />
									<span>Location</span>
									{filters.states.length > 0 && (
										<span className='ml-1 bg-primary-foreground text-primary text-xs font-medium px-2 py-0.5 rounded-full'>
											{filters.states.length}
										</span>
									)}
									<ChevronDown size={16} />
								</Button>

								{openFilterSection === 'states' && (
									<div className='absolute z-10 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-2 max-h-96 overflow-y-auto'>
										{/* State search */}
										<div className='relative mb-2'>
											<Input
												type='text'
												placeholder='Search states...'
												value={stateSearchQuery}
												onChange={(e) => setStateSearchQuery(e.target.value)}
												className='pl-8 py-1 h-8 text-sm'
											/>
											<Search
												size={14}
												className='absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400'
											/>
										</div>

										{/* National option */}
										<div
											className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer mb-2 border-b border-gray-200'
											onClick={() => handleFilterSelect('states', 'National')}>
											<input
												type='checkbox'
												className='mr-2'
												checked={filters.states.includes('National')}
												onChange={() => {}}
											/>
											<span className='font-medium'>National (All States)</span>
										</div>

										{filteredStates.length > 0 ? (
											filteredStates.map((state) => (
												<div
													key={state}
													className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
													onClick={() => handleFilterSelect('states', state)}>
													<input
														type='checkbox'
														className='mr-2'
														checked={filters.states.includes(state)}
														onChange={() => {}}
													/>
													<span>{state}</span>
												</div>
											))
										) : (
											<div className='p-2 text-gray-500'>
												No matching states
											</div>
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

								{/* Category filters */}
								{filters.categories.map((category) => {
									const categoryColor = getCategoryColor(category);
									return (
										<div
											key={`cat-${category}`}
											className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
											<span
												className='w-2 h-2 rounded-full'
												style={{
													backgroundColor: categoryColor.color,
												}}
											/>
											<span>{category}</span>
											<button
												onClick={() =>
													handleFilterSelect('categories', category)
												}
												className='ml-1'>
												<X size={14} />
											</button>
										</div>
									);
								})}

								{/* State filters */}
								{filters.states.map((state) => (
									<div
										key={`state-${state}`}
										className='flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-sm'>
										<Map size={14} />
										<span>{state}</span>
										<button
											onClick={() => handleFilterSelect('states', state)}
											className='ml-1'>
											<X size={14} />
										</button>
									</div>
								))}

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

'use client';

import { useState, useEffect, useRef } from 'react';
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
	ArrowUp,
	ArrowDown,
	Check,
	ChevronLeft,
	ChevronRight,
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
	open: { color: '#4CAF50', bgColor: '#E8F5E9', display: 'Open' },
	upcoming: { color: '#2196F3', bgColor: '#E3F2FD', display: 'Upcoming' },
	closed: { color: '#9E9E9E', bgColor: '#F5F5F5', display: 'Closed' },
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

// Helper to get status color regardless of case
const getStatusColor = (status) => {
	if (!status) return '#9E9E9E';
	const statusKey = status.toLowerCase();
	return statusIndicator[statusKey]?.color || '#9E9E9E';
};

export default function OpportunitiesPage() {
	const [opportunities, setOpportunities] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [totalCount, setTotalCount] = useState(0);
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
	const [sortDirection, setSortDirection] = useState('desc');
	const [categorySearchQuery, setCategorySearchQuery] = useState('');
	const [stateSearchQuery, setStateSearchQuery] = useState('');
	const [sortMenuOpen, setSortMenuOpen] = useState(false);

	// Create refs for the dropdown containers
	const categoryDropdownRef = useRef(null);
	const statusDropdownRef = useRef(null);
	const stateDropdownRef = useRef(null);
	const filterContainerRef = useRef(null);
	const sortDropdownRef = useRef(null);

	// Add click outside listener to close dropdown
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (
				openFilterSection &&
				filterContainerRef.current &&
				!filterContainerRef.current.contains(event.target)
			) {
				setOpenFilterSection(null);
			}

			if (
				sortMenuOpen &&
				sortDropdownRef.current &&
				!sortDropdownRef.current.contains(event.target)
			) {
				setSortMenuOpen(false);
			}
		};

		// Add escape key listener to close dropdown
		const handleEscapeKey = (event) => {
			if (event.key === 'Escape') {
				if (openFilterSection) {
					setOpenFilterSection(null);
				}
				if (sortMenuOpen) {
					setSortMenuOpen(false);
				}
			}
		};

		// Add event listeners
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscapeKey);

		// Clean up
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscapeKey);
		};
	}, [openFilterSection, sortMenuOpen]);

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

				// Add search query to API request if it exists
				if (searchQuery.trim()) {
					queryParams.append('search', searchQuery.trim());
				}

				queryParams.append('page', filters.page.toString());
				queryParams.append('page_size', filters.page_size.toString());

				// Add sort option
				if (sortOption === 'deadline') {
					queryParams.append('sort_by', 'close_date');
					queryParams.append('sort_direction', sortDirection);
				} else if (sortOption === 'amount') {
					queryParams.append('sort_by', 'maximum_award');
					queryParams.append('sort_direction', sortDirection);
				} else if (sortOption === 'recent') {
					queryParams.append('sort_by', 'posted_date');
					queryParams.append('sort_direction', sortDirection);
				} else {
					// Default to relevance if available
					queryParams.append('sort_by', 'relevance_score');
					queryParams.append('sort_direction', sortDirection);
				}

				// Debug: Log the API URL and filters
				console.log('Current filters:', filters);
				console.log('API URL:', `/api/funding?${queryParams.toString()}`);

				// Fetch data from our API
				const response = await fetch(`/api/funding?${queryParams.toString()}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch opportunities');
				}

				// Log API response for debugging
				console.log('API response:', result);

				setOpportunities(result.data);
				setTotalCount(result.total_count || 0);
			} catch (err) {
				console.error('Error fetching opportunities:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchOpportunities();
	}, [filters, sortOption, sortDirection, searchQuery]);

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
				setTimeout(() => setOpenFilterSection(null), 50);
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

	// Handle sort option change
	const handleSortSelect = (option) => {
		if (option === sortOption) {
			// Toggle direction if same option is selected
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			// Set new option with default direction
			setSortOption(option);
			// Set default direction based on the sort type
			if (option === 'deadline') {
				setSortDirection('asc'); // Soonest deadlines first
			} else {
				setSortDirection('desc'); // Higher values first for other sorts
			}
		}
		// Don't close the dropdown when selecting an option
	};

	// Get display name for sort options
	const getSortDisplayName = (option) => {
		switch (option) {
			case 'relevance':
				return 'Relevance';
			case 'deadline':
				return 'Deadline';
			case 'amount':
				return 'Amount';
			case 'recent':
				return 'Recently added';
			default:
				return 'Relevance';
		}
	};

	// Render the status filter dropdown
	const renderStatusFilter = () => (
		<div className='absolute z-10 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 p-2'>
			{Object.entries(statusIndicator).map(([key, value]) => (
				<div
					key={key}
					className='flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer'
					onClick={() => handleFilterSelect('status', key)}>
					<input
						type='checkbox'
						className='mr-2'
						checked={filters.status === key}
						onChange={() => {}}
					/>
					<span
						className='w-3 h-3 rounded-full mr-2'
						style={{
							backgroundColor: value.color,
						}}
					/>
					<span>{value.display}</span>
				</div>
			))}
		</div>
	);

	// Calculate pagination values
	const totalPages = Math.ceil(totalCount / filters.page_size);
	const startIndex = (filters.page - 1) * filters.page_size;
	const endIndex = Math.min(startIndex + filters.page_size, totalCount);

	// Handle page change
	const handlePageChange = (newPage) => {
		setFilters((prev) => ({
			...prev,
			page: newPage,
		}));
		// Scroll to top when changing pages
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	// Reset to page 1 when filters change (except for page itself)
	useEffect(() => {
		// Store the current filters except page
		const currentFiltersWithoutPage = { ...filters };
		delete currentFiltersWithoutPage.page;

		// Store the previous filters except page
		const prevFiltersWithoutPage = { ...prevFilters.current };
		delete prevFiltersWithoutPage.page;

		// Compare if any filter other than page has changed
		if (
			JSON.stringify(currentFiltersWithoutPage) !==
			JSON.stringify(prevFiltersWithoutPage)
		) {
			setFilters((prev) => ({
				...prev,
				page: 1,
			}));
		}

		// Update previous filters reference
		prevFilters.current = { ...filters };
	}, [filters.status, filters.categories, filters.states, searchQuery]);

	// Track previous filters
	const prevFilters = useRef(filters);

	// Render pagination controls
	const renderPaginationControls = () => {
		return (
			<div className='flex justify-between items-center w-full'>
				<div className='text-sm text-gray-500'>
					{totalCount > 0 ? (
						<>
							Showing {startIndex + 1}-{endIndex} of {totalCount} opportunities
						</>
					) : (
						<>No opportunities found</>
					)}
				</div>
				<div className='flex gap-2'>
					<Button
						variant='outline'
						size='sm'
						disabled={filters.page === 1}
						onClick={() => handlePageChange(filters.page - 1)}>
						<ChevronLeft className='h-4 w-4 mr-1' /> Previous
					</Button>
					<Button
						variant='outline'
						size='sm'
						disabled={filters.page >= totalPages || totalCount === 0}
						onClick={() => handlePageChange(filters.page + 1)}>
						Next <ChevronRight className='h-4 w-4 ml-1' />
					</Button>
				</div>
			</div>
		);
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
						<div className='flex flex-wrap gap-2' ref={filterContainerRef}>
							{/* Category filter */}
							<div className='relative' ref={categoryDropdownRef}>
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
							<div className='relative' ref={statusDropdownRef}>
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

								{openFilterSection === 'status' && renderStatusFilter()}
							</div>

							{/* State filter */}
							<div className='relative' ref={stateDropdownRef}>
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
												backgroundColor: getStatusColor(filters.status),
											}}
										/>
										<span>{formatStatusForDisplay(filters.status)}</span>
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

				{/* Results count, sort, and pagination (top) */}
				<div className='flex flex-col gap-4 mb-4'>
					<div className='flex justify-between items-center'>
						<h2 className='text-lg font-medium text-gray-700'>
							{totalCount} {totalCount === 1 ? 'opportunity' : 'opportunities'}
						</h2>

						<div
							className='flex items-center gap-2 relative'
							ref={sortDropdownRef}>
							<span className='text-sm text-gray-500'>Sort By:</span>
							<Button
								variant='outline'
								className='flex items-center gap-1 h-8 px-3'
								onClick={() => setSortMenuOpen(!sortMenuOpen)}>
								{getSortDisplayName(sortOption)}
								{sortDirection === 'asc' ? (
									<ArrowUp size={14} className='ml-1' />
								) : (
									<ArrowDown size={14} className='ml-1' />
								)}
							</Button>

							{sortMenuOpen && (
								<div className='absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg z-10 border border-gray-200 py-1'>
									<div className='p-2 text-sm text-gray-500 border-b border-gray-100'>
										Sort By
									</div>
									<div className='py-1'>
										<div
											className={`flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer ${
												sortOption === 'relevance' ? 'bg-blue-50' : ''
											}`}
											onClick={() => handleSortSelect('relevance')}>
											<span>Relevance</span>
											<div>
												{sortOption === 'relevance' &&
													(sortDirection === 'asc' ? (
														<ArrowUp size={14} className='text-gray-600' />
													) : (
														<ArrowDown size={14} className='text-gray-600' />
													))}
											</div>
										</div>

										<div
											className={`flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer ${
												sortOption === 'deadline' ? 'bg-blue-50' : ''
											}`}
											onClick={() => handleSortSelect('deadline')}>
											<span>Deadline</span>
											<div>
												{sortOption === 'deadline' &&
													(sortDirection === 'asc' ? (
														<ArrowUp size={14} className='text-gray-600' />
													) : (
														<ArrowDown size={14} className='text-gray-600' />
													))}
											</div>
										</div>

										<div
											className={`flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer ${
												sortOption === 'amount' ? 'bg-blue-50' : ''
											}`}
											onClick={() => handleSortSelect('amount')}>
											<span>Amount</span>
											<div>
												{sortOption === 'amount' &&
													(sortDirection === 'asc' ? (
														<ArrowUp size={14} className='text-gray-600' />
													) : (
														<ArrowDown size={14} className='text-gray-600' />
													))}
											</div>
										</div>

										<div
											className={`flex justify-between items-center px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer ${
												sortOption === 'recent' ? 'bg-blue-50' : ''
											}`}
											onClick={() => handleSortSelect('recent')}>
											<span>Recently added</span>
											<div>
												{sortOption === 'recent' &&
													(sortDirection === 'asc' ? (
														<ArrowUp size={14} className='text-gray-600' />
													) : (
														<ArrowDown size={14} className='text-gray-600' />
													))}
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Top pagination controls */}
					{renderPaginationControls()}
				</div>

				{/* Loading, error, and no results states */}
				{loading ? (
					<div className='flex justify-center items-center py-12'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700' />
					</div>
				) : error ? (
					<div className='bg-red-50 border border-red-200 rounded-md p-4 mb-6'>
						<p className='text-red-800 font-medium'>
							Error loading opportunities: {error}
						</p>
						<button
							className='mt-2 px-4 py-2 bg-red-100 text-red-800 rounded-md'
							onClick={() => {
								setError(null);
								setFilters({ ...filters });
							}}>
							Try Again
						</button>
					</div>
				) : opportunities.length === 0 ? (
					<div className='bg-gray-50 border border-gray-200 rounded-md p-6 text-center'>
						<p className='text-gray-700 mb-2'>No opportunities found.</p>
						{hasActiveFilters() && (
							<p className='text-gray-500 text-sm'>
								Try adjusting your filters or{' '}
								<button
									className='text-blue-600 hover:underline'
									onClick={clearAllFilters}>
									clear all filters
								</button>
								.
							</p>
						)}
					</div>
				) : (
					<>
						{/* Display opportunities in a grid */}
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6'>
							{opportunities.map((opportunity) => (
								<OpportunityCard
									key={opportunity.id}
									opportunity={opportunity}
								/>
							))}
						</div>

						{/* Bottom pagination controls */}
						{renderPaginationControls()}
					</>
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

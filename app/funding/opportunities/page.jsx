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
import { classNames } from '@/app/lib/utils';

// Helper function to get a consistent color for a category
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

// Status indicator styling
const statusIndicator = {
	open: 'Open',
	upcoming: 'Upcoming',
	closed: 'Closed',
};

// Helper to format status for display
const formatStatusForDisplay = (status) => {
	return statusIndicator[status] || status;
};

// Get appropriate color for status - updated to match OpportunityCard colors
const getStatusColor = (status) => {
	if (!status) return '#9E9E9E';

	const statusColors = {
		open: '#4CAF50', // green - matches card
		upcoming: '#2196F3', // blue - matches card
		closed: '#9E9E9E', // gray - matches card
	};

	const statusKey = status.toLowerCase();
	return statusColors[statusKey] || '#9E9E9E'; // default to gray
};

// Format category for display - handles "Other: Description" format
const formatCategoryForDisplay = (category) => {
	// If the category starts with "Other: ", extract just the description part
	if (category && category.startsWith('Other: ')) {
		return category.substring(7); // Remove "Other: " prefix
	}
	return category;
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
	const [categorySearchInput, setCategorySearchInput] = useState('');
	const [stateSearchInput, setStateSearchInput] = useState('');
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

	// Extract unique categories from opportunities and combine with taxonomy
	useEffect(() => {
		if (opportunities.length > 0) {
			// Extract all unique categories from opportunities
			const dynamicCategories = [
				...new Set(
					opportunities.flatMap((opportunity) =>
						opportunity.categories ? opportunity.categories : []
					)
				),
			];

			// Combine with taxonomy categories (avoiding duplicates)
			const taxonomyCategories = TAXONOMIES.CATEGORIES;
			const allCategories = [
				...new Set([...taxonomyCategories, ...dynamicCategories]),
			];

			// Sort alphabetically for better usability
			allCategories.sort();

			// Update state with combined list
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
					queryParams.append('sort_by', 'updated_at');
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
		setCategorySearchInput('');
		setStateSearchInput('');
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
	const filteredCategories = categorySearchInput
		? availableCategories.filter((category) =>
				category.toLowerCase().includes(categorySearchInput.toLowerCase())
		  )
		: availableCategories;

	// Filter states for search
	const filteredStates = stateSearchInput
		? availableStates.filter((state) =>
				state.toLowerCase().includes(stateSearchInput.toLowerCase())
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
	const renderStatusFilter = () => {
		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('status')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'status'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							openFilterSection === 'status' && filters.status
								? 'bg-blue-100'
								: ''
						)}>
						{filters.status
							? `Status: ${formatStatusForDisplay(filters.status)}`
							: 'Status'}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'status' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'status' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-48 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={statusDropdownRef}>
						<div className='p-4'>
							{Object.entries(statusIndicator).map(([key, value]) => (
								<div
									key={key}
									className='flex items-center py-1 cursor-pointer hover:bg-gray-50'
									onClick={() => handleFilterSelect('status', key)}>
									<div className='flex items-center'>
										<input
											type='checkbox'
											className='mr-2'
											checked={filters.status === key}
											readOnly
										/>
										<span
											className='w-3 h-3 rounded-full mr-2'
											style={{
												backgroundColor: getStatusColor(key),
											}}
										/>
										<span className='text-sm'>{value}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

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

	// Render the category filter dropdown
	const renderCategoryFilter = () => {
		// Filter visible categories based on search input
		const filteredCategories = (availableCategories || []).filter((category) =>
			category.toLowerCase().includes(categorySearchInput.toLowerCase())
		);

		// Count selected categories for display
		const selectedCount = filters.categories.length;
		const displayText =
			selectedCount > 0 ? `Categories (${selectedCount})` : 'Categories';

		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('categories')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'categories'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							openFilterSection === 'categories' &&
								filters.categories.length > 0
								? 'bg-blue-100'
								: ''
						)}>
						{displayText}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'categories' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'categories' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-64 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={categoryDropdownRef}>
						<div className='p-4'>
							{/* Search input */}
							<div className='mb-4'>
								<div className='relative'>
									<Search
										className='absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400'
										size={16}
									/>
									<input
										type='text'
										className='w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm'
										placeholder='Search categories...'
										value={categorySearchInput}
										onChange={(e) => setCategorySearchInput(e.target.value)}
									/>
									{categorySearchInput && (
										<X
											className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer'
											size={16}
											onClick={() => setCategorySearchInput('')}
										/>
									)}
								</div>
							</div>

							{/* All categories */}
							<div className='max-h-60 overflow-y-auto'>
								{filteredCategories.map((category) => {
									const isSelected = filters.categories.includes(category);
									const categoryColor = getCategoryColor(category);
									return (
										<div
											key={category}
											className='flex items-center py-1 cursor-pointer hover:bg-gray-50'
											onClick={() =>
												handleFilterSelect('categories', category)
											}>
											<div className='flex items-center'>
												<input
													type='checkbox'
													className='mr-2'
													checked={isSelected}
													readOnly
												/>
												<span
													className='w-3 h-3 rounded-full mr-2'
													style={{ backgroundColor: categoryColor.color }}
												/>
												<span className='text-sm'>
													{formatCategoryForDisplay(category)}
												</span>
											</div>
										</div>
									);
								})}
							</div>

							{/* No results */}
							{filteredCategories.length === 0 && (
								<div className='py-3 text-center text-sm text-gray-500'>
									No categories found
								</div>
							)}

							{/* Clear selections button if any selected */}
							{filters.categories.length > 0 && (
								<div className='mt-4 pt-3 border-t border-gray-200 flex justify-end'>
									<Button
										variant='link'
										size='sm'
										className='text-blue-600 hover:text-blue-800'
										onClick={() => {
											setFilters({ ...filters, categories: [], page: 1 });
										}}>
										Clear selections
									</Button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		);
	};

	// Render state filter dropdown
	const renderStateFilter = () => {
		// Count selected states for display
		const selectedCount = filters.states.length;
		const displayText =
			selectedCount > 0 ? `Locations (${selectedCount})` : 'Locations';

		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('states')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'states'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							openFilterSection === 'states' && filters.states.length > 0
								? 'bg-blue-100'
								: ''
						)}>
						{displayText}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'states' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'states' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-64 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={stateDropdownRef}>
						<div className='p-4'>
							{/* Search input */}
							<div className='mb-4'>
								<div className='relative'>
									<Search
										className='absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400'
										size={16}
									/>
									<input
										type='text'
										className='w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm'
										placeholder='Search locations...'
										value={stateSearchInput}
										onChange={(e) => setStateSearchInput(e.target.value)}
									/>
									{stateSearchInput && (
										<X
											className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer'
											size={16}
											onClick={() => setStateSearchInput('')}
										/>
									)}
								</div>
							</div>

							{/* National option */}
							<div
								className='flex items-center py-1 cursor-pointer hover:bg-gray-50 mb-2 border-b border-gray-200 pb-2'
								onClick={() => handleFilterSelect('states', 'National')}>
								<div className='flex items-center'>
									<input
										type='checkbox'
										className='mr-2'
										checked={filters.states.includes('National')}
										readOnly
									/>
									<span className='text-sm font-medium'>
										National (All States)
									</span>
								</div>
							</div>

							{/* State list */}
							<div className='max-h-60 overflow-y-auto'>
								{filteredStates.map((state) => (
									<div
										key={state}
										className='flex items-center py-1 cursor-pointer hover:bg-gray-50'
										onClick={() => handleFilterSelect('states', state)}>
										<div className='flex items-center'>
											<input
												type='checkbox'
												className='mr-2'
												checked={filters.states.includes(state)}
												readOnly
											/>
											<span className='text-sm'>{state}</span>
										</div>
									</div>
								))}
							</div>

							{/* No results */}
							{filteredStates.length === 0 && (
								<div className='py-3 text-center text-sm text-gray-500'>
									No locations found
								</div>
							)}

							{/* Clear selections button if any selected */}
							{filters.states.length > 0 && (
								<div className='mt-4 pt-3 border-t border-gray-200 flex justify-end'>
									<Button
										variant='link'
										size='sm'
										className='text-blue-600 hover:text-blue-800'
										onClick={() => {
											setFilters({ ...filters, states: [], page: 1 });
										}}>
										Clear selections
									</Button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		);
	};

	// Render active filters
	const renderActiveFilters = () => {
		if (!hasActiveFilters()) return null;

		return (
			<div className='flex flex-wrap gap-2 mt-4 py-2 border-t border-gray-100'>
				<span className='text-sm text-gray-500 mr-1'>Active filters:</span>

				{/* Status filter */}
				{filters.status && (
					<span
						className='flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs font-medium'
						style={{
							backgroundColor: getStatusColor(filters.status),
							color: 'white',
						}}>
						{formatStatusForDisplay(filters.status)}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => setFilters({ ...filters, status: null, page: 1 })}
						/>
					</span>
				)}

				{/* Category filters */}
				{filters.categories.map((category) => {
					const categoryColor = getCategoryColor(category);
					return (
						<span
							key={category}
							className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
							style={{
								backgroundColor: categoryColor.bgColor,
								color: categoryColor.color,
							}}>
							{formatCategoryForDisplay(category)}
							<X
								size={14}
								className='cursor-pointer'
								onClick={() => {
									const updatedCategories = filters.categories.filter(
										(c) => c !== category
									);
									setFilters({
										...filters,
										categories: updatedCategories,
										page: 1,
									});
								}}
							/>
						</span>
					);
				})}

				{/* State filters */}
				{filters.states.map((state) => (
					<span
						key={state}
						className='flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium'>
						{state}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								const updatedStates = filters.states.filter((s) => s !== state);
								setFilters({
									...filters,
									states: updatedStates,
									page: 1,
								});
							}}
						/>
					</span>
				))}

				{/* Search query */}
				{searchQuery && (
					<span className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
						Search: {searchQuery}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => setSearchQuery('')}
						/>
					</span>
				)}

				{/* Clear all */}
				<button
					className='text-blue-600 hover:underline text-xs font-medium ml-2'
					onClick={clearAllFilters}>
					Clear all
				</button>
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
							{renderCategoryFilter()}

							{/* Status filter */}
							{renderStatusFilter()}

							{/* State filter */}
							{renderStateFilter()}
						</div>
					</div>

					{/* Active filters */}
					{renderActiveFilters()}
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

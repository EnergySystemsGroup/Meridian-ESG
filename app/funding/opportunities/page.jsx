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
	Star,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';
import TAXONOMIES from '@/app/lib/constants/taxonomies';
import OpportunityCard from '@/app/components/opportunities/OpportunityCard';
import { classNames } from '@/app/lib/utils';
import { useTrackedOpportunities } from '@/app/hooks/useTrackedOpportunities';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

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
	const [loading, setLoading] = useState(false); // Internal fetch loading state
	const [isPageLoading, setIsPageLoading] = useState(true); // Overall page load state
	const [error, setError] = useState(null);
	const [totalCount, setTotalCount] = useState(0);
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
	const [openFilterSection, setOpenFilterSection] = useState(null);
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	// Initialize filter state directly from URL params
	// This avoids a useEffect and potential extra render
	const initialFilters = {
		status: null,
		categories: [],
		states: [],
		page: 1,
		page_size: 9,
		tracked: searchParams.get('tracked') === 'true',
	};

	const [filters, setFilters] = useState(initialFilters);

	const [availableTags, setAvailableTags] = useState([]);
	const [availableCategories, setAvailableCategories] = useState([]);
	const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
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

	// Use our custom hook for tracking opportunities
	const {
		trackedOpportunityIds,
		trackedCount,
		isInitialized,
		isTracked,
		toggleTracked,
	} = useTrackedOpportunities();

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

	// Add a new effect to fetch all categories on component mount
	useEffect(() => {
		async function fetchAllCategories() {
			try {
				setIsCategoriesLoading(true);
				const response = await fetch('/api/categories');
				const result = await response.json();

				if (result.success) {
					setAvailableCategories(result.data);
					console.log('Loaded all available categories:', result.data.length);
				} else {
					console.error('Error fetching categories:', result.error);
				}
			} catch (err) {
				console.error('Failed to fetch categories:', err);
			} finally {
				setIsCategoriesLoading(false);
			}
		}

		fetchAllCategories();
	}, []); // Empty dependency array - only run once on mount

	// Debounce search query
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
			// Reset page to 1 when the actual search query changes
			setFilters((prev) => ({ ...prev, page: 1 }));
		}, 500); // 500ms delay

		// Cleanup function to clear the timeout if the user types again quickly
		return () => {
			clearTimeout(handler);
		};
	}, [searchQuery]); // Only re-run the effect if searchQuery changes

	// Log whenever filters change
	useEffect(() => {
		console.log('[Debug Tracking] Filters state changed:', filters);
	}, [filters]);

	// Log when isInitialized changes
	useEffect(() => {
		console.log('[Debug Tracking] isInitialized state changed:', isInitialized);
	}, [isInitialized]);

	useEffect(() => {
		async function fetchOpportunities() {
			// Wait until context is initialized before fetching
			if (!isInitialized) {
				console.log('[Debug Init] Fetch skipped: Context not initialized.');
				// Don't set isPageLoading false yet, wait for initialization
				return;
			}

			try {
				setLoading(true); // Indicate internal fetch is running
				// Don't set isPageLoading here - it's already true initially

				console.log('[Debug Tracking] Fetching opportunities...');
				console.log('[Debug Tracking] isInitialized:', isInitialized);
				console.log('[Debug Tracking] Current filters:', filters);

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

				// Add debounced search query to API request if it exists
				if (debouncedSearchQuery.trim()) {
					queryParams.append('search', debouncedSearchQuery.trim());
				}

				queryParams.append('page', filters.page.toString());
				queryParams.append('page_size', filters.page_size.toString());

				// Add sort option
				if (sortOption === 'deadline') {
					queryParams.append('sort_by', 'close_date');
					queryParams.append('sort_direction', sortDirection);
				} else if (sortOption === 'amount') {
					// Send 'amount' to trigger the backend RPC logic
					queryParams.append('sort_by', 'amount');
					queryParams.append('sort_direction', sortDirection);
				} else if (sortOption === 'recent') {
					queryParams.append('sort_by', 'updated_at');
					queryParams.append('sort_direction', sortDirection);
				} else {
					// Default to relevance, send 'relevance'
					queryParams.append('sort_by', 'relevance');
					queryParams.append('sort_direction', sortDirection);
				}

				// Add tracked IDs filter if tracked filter is on
				if (filters.tracked && isInitialized) {
					console.log(
						'[Debug Tracking] Tracked filter ON. isInitialized:',
						isInitialized,
						'Tracked IDs:',
						trackedOpportunityIds
					);
					console.log(
						'[Debug Tracking] Appending trackedIds to queryParams:',
						trackedOpportunityIds.join(',')
					);
					if (trackedOpportunityIds.length > 0) {
						queryParams.append('trackedIds', trackedOpportunityIds.join(','));
					}
				}

				// console.log('Current filters:', filters); // Replaced by more specific logs
				console.log(
					'[Debug Tracking] Final API URL:',
					`/api/funding?${queryParams.toString()}`
				);

				// Fetch data from our API
				const response = await fetch(`/api/funding?${queryParams.toString()}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch opportunities');
				}

				// Log API response for debugging
				console.log('[Debug Tracking] API Response:', result);

				// If trackedIds is used but no opportunities match (empty array),
				// we handle this edge case by showing no results
				setOpportunities(result.data);
				setTotalCount(result.total_count || 0);
				console.log(
					'[Debug Tracking] State after API call: Opportunities Count =',
					result.data?.length,
					'Total Count =',
					result.total_count || 0
				);
			} catch (err) {
				console.error('Error fetching opportunities:', err);
				console.error('[Debug Tracking] Error in fetchOpportunities:', err);
				setError(err.message);
			} finally {
				setLoading(false); // Internal fetch finished
				setIsPageLoading(false); // *Now* the overall page load is complete
			}
		}

		fetchOpportunities();
	}, [filters, sortOption, sortDirection, debouncedSearchQuery, isInitialized]);

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
			tracked: false,
		});
		setSearchQuery('');
		setCategorySearchInput('');
		setStateSearchInput('');

		// Clear URL parameters
		router.replace(pathname, { scroll: false });
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

	// Toggle tracked opportunities filter
	const toggleTrackedFilter = () => {
		// Get the current tracked state
		const currentlyTracked = filters.tracked;

		setFilters((prevFilters) => ({
			...prevFilters,
			tracked: !currentlyTracked,
			page: 1, // Reset to first page when toggling filter
		}));

		// Update URL when toggling the filter
		const params = new URLSearchParams(searchParams.toString());
		if (currentlyTracked) {
			// If currently tracked, remove the tracked parameter
			params.delete('tracked');
		} else {
			// If not currently tracked, add the tracked parameter
			params.set('tracked', 'true');
		}

		// Use Next.js router to update URL without reloading the page
		const newUrl = params.toString()
			? `${pathname}?${params.toString()}`
			: pathname;
		router.replace(newUrl, { scroll: false });
	};

	// Render tracked opportunities filter button
	const renderTrackedFilter = () => {
		return (
			<div className='relative'>
				<Button
					variant={filters.tracked ? 'default' : 'outline'}
					className={`flex items-center px-4 py-2 text-sm ${
						filters.tracked
							? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500'
							: 'border-amber-300 text-amber-700 hover:bg-amber-50'
					}`}
					onClick={toggleTrackedFilter}>
					<Star
						className={`mr-1 h-4 w-4 ${
							filters.tracked ? 'fill-white' : 'fill-amber-500'
						}`}
					/>
					My Opportunities {trackedCount > 0 && `(${trackedCount})`}
				</Button>
			</div>
		);
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
	}, [
		filters.status,
		filters.categories,
		filters.states,
		debouncedSearchQuery,
	]);

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

							{/* Loading indicator for categories */}
							{isCategoriesLoading && (
								<div className='py-3 text-center text-sm text-gray-500'>
									<div className='inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2'></div>
									Loading categories...
								</div>
							)}

							{/* All categories */}
							{!isCategoriesLoading && (
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
							)}

							{/* No results */}
							{!isCategoriesLoading && filteredCategories.length === 0 && (
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
			<div className='flex flex-wrap items-center mt-4 text-xs gap-2'>
				<span className='text-neutral-500 font-medium'>Active filters:</span>

				{/* Tracked filter */}
				{filters.tracked && (
					<span className='flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium'>
						My Opportunities
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								setFilters({
									...filters,
									tracked: false,
									page: 1,
								});

								// Update URL by removing the tracked parameter
								const params = new URLSearchParams(searchParams.toString());
								params.delete('tracked');

								// Use Next.js router to update URL without reloading the page
								const newUrl = params.toString()
									? `${pathname}?${params.toString()}`
									: pathname;
								router.replace(newUrl, { scroll: false });
							}}
						/>
					</span>
				)}

				{/* Status filter */}
				{filters.status && (
					<span
						className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
						style={{
							backgroundColor: 'white',
							color: getStatusColor(filters.status),
							borderWidth: '1px',
							borderStyle: 'solid',
							borderColor: getStatusColor(filters.status) + '50',
						}}>
						Status: {filters.status}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								setFilters({
									...filters,
									status: null,
									page: 1,
								});
							}}
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
				{debouncedSearchQuery && (
					<span className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
						Search: {debouncedSearchQuery}
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

	// Check if any filters are applied
	const hasActiveFilters = () => {
		return (
			filters.status !== null ||
			filters.categories.length > 0 ||
			filters.states.length > 0 ||
			debouncedSearchQuery !== '' ||
			filters.tracked
		);
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Funding Opportunities</h1>
					<div className='flex gap-2'>
						{/* Export functionality will be implemented later
						<Button variant='outline' onClick={handleExport}>
							<Download size={16} className='mr-2' />
							Export
						</Button>
						*/}
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
							{/* Tracked opportunities filter */}
							{renderTrackedFilter()}

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
				{isPageLoading ? (
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
							{/* Use opportunities directly */}
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

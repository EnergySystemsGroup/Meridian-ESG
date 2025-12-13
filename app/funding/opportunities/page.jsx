'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { calculateDaysLeft, determineStatus } from '@/lib/supabase';
import TAXONOMIES from '@/lib/constants/taxonomies';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import { classNames } from '@/lib/utils';
import { useTrackedOpportunities } from '@/hooks/useTrackedOpportunities';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
	getProjectTypeColor,
} from '@/lib/utils/uiHelpers';

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

// Get appropriate color for status - updated to match map view colors
const getStatusColor = (status) => {
	if (!status) return '#9E9E9E';

	const statusColors = {
		open: '#2563EB', // updated blue for open status to match badge primary color
		upcoming: '#4CAF50', // green for upcoming status
		closed: '#EF4444', // red for closed status
	};

	const statusKey = status.toLowerCase();
	return statusColors[statusKey] || '#9E9E9E'; // default to gray
};

export default function OpportunitiesPage() {
	return (
		<Suspense
			fallback={
				<MainLayout>
					<div className='container py-10'>
						<div className='flex justify-center items-center py-12'>
							<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700' />
						</div>
					</div>
				</MainLayout>
			}>
			<OpportunitiesContent />
		</Suspense>
	);
}

function OpportunitiesContent() {
	const [opportunities, setOpportunities] = useState([]);
	const [loading, setLoading] = useState(false); // Internal fetch loading state
	const [isPageLoading, setIsPageLoading] = useState(true); // Overall page load state
	const [error, setError] = useState(null);
	const [totalCount, setTotalCount] = useState(0);
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	// Default coverage types (all checked except unknown)
	const defaultCoverageTypes = ['national', 'state', 'local'];

	// Initialize filter state directly from URL params
	// This avoids a useEffect and potential extra render
	const initialFilters = {
		status: searchParams.get('status') || null,
		projectTypes: searchParams.get('projectTypes') ? searchParams.get('projectTypes').split(',') : [],
		state: searchParams.get('state') || null, // Single state code
		coverageTypes: searchParams.get('coverage_types')
			? searchParams.get('coverage_types').split(',')
			: defaultCoverageTypes, // Default to all except unknown
		page: parseInt(searchParams.get('page')) || 1,
		page_size: 9,
		tracked: searchParams.get('tracked') === 'true',
	};

	const [filters, setFilters] = useState(initialFilters);
	const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('search') || '');
	const [openFilterSection, setOpenFilterSection] = useState(null);

	const [projectTypesApiResponse, setProjectTypesApiResponse] = useState(null);
	const [availableProjectTypes, setAvailableProjectTypes] = useState([]);
	const [isProjectTypesLoading, setIsProjectTypesLoading] = useState(true);
	// Use US_STATES from taxonomies for state dropdown
	const usStates = TAXONOMIES.US_STATES;
	// Initialize sort options from URL parameters
	const [sortOption, setSortOption] = useState(
		searchParams.get('sort') || 'relevance'
	);
	const [sortDirection, setSortDirection] = useState(
		searchParams.get('sort_direction') || 'desc'
	);
	const [projectTypeSearchInput, setProjectTypeSearchInput] = useState('');
	const [sortMenuOpen, setSortMenuOpen] = useState(false);

	// Create refs for the dropdown containers
	const projectTypeDropdownRef = useRef(null);
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

	// Coverage counts for filter display
	const [coverageCounts, setCoverageCounts] = useState({
		national: null,
		state: null,
		local: null,
		unknown: null
	});

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

	// Fetch available project types with counts - updates based on current filters
	useEffect(() => {
		async function fetchProjectTypes() {
			try {
				setIsProjectTypesLoading(true);

				// Build query params to pass current filters
				const params = new URLSearchParams();
				if (filters.status) {
					params.append('status', filters.status);
				}
				if (filters.state) {
					params.append('state', filters.state);
				}
				if (filters.coverageTypes && filters.coverageTypes.length > 0) {
					params.append('coverage_types', filters.coverageTypes.join(','));
				}

				const url = `/api/project-types${params.toString() ? `?${params}` : ''}`;
				const response = await fetch(url);
				const result = await response.json();

				if (result.success) {
					setProjectTypesApiResponse(result);
					setAvailableProjectTypes(result.projectTypes);
					console.log(
						'Loaded project types:',
						result.projectTypes.length,
						filters.status ? `[status: ${filters.status}]` : '',
						filters.state ? `[state: ${filters.state}]` : ''
					);
				} else {
					console.error('Error fetching project types:', result.error);
				}
			} catch (err) {
				console.error('Failed to fetch project types:', err);
			} finally {
				setIsProjectTypesLoading(false);
			}
		}

		fetchProjectTypes();
	}, [filters.status, filters.state, filters.coverageTypes]); // Refetch when filters change

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
	}, [searchQuery, sortOption, sortDirection]); // Only re-run the effect if searchQuery changes

	// Log whenever filters change
	useEffect(() => {
		console.log('[Debug Tracking] Filters state changed:', filters);
	}, [filters]);

	// Fetch coverage counts when state filter changes
	useEffect(() => {
		async function fetchCoverageCounts() {
			try {
				const params = new URLSearchParams();
				if (filters.state) {
					params.append('state', filters.state);
				}

				const response = await fetch(`/api/funding/coverage-counts?${params}`);
				const result = await response.json();
				if (result.success) {
					setCoverageCounts(result.counts);
				}
			} catch (err) {
				console.error('Failed to fetch coverage counts:', err);
			}
		}
		fetchCoverageCounts();
	}, [filters.state]);

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

				// Add project types filter
				if (filters.projectTypes && filters.projectTypes.length > 0) {
					queryParams.append('projectTypes', filters.projectTypes.join(','));
				}

				// Add state filter (single state code)
				if (filters.state) {
					queryParams.append('state', filters.state);
				}

				// Add coverage types filter
				if (filters.coverageTypes && filters.coverageTypes.length > 0) {
					queryParams.append('coverage_types', filters.coverageTypes.join(','));
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
					// Always send trackedIds parameter when tracked filter is on
					// This ensures the API knows to filter to tracked opportunities only,
					// even if the list is empty (which should return no results)
					queryParams.append('trackedIds', trackedOpportunityIds.join(','));
				}

				// console.log('Current filters:', filters); // Replaced by more specific logs
				console.log(
					'[Debug Tracking] Final API URL:',
					`/api/funding?${queryParams.toString()}`
				);

				// Fetch data from our API
				const response = await fetch(`/api/funding?${queryParams.toString()}`);

				if (!response.ok) {
					console.error(`API request failed: ${response.status} ${response.statusText}`);
					console.error('Request URL:', `/api/funding?${queryParams.toString()}`);
					throw new Error(`API request failed: ${response.status} ${response.statusText}`);
				}

				// Check if response is JSON
				const contentType = response.headers.get('content-type');
				if (!contentType || !contentType.includes('application/json')) {
					console.error('Response is not JSON:', contentType);
					console.error('Request URL:', `/api/funding?${queryParams.toString()}`);
					throw new Error(`API returned non-JSON response: ${contentType}`);
				}

				let result;
				try {
					result = await response.json();
				} catch (jsonError) {
					console.error('Failed to parse JSON response:', jsonError);
					console.error('Response status:', response.status);
					console.error('Response headers:', Object.fromEntries(response.headers.entries()));
					console.error('Request URL:', `/api/funding?${queryParams.toString()}`);
					throw new Error(`Invalid JSON response from API: ${jsonError.message}`);
				}

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
	}, [
		filters,
		sortOption,
		sortDirection,
		debouncedSearchQuery,
		isInitialized,
	]);

	// Update URL parameters based on current filters and sort
	const updateUrlParams = useCallback((newFilters = filters, newSort = sortOption, newSortDirection = sortDirection, newSearchQuery = searchQuery) => {
		const params = new URLSearchParams();

		// Add search query
		if (newSearchQuery && newSearchQuery.trim()) {
			params.set('search', newSearchQuery.trim());
		}

		// Add status filter
		if (newFilters.status) {
			params.set('status', newFilters.status);
		}

		// Add project types filter
		if (newFilters.projectTypes && newFilters.projectTypes.length > 0) {
			params.set('projectTypes', newFilters.projectTypes.join(','));
		}

		// Add state filter (single state)
		if (newFilters.state) {
			params.set('state', newFilters.state);
		}

		// Add coverage types filter (only if different from default)
		if (newFilters.coverageTypes && newFilters.coverageTypes.length > 0) {
			const defaultTypes = ['national', 'state', 'local'];
			const isDefault = newFilters.coverageTypes.length === defaultTypes.length &&
				defaultTypes.every(t => newFilters.coverageTypes.includes(t));
			if (!isDefault) {
				params.set('coverage_types', newFilters.coverageTypes.join(','));
			}
		}

		// Add tracked filter
		if (newFilters.tracked) {
			params.set('tracked', 'true');
		}

		// Add sort parameters (only if not default)
		if (newSort && newSort !== 'relevance') {
			params.set('sort', newSort);
		}
		if (newSortDirection && newSortDirection !== 'desc') {
			params.set('sort_direction', newSortDirection);
		}

		// Add pagination (only if not first page)
		if (newFilters.page && newFilters.page > 1) {
			params.set('page', newFilters.page.toString());
		}

		// Update URL without triggering a page reload
		const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

		// Use setTimeout to prevent router updates during render
		setTimeout(() => {
			router.replace(newUrl, { scroll: false });
		}, 0);
	}, [filters, sortOption, sortDirection, searchQuery, pathname, router]);

	// Sync URL when filters, sort, or search change
	useEffect(() => {
		if (isInitialized) {
			updateUrlParams();
		}
	}, [filters, sortOption, sortDirection, searchQuery, isInitialized, updateUrlParams]);

	// Toggle filter section
	const toggleFilterSection = (section) => {
		setOpenFilterSection(openFilterSection === section ? null : section);
	};

	// Handle filter selection
	const handleFilterSelect = (type, value) => {
		setFilters((prev) => {
			const newFilters = { ...prev };

			if (type === 'projectTypes' || type === 'states') {
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
			projectTypes: [],
			state: null,
			coverageTypes: defaultCoverageTypes,
			page: 1,
			page_size: 9,
			tracked: false,
		});
		setSearchQuery('');
		setProjectTypeSearchInput('');

		// Clear URL parameters
		setTimeout(() => {
			router.replace(pathname, { scroll: false });
		}, 0);
	};

	// Filter project types for search
	const filteredProjectTypes = projectTypeSearchInput
		? availableProjectTypes.filter((type) =>
				type.toLowerCase().includes(projectTypeSearchInput.toLowerCase())
		  )
		: availableProjectTypes;

	// Handle export functionality
	const handleExport = () => {
		// Export functionality would be implemented here
		alert('Export functionality will be implemented here');
	};

	// Handle sort option change
	const handleSortSelect = (option) => {
		let newSort = option;
		let newDirection = sortDirection;
		
		if (option === sortOption) {
			// Toggle direction if same option is selected
			newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			setSortDirection(newDirection);
		} else {
			// Set new option with default direction
			setSortOption(newSort);
			// Set default direction based on the sort type
			if (option === 'deadline') {
				newDirection = 'asc'; // Soonest deadlines first
			} else {
				newDirection = 'desc'; // Higher values first for other sorts
			}
			setSortDirection(newDirection);
		}
		
		// Update URL with new sort params
		updateUrlParams(filters, newSort, newDirection);
		
		// Close the dropdown
		setSortMenuOpen(false);
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

		// URL will be updated automatically by the URL sync useEffect
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
		setFilters((prev) => {
			const newFilters = {
				...prev,
				page: newPage,
			};
			// Update URL with new page
			updateUrlParams(newFilters);
			return newFilters;
		});
		// Scroll to top when changing pages
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	// Track previous filters
	const prevFilters = useRef(filters);

	// Update previous filters reference for comparison
	useEffect(() => {
		prevFilters.current = { ...filters };
	}, [filters]);

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

	// Render the project types filter dropdown
	const renderProjectTypeFilter = () => {
		// Count selected project types for display
		const selectedCount = filters.projectTypes.length;
		const displayText =
			selectedCount > 0 ? `Project Types (${selectedCount})` : 'Project Types';

		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('projectTypes')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'projectTypes'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							openFilterSection === 'projectTypes' &&
								filters.projectTypes.length > 0
								? 'bg-blue-100'
								: ''
						)}>
						{displayText}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'projectTypes' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'projectTypes' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-80 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={projectTypeDropdownRef}>
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
										placeholder='Search project types...'
										value={projectTypeSearchInput}
										onChange={(e) => setProjectTypeSearchInput(e.target.value)}
									/>
									{projectTypeSearchInput && (
										<X
											className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer'
											size={16}
											onClick={() => setProjectTypeSearchInput('')}
										/>
									)}
								</div>
							</div>

							{/* Loading indicator */}
							{isProjectTypesLoading && (
								<div className='py-3 text-center text-sm text-gray-500'>
									<div className='inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2'></div>
									Loading project types...
								</div>
							)}

							{/* All project types */}
							{!isProjectTypesLoading && (
								<div className='max-h-60 overflow-y-auto'>
									{filteredProjectTypes.map((projectType) => {
										const isSelected = filters.projectTypes.includes(projectType);
										const typeColor = getProjectTypeColor(projectType);
										const count =
											projectTypesApiResponse?.projectTypeGroups?.[projectType]
												?.count || 0;
										return (
											<div
												key={projectType}
												className='flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50'
												onClick={() =>
													handleFilterSelect('projectTypes', projectType)
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
														style={{ backgroundColor: typeColor.color }}
													/>
													<span className='text-sm'>
														{projectType}
													</span>
												</div>
												<span className='text-xs text-gray-500 ml-1'>
													{count}
												</span>
											</div>
										);
									})}
								</div>
							)}

							{/* No results */}
							{!isProjectTypesLoading && filteredProjectTypes.length === 0 && (
								<div className='py-3 text-center text-sm text-gray-500'>
									No project types found
								</div>
							)}

							{/* Clear selections button if any selected */}
							{filters.projectTypes.length > 0 && (
								<div className='mt-4 pt-3 border-t border-gray-200 flex justify-end'>
									<Button
										variant='link'
										size='sm'
										className='text-blue-600 hover:text-blue-800'
										onClick={() => {
											const newFilters = { ...filters, projectTypes: [], page: 1 };
											setFilters(newFilters);
											updateUrlParams(newFilters);
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

	// Render state dropdown (single select)
	const renderStateFilter = () => {
		const selectedState = usStates.find(s => s.code === filters.state);
		const displayText = selectedState ? selectedState.name : 'All States';

		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('state')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'state'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							filters.state ? 'bg-blue-100' : ''
						)}>
						<Map size={16} className='mr-1' />
						{displayText}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'state' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'state' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-64 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={stateDropdownRef}>
						<div className='p-4'>
							{/* All States option */}
							<div
								className='flex items-center py-2 cursor-pointer hover:bg-gray-50 mb-2 border-b border-gray-200 pb-2'
								onClick={() => {
									const newFilters = { ...filters, state: null, page: 1 };
									setFilters(newFilters);
									updateUrlParams(newFilters);
									setOpenFilterSection(null);
								}}>
								<div className='flex items-center'>
									{!filters.state && <Check size={16} className='mr-2 text-blue-600' />}
									{filters.state && <span className='w-6' />}
									<span className='text-sm font-medium'>All States</span>
								</div>
							</div>

							{/* State list */}
							<div className='max-h-60 overflow-y-auto'>
								{usStates.map((state) => (
									<div
										key={state.code}
										className='flex items-center py-1 cursor-pointer hover:bg-gray-50'
										onClick={() => {
											const newFilters = { ...filters, state: state.code, page: 1 };
											setFilters(newFilters);
											updateUrlParams(newFilters);
											setOpenFilterSection(null);
										}}>
										<div className='flex items-center'>
											{filters.state === state.code && <Check size={16} className='mr-2 text-blue-600' />}
											{filters.state !== state.code && <span className='w-6' />}
											<span className='text-sm'>{state.name}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	// Render coverage type checkboxes
	const renderCoverageTypeFilter = () => {
		const coverageTypeOptions = [
			{ value: 'national', label: 'Federal/National' },
			{ value: 'state', label: 'State' },
			{ value: 'local', label: 'Local' },
			{ value: 'unknown', label: 'Unknown Location' },
		];

		const selectedCount = filters.coverageTypes.length;
		const displayText = selectedCount < 4 ? `Coverage (${selectedCount})` : 'Coverage';

		return (
			<div className='relative inline-block text-left'>
				<div>
					<Button
						variant='outline'
						onClick={() => toggleFilterSection('coverage')}
						className={classNames(
							'flex items-center justify-between gap-1 px-4 py-2 text-sm',
							openFilterSection === 'coverage'
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: 'border-gray-300',
							selectedCount !== defaultCoverageTypes.length ? 'bg-blue-100' : ''
						)}>
						{displayText}
						<ChevronDown
							size={16}
							className={classNames(
								'transition-transform',
								openFilterSection === 'coverage' ? 'rotate-180' : ''
							)}
						/>
					</Button>
				</div>

				{openFilterSection === 'coverage' && (
					<div
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white rounded-md shadow-lg w-56 ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}>
						<div className='p-4'>
							<div className='text-xs text-gray-500 mb-3'>
								Filter by coverage area type
							</div>

							{coverageTypeOptions.map((option) => (
								<div
									key={option.value}
									className='flex items-center py-2 cursor-pointer hover:bg-gray-50'
									onClick={() => {
										const isChecked = filters.coverageTypes.includes(option.value);
										let newCoverageTypes;
										if (isChecked) {
											newCoverageTypes = filters.coverageTypes.filter(t => t !== option.value);
										} else {
											newCoverageTypes = [...filters.coverageTypes, option.value];
										}
										const newFilters = { ...filters, coverageTypes: newCoverageTypes, page: 1 };
										setFilters(newFilters);
										updateUrlParams(newFilters);
									}}>
									<input
										type='checkbox'
										className='mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
										checked={filters.coverageTypes.includes(option.value)}
										onChange={() => {}} // Handled by parent onClick
									/>
									<span className='text-sm flex-1'>
										{option.label}
										{coverageCounts[option.value] !== null && (
											<span className='text-gray-400 ml-1'>
												({coverageCounts[option.value]})
											</span>
										)}
									</span>
								</div>
							))}

							{/* Reset to defaults button */}
							{filters.coverageTypes.length !== defaultCoverageTypes.length ||
							!defaultCoverageTypes.every(t => filters.coverageTypes.includes(t)) ? (
								<div className='mt-3 pt-3 border-t border-gray-200'>
									<Button
										variant='link'
										size='sm'
										className='text-blue-600 hover:text-blue-800 p-0'
										onClick={() => {
											const newFilters = { ...filters, coverageTypes: defaultCoverageTypes, page: 1 };
											setFilters(newFilters);
											updateUrlParams(newFilters);
										}}>
										Reset to defaults
									</Button>
								</div>
							) : null}
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
								const newFilters = {
									...filters,
									tracked: false,
									page: 1,
								};
								setFilters(newFilters);
								updateUrlParams(newFilters);
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
								const newFilters = {
									...filters,
									status: null,
									page: 1,
								};
								setFilters(newFilters);
								updateUrlParams(newFilters);
							}}
						/>
					</span>
				)}

				{/* Project type filters */}
				{filters.projectTypes.map((projectType) => {
					const typeColor = getProjectTypeColor(projectType);
					return (
						<span
							key={projectType}
							className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
							style={{
								backgroundColor: typeColor.bgColor,
								color: typeColor.color,
							}}>
							{projectType}
							<X
								size={14}
								className='cursor-pointer'
								onClick={() => {
									const updatedTypes = filters.projectTypes.filter(
										(t) => t !== projectType
									);
									const newFilters = {
										...filters,
										projectTypes: updatedTypes,
										page: 1,
									};
									setFilters(newFilters);
									updateUrlParams(newFilters);
								}}
							/>
						</span>
					);
				})}

				{/* State filter */}
				{filters.state && (
					<span className='flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium'>
						{usStates.find(s => s.code === filters.state)?.name || filters.state}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								const newFilters = {
									...filters,
									state: null,
									page: 1,
								};
								setFilters(newFilters);
								updateUrlParams(newFilters);
							}}
						/>
					</span>
				)}

				{/* Coverage type filters (only show if not default) */}
				{(filters.coverageTypes.length !== defaultCoverageTypes.length ||
				!defaultCoverageTypes.every(t => filters.coverageTypes.includes(t))) && (
					<span className='flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium'>
						Coverage: {filters.coverageTypes.join(', ')}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								const newFilters = {
									...filters,
									coverageTypes: defaultCoverageTypes,
									page: 1,
								};
								setFilters(newFilters);
								updateUrlParams(newFilters);
							}}
						/>
					</span>
				)}

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
		const hasNonDefaultCoverage = filters.coverageTypes.length !== defaultCoverageTypes.length ||
			!defaultCoverageTypes.every(t => filters.coverageTypes.includes(t));

		return (
			filters.status !== null ||
			filters.projectTypes.length > 0 ||
			filters.state !== null ||
			hasNonDefaultCoverage ||
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
								placeholder='Search titles, descriptions, summaries...'
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>

						{/* Filter dropdown buttons */}
						<div className='flex flex-wrap gap-2' ref={filterContainerRef}>
							{/* Tracked opportunities filter */}
							{renderTrackedFilter()}

							{/* Project Types filter */}
							{renderProjectTypeFilter()}

							{/* Status filter */}
							{renderStatusFilter()}

							{/* State filter (dropdown) */}
							{renderStateFilter()}

							{/* Coverage type filter (checkboxes) */}
							{renderCoverageTypeFilter()}
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

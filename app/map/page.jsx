'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	Calendar,
	Info,
	Globe,
	ArrowLeft,
	Building2,
	Search,
	X,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import ScopeSummary from '@/components/map/ScopeSummary';
import CoverageAreaFilter from '@/components/map/CoverageAreaFilter';
import OpportunitySortDropdown from '@/components/map/OpportunitySortDropdown';
import StatusFilter from '@/components/map/StatusFilter';
import ProjectTypesFilter from '@/components/map/ProjectTypesFilter';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';

// Dynamically import the map component with SSR disabled
const FundingMapClient = dynamic(
	() => import('@/components/map/FundingMapClient'),
	{
		ssr: false, // Disable server-side rendering for this component
		loading: () => (
			<div className='flex items-center justify-center h-[500px]'>
				{/* Use a simple div or a manually imported spinner here */}
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
			</div>
		),
	}
);

// FilterSidebar removed - using ProjectTypesFilter instead

// State abbreviations for map labels
const stateAbbreviations = {
	Alabama: 'AL',
	Alaska: 'AK',
	Arizona: 'AZ',
	Arkansas: 'AR',
	California: 'CA',
	Colorado: 'CO',
	Connecticut: 'CT',
	Delaware: 'DE',
	Florida: 'FL',
	Georgia: 'GA',
	Hawaii: 'HI',
	Idaho: 'ID',
	Illinois: 'IL',
	Indiana: 'IN',
	Iowa: 'IA',
	Kansas: 'KS',
	Kentucky: 'KY',
	Louisiana: 'LA',
	Maine: 'ME',
	Maryland: 'MD',
	Massachusetts: 'MA',
	Michigan: 'MI',
	Minnesota: 'MN',
	Mississippi: 'MS',
	Missouri: 'MO',
	Montana: 'MT',
	Nebraska: 'NE',
	Nevada: 'NV',
	'New Hampshire': 'NH',
	'New Jersey': 'NJ',
	'New Mexico': 'NM',
	'New York': 'NY',
	'North Carolina': 'NC',
	'North Dakota': 'ND',
	Ohio: 'OH',
	Oklahoma: 'OK',
	Oregon: 'OR',
	Pennsylvania: 'PA',
	'Rhode Island': 'RI',
	'South Carolina': 'SC',
	'South Dakota': 'SD',
	Tennessee: 'TN',
	Texas: 'TX',
	Utah: 'UT',
	Vermont: 'VT',
	Virginia: 'VA',
	Washington: 'WA',
	'West Virginia': 'WV',
	Wisconsin: 'WI',
	Wyoming: 'WY',
	'District of Columbia': 'DC',
};


// Helper function to format funding amounts appropriately
function formatFundingAmount(value) {
	if (!value) return '0';

	// Format as billions if over 1 billion
	if (value >= 1000000000) {
		return `${(value / 1000000000).toFixed(2)}B`;
	}

	// Format as millions if over 1 million
	if (value >= 1000000) {
		return `${(value / 1000000).toFixed(1)}M`;
	}

	// Format as thousands if over 1 thousand
	if (value >= 1000) {
		return `${(value / 1000).toFixed(0)}K`;
	}

	// Otherwise just return the value
	return value.toLocaleString();
}

// Main map content component that uses useSearchParams
function MapPageContent() {
	// URL params handling
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	// Parse initial state from URL params
	const initialFilters = useMemo(() => ({
		minAmount: 0,
		maxAmount: parseInt(searchParams.get('maxAmount') || '0'),
		// Default to Open,Upcoming like opportunities page
		status: searchParams.get('status')?.split(',').filter(Boolean) || ['Open', 'Upcoming'],
		sourceType: 'all',
		categories: [],
		projectTypes: searchParams.get('projectTypes')?.split(',').filter(Boolean) || [],
		showNational: true,
		deadlineRange: { start: null, end: null },
		scope: searchParams.get('scope')?.split(',').filter(Boolean) || ['national', 'state_wide', 'county', 'utility'],
		search: searchParams.get('search') || '',
		page: parseInt(searchParams.get('page')) || 1,
	}), []);

	// Sort state
	const initialSortOption = searchParams.get('sort') || 'relevance';
	const initialSortDirection = searchParams.get('sortDir') || 'desc';

	const initialViewMode = searchParams.get('view') || 'us';
	const initialStateCode = searchParams.get('state') || null;

	// Convert state code back to full name for initializing selectedState
	const getStateNameFromCode = (code) => {
		if (!code) return null;
		return Object.entries(stateAbbreviations).find(([name, abbr]) => abbr === code)?.[0] || null;
	};

	const [fundingData, setFundingData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedState, setSelectedState] = useState(() => getStateNameFromCode(initialStateCode));
	const [selectedStateCode, setSelectedStateCode] = useState(initialStateCode);
	const [colorBy, setColorBy] = useState('amount'); // 'amount' or 'count'
	const [totalFundingAvailable, setTotalFundingAvailable] = useState(0);
	const [totalOpportunities, setTotalOpportunities] = useState(0);
	const [statesWithFunding, setStatesWithFunding] = useState(0);
	const [categoryMapping, setCategoryMapping] = useState({});

	// View mode state: 'us' or 'state' (county/utility views removed)
	const [viewMode, setViewMode] = useState(initialViewMode === 'county' || initialViewMode === 'utility' ? 'state' : initialViewMode);
	const [scopeBreakdown, setScopeBreakdown] = useState(null); // Scope counts from ScopeBreakdown
	const [nationalOpportunities, setNationalOpportunities] = useState([]);
	const [nationalOpportunitiesLoading, setNationalOpportunitiesLoading] =
		useState(false);
	const [nationalPage, setNationalPage] = useState(initialFilters.page);
	const [nationalTotalCount, setNationalTotalCount] = useState(0);

	const [filters, setFilters] = useState(initialFilters);

	// Sort state
	const [sortOption, setSortOption] = useState(initialSortOption);
	const [sortDirection, setSortDirection] = useState(initialSortDirection);

	// Fetch the category mapping on mount
	useEffect(() => {
		async function fetchCategoryMapping() {
			try {
				const response = await fetch('/api/categories');
				const result = await response.json();

				if (result.success && result.rawToNormalizedMap) {
					setCategoryMapping(result.rawToNormalizedMap);
					console.log(
						'Loaded category mapping with',
						Object.keys(result.rawToNormalizedMap).length,
						'entries'
					);
				} else if (result.success) {
					console.warn('API returned success but no category mapping data:', result);
					setCategoryMapping({});
				} else {
					console.error('Error fetching categories:', result.error);
				}
			} catch (err) {
				console.error('Failed to fetch categories:', err);
			}
		}

		fetchCategoryMapping();
	}, []);

	useEffect(() => {
		async function fetchFundingData() {
			try {
				setLoading(true);
				// Build query parameters
				const queryParams = new URLSearchParams();

				// Handle status as array
				const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
				if (statusArray.length > 0 && statusArray[0] !== 'all') {
					queryParams.append('status', statusArray.join(','));
				}
				if (filters.sourceType !== 'all') {
					queryParams.append('source_type', filters.sourceType);
				}

				// Handle category filtering with normalization
				if (filters.categories?.length > 0) {
					// Get all raw categories that map to our selected normalized categories
					const rawCategories = Object.entries(categoryMapping)
						.filter(([raw, normalized]) =>
							filters.categories.includes(normalized)
						)
						.map(([raw]) => raw);

					// If we have a mapping, use all raw categories that map to our selections
					// Otherwise, just use the selected categories directly
					const categoriesToSend =
						rawCategories.length > 0 ? rawCategories : filters.categories;

					queryParams.append('categories', categoriesToSend.join(','));
				}

				// Handle project types filtering
				if (filters.projectTypes?.length > 0) {
					queryParams.append('projectTypes', filters.projectTypes.join(','));
				}

				// AMOUNT FILTER DISABLED (Dec 2025)
				// Reason: 65% of opportunities have NULL maximum_award, making this filter
				// ineffective and confusing. Re-enable if data quality improves or users request it.
				// if (filters.minAmount > 0) {
				// 	queryParams.append('min_amount', filters.minAmount);
				// }
				// if (filters.maxAmount > 0) {
				// 	queryParams.append('max_amount', filters.maxAmount);
				// }
				if (!filters.showNational) {
					queryParams.append('include_national', 'false');
				}
				if (filters.deadlineRange.start) {
					queryParams.append(
						'deadline_start',
						format(filters.deadlineRange.start, 'yyyy-MM-dd')
					);
				}
				if (filters.deadlineRange.end) {
					queryParams.append(
						'deadline_end',
						format(filters.deadlineRange.end, 'yyyy-MM-dd')
					);
				}

				// Add cache-busting timestamp
				queryParams.append('_t', Date.now());

				const response = await fetch(
					`/api/map/funding-by-state?${queryParams}`
				);
				const result = await response.json();

				if (result.success) {
					// Check California in the API response
					const californiaResponse = result.data.find(
						(d) => d.state === 'California'
					);
					console.log('API response California:', californiaResponse);

					// Log all state names to check for weird ones
					const stateNames = result.data.map((d) => d.state);
					console.log('All state names:', stateNames);

					setFundingData(result.data);
					setTotalFundingAvailable(result.totalFunding || 0);
					setTotalOpportunities(result.totalOpportunities || 0);
					setStatesWithFunding(result.statesWithFunding || 0);
				} else {
					console.error('Error in API response:', result.error);
					setError(result.error);
				}
			} catch (err) {
				console.error('Error fetching funding data:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchFundingData();
	}, [filters, categoryMapping]);

	const handleStateClick = (geo) => {
		const stateName = geo.properties.name;
		const stateCode = stateAbbreviations[stateName] || null;
		if (selectedState === stateName) {
			// Deselect state, go back to US view
			setSelectedState(null);
			setSelectedStateCode(null);
			setViewMode('us');
			updateUrlParams(filters, 'us', null);
		} else {
			// Select state, enter state view
			setSelectedState(stateName);
			setSelectedStateCode(stateCode);
			setViewMode('state');
			updateUrlParams(filters, 'state', stateCode);
		}
	};


	// Update URL params when filters/view change
	const updateUrlParams = useCallback((newFilters, newViewMode, newState, newSortOption = sortOption, newSortDirection = sortDirection, newPage = 1) => {
		const params = new URLSearchParams();

		// Add non-default filter values to URL
		// Status is now an array, default is ['Open', 'Upcoming']
		const defaultStatus = ['Open', 'Upcoming'];
		const statusArray = Array.isArray(newFilters.status) ? newFilters.status : [newFilters.status];
		const isDefaultStatus = statusArray.length === 2 &&
			statusArray.includes('Open') && statusArray.includes('Upcoming');
		if (!isDefaultStatus && statusArray.length > 0 && statusArray[0] !== 'all') {
			params.set('status', statusArray.join(','));
		}
		if (newFilters.projectTypes?.length > 0) {
			params.set('projectTypes', newFilters.projectTypes.join(','));
		}
		if (newFilters.search) {
			params.set('search', newFilters.search);
		}
		// DISABLED - see amount filter comment in fetchData
		// if (newFilters.maxAmount > 0) {
		// 	params.set('maxAmount', newFilters.maxAmount.toString());
		// }
		if (newFilters.scope?.length > 0 && newFilters.scope.length < 4) {
			params.set('scope', newFilters.scope.join(','));
		}
		if (newViewMode && newViewMode !== 'us') {
			params.set('view', newViewMode);
		}
		if (newState) {
			params.set('state', newState);
		}
		// Add sort params if not default
		if (newSortOption && newSortOption !== 'relevance') {
			params.set('sort', newSortOption);
		}
		if (newSortDirection && newSortDirection !== 'desc') {
			params.set('sortDir', newSortDirection);
		}
		// Add page param if not on first page
		if (newPage > 1) {
			params.set('page', newPage.toString());
		}

		const queryString = params.toString();
		router.replace(`${pathname}${queryString ? '?' + queryString : ''}`, { scroll: false });
	}, [pathname, router, sortOption, sortDirection]);

	const handleFilterChange = (filterKey, value) => {
		const newFilters = {
			...filters,
			[filterKey]: value,
		};
		setFilters(newFilters);
		// Update URL
		updateUrlParams(newFilters, viewMode, selectedStateCode);
	};

	const handleResetFilters = () => {
		const defaultFilters = {
			minAmount: 0,
			maxAmount: 0,
			status: ['Open', 'Upcoming'], // Default to Open + Upcoming
			sourceType: 'all',
			categories: [],
			projectTypes: [],
			showNational: true,
			deadlineRange: {
				start: null,
				end: null,
			},
			scope: ['national', 'state_wide', 'county', 'utility'],
			search: '',
		};
		setFilters(defaultFilters);
		setSortOption('relevance');
		setSortDirection('desc');
		// Reset pagination
		setNationalPage(1);
		// Update URL to clear filter params
		updateUrlParams(defaultFilters, viewMode, selectedStateCode, 'relevance', 'desc');
	};

	// Handle sort change
	const handleSortChange = (newOption, newDirection) => {
		setSortOption(newOption);
		setSortDirection(newDirection);
		updateUrlParams(filters, viewMode, selectedStateCode, newOption, newDirection);
	};

	// Sync pagination to URL when page changes
	useEffect(() => {
		// Skip initial render - only sync when user navigates pages
		if (nationalPage !== initialFilters.page || nationalPage > 1) {
			updateUrlParams(filters, viewMode, selectedStateCode, sortOption, sortDirection, nationalPage);
		}
	}, [nationalPage]); // Only trigger on page change

	// View mode handlers
	const handleBackToUS = useCallback(() => {
		setViewMode('us');
		setSelectedState(null);
		setSelectedStateCode(null);
		updateUrlParams(filters, 'us', null);
	}, [filters, updateUrlParams]);

	// Unified opportunities fetch for side panel - works for both nationwide and state views
	useEffect(() => {
		async function fetchMapOpportunities() {
			try {
				setNationalOpportunitiesLoading(true);
				const params = new URLSearchParams();

				// Add state if selected (otherwise nationwide)
				if (selectedStateCode) {
					params.append('state', selectedStateCode);
				}

				// Status as array
				const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
				if (statusArray.length > 0 && statusArray[0] !== 'all') {
					params.append('status', statusArray.join(','));
				}

				// Scope/coverage filter
				if (filters.scope?.length > 0 && filters.scope.length < 4) {
					params.append('scope', filters.scope.join(','));
				}

				// Project types
				if (filters.projectTypes?.length > 0) {
					params.append('projectTypes', filters.projectTypes.join(','));
				}

				// Sorting
				if (sortOption) {
					params.append('sort_by', sortOption);
				}
				if (sortDirection) {
					params.append('sort_direction', sortDirection);
				}

				// Pagination
				params.append('page', nationalPage.toString());
				params.append('pageSize', '10');

				// Search
				if (filters.search) {
					params.append('search', filters.search);
				}

				const response = await fetch(`/api/map/opportunities?${params}`);
				const result = await response.json();

				if (result.success && result.data) {
					setNationalTotalCount(result.data.total || 0);
					setNationalOpportunities(result.data.opportunities || []);
				}
			} catch (error) {
				console.error('Error fetching map opportunities:', error);
			} finally {
				setNationalOpportunitiesLoading(false);
			}
		}

		fetchMapOpportunities();
	}, [selectedStateCode, filters.status, filters.projectTypes, filters.scope, filters.search, sortOption, sortDirection, nationalPage]);

	// Fetch scope breakdown for ScopeSummary
	useEffect(() => {
		async function fetchScopeBreakdown() {
			try {
				const params = new URLSearchParams();

				// Status as array
				const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
				if (statusArray.length > 0 && statusArray[0] !== 'all') {
					params.append('status', statusArray.join(','));
				}

				if (filters.projectTypes?.length > 0) {
					params.append('projectTypes', filters.projectTypes.join(','));
				}

				// Use state code or 'US' for nationwide
				const endpoint = selectedStateCode
					? `/api/map/scope-breakdown/${selectedStateCode}?${params}`
					: `/api/map/scope-breakdown/US?${params}`;

				const response = await fetch(endpoint);
				const result = await response.json();

				if (result.success && result.data) {
					setScopeBreakdown(result.data);
				}
			} catch (error) {
				console.error('Error fetching scope breakdown:', error);
			}
		}

		fetchScopeBreakdown();
	}, [selectedStateCode, filters.status, filters.projectTypes]);

	// Format amount with K/M suffix based on size
	const formatAmount = (minimum, maximum, total) => {
		// Helper to format a number with K/M suffix (including $ sign)
		const formatWithSuffix = (num) => {
			if (!num && num !== 0) return null;

			if (num >= 1000000) {
				return `$${(num / 1000000).toLocaleString(undefined, {
					maximumFractionDigits: 1,
					minimumFractionDigits: 0,
				})}M`;
			} else {
				return `$${(num / 1000).toLocaleString(undefined, {
					maximumFractionDigits: 0,
				})}K`;
			}
		};

		// Handle different cases based on available data with proper $ formatting
		if (minimum && maximum) {
			return `${formatWithSuffix(minimum)} - ${formatWithSuffix(maximum)}`;
		} else if (maximum) {
			return `Up to ${formatWithSuffix(maximum)}`;
		} else if (minimum) {
			return `From ${formatWithSuffix(minimum)}`;
		} else if (total) {
			return `${formatWithSuffix(total)} total`;
		} else {
			return 'Amount not specified';
		}
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6'>
					{/* Header with title and navigation */}
					<div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4'>
						<div className='flex flex-wrap items-center gap-2 sm:gap-4'>
							{/* Back button - show when state is selected */}
							{viewMode === 'state' && (
								<Button
									variant='ghost'
									size='sm'
									onClick={handleBackToUS}
									className='gap-1 px-2 sm:px-3'
								>
									<ArrowLeft className='h-4 w-4' />
									<span className='hidden xs:inline'>US</span>
									<span className='xs:hidden'>US</span>
								</Button>
							)}
							<h1 className='text-xl sm:text-2xl lg:text-3xl font-bold truncate'>
								{viewMode === 'us' && !selectedState && 'Funding Map'}
								{viewMode === 'us' && selectedState && `${selectedState} Opportunities`}
								{viewMode === 'state' && `${selectedState} Opportunities`}
							</h1>
						</div>

						{/* View mode indicator - Hidden on smallest screens */}
						<div className='hidden sm:flex items-center gap-2 text-sm text-muted-foreground'>
							{viewMode === 'us' && !selectedState && (
								<span className='flex items-center gap-1'>
									<Globe className='h-4 w-4' /> Nationwide View
								</span>
							)}
							{(viewMode === 'us' && selectedState) || viewMode === 'state' ? (
								<span className='flex items-center gap-1'>
									<Building2 className='h-4 w-4' /> State View
								</span>
							) : null}
						</div>
					</div>

					{/* Filter Row - Above the map */}
					<div className='border rounded-lg shadow-sm mb-6 p-4 dark:border-neutral-700'>
						<div className='flex flex-wrap items-center gap-3 md:gap-4'>
							{/* Search Box - Full width on mobile */}
							<div className='relative w-full sm:w-[200px] order-1'>
								<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
								<input
									type='text'
									placeholder='Search opportunities...'
									value={filters.search}
									onChange={(e) => handleFilterChange('search', e.target.value)}
									className='w-full h-10 pl-9 pr-8 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:border-neutral-600'
								/>
								{filters.search && (
									<X
										className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground'
										onClick={() => handleFilterChange('search', '')}
									/>
								)}
							</div>

							{/* Filter elements container - wraps on mobile */}
							<div className='flex flex-wrap items-center gap-2 sm:gap-3 flex-1 order-2'>
								{/* Status Filter */}
								<StatusFilter
									value={Array.isArray(filters.status) ? filters.status : [filters.status]}
									onChange={(newStatus) => handleFilterChange('status', newStatus)}
								/>

								{/* Project Types Filter */}
								<ProjectTypesFilter
									value={filters.projectTypes || []}
									onChange={(newTypes) => handleFilterChange('projectTypes', newTypes)}
								/>

								{/* Coverage Area Filter */}
								<CoverageAreaFilter
									value={filters.scope || ['national', 'state_wide', 'county', 'utility']}
									onChange={(newScope) => handleFilterChange('scope', newScope)}
									stateCode={selectedStateCode}
									filters={{
										status: filters.status,
										projectTypes: filters.projectTypes,
									}}
								/>

								{/* AMOUNT FILTER UI DISABLED (Dec 2025)
								   Reason: 65% of opportunities have NULL maximum_award, making this filter
								   ineffective. Re-enable if data quality improves or users request it.
								<div className='hidden sm:block w-[180px] lg:w-[200px]'>
									<div className='flex justify-between mb-1'>
										<span className='text-xs sm:text-sm font-medium'>Amount:</span>
										<span className='text-xs sm:text-sm text-blue-600 dark:text-blue-400'>
											${(filters.maxAmount / 1000000).toFixed(1)}M+
										</span>
									</div>
									<Slider
										value={[filters.maxAmount]}
										max={10000000}
										step={500000}
										onValueChange={(values) =>
											handleFilterChange('maxAmount', values[0])
										}
									/>
								</div>
							*/}

								{/* Sort Dropdown */}
								<OpportunitySortDropdown
									value={sortOption}
									direction={sortDirection}
									onChange={handleSortChange}
								/>
							</div>

							{/* Reset Button */}
							<Button
								variant='outline'
								onClick={handleResetFilters}
								className='h-10 px-3 sm:px-4 whitespace-nowrap order-3 sm:order-last'>
								Reset
							</Button>
						</div>

						{/* Active Filter Pills */}
						{(() => {
							// Check if status differs from default ['Open', 'Upcoming']
							const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
							const isDefaultStatus = statusArray.length === 2 &&
								statusArray.includes('Open') && statusArray.includes('Upcoming');
							// Check if scope differs from default (all 4)
							const isDefaultScope = filters.scope?.length === 4;
							const hasActiveFilters = !isDefaultStatus ||
								filters.projectTypes?.length > 0 ||
								filters.search ||
								// filters.maxAmount > 0 ||  // DISABLED - see amount filter comment above
								!isDefaultScope;

							return hasActiveFilters && (
								<div className='flex flex-wrap gap-2 mt-3 pt-3 border-t'>
									{/* Status pills */}
									{!isDefaultStatus && statusArray.map((status) => (
										<span
											key={status}
											className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
											Status: {status}
											<X
												className='h-3 w-3 cursor-pointer hover:text-blue-600'
												onClick={() => {
													const newStatus = statusArray.filter((s) => s !== status);
													handleFilterChange('status', newStatus.length > 0 ? newStatus : ['Open', 'Upcoming']);
												}}
											/>
										</span>
									))}

									{/* Project type pills */}
									{filters.projectTypes?.map((type) => {
										const typeColor = getProjectTypeColor(type);
										return (
											<span
												key={type}
												className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
												style={{
													backgroundColor: typeColor.bgColor,
													color: typeColor.color,
												}}>
												{type}
												<X
													className='h-3 w-3 cursor-pointer'
													onClick={() => {
														const newTypes = filters.projectTypes.filter((t) => t !== type);
														handleFilterChange('projectTypes', newTypes);
													}}
												/>
											</span>
										);
									})}

									{/* Scope filter pill - only show if not all selected */}
									{!isDefaultScope && filters.scope?.length > 0 && (
										<span className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'>
											Coverage ({filters.scope.length})
											<X
												className='h-3 w-3 cursor-pointer hover:text-purple-600'
												onClick={() => handleFilterChange('scope', ['national', 'state_wide', 'county', 'utility'])}
											/>
										</span>
									)}

									{/* Search pill */}
									{filters.search && (
										<span className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-200'>
											Search: "{filters.search}"
											<X
												className='h-3 w-3 cursor-pointer hover:text-gray-600'
												onClick={() => handleFilterChange('search', '')}
											/>
										</span>
									)}

									{/* Amount pill - DISABLED (see amount filter comment above)
									{filters.maxAmount > 0 && (
										<span className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>
											Max: ${(filters.maxAmount / 1000000).toFixed(1)}M
											<X
												className='h-3 w-3 cursor-pointer hover:text-green-600'
												onClick={() => handleFilterChange('maxAmount', 0)}
											/>
										</span>
									)}
								*/}

									{/* Clear all button */}
									<button
										className='text-xs text-blue-600 hover:text-blue-800 hover:underline'
										onClick={handleResetFilters}>
										Clear all filters
									</button>
								</div>
							);
						})()}
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
					{/* Map Column */}
					<div className='lg:col-span-8'>
						<Card>
							<CardHeader>
								<div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
									<CardTitle>Geographic Distribution</CardTitle>
									<div className='flex gap-2'>
										<Button
											variant={colorBy === 'amount' ? 'default' : 'outline'}
											size='sm'
											onClick={() => setColorBy('amount')}>
											Color by Amount
										</Button>
										<Button
											variant={colorBy === 'count' ? 'default' : 'outline'}
											size='sm'
											onClick={() => setColorBy('count')}>
											Color by Count
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent className='p-0 relative'>
								<FundingMapClient
									loading={loading}
									error={error}
									fundingData={fundingData}
									colorBy={colorBy}
									selectedState={selectedState}
									onStateClick={handleStateClick}
									stateAbbreviations={stateAbbreviations}
								/>
							</CardContent>
						</Card>

						{/* Context-Aware Summary Stats Card */}
						<Card className='mt-6'>
							<CardHeader className='pb-2'>
								<CardTitle className='text-base'>
									{viewMode === 'us' && 'Funding Summary'}
									{viewMode === 'state' && `${selectedState || 'State'} Summary`}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className='space-y-3'>
									{/* US View Stats */}
									{viewMode === 'us' && (
										<>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>Total Opportunities</span>
												<span className='font-semibold text-lg'>{totalOpportunities}</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>Total Funding</span>
												<span className='font-semibold text-lg text-green-600 dark:text-green-400'>
													${formatFundingAmount(totalFundingAvailable)}
												</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>States with Funding</span>
												<span className='font-semibold'>{statesWithFunding}</span>
											</div>
										</>
									)}

									{/* State View Stats */}
									{viewMode === 'state' && selectedState && (
										<>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>State Opportunities</span>
												<span className='font-semibold text-lg'>{nationalTotalCount.toLocaleString()}</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>State Funding</span>
												<span className='font-semibold text-lg text-green-600 dark:text-green-400'>
													${formatFundingAmount(fundingData.find(d => d.state === selectedState)?.value || 0)}
												</span>
											</div>
										</>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Side Panel Column - Unified opportunities display */}
					<div className='lg:col-span-4'>
						{/* Unified Opportunities Card - Works for both nationwide and state views */}
						<Card>
							<CardHeader className='pb-2'>
								<CardTitle className='flex items-center'>
									{selectedState ? (
										<>
											<Building2 className='h-5 w-5 mr-2' />
											{selectedState}
										</>
									) : (
										<>
											<Globe className='h-5 w-5 mr-2' />
											United States
										</>
									)}
								</CardTitle>
								<CardDescription>
									{nationalOpportunitiesLoading
										? 'Loading opportunities...'
										: selectedState
											? `${nationalTotalCount.toLocaleString()} opportunities for ${selectedState}`
											: `${nationalTotalCount.toLocaleString()} opportunities nationwide`}
								</CardDescription>
							</CardHeader>
							<div className='px-6'>
								<div className='h-[1px] bg-[#E0E0E0] my-3'></div>
							</div>
							<CardContent className='pt-0'>
								{/* Scope Summary - Compact read-only display */}
								<ScopeSummary
									breakdown={scopeBreakdown || {}}
									selectedScopes={filters.scope || ['national', 'state_wide', 'county', 'utility']}
									className="mb-4"
								/>

								{/* Divider */}
								<div className='h-[1px] bg-[#E0E0E0] my-4'></div>

								{/* Opportunities List */}
								<div>
									{/* Header with title and compact pagination */}
									<div className='flex justify-between items-center mb-3'>
										<h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
											Opportunities
										</h4>
										{nationalTotalCount > 10 && !nationalOpportunitiesLoading && (
											<div className='flex items-center gap-2'>
												<span className='text-xs text-muted-foreground'>
													{nationalPage > 1 ? `${(nationalPage - 1) * 10 + 1}-${Math.min(nationalPage * 10, nationalTotalCount)}` : `1-${Math.min(10, nationalTotalCount)}`} of {nationalTotalCount.toLocaleString()}
												</span>
												<div className='flex gap-1'>
													<Button
														size='icon'
														variant='ghost'
														className='h-7 w-7'
														disabled={nationalPage === 1}
														onClick={() => setNationalPage((p) => p - 1)}>
														<ChevronLeft className='h-4 w-4' />
													</Button>
													<Button
														size='icon'
														variant='ghost'
														className='h-7 w-7'
														disabled={nationalPage >= Math.ceil(nationalTotalCount / 10)}
														onClick={() => setNationalPage((p) => p + 1)}>
														<ChevronRight className='h-4 w-4' />
													</Button>
												</div>
											</div>
										)}
										{nationalTotalCount > 0 && nationalTotalCount <= 10 && !nationalOpportunitiesLoading && (
											<span className='text-xs text-muted-foreground'>
												{nationalTotalCount.toLocaleString()} total
											</span>
										)}
									</div>

									{nationalOpportunitiesLoading ? (
										<div className='flex justify-center py-8'>
											<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
										</div>
									) : nationalOpportunities.length > 0 ? (
										<>
											{/* Scrollable container for opportunity cards */}
											<div className='max-h-[500px] overflow-y-auto pr-1 custom-scrollbar'>
												<div className='space-y-4 animate-fadeIn'>
												{nationalOpportunities.map((opp, index) => {
													const relevanceScore = opp.relevance_score || 0;
													const relevanceColor = relevanceScore >= 8 ? 'bg-green-400' : relevanceScore >= 6 ? 'bg-orange-400' : 'bg-gray-400';

													return (
														<div
															key={opp.id || index}
															className='border rounded-lg p-3 hover:shadow-md transition-shadow dark:border-neutral-700'>
															<div className='flex items-start gap-2'>
																<h3 className='font-medium text-sm flex-1'>
																	{opp.title}
																</h3>
																<Badge
																	variant={
																		opp.status?.toLowerCase() === 'open'
																			? 'default'
																			: opp.status?.toLowerCase() === 'upcoming'
																			? 'success'
																			: 'destructive'
																	}
																	className='h-6 px-2 text-xs flex-shrink-0 mt-0.5'>
																	{opp.status}
																</Badge>
															</div>
															<div className='flex justify-between text-xs text-muted-foreground mt-2'>
																<div className='flex items-center'>
																	{formatAmount(opp.minimum_award, opp.maximum_award, null)}
																</div>
																<div className='flex items-center'>
																	<Calendar className='h-3 w-3 mr-1' />
																	{opp.close_date
																		? new Date(opp.close_date).toLocaleDateString()
																		: 'No deadline'}
																</div>
															</div>

															{/* View Details with tooltip + Funding Type */}
															<div className='mt-3 flex items-center justify-between'>
																<TooltipProvider>
																	<Tooltip delayDuration={100}>
																		<TooltipTrigger asChild>
																			<button className='flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium focus:outline-none'>
																				<span>View Details</span>
																				<Info className='h-3.5 w-3.5' />
																			</button>
																		</TooltipTrigger>
																		<TooltipContent
																			side='top'
																			align='start'
																			className='w-80 p-4 space-y-3 shadow-lg rounded-lg bg-blue-600 text-white z-[100]'>
																			{/* Program Overview */}
																			<div>
																				<p className='text-sm font-medium mb-2'>Program Overview</p>
																				<p className='text-xs leading-relaxed'>
																					{opp.program_overview || opp.actionable_summary || opp.summary || 'No overview available.'}
																				</p>
																			</div>

																			{/* Project Types */}
																			<div>
																				<p className='text-sm font-medium mb-2'>Project Types</p>
																				<div className='flex flex-wrap gap-1'>
																					{opp.eligible_project_types?.slice(0, 4).map((type, i) => (
																						<span key={i} className='px-2 py-0.5 bg-white/20 rounded text-xs'>
																							{type}
																						</span>
																					)) || (
																						<span className='text-xs opacity-70'>Not specified</span>
																					)}
																				</div>
																			</div>

																			{/* Who Can Apply */}
																			<div>
																				<p className='text-sm font-medium mb-2'>Who Can Apply</p>
																				<p className='text-xs'>
																					{opp.eligible_applicants?.join(', ') || 'Eligible organizations'}
																				</p>
																			</div>

																			{/* Relevance Meter */}
																			<div>
																				<div className='flex justify-between mb-1'>
																					<p className='text-sm font-medium'>Relevance</p>
																					<span className='text-xs'>{relevanceScore.toFixed(1)}/10</span>
																				</div>
																				<div className='h-2 w-full bg-blue-800 rounded-full overflow-hidden'>
																					<div
																						className={`h-full ${relevanceColor}`}
																						style={{ width: `${(relevanceScore / 10) * 100}%` }}
																					/>
																				</div>
																			</div>

																			{/* View Full Opportunity Link */}
																			<Link
																				href={`/funding/opportunities/${opp.id}`}
																				className='block w-full text-center text-xs font-medium bg-white hover:bg-gray-100 text-blue-700 py-2 rounded-md transition-colors'>
																				View Full Opportunity
																			</Link>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
																{opp.funding_type && (() => {
																	// Parse funding types (can be JSON array, semicolon-separated, or single value)
																	let types = [];
																	try {
																		if (opp.funding_type.startsWith('[')) {
																			types = JSON.parse(opp.funding_type);
																		} else if (opp.funding_type.includes(';')) {
																			types = opp.funding_type.split(';').map(t => t.trim());
																		} else {
																			types = [opp.funding_type];
																		}
																	} catch {
																		types = [opp.funding_type];
																	}
																	return (
																		<div className='flex gap-1'>
																			{types.slice(0, 2).map((type, i) => (
																				<Badge key={i} variant='outline' className='text-xs h-5 px-2'>
																					{type}
																				</Badge>
																			))}
																		</div>
																	);
																})()}
															</div>
														</div>
													);
												})}
												</div>
											</div>

											{/* Pagination */}
											{nationalTotalCount > 10 && (
												<div className='flex justify-between items-center pt-4 mt-4 border-t'>
													<Button
														variant='outline'
														size='sm'
														disabled={nationalPage === 1}
														onClick={() => setNationalPage((p) => p - 1)}>
														Previous
													</Button>
													<span className='text-sm text-muted-foreground'>
														Page {nationalPage} of {Math.ceil(nationalTotalCount / 10)}
													</span>
													<Button
														variant='outline'
														size='sm'
														disabled={nationalPage >= Math.ceil(nationalTotalCount / 10)}
														onClick={() => setNationalPage((p) => p + 1)}>
														Next
													</Button>
												</div>
											)}
										</>
									) : (
										<p className='text-muted-foreground text-sm text-center py-8'>
											No opportunities found with current filters.
											{filters.scope?.length < 4 && (
												<span className='block mt-2 text-xs'>
													Try expanding your coverage area selection.
												</span>
											)}
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

// Loading fallback for Suspense
function MapPageFallback() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='animate-pulse'>
					{/* Header skeleton */}
					<div className='h-8 bg-gray-200 dark:bg-neutral-700 rounded w-1/4 mb-6'></div>

					{/* Filter bar skeleton */}
					<div className='border rounded-lg p-4 mb-6'>
						<div className='flex gap-4'>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-48'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-32'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-32'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-48'></div>
						</div>
					</div>

					{/* Map and sidebar skeleton */}
					<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
						<div className='lg:col-span-8'>
							<div className='h-[500px] bg-gray-200 dark:bg-neutral-700 rounded-lg'></div>
						</div>
						<div className='lg:col-span-4'>
							<div className='h-[300px] bg-gray-200 dark:bg-neutral-700 rounded-lg'></div>
						</div>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

// Default export with Suspense boundary for useSearchParams
export default function Page() {
	return (
		<Suspense fallback={<MapPageFallback />}>
			<MapPageContent />
		</Suspense>
	);
}

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Search,
	X,
	ChevronDown,
	Map,
	ArrowUp,
	ArrowDown,
	Check,
	ChevronLeft,
	ChevronRight,
	Star,
} from 'lucide-react';
import TAXONOMIES from '@/lib/constants/taxonomies';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import { classNames } from '@/lib/utils';
import {
	getProjectTypeColor,
} from '@/lib/utils/uiHelpers';
import {
	useOpportunities,
	useProjectTypes,
	useCoverageCounts,
} from '@/lib/hooks/queries';
import {
	useOpportunitiesFilterStore,
	DEFAULT_FILTERS,
} from '@/lib/stores/opportunitiesFilterStore';
import { useTrackedOpportunitiesStore } from '@/lib/stores/trackedOpportunitiesStore';
import { useOpportunitiesUrlSync } from '@/hooks/useOpportunitiesUrlSync';
import { useOpportunitiesApiFilters } from '@/hooks/useOpportunitiesApiFilters';

// Status indicator styling - keys must match filter values (capitalized)
const statusIndicator = {
	Open: 'Open',
	Upcoming: 'Upcoming',
	Closed: 'Closed',
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
	// --- URL sync (bidirectional: URL ↔ store) ---
	useOpportunitiesUrlSync();

	// --- Zustand store: filter/sort/search state ---
	const filters = useOpportunitiesFilterStore((s) => s.filters);
	const searchQuery = useOpportunitiesFilterStore((s) => s.searchQuery);
	const sortOption = useOpportunitiesFilterStore((s) => s.sortOption);
	const sortDirection = useOpportunitiesFilterStore((s) => s.sortDirection);
	const projectTypeSearchInput = useOpportunitiesFilterStore(
		(s) => s.projectTypeSearchInput
	);

	// Store actions
	const updateFilter = useOpportunitiesFilterStore((s) => s.updateFilter);
	const resetFilters = useOpportunitiesFilterStore((s) => s.resetFilters);
	const setSearchQuery = useOpportunitiesFilterStore((s) => s.setSearchQuery);
	const setSortOption = useOpportunitiesFilterStore((s) => s.setSortOption);
	const setSortDirection = useOpportunitiesFilterStore(
		(s) => s.setSortDirection
	);
	const setPage = useOpportunitiesFilterStore((s) => s.setPage);
	const setProjectTypeSearchInput = useOpportunitiesFilterStore(
		(s) => s.setProjectTypeSearchInput
	);

	// --- Zustand store: tracked opportunities ---
	const trackedOpportunityIds = useTrackedOpportunitiesStore(
		(s) => s.trackedOpportunityIds
	);
	const trackedCount = trackedOpportunityIds.length;

	// --- API filter composition (maps store → API params, handles debounce) ---
	const {
		apiFilters,
		projectTypeFilters,
		coverageCountFilters,
		debouncedSearch,
		isInitialized,
	} = useOpportunitiesApiFilters();

	// --- TanStack Query: data fetching with caching ---
	const {
		data: fundingData,
		isLoading: isPageLoading,
		error: queryError,
		refetch,
	} = useOpportunities(apiFilters, {
		enabled: !filters.tracked || isInitialized,
	});

	const { data: projectTypesData, isLoading: isProjectTypesLoading } =
		useProjectTypes(projectTypeFilters);

	const { data: coverageData } = useCoverageCounts(coverageCountFilters);

	// --- Derived values (same variable names as before for JSX compatibility) ---
	const opportunities = fundingData?.data ?? [];
	const totalCount = fundingData?.total_count ?? 0;
	const error = queryError?.message ?? null;
	const availableProjectTypes = projectTypesData?.projectTypes ?? [];
	const projectTypesApiResponse = projectTypesData ?? null;
	const coverageCounts = coverageData?.counts ?? {
		national: null,
		state: null,
		local: null,
		unknown: null,
	};

	// --- Local UI state (pure toggles, not shared) ---
	const [openFilterSection, setOpenFilterSection] = useState(null);
	const [sortMenuOpen, setSortMenuOpen] = useState(false);

	// --- Refs for click-outside detection ---
	const filterContainerRef = useRef(null);
	const sortDropdownRef = useRef(null);

	// US states for dropdown
	const usStates = TAXONOMIES.US_STATES;

	// Reset page when debounced search changes (skip initial render)
	const prevDebouncedSearch = useRef(debouncedSearch);
	useEffect(() => {
		if (prevDebouncedSearch.current !== debouncedSearch) {
			setPage(1);
			prevDebouncedSearch.current = debouncedSearch;
		}
	}, [debouncedSearch, setPage]);

	// Click outside and Escape key listener to close dropdowns
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

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscapeKey);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscapeKey);
		};
	}, [openFilterSection, sortMenuOpen]);

	// Toggle filter section
	const toggleFilterSection = (section) => {
		setOpenFilterSection(openFilterSection === section ? null : section);
	};

	// Handle filter selection
	const handleFilterSelect = (type, value) => {
		// Multi-select filters (arrays)
		if (type === 'projectTypes' || type === 'states' || type === 'status') {
			const current = filters[type];
			const updated = current.includes(value)
				? current.filter((item) => item !== value)
				: [...current, value];
			updateFilter(type, updated);
		} else {
			// Single-select filters
			updateFilter(type, filters[type] === value ? null : value);
			setTimeout(() => setOpenFilterSection(null), 50);
		}
		setPage(1);
	};

	// Clear all filters
	const clearAllFilters = () => {
		resetFilters();
	};

	// Filter project types for search
	const filteredProjectTypes = projectTypeSearchInput
		? availableProjectTypes.filter((type) =>
				type.toLowerCase().includes(projectTypeSearchInput.toLowerCase())
		  )
		: availableProjectTypes;

	// Handle sort option change
	const handleSortSelect = (option) => {
		if (option === sortOption) {
			// Toggle direction if same option is selected
			setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
		} else {
			// Set new option with default direction
			setSortOption(option);
			setSortDirection(option === 'deadline' ? 'asc' : 'desc');
		}
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
		updateFilter('tracked', !filters.tracked);
		setPage(1);
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
		const getStatusButtonLabel = () => {
			if (!filters.status || filters.status.length === 0) {
				return 'Status';
			}
			if (filters.status.length === 1) {
				return `Status: ${formatStatusForDisplay(filters.status[0])}`;
			}
			return `Status (${filters.status.length})`;
		};

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
							openFilterSection === 'status' && filters.status?.length > 0
								? 'bg-blue-100'
								: ''
						)}>
						{getStatusButtonLabel()}
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
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white dark:bg-neutral-800 rounded-md shadow-lg w-48 ring-1 ring-black ring-opacity-5 dark:ring-neutral-600 focus:outline-none'
						tabIndex={-1}
						>
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
											checked={filters.status?.includes(key)}
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
	const totalPages = Math.ceil(totalCount / filters.pageSize);
	const startIndex = (filters.page - 1) * filters.pageSize;
	const endIndex = Math.min(startIndex + filters.pageSize, totalCount);

	// Handle page change
	const handlePageChange = (newPage) => {
		setPage(newPage);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

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
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white dark:bg-neutral-800 rounded-md shadow-lg w-80 ring-1 ring-black ring-opacity-5 dark:ring-neutral-600 focus:outline-none'
						tabIndex={-1}
						>
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
											updateFilter('projectTypes', []);
											setPage(1);
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
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white dark:bg-neutral-800 rounded-md shadow-lg w-64 ring-1 ring-black ring-opacity-5 dark:ring-neutral-600 focus:outline-none'
						tabIndex={-1}
						>
						<div className='p-4'>
							{/* All States option */}
							<div
								className='flex items-center py-2 cursor-pointer hover:bg-gray-50 mb-2 border-b border-gray-200 pb-2'
								onClick={() => {
									updateFilter('state', null);
									setPage(1);
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
											updateFilter('state', state.code);
											setPage(1);
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
							selectedCount !== DEFAULT_FILTERS.coverageTypes.length ? 'bg-blue-100' : ''
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
						className='absolute left-0 z-20 mt-2 origin-top-left bg-white dark:bg-neutral-800 rounded-md shadow-lg w-56 ring-1 ring-black ring-opacity-5 dark:ring-neutral-600 focus:outline-none'
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
										const newCoverageTypes = isChecked
											? filters.coverageTypes.filter(t => t !== option.value)
											: [...filters.coverageTypes, option.value];
										updateFilter('coverageTypes', newCoverageTypes);
										setPage(1);
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
							{filters.coverageTypes.length !== DEFAULT_FILTERS.coverageTypes.length ||
							!DEFAULT_FILTERS.coverageTypes.every(t => filters.coverageTypes.includes(t)) ? (
								<div className='mt-3 pt-3 border-t border-gray-200'>
									<Button
										variant='link'
										size='sm'
										className='text-blue-600 hover:text-blue-800 p-0'
										onClick={() => {
											updateFilter('coverageTypes', [...DEFAULT_FILTERS.coverageTypes]);
											setPage(1);
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
								updateFilter('tracked', false);
								setPage(1);
							}}
						/>
					</span>
				)}

				{/* Status filters - only show when different from default */}
				{(() => {
					const isDefaultStatus = filters.status?.length === DEFAULT_FILTERS.status.length &&
						DEFAULT_FILTERS.status.every(s => filters.status?.includes(s));
					if (isDefaultStatus) return null;
					return filters.status?.map((status) => (
						<span
							key={status}
							className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
							style={{
								backgroundColor: 'white',
								color: getStatusColor(status),
								borderWidth: '1px',
								borderStyle: 'solid',
								borderColor: getStatusColor(status) + '50',
							}}>
							{formatStatusForDisplay(status)}
							<X
								size={14}
								className='cursor-pointer'
								onClick={() => {
									updateFilter('status', filters.status.filter((s) => s !== status));
									setPage(1);
								}}
							/>
						</span>
					));
				})()}

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
									updateFilter(
										'projectTypes',
										filters.projectTypes.filter((t) => t !== projectType)
									);
									setPage(1);
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
								updateFilter('state', null);
								setPage(1);
							}}
						/>
					</span>
				)}

				{/* Coverage type filters (only show if not default) */}
				{(filters.coverageTypes.length !== DEFAULT_FILTERS.coverageTypes.length ||
				!DEFAULT_FILTERS.coverageTypes.every(t => filters.coverageTypes.includes(t))) && (
					<span className='flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium'>
						Coverage: {filters.coverageTypes.join(', ')}
						<X
							size={14}
							className='cursor-pointer'
							onClick={() => {
								updateFilter('coverageTypes', [...DEFAULT_FILTERS.coverageTypes]);
								setPage(1);
							}}
						/>
					</span>
				)}

				{/* Search query */}
				{debouncedSearch && (
					<span className='flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium'>
						Search: {debouncedSearch}
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
		const hasNonDefaultCoverage = filters.coverageTypes.length !== DEFAULT_FILTERS.coverageTypes.length ||
			!DEFAULT_FILTERS.coverageTypes.every(t => filters.coverageTypes.includes(t));

		const hasNonDefaultStatus = filters.status?.length !== DEFAULT_FILTERS.status.length ||
			!DEFAULT_FILTERS.status.every(s => filters.status?.includes(s));

		return (
			hasNonDefaultStatus ||
			filters.projectTypes.length > 0 ||
			filters.state !== null ||
			hasNonDefaultCoverage ||
			debouncedSearch !== '' ||
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
				<div className='bg-white dark:bg-neutral-900 dark:border dark:border-neutral-700 rounded-xl shadow-sm p-4 mb-6'>
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
								<div className='absolute right-0 top-full mt-1 w-44 bg-white dark:bg-neutral-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-neutral-600 py-1'>
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
							onClick={() => refetch()}>
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

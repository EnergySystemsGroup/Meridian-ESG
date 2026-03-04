'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';
import { stateNameToCode } from '@/lib/utils/stateAbbreviations';
import {
	useFundingByState,
	useMapOpportunities,
	useScopeBreakdown,
	useCategoryMapping,
} from '@/lib/hooks/queries';
import { useMapFilterStore } from '@/lib/stores/mapFilterStore';
import { useMapUrlSync } from '@/hooks/useMapUrlSync';
import { useMapApiFilters } from '@/hooks/useMapApiFilters';

// Dynamically import the map component with SSR disabled
const FundingMapClient = dynamic(
	() => import('@/components/map/FundingMapClient'),
	{
		ssr: false,
		loading: () => (
			<div className='flex items-center justify-center h-[500px]'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
			</div>
		),
	}
);

function formatFundingAmount(value) {
	if (!value) return '0';
	if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
	if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
	if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
	return value.toLocaleString();
}

function formatAmount(minimum, maximum, total) {
	const formatWithSuffix = (num) => {
		if (!num && num !== 0) return null;
		if (num >= 1000000) {
			return `$${(num / 1000000).toLocaleString(undefined, {
				maximumFractionDigits: 1,
				minimumFractionDigits: 0,
			})}M`;
		}
		return `$${(num / 1000).toLocaleString(undefined, {
			maximumFractionDigits: 0,
		})}K`;
	};

	if (minimum && maximum) return `${formatWithSuffix(minimum)} - ${formatWithSuffix(maximum)}`;
	if (maximum) return `Up to ${formatWithSuffix(maximum)}`;
	if (minimum) return `From ${formatWithSuffix(minimum)}`;
	if (total) return `${formatWithSuffix(total)} total`;
	return 'Amount not specified';
}

// Main map content component
function MapPageContent() {
	// --- URL sync (bidirectional: URL <-> store) ---
	useMapUrlSync();

	// --- Zustand store: filter/sort/view state ---
	const filters = useMapFilterStore((s) => s.filters);
	const selectedStateCode = useMapFilterStore((s) => s.selectedStateCode);
	const selectedStateName = useMapFilterStore((s) => s.selectedStateName);
	const viewMode = useMapFilterStore((s) => s.viewMode);
	const colorBy = useMapFilterStore((s) => s.colorBy);
	const sortOption = useMapFilterStore((s) => s.sortOption);
	const sortDirection = useMapFilterStore((s) => s.sortDirection);

	// Store actions
	const updateFilter = useMapFilterStore((s) => s.updateFilter);
	const resetFilters = useMapFilterStore((s) => s.resetFilters);
	const setSelectedState = useMapFilterStore((s) => s.setSelectedState);
	const clearSelectedState = useMapFilterStore((s) => s.clearSelectedState);
	const setColorBy = useMapFilterStore((s) => s.setColorBy);
	const setSortOption = useMapFilterStore((s) => s.setSortOption);
	const setSortDirection = useMapFilterStore((s) => s.setSortDirection);
	const setPage = useMapFilterStore((s) => s.setPage);

	// --- API filter composition ---
	const { fundingByStateFilters, opportunitiesFilters, scopeBreakdownFilters } =
		useMapApiFilters();

	// --- TanStack Query: data fetching with caching ---
	const { data: fundingByStateData, isLoading: loading, error: queryError } =
		useFundingByState(fundingByStateFilters);

	const { data: oppData, isLoading: oppsLoading } =
		useMapOpportunities(opportunitiesFilters);

	const { data: scopeData } = useScopeBreakdown(
		selectedStateCode || 'US',
		scopeBreakdownFilters
	);

	useCategoryMapping(); // Pre-warm cache; not directly consumed on this page

	// --- Derived values ---
	const fundingData = fundingByStateData?.data ?? [];
	const totalFundingAvailable = fundingByStateData?.totalFunding ?? 0;
	const totalOpportunities = fundingByStateData?.totalOpportunities ?? 0;
	const statesWithFunding = fundingByStateData?.statesWithFunding ?? 0;
	const error = queryError?.message ?? null;

	const nationalOpportunities = oppData?.data?.opportunities ?? [];
	const nationalTotalCount = oppData?.data?.total ?? 0;
	const scopeBreakdown = scopeData?.data ?? null;

	// --- Event handlers ---
	const handleStateClick = (geo) => {
		const stateName = geo.properties.name;
		const stateCode = stateNameToCode[stateName] || null;
		if (selectedStateName === stateName) {
			clearSelectedState();
		} else {
			setSelectedState(stateCode, stateName);
		}
	};

	const handleFilterChange = (filterKey, value) => {
		updateFilter(filterKey, value);
		if (filterKey !== 'page') {
			setPage(1);
		}
	};

	const handleResetFilters = () => {
		resetFilters();
	};

	const handleSortChange = (newOption, newDirection) => {
		setSortOption(newOption);
		setSortDirection(newDirection);
	};

	const handleBackToUS = () => {
		clearSelectedState();
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6'>
					{/* Header with title and navigation */}
					<div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4'>
						<div className='flex flex-wrap items-center gap-2 sm:gap-4'>
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
								{viewMode === 'us' && !selectedStateName && 'Funding Map'}
								{viewMode === 'us' && selectedStateName && `${selectedStateName} Opportunities`}
								{viewMode === 'state' && `${selectedStateName} Opportunities`}
							</h1>
						</div>

						<div className='hidden sm:flex items-center gap-2 text-sm text-muted-foreground'>
							{viewMode === 'us' && !selectedStateName && (
								<span className='flex items-center gap-1'>
									<Globe className='h-4 w-4' /> Nationwide View
								</span>
							)}
							{(viewMode === 'us' && selectedStateName) || viewMode === 'state' ? (
								<span className='flex items-center gap-1'>
									<Building2 className='h-4 w-4' /> State View
								</span>
							) : null}
						</div>
					</div>

					{/* Filter Row */}
					<div className='border rounded-lg shadow-sm mb-6 p-4 dark:border-neutral-700'>
						<div className='flex flex-wrap items-center gap-3 md:gap-4'>
							{/* Search Box */}
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

							{/* Filter elements */}
							<div className='flex flex-wrap items-center gap-2 sm:gap-3 flex-1 order-2'>
								<StatusFilter
									value={Array.isArray(filters.status) ? filters.status : [filters.status]}
									onChange={(newStatus) => handleFilterChange('status', newStatus)}
								/>

								<ProjectTypesFilter
									value={filters.projectTypes || []}
									onChange={(newTypes) => handleFilterChange('projectTypes', newTypes)}
								/>

								<CoverageAreaFilter
									value={filters.scope || ['national', 'state_wide', 'county', 'utility']}
									onChange={(newScope) => handleFilterChange('scope', newScope)}
									stateCode={selectedStateCode}
									filters={{
										status: filters.status,
										projectTypes: filters.projectTypes,
									}}
								/>

								<OpportunitySortDropdown
									value={sortOption}
									direction={sortDirection}
									onChange={handleSortChange}
								/>
							</div>

							<Button
								variant='outline'
								onClick={handleResetFilters}
								className='h-10 px-3 sm:px-4 whitespace-nowrap order-3 sm:order-last'>
								Reset
							</Button>
						</div>

						{/* Active Filter Pills */}
						{(() => {
							const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
							const isDefaultStatus = statusArray.length === 2 &&
								statusArray.includes('Open') && statusArray.includes('Upcoming');
							const isDefaultScope = filters.scope?.length === 4;
							const hasActiveFilters = !isDefaultStatus ||
								filters.projectTypes?.length > 0 ||
								filters.search ||
								!isDefaultScope;

							return hasActiveFilters && (
								<div className='flex flex-wrap gap-2 mt-3 pt-3 border-t'>
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

									{!isDefaultScope && filters.scope?.length > 0 && (
										<span className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'>
											Coverage ({filters.scope.length})
											<X
												className='h-3 w-3 cursor-pointer hover:text-purple-600'
												onClick={() => handleFilterChange('scope', ['national', 'state_wide', 'county', 'utility'])}
											/>
										</span>
									)}

									{filters.search && (
										<span className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-neutral-200'>
											Search: &quot;{filters.search}&quot;
											<X
												className='h-3 w-3 cursor-pointer hover:text-gray-600'
												onClick={() => handleFilterChange('search', '')}
											/>
										</span>
									)}

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
									selectedState={selectedStateName}
									onStateClick={handleStateClick}
									stateAbbreviations={stateNameToCode}
								/>
							</CardContent>
						</Card>

						{/* Summary Stats Card */}
						<Card className='mt-6'>
							<CardHeader className='pb-2'>
								<CardTitle className='text-base'>
									{viewMode === 'us' && 'Funding Summary'}
									{viewMode === 'state' && `${selectedStateName || 'State'} Summary`}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className='space-y-3'>
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

									{viewMode === 'state' && selectedStateName && (
										<>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>State Opportunities</span>
												<span className='font-semibold text-lg'>{nationalTotalCount.toLocaleString()}</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='text-muted-foreground text-sm'>State Funding</span>
												<span className='font-semibold text-lg text-green-600 dark:text-green-400'>
													${formatFundingAmount(fundingData.find(d => d.state === selectedStateName)?.value || 0)}
												</span>
											</div>
										</>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Side Panel */}
					<div className='lg:col-span-4'>
						<Card>
							<CardHeader className='pb-2'>
								<CardTitle className='flex items-center'>
									{selectedStateName ? (
										<>
											<Building2 className='h-5 w-5 mr-2' />
											{selectedStateName}
										</>
									) : (
										<>
											<Globe className='h-5 w-5 mr-2' />
											United States
										</>
									)}
								</CardTitle>
								<CardDescription>
									{oppsLoading
										? 'Loading opportunities...'
										: selectedStateName
											? `${nationalTotalCount.toLocaleString()} opportunities for ${selectedStateName}`
											: `${nationalTotalCount.toLocaleString()} opportunities nationwide`}
								</CardDescription>
							</CardHeader>
							<div className='px-6'>
								<div className='h-[1px] bg-[#E0E0E0] my-3'></div>
							</div>
							<CardContent className='pt-0'>
								<ScopeSummary
									breakdown={scopeBreakdown || {}}
									selectedScopes={filters.scope || ['national', 'state_wide', 'county', 'utility']}
									className="mb-4"
								/>

								<div className='h-[1px] bg-[#E0E0E0] my-4'></div>

								{/* Opportunities List */}
								<div>
									<div className='flex justify-between items-center mb-3'>
										<h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
											Opportunities
										</h4>
										{nationalTotalCount > 10 && !oppsLoading && (
											<div className='flex items-center gap-2'>
												<span className='text-xs text-muted-foreground'>
													{filters.page > 1 ? `${(filters.page - 1) * 10 + 1}-${Math.min(filters.page * 10, nationalTotalCount)}` : `1-${Math.min(10, nationalTotalCount)}`} of {nationalTotalCount.toLocaleString()}
												</span>
												<div className='flex gap-1'>
													<Button
														size='icon'
														variant='ghost'
														className='h-7 w-7'
														disabled={filters.page === 1}
														onClick={() => setPage(filters.page - 1)}>
														<ChevronLeft className='h-4 w-4' />
													</Button>
													<Button
														size='icon'
														variant='ghost'
														className='h-7 w-7'
														disabled={filters.page >= Math.ceil(nationalTotalCount / 10)}
														onClick={() => setPage(filters.page + 1)}>
														<ChevronRight className='h-4 w-4' />
													</Button>
												</div>
											</div>
										)}
										{nationalTotalCount > 0 && nationalTotalCount <= 10 && !oppsLoading && (
											<span className='text-xs text-muted-foreground'>
												{nationalTotalCount.toLocaleString()} total
											</span>
										)}
									</div>

									{oppsLoading ? (
										<div className='flex justify-center py-8'>
											<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
										</div>
									) : nationalOpportunities.length > 0 ? (
										<>
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
																			<div>
																				<p className='text-sm font-medium mb-2'>Program Overview</p>
																				<p className='text-xs leading-relaxed'>
																					{opp.program_overview || opp.actionable_summary || opp.summary || 'No overview available.'}
																				</p>
																			</div>
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
																			<div>
																				<p className='text-sm font-medium mb-2'>Who Can Apply</p>
																				<p className='text-xs'>
																					{opp.eligible_applicants?.join(', ') || 'Eligible organizations'}
																				</p>
																			</div>
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
																			<Link
																				href={`/funding/opportunities/${opp.id}`}
																				className='block w-full text-center text-xs font-medium bg-white hover:bg-gray-100 text-blue-700 py-2 rounded-md transition-colors'>
																				View Full Opportunity
																			</Link>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
																{opp.funding_type && (() => {
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

											{nationalTotalCount > 10 && (
												<div className='flex justify-between items-center pt-4 mt-4 border-t'>
													<Button
														variant='outline'
														size='sm'
														disabled={filters.page === 1}
														onClick={() => setPage(filters.page - 1)}>
														Previous
													</Button>
													<span className='text-sm text-muted-foreground'>
														Page {filters.page} of {Math.ceil(nationalTotalCount / 10)}
													</span>
													<Button
														variant='outline'
														size='sm'
														disabled={filters.page >= Math.ceil(nationalTotalCount / 10)}
														onClick={() => setPage(filters.page + 1)}>
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
					<div className='h-8 bg-gray-200 dark:bg-neutral-700 rounded w-1/4 mb-6'></div>
					<div className='border rounded-lg p-4 mb-6'>
						<div className='flex gap-4'>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-48'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-32'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-32'></div>
							<div className='h-10 bg-gray-200 dark:bg-neutral-700 rounded w-48'></div>
						</div>
					</div>
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

export default function Page() {
	return (
		<Suspense fallback={<MapPageFallback />}>
			<MapPageContent />
		</Suspense>
	);
}

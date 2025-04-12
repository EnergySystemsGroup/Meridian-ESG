'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MainLayout from '@/app/components/layout/main-layout';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from 'react-simple-maps';
import { scaleQuantile } from 'd3-scale';
import { geoCentroid } from 'd3-geo';
import {
	MapPin,
	Filter,
	DollarSign,
	Calendar,
	Info,
	ChevronDown,
	Tag,
	Star,
} from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/app/components/ui/select';
import { Slider } from '@/app/components/ui/slider';
import { Badge } from '@/app/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { format } from 'date-fns';
import { CalendarIcon } from '@radix-ui/react-icons';
import { cn } from '@/app/lib/utils';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/app/components/ui/popover';
import { Calendar as CalendarComponent } from '@/app/components/ui/calendar';

// Dynamically import the map component with SSR disabled
const FundingMapClient = dynamic(
	() => import('@/app/components/map/FundingMapClient'),
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

// Dynamically import the filter sidebar component
const FilterSidebar = dynamic(
	() => import('@/app/components/map/FilterSidebar'),
	{ ssr: false } // No specific loader needed for sidebar initially
);

// US States GeoJSON
const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

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

export default function Page() {
	const [fundingData, setFundingData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedState, setSelectedState] = useState('California');
	const [stateOpportunities, setStateOpportunities] = useState([]);
	const [stateOpportunitiesPage, setStateOpportunitiesPage] = useState(1);
	const [stateOpportunitiesTotalCount, setStateOpportunitiesTotalCount] =
		useState(0);
	const [stateOpportunitiesLoading, setStateOpportunitiesLoading] =
		useState(false);
	const [colorBy, setColorBy] = useState('amount'); // 'amount' or 'count'
	const [tooltip, setTooltip] = useState({
		show: false,
		content: {},
		position: { x: 0, y: 0 },
	});
	const [activeLayer, setActiveLayer] = useState('federal'); // federal, state, all
	const [totalFundingAvailable, setTotalFundingAvailable] = useState(0);
	const [totalOpportunities, setTotalOpportunities] = useState(0);
	const [statesWithFunding, setStatesWithFunding] = useState(0);
	const [filters, setFilters] = useState({
		minAmount: 0,
		maxAmount: 0,
		status: 'all', // all, Open, Upcoming, Closed
		sourceType: 'all', // all, Federal, State, Local, Private
		categories: [], // Now an array for multiple selection
		showNational: true,
		deadlineRange: {
			start: null,
			end: null,
		},
	});

	useEffect(() => {
		async function fetchFundingData() {
			try {
				setLoading(true);
				// Build query parameters
				const queryParams = new URLSearchParams();

				if (filters.status !== 'all') {
					queryParams.append('status', filters.status);
				}
				if (filters.sourceType !== 'all') {
					queryParams.append('source_type', filters.sourceType);
				}
				if (filters.categories?.length > 0) {
					queryParams.append('categories', filters.categories.join(','));
				}
				if (filters.minAmount > 0) {
					queryParams.append('min_amount', filters.minAmount);
				}
				// Only include max_amount parameter if it's greater than 0
				if (filters.maxAmount > 0) {
					queryParams.append('max_amount', filters.maxAmount);
				}
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

					// Set state with the data
					setFundingData(result.data);

					// Set the funding summary metrics from API response
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
	}, [filters]);

	// When a state is selected, fetch opportunities for that state
	useEffect(() => {
		async function fetchStateOpportunities() {
			if (!selectedState) {
				setStateOpportunities([]);
				setStateOpportunitiesTotalCount(0);
				return;
			}

			try {
				setStateOpportunitiesLoading(true);
				const stateCode = stateAbbreviations[selectedState];
				if (!stateCode) {
					console.error('No state code found for:', selectedState);
					return;
				}

				// Build query parameters
				const queryParams = new URLSearchParams();

				// Pagination
				queryParams.append('page', stateOpportunitiesPage.toString());
				queryParams.append('pageSize', '5'); // 5 items per page

				// Filters
				if (filters.status !== 'all') {
					queryParams.append('status', filters.status);
				}
				if (filters.sourceType !== 'all') {
					queryParams.append('source_type', filters.sourceType);
				}
				if (filters.categories?.length > 0) {
					queryParams.append('categories', filters.categories.join(','));
				}
				if (filters.minAmount > 0) {
					queryParams.append('min_amount', filters.minAmount);
				}
				// Only include max_amount parameter if it's greater than 0
				if (filters.maxAmount > 0) {
					queryParams.append('max_amount', filters.maxAmount);
				}
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

				const response = await fetch(
					`/api/map/opportunities/${stateCode}?${queryParams}`
				);
				const result = await response.json();

				if (result.success) {
					// Format the data for display
					const formattedOpportunities = result.data.opportunities.map(
						(opp) => ({
							id: opp.id,
							title: opp.title,
							amount: formatAmount(
								opp.minimum_award,
								opp.maximum_award,
								opp.total_funding_available
							),
							closeDate:
								opp.close_date && new Date(opp.close_date).getFullYear() > 1970
									? new Date(opp.close_date).toLocaleDateString()
									: 'No deadline specified',
							source: opp.source_name,
							sourceType: opp.source_type,
							status: opp.status,
							isNational: opp.is_national,
							actionable_summary: opp.actionable_summary,
							description: opp.description,
							tags: opp.tags || [],
							categories: opp.categories || [],
							eligible_applicants: opp.eligible_applicants || [],
							eligible_project_types: opp.eligible_project_types || [],
							eligible_locations: opp.eligible_locations || [],
							relevance_score: opp.relevance_score,
							url: opp.url,
							funding_type: opp.funding_type,
							agency_name: opp.agency_name,
						})
					);

					setStateOpportunities(formattedOpportunities);
					setStateOpportunitiesTotalCount(
						result.data.total || formattedOpportunities.length
					);
				} else {
					console.error('Error in API response:', result.error);
					setError(result.error);
				}
			} catch (err) {
				console.error('Error fetching state opportunities:', err);
				setError(err.message);
			} finally {
				setStateOpportunitiesLoading(false);
			}
		}

		fetchStateOpportunities();
	}, [selectedState, filters, stateOpportunitiesPage]);

	// Generate color scale based on either funding amounts or opportunity count
	const colorScale = scaleQuantile()
		.domain(
			fundingData.map((d) => (colorBy === 'amount' ? d.value : d.opportunities))
		)
		.range([
			'#e6f7ff',
			'#bae7ff',
			'#91d5ff',
			'#69c0ff',
			'#40a9ff',
			'#1890ff',
			'#096dd9',
			'#0050b3',
			'#003a8c',
		]);

	const handleStateClick = (geo) => {
		const stateName = geo.properties.name;
		setSelectedState(selectedState === stateName ? null : stateName);
		setStateOpportunitiesPage(1);
	};

	const handleLayerChange = (layer) => {
		setActiveLayer(layer);
		// If we're changing layers, clear the selected state
		if (selectedState) {
			// But keep the same state selected, just update the opportunities
			const mockOpportunities = generateMockOpportunitiesForState(
				selectedState,
				layer
			);
			setStateOpportunities(mockOpportunities);
		}
	};

	const handleFilterChange = (filterKey, value) => {
		setFilters({
			...filters,
			[filterKey]: value,
		});
		// Reset pagination when changing filters
		setStateOpportunitiesPage(1);
	};

	const handleResetFilters = () => {
		setFilters({
			minAmount: 0,
			maxAmount: 0,
			status: 'all',
			sourceType: 'all',
			categories: [],
			showNational: true,
			deadlineRange: {
				start: null,
				end: null,
			},
		});
		// Reset pagination
		setStateOpportunitiesPage(1);
	};

	const handlePageChange = (newPage, e) => {
		// Prevent any default behavior that might trigger a page reload
		if (e) e.preventDefault();
		setStateOpportunitiesPage(newPage);
	};

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
				<div className='flex flex-col gap-4 mb-6'>
					<div className='flex justify-between items-center'>
						<h1 className='text-3xl font-bold'>Funding Map</h1>
					</div>

					{/* Filter Row - Above the map */}
					<div className='border rounded-lg shadow-sm mb-6 p-4'>
						<div className='flex items-center gap-6'>
							{/* Filters label */}
							<div className='flex items-center gap-2 text-sm font-medium text-muted-foreground whitespace-nowrap'>
								<Filter className='h-4 w-4' />
								<span>Filters:</span>
							</div>

							{/* Filter elements container with equal spacing */}
							<div className='flex items-center gap-6 flex-1 justify-center'>
								{/* Status Filter */}
								<div className='w-[160px]'>
									<Select
										value={filters.status}
										onValueChange={(value) =>
											handleFilterChange('status', value)
										}>
										<SelectTrigger className='h-10'>
											<SelectValue placeholder='All Status' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='all'>All Status</SelectItem>
											<SelectItem value='Open'>Open</SelectItem>
											<SelectItem value='Upcoming'>Upcoming</SelectItem>
											<SelectItem value='Closed'>Closed</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* Categories Filter */}
								<div className='w-[160px]'>
									<FilterSidebar
										filters={filters}
										onFilterChange={handleFilterChange}
										onResetFilters={handleResetFilters}
										horizontal={true}
										categoriesOnly={true}
									/>
								</div>

								{/* Source Type Filter */}
								<div className='w-[160px]'>
									<Select
										value={filters.sourceType}
										onValueChange={(value) =>
											handleFilterChange('sourceType', value)
										}>
										<SelectTrigger className='h-10'>
											<SelectValue placeholder='All Sources' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='all'>All Sources</SelectItem>
											<SelectItem value='Federal'>Federal</SelectItem>
											<SelectItem value='State'>State</SelectItem>
											<SelectItem value='Local'>Local</SelectItem>
											<SelectItem value='Private'>Private</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* Award Amount Filter with improved label spacing */}
								<div className='w-[220px]'>
									<div className='flex justify-between mb-1'>
										<span className='text-sm font-medium'>Award Amount:</span>
										<span className='text-sm text-blue-600'>
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
							</div>

							{/* Reset Button */}
							<Button
								variant='outline'
								onClick={handleResetFilters}
								className='h-10 px-4 whitespace-nowrap'>
								Reset
							</Button>
						</div>
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
					{/* Map Column */}
					<div className='lg:col-span-8'>
						<Card>
							<CardHeader>
								<div className='flex justify-between items-center'>
									<CardTitle>Geographic Distribution</CardTitle>
									<div className='flex gap-2'>
										<Button
											variant={colorBy === 'amount' ? 'default' : 'outline'}
											onClick={() => setColorBy('amount')}>
											Color by Amount
										</Button>
										<Button
											variant={colorBy === 'count' ? 'default' : 'outline'}
											onClick={() => setColorBy('count')}>
											Color by Count
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{/* Render the dynamically imported map component */}
								<CardContent className='p-0 relative'>
									<FundingMapClient
										loading={loading}
										error={error}
										fundingData={(() => {
											// Debug log right before passing data to FundingMapClient
											const california = fundingData.find(
												(d) => d.state === 'California'
											);
											console.log(
												'Page right before passing fundingData - California:',
												california
											);
											return fundingData;
										})()}
										colorBy={colorBy}
										selectedState={selectedState}
										onStateClick={handleStateClick}
										stateAbbreviations={stateAbbreviations}
									/>
								</CardContent>
							</CardContent>
						</Card>

						{/* Summary Stats Card - Moved below map */}
						<Card className='mt-6'>
							<CardHeader>
								<CardTitle>Funding Summary</CardTitle>
							</CardHeader>
							<CardContent>
								<div className='space-y-2'>
									<div className='flex justify-between'>
										<span className='text-muted-foreground'>
											Total Opportunities:
										</span>
										<span className='font-medium'>{totalOpportunities}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-muted-foreground'>
											Total Funding:
										</span>
										<span className='font-medium'>
											${formatFundingAmount(totalFundingAvailable)}
										</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-muted-foreground'>
											States with Funding:
										</span>
										<span className='font-medium'>{statesWithFunding}</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* State Details Column - Now directly parallel to map */}
					<div className='lg:col-span-4'>
						{/* State Details Card */}
						{selectedState ? (
							<Card>
								<CardHeader className='pb-2'>
									<CardTitle className='flex items-center'>
										<MapPin className='h-5 w-5 mr-2' />
										{selectedState}
									</CardTitle>
									<CardDescription>
										{stateOpportunitiesLoading
											? 'Loading opportunities...'
											: `Showing ${
													stateOpportunities.length
														? `${
																(stateOpportunitiesPage - 1) * 5 + 1
														  }-${Math.min(
																stateOpportunitiesPage * 5,
																stateOpportunitiesTotalCount
														  )} of ${stateOpportunitiesTotalCount}`
														: '0'
											  } opportunities`}
									</CardDescription>
									{/* Pagination controls after the state label */}
									{stateOpportunities.length > 0 &&
										stateOpportunitiesTotalCount > 5 && (
											<div className='flex justify-between items-center mt-4 pt-2 border-t'>
												<Button
													variant='outline'
													size='sm'
													disabled={stateOpportunitiesPage === 1}
													onClick={(e) =>
														handlePageChange(stateOpportunitiesPage - 1, e)
													}>
													Previous
												</Button>
												<span className='text-sm text-muted-foreground'>
													Page {stateOpportunitiesPage} of{' '}
													{Math.ceil(stateOpportunitiesTotalCount / 5)}
												</span>
												<Button
													variant='outline'
													size='sm'
													disabled={
														stateOpportunitiesPage >=
														Math.ceil(stateOpportunitiesTotalCount / 5)
													}
													onClick={(e) =>
														handlePageChange(stateOpportunitiesPage + 1, e)
													}>
													Next
												</Button>
											</div>
										)}
								</CardHeader>
								{/* Horizontal divider */}
								<div className='px-6'>
									<div className='h-[1px] bg-[#E0E0E0] my-3'></div>
								</div>
								<CardContent className='pt-0'>
									<div className='space-y-4'>
										{stateOpportunitiesLoading ? (
											<div className='flex justify-center py-8'>
												<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
											</div>
										) : stateOpportunities.length > 0 ? (
											<>
												<div className='space-y-4 animate-fadeIn'>
													{stateOpportunities.map((opportunity, index) => (
														<div
															key={opportunity.id || index}
															className='border-b pb-3 last:border-b-0 last:pb-0'>
															<div className='flex justify-between'>
																<h3 className='font-medium text-sm mt-0.5'>
																	{opportunity.title}
																</h3>
																<Badge
																	variant={
																		opportunity.status === 'Open'
																			? 'default'
																			: opportunity.status === 'Upcoming'
																			? 'success'
																			: 'destructive'
																	}
																	className='h-7 px-3 flex items-center justify-center min-w-[70px] self-start'>
																	{opportunity.status}
																</Badge>
															</div>
															<div className='flex justify-between text-xs text-muted-foreground mt-1'>
																<div className='flex items-center flex-1 min-w-0 mr-2 truncate'>
																	{opportunity.amount}
																</div>
																<div className='flex items-center flex-shrink-0'>
																	<Calendar className='h-3 w-3 mr-1' />
																	{opportunity.closeDate}
																</div>
															</div>
															<div className='mt-1 text-xs text-muted-foreground flex items-center gap-1'>
																<span>{opportunity.source}</span>
																<TooltipProvider>
																	<Tooltip delayDuration={100}>
																		<TooltipTrigger asChild>
																			<button className='text-blue-500 focus:outline-none'>
																				<Info className='h-3 w-3' />
																			</button>
																		</TooltipTrigger>
																		<TooltipContent
																			side='top'
																			align='start'
																			className='w-80 p-4 space-y-3 shadow-md rounded-lg bg-blue-600 text-white'>
																			{/* Actionable Summary */}
																			<div>
																				<p className='text-sm font-medium mb-2'>
																					Actionable Summary
																				</p>
																				<p className='text-xs'>
																					{opportunity.actionable_summary ||
																						opportunity.description ||
																						`${
																							opportunity.title
																						} funding is available for ${
																							opportunity.sourceType
																								? opportunity.sourceType.toLowerCase()
																								: ''
																						} projects. Apply by ${
																							opportunity.closeDate
																						}.`}
																				</p>
																			</div>

																			{/* Tags */}
																			<div>
																				<p className='text-sm font-medium mb-2'>
																					Tags
																				</p>
																				<div className='flex flex-wrap gap-1'>
																					{opportunity.tags &&
																					opportunity.tags.length > 0
																						? opportunity.tags.map((tag, i) => (
																								<span
																									key={i}
																									className='inline-flex px-2 py-0.5 rounded-full bg-white text-blue-700 text-xs'>
																									{tag}
																								</span>
																						  ))
																						: [
																								opportunity.sourceType,
																								opportunity.status,
																								...(opportunity.categories &&
																								opportunity.categories.length
																									? [opportunity.categories[0]]
																									: []),
																								opportunity.isNational
																									? 'National'
																									: 'State-specific',
																						  ].map((tag, i) => (
																								<span
																									key={i}
																									className='inline-flex px-2 py-0.5 rounded-full bg-white text-blue-700 text-xs'>
																									{tag}
																								</span>
																						  ))}
																				</div>
																			</div>

																			{/* Eligible Applicants */}
																			<div>
																				<p className='text-sm font-medium mb-2'>
																					Who Can Apply
																				</p>
																				<div className='text-xs'>
																					{opportunity.eligible_applicants &&
																					opportunity.eligible_applicants
																						.length > 0
																						? opportunity.eligible_applicants.join(
																								', '
																						  )
																						: 'Eligible organizations in this state'}
																				</div>
																			</div>

																			{/* Relevance Meter */}
																			<div>
																				<div className='flex justify-between mb-1'>
																					<p className='text-sm font-medium'>
																						Relevance
																					</p>
																					<span className='text-xs'>
																						{Math.min(
																							10,
																							opportunity.relevance_score || 4
																						).toFixed(1)}
																						/10
																					</span>
																				</div>
																				<div className='h-2 w-full bg-blue-800 rounded-full overflow-hidden'>
																					<div
																						className={`h-full ${
																							(opportunity.relevance_score ||
																								4) >= 8
																								? 'bg-green-400'
																								: (opportunity.relevance_score ||
																										4) >= 6
																								? 'bg-orange-400'
																								: 'bg-gray-400'
																						}`}
																						style={{
																							width: `${
																								(Math.min(
																									10,
																									opportunity.relevance_score ||
																										4
																								) /
																									10) *
																								100
																							}%`,
																						}}></div>
																				</div>
																			</div>

																			{/* Action Button */}
																			<Link
																				href={`/funding/opportunities/${opportunity.id}`}
																				className='block w-full text-center text-xs font-medium bg-white hover:bg-gray-100 text-blue-700 py-2 rounded-md transition-colors'>
																				View Full Opportunity
																			</Link>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
															</div>
															<div className='mt-2'>
																<Button
																	size='sm'
																	variant='outline'
																	className='w-full text-xs'
																	asChild>
																	<Link
																		href={`/funding/opportunities/${opportunity.id}`}>
																		View Details
																	</Link>
																</Button>
															</div>
														</div>
													))}
												</div>

												{/* Bottom pagination controls */}
												{stateOpportunitiesTotalCount > 5 && (
													<div className='flex justify-between items-center pt-4 mt-2 border-t'>
														<Button
															variant='outline'
															size='sm'
															disabled={stateOpportunitiesPage === 1}
															onClick={(e) =>
																handlePageChange(stateOpportunitiesPage - 1, e)
															}>
															Previous
														</Button>
														<span className='text-sm text-muted-foreground'>
															Page {stateOpportunitiesPage} of{' '}
															{Math.ceil(stateOpportunitiesTotalCount / 5)}
														</span>
														<Button
															variant='outline'
															size='sm'
															disabled={
																stateOpportunitiesPage >=
																Math.ceil(stateOpportunitiesTotalCount / 5)
															}
															onClick={(e) =>
																handlePageChange(stateOpportunitiesPage + 1, e)
															}>
															Next
														</Button>
													</div>
												)}
											</>
										) : (
											<p className='text-muted-foreground text-sm'>
												No opportunities found for {selectedState} with the
												current filters.
											</p>
										)}
									</div>
								</CardContent>
							</Card>
						) : (
							<Card>
								<CardHeader>
									<CardTitle>State Details</CardTitle>
								</CardHeader>
								<CardContent>
									<p className='text-muted-foreground text-center py-8'>
										Select a state on the map to view available funding
										opportunities.
									</p>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

// Remove the mock data generation functions as they are no longer needed here
/*
function generateMockStateData() {
	// ... implementation ...
}

function generateMockOpportunitiesForState(state, layer) {
	// ... implementation ...
}

function getRandomFundingType() {
	// ... implementation ...
}

function getRandomSector() {
	// ... implementation ...
}

function getRandomFederalAgency() {
	// ... implementation ...
}

function getRandomStateAgency() {
	// ... implementation ...
}

function getRandomFutureDate() {
	// ... implementation ...
}
*/

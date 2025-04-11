'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
import { MapPin, Filter, DollarSign, Calendar, Info } from 'lucide-react';
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

export default function Page() {
	const [fundingData, setFundingData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedState, setSelectedState] = useState(null);
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
	const [filters, setFilters] = useState({
		minAmount: 0,
		maxAmount: 10000000,
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
				if (filters.maxAmount < 10000000) {
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
					`/api/map/funding-by-state?${queryParams}`
				);
				const result = await response.json();

				if (result.success) {
					setFundingData(result.data);
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
				queryParams.append('pageSize', '10'); // 10 items per page

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
				if (filters.maxAmount < 10000000) {
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
							closeDate: new Date(opp.close_date).toLocaleDateString(),
							source: opp.source_name,
							sourceType: opp.source_type,
							status: opp.status,
							isNational: opp.is_national,
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
			maxAmount: 10000000,
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

	const handlePageChange = (newPage) => {
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
					<div className='border rounded-md shadow-sm mb-3'>
						<div className='flex items-center justify-between px-3 py-2'>
							<div className='flex items-center gap-1 text-xs font-medium text-muted-foreground'>
								<Filter className='h-3 w-3' />
								<span>Filters:</span>
							</div>
							<div className='flex-1 flex flex-wrap justify-center gap-x-4 gap-y-2 px-2'>
								<FilterSidebar
									filters={filters}
									onFilterChange={handleFilterChange}
									onResetFilters={handleResetFilters}
									horizontal={true}
								/>
							</div>
							<Button
								variant='ghost'
								size='sm'
								onClick={handleResetFilters}
								className='h-7 text-xs px-2'>
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
										fundingData={fundingData}
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
										<span className='font-medium'>
											{fundingData.reduce(
												(sum, state) => sum + state.opportunities,
												0
											)}
										</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-muted-foreground'>
											Total Funding:
										</span>
										<span className='font-medium'>
											$
											{(
												fundingData.reduce(
													(sum, state) => sum + state.value,
													0
												) / 1000000
											).toFixed(1)}
											M
										</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-muted-foreground'>
											States with Funding:
										</span>
										<span className='font-medium'>
											{fundingData.filter((state) => state.value > 0).length}
										</span>
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
																(stateOpportunitiesPage - 1) * 10 + 1
														  }-${Math.min(
																stateOpportunitiesPage * 10,
																stateOpportunitiesTotalCount
														  )} of ${stateOpportunitiesTotalCount}`
														: '0'
											  } opportunities`}
									</CardDescription>
								</CardHeader>
								<CardContent className='space-y-4'>
									{stateOpportunitiesLoading ? (
										<div className='flex justify-center py-8'>
											<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
										</div>
									) : stateOpportunities.length > 0 ? (
										<>
											{stateOpportunities.map((opportunity, index) => (
												<div
													key={opportunity.id || index}
													className='border-b pb-3 last:border-b-0 last:pb-0'>
													<div className='flex justify-between'>
														<h3 className='font-medium text-sm'>
															{opportunity.title}
														</h3>
														<Badge
															variant={
																opportunity.status === 'Open'
																	? 'default'
																	: opportunity.status === 'Upcoming'
																	? 'outline'
																	: 'secondary'
															}>
															{opportunity.status}
														</Badge>
													</div>
													<div className='flex justify-between text-xs text-muted-foreground mt-1'>
														<div className='flex items-center'>
															{opportunity.amount}
														</div>
														<div className='flex items-center'>
															<Calendar className='h-3 w-3 mr-1' />
															{opportunity.closeDate}
														</div>
													</div>
													<div className='mt-1 text-xs text-muted-foreground flex items-center gap-1'>
														<span>{opportunity.source}</span>
														{opportunity.isNational && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger>
																		<Info className='h-3 w-3' />
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>
																			National opportunity (available in all
																			states)
																		</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
													<div className='mt-2'>
														<Button
															size='sm'
															variant='outline'
															className='w-full text-xs'
															asChild>
															<a
																href={`/funding/opportunities/${opportunity.id}`}>
																View Details
															</a>
														</Button>
													</div>
												</div>
											))}

											{/* Pagination controls */}
											{stateOpportunitiesTotalCount > 10 && (
												<div className='flex justify-between items-center pt-2'>
													<Button
														variant='outline'
														size='sm'
														disabled={stateOpportunitiesPage === 1}
														onClick={() =>
															handlePageChange(stateOpportunitiesPage - 1)
														}>
														Previous
													</Button>
													<span className='text-sm text-muted-foreground'>
														Page {stateOpportunitiesPage} of{' '}
														{Math.ceil(stateOpportunitiesTotalCount / 10)}
													</span>
													<Button
														variant='outline'
														size='sm'
														disabled={
															stateOpportunitiesPage >=
															Math.ceil(stateOpportunitiesTotalCount / 10)
														}
														onClick={() =>
															handlePageChange(stateOpportunitiesPage + 1)
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

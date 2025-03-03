'use client';

import { useState, useEffect } from 'react';
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
import { MapPin, Filter, DollarSign, Calendar } from 'lucide-react';

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
	const [activeLayer, setActiveLayer] = useState('federal'); // federal, state, all
	const [filters, setFilters] = useState({
		minAmount: 0,
		maxAmount: 10000000,
		status: 'all', // all, open, upcoming, closed
	});

	useEffect(() => {
		async function fetchFundingData() {
			try {
				setLoading(true);
				// In a real implementation, this would fetch from an API
				// For now, we'll use mock data
				const mockData = generateMockStateData();
				setFundingData(mockData);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching funding data:', err);
				setError(err.message);
				setLoading(false);
			}
		}

		fetchFundingData();
	}, []);

	// When a state is selected, fetch opportunities for that state
	useEffect(() => {
		if (selectedState) {
			// In a real implementation, this would fetch from an API with the state as a parameter
			// For now, we'll generate mock data
			const mockOpportunities = generateMockOpportunitiesForState(
				selectedState,
				activeLayer
			);
			setStateOpportunities(mockOpportunities);
		} else {
			setStateOpportunities([]);
		}
	}, [selectedState, activeLayer]);

	// Generate color scale based on funding amounts
	const colorScale = scaleQuantile()
		.domain(fundingData.map((d) => d.value))
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
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Funding Map</h1>
					<div className='flex gap-2'>
						<Button
							variant={activeLayer === 'federal' ? 'default' : 'outline'}
							onClick={() => handleLayerChange('federal')}>
							Federal
						</Button>
						<Button
							variant={activeLayer === 'state' ? 'default' : 'outline'}
							onClick={() => handleLayerChange('state')}>
							State
						</Button>
						<Button
							variant={activeLayer === 'all' ? 'default' : 'outline'}
							onClick={() => handleLayerChange('all')}>
							All Funding
						</Button>
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					{/* Map Column */}
					<div className='lg:col-span-2'>
						<Card className='h-full'>
							<CardHeader>
								<CardTitle>Geographic Distribution of Funding</CardTitle>
								<CardDescription>
									{activeLayer === 'federal'
										? 'Federal funding opportunities by state'
										: activeLayer === 'state'
										? 'State-level funding opportunities'
										: 'All funding opportunities by state'}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{loading ? (
									<div className='flex justify-center items-center h-[500px]'>
										<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
									</div>
								) : error ? (
									<div className='bg-red-50 text-red-800 p-4 rounded-md'>
										<p>Error: {error}</p>
									</div>
								) : (
									<div className='relative'>
										<ComposableMap
											projection='geoAlbersUsa'
											className='w-full h-[500px]'>
											<ZoomableGroup>
												<Geographies geography={geoUrl}>
													{({ geographies }) =>
														geographies.map((geo) => {
															const stateName = geo.properties.name;
															const stateData = fundingData.find(
																(d) => d.state === stateName
															);
															const isSelected = selectedState === stateName;

															return (
																<Geography
																	key={geo.rsmKey}
																	geography={geo}
																	onClick={() => handleStateClick(geo)}
																	style={{
																		default: {
																			fill: stateData
																				? colorScale(stateData.value)
																				: '#EEE',
																			stroke: '#FFF',
																			strokeWidth: 0.5,
																			outline: 'none',
																		},
																		hover: {
																			fill: '#1890ff',
																			stroke: '#FFF',
																			strokeWidth: 0.5,
																			outline: 'none',
																			cursor: 'pointer',
																		},
																		pressed: {
																			fill: '#003a8c',
																			stroke: '#FFF',
																			strokeWidth: 0.5,
																			outline: 'none',
																		},
																	}}
																/>
															);
														})
													}
												</Geographies>

												{/* Add state abbreviations */}
												<Geographies geography={geoUrl}>
													{({ geographies }) =>
														geographies.map((geo) => {
															const centroid = geoCentroid(geo);
															const stateName = geo.properties.name;
															const stateAbbr = stateAbbreviations[stateName];

															return (
																<g key={geo.rsmKey + '-name'}>
																	{stateAbbr && (
																		<text
																			x={centroid[0]}
																			y={centroid[1]}
																			style={{
																				fontFamily: 'sans-serif',
																				fontSize: '8px',
																				fontWeight: 'bold',
																				fill: '#333',
																				textAnchor: 'middle',
																				alignmentBaseline: 'middle',
																				pointerEvents: 'none',
																			}}>
																			{stateAbbr}
																		</text>
																	)}
																</g>
															);
														})
													}
												</Geographies>
											</ZoomableGroup>
										</ComposableMap>

										<div className='absolute bottom-2 right-2 bg-white p-2 rounded-md shadow-md text-xs'>
											<div className='flex items-center mb-1'>
												<div className='w-3 h-3 bg-[#e6f7ff] mr-1'></div>
												<span>Low Funding</span>
											</div>
											<div className='flex items-center'>
												<div className='w-3 h-3 bg-[#003a8c] mr-1'></div>
												<span>High Funding</span>
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Sidebar Column */}
					<div className='space-y-6'>
						{/* Filters Card */}
						<Card>
							<CardHeader>
								<CardTitle className='flex items-center'>
									<Filter className='h-5 w-5 mr-2' />
									Filters
								</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4'>
								<div>
									<label className='text-sm font-medium mb-1 block'>
										Funding Amount
									</label>
									<div className='flex items-center gap-2'>
										<input
											type='range'
											min='0'
											max='10000000'
											step='100000'
											value={filters.maxAmount}
											onChange={(e) =>
												handleFilterChange(
													'maxAmount',
													parseInt(e.target.value)
												)
											}
											className='w-full'
										/>
										<span className='text-sm whitespace-nowrap'>
											Up to ${(filters.maxAmount / 1000000).toFixed(1)}M
										</span>
									</div>
								</div>

								<div>
									<label className='text-sm font-medium mb-1 block'>
										Status
									</label>
									<div className='grid grid-cols-3 gap-2'>
										<Button
											size='sm'
											variant={filters.status === 'all' ? 'default' : 'outline'}
											onClick={() => handleFilterChange('status', 'all')}
											className='w-full'>
											All
										</Button>
										<Button
											size='sm'
											variant={
												filters.status === 'open' ? 'default' : 'outline'
											}
											onClick={() => handleFilterChange('status', 'open')}
											className='w-full'>
											Open
										</Button>
										<Button
											size='sm'
											variant={
												filters.status === 'upcoming' ? 'default' : 'outline'
											}
											onClick={() => handleFilterChange('status', 'upcoming')}
											className='w-full'>
											Upcoming
										</Button>
									</div>
								</div>

								<Button className='w-full' variant='outline'>
									Reset Filters
								</Button>
							</CardContent>
						</Card>

						{/* State Details Card */}
						{selectedState && (
							<Card>
								<CardHeader>
									<CardTitle className='flex items-center'>
										<MapPin className='h-5 w-5 mr-2' />
										{selectedState}
									</CardTitle>
									<CardDescription>
										{stateOpportunities.length} funding opportunities available
									</CardDescription>
								</CardHeader>
								<CardContent className='space-y-4'>
									{stateOpportunities.length > 0 ? (
										stateOpportunities.map((opportunity, index) => (
											<div
												key={index}
												className='border-b pb-3 last:border-b-0 last:pb-0'>
												<h3 className='font-medium text-sm'>
													{opportunity.title}
												</h3>
												<div className='flex justify-between text-xs text-muted-foreground mt-1'>
													<div className='flex items-center'>
														<DollarSign className='h-3 w-3 mr-1' />
														{opportunity.amount}
													</div>
													<div className='flex items-center'>
														<Calendar className='h-3 w-3 mr-1' />
														{opportunity.closeDate}
													</div>
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
										))
									) : (
										<p className='text-muted-foreground text-sm'>
											No opportunities found for {selectedState} with the
											current filters.
										</p>
									)}
								</CardContent>
							</Card>
						)}

						{/* Summary Stats Card */}
						<Card>
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
				</div>
			</div>
		</MainLayout>
	);
}

// Mock data generation functions
function generateMockStateData() {
	const states = Object.keys(stateAbbreviations);
	return states.map((state) => {
		// Generate random funding values, weighted toward certain states
		let value = Math.random() * 10000000;

		// Boost values for certain states to create a more realistic distribution
		if (
			['California', 'New York', 'Texas', 'Florida', 'Illinois'].includes(state)
		) {
			value *= 2.5;
		} else if (
			[
				'Washington',
				'Massachusetts',
				'Colorado',
				'Michigan',
				'Pennsylvania',
			].includes(state)
		) {
			value *= 1.8;
		}

		return {
			state,
			value,
			opportunities: Math.floor(Math.random() * 20) + 1,
		};
	});
}

function generateMockOpportunitiesForState(state, layer) {
	// Number of opportunities to generate
	const count = Math.floor(Math.random() * 8) + 2;

	// Generate mock opportunities
	const opportunities = [];
	for (let i = 0; i < count; i++) {
		// Skip some opportunities based on the active layer
		if (layer === 'federal' && Math.random() > 0.7) {
			continue;
		} else if (layer === 'state' && Math.random() > 0.7) {
			continue;
		}

		const isFederal =
			layer === 'federal' || (layer === 'all' && Math.random() > 0.5);

		opportunities.push({
			id: `opp-${state.toLowerCase().replace(/\s+/g, '-')}-${i}`,
			title: isFederal
				? `Federal ${getRandomFundingType()} for ${getRandomSector()}`
				: `${state} ${getRandomFundingType()} for ${getRandomSector()}`,
			amount: `$${(Math.floor(Math.random() * 900) + 100).toLocaleString()}K`,
			closeDate: getRandomFutureDate(),
			source: isFederal
				? getRandomFederalAgency()
				: `${state} Department of ${getRandomStateAgency()}`,
			isFederal,
		});
	}

	return opportunities;
}

function getRandomFundingType() {
	const types = [
		'Grant',
		'Loan Program',
		'Tax Credit',
		'Rebate',
		'Incentive Program',
	];
	return types[Math.floor(Math.random() * types.length)];
}

function getRandomSector() {
	const sectors = [
		'Energy Efficiency',
		'Renewable Energy',
		'Building Modernization',
		'Infrastructure',
		'Climate Resilience',
		'Water Conservation',
	];
	return sectors[Math.floor(Math.random() * sectors.length)];
}

function getRandomFederalAgency() {
	const agencies = [
		'Department of Energy',
		'EPA',
		'Department of Agriculture',
		'Department of Transportation',
		'Department of Housing',
	];
	return agencies[Math.floor(Math.random() * agencies.length)];
}

function getRandomStateAgency() {
	const agencies = [
		'Energy',
		'Environmental Protection',
		'Natural Resources',
		'Transportation',
		'Housing',
	];
	return agencies[Math.floor(Math.random() * agencies.length)];
}

function getRandomFutureDate() {
	const today = new Date();
	const futureDate = new Date(today);
	futureDate.setDate(today.getDate() + Math.floor(Math.random() * 180) + 1);
	return futureDate.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});
}

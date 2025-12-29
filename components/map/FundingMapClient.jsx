'use client';

import { useState, useMemo, useEffect } from 'react';
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from 'react-simple-maps';
import { scaleLinear, scaleThreshold } from 'd3-scale';
import { geoCentroid } from 'd3-geo';
import { Spinner } from '@/components/ui/spinner';

// US States GeoJSON
const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

// State centroids and zoom levels for focusing on individual states
const stateZoomConfig = {
	'Alabama': { center: [-86.9, 32.8], zoom: 5 },
	'Alaska': { center: [-153, 64], zoom: 2.5 },
	'Arizona': { center: [-111.9, 34.3], zoom: 5 },
	'Arkansas': { center: [-92.4, 34.9], zoom: 5.5 },
	'California': { center: [-119.4, 37.2], zoom: 4 },
	'Colorado': { center: [-105.5, 39], zoom: 5 },
	'Connecticut': { center: [-72.7, 41.6], zoom: 9 },
	'Delaware': { center: [-75.5, 39], zoom: 9 },
	'Florida': { center: [-82, 28.5], zoom: 4.5 },
	'Georgia': { center: [-83.4, 32.6], zoom: 5 },
	'Hawaii': { center: [-157, 20.5], zoom: 5 },
	'Idaho': { center: [-114.5, 44.4], zoom: 4.5 },
	'Illinois': { center: [-89.2, 40], zoom: 5 },
	'Indiana': { center: [-86.3, 39.9], zoom: 5.5 },
	'Iowa': { center: [-93.5, 42], zoom: 5 },
	'Kansas': { center: [-98.4, 38.5], zoom: 5 },
	'Kentucky': { center: [-85.7, 37.8], zoom: 5.5 },
	'Louisiana': { center: [-92, 31], zoom: 5 },
	'Maine': { center: [-69, 45.3], zoom: 5 },
	'Maryland': { center: [-76.8, 39.2], zoom: 7 },
	'Massachusetts': { center: [-71.8, 42.2], zoom: 7.5 },
	'Michigan': { center: [-85, 44.3], zoom: 4.5 },
	'Minnesota': { center: [-94.3, 46.3], zoom: 4.5 },
	'Mississippi': { center: [-89.7, 32.7], zoom: 5 },
	'Missouri': { center: [-92.5, 38.4], zoom: 5 },
	'Montana': { center: [-110, 47], zoom: 4 },
	'Nebraska': { center: [-99.8, 41.5], zoom: 5 },
	'Nevada': { center: [-117, 39], zoom: 4.5 },
	'New Hampshire': { center: [-71.5, 43.7], zoom: 6.5 },
	'New Jersey': { center: [-74.7, 40.2], zoom: 7 },
	'New Mexico': { center: [-106, 34.4], zoom: 4.5 },
	'New York': { center: [-75.5, 43], zoom: 5 },
	'North Carolina': { center: [-79.4, 35.5], zoom: 5 },
	'North Dakota': { center: [-100.5, 47.5], zoom: 5 },
	'Ohio': { center: [-82.8, 40.2], zoom: 5.5 },
	'Oklahoma': { center: [-97.5, 35.5], zoom: 5 },
	'Oregon': { center: [-120.5, 44], zoom: 4.5 },
	'Pennsylvania': { center: [-77.6, 41], zoom: 5.5 },
	'Rhode Island': { center: [-71.5, 41.7], zoom: 10 },
	'South Carolina': { center: [-80.9, 33.9], zoom: 6 },
	'South Dakota': { center: [-100.2, 44.4], zoom: 5 },
	'Tennessee': { center: [-86.3, 35.8], zoom: 5.5 },
	'Texas': { center: [-99.5, 31.5], zoom: 3.5 },
	'Utah': { center: [-111.7, 39.3], zoom: 4.5 },
	'Vermont': { center: [-72.7, 44], zoom: 6.5 },
	'Virginia': { center: [-78.8, 37.5], zoom: 5.5 },
	'Washington': { center: [-120.5, 47.4], zoom: 5 },
	'West Virginia': { center: [-80.6, 38.9], zoom: 6 },
	'Wisconsin': { center: [-89.8, 44.6], zoom: 5 },
	'Wyoming': { center: [-107.5, 43], zoom: 5 },
	'District of Columbia': { center: [-77, 38.9], zoom: 12 },
};

export default function FundingMapClient({
	loading,
	error,
	fundingData,
	colorBy,
	selectedState,
	onStateClick,
	stateAbbreviations,
	viewMode = 'us', // 'us', 'state', 'national'
	zoomToState = null, // State name to zoom to
}) {
	// Tooltip state
	const [tooltipVisible, setTooltipVisible] = useState(false);
	const [tooltipState, setTooltipState] = useState('');
	const [tooltipOpportunities, setTooltipOpportunities] = useState(0);
	const [tooltipValue, setTooltipValue] = useState(0);
	const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

	// Zoom and center state
	const [position, setPosition] = useState({ coordinates: [-96, 38], zoom: 1 });

	// Calculate zoom position based on selected state or view mode
	useEffect(() => {
		console.log('Zoom effect triggered:', { viewMode, zoomToState });
		if (viewMode === 'state' && zoomToState && stateZoomConfig[zoomToState]) {
			const config = stateZoomConfig[zoomToState];
			console.log('Zooming to state:', zoomToState, config);
			setPosition({ coordinates: config.center, zoom: config.zoom });
		} else if (viewMode === 'us' || viewMode === 'national') {
			console.log('Resetting to US view');
			setPosition({ coordinates: [-96, 38], zoom: 1 });
		}
	}, [viewMode, zoomToState]);

	// Handle zoom changes from user interaction
	const handleMoveEnd = (position) => {
		setPosition(position);
	};

	// Get the values for coloring
	const values = fundingData.map((d) =>
		colorBy === 'amount' ? d.value : d.opportunities
	);

	// Find the maximum value and unique values
	const maxValue = Math.max(...values);
	const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

	// Choose the appropriate scale based on the data distribution
	let colorScale;

	if (uniqueValues.length <= 2) {
		// If we only have 1-2 distinct values, use a threshold scale
		colorScale = scaleThreshold()
			.domain([
				uniqueValues[0],
				(uniqueValues[0] + uniqueValues[uniqueValues.length - 1]) / 2,
			])
			.range(['#e6f7ff', '#40a9ff', '#003a8c']);
	} else {
		// Otherwise use a linear scale that's better for showing the full range
		colorScale = scaleLinear()
			.domain([0, maxValue * 0.3, maxValue * 0.6, maxValue])
			.range(['#e6f7ff', '#69c0ff', '#1890ff', '#003a8c']);
	}

	if (loading) {
		return (
			<div className='flex items-center justify-center h-[500px]'>
				<Spinner className='w-8 h-8' />
			</div>
		);
	}

	if (error) {
		return (
			<div className='flex items-center justify-center h-[500px] text-red-500'>
				{error}
			</div>
		);
	}

	// Handlers for tooltip
	const handleMouseEnter = (evt, stateName, stateData) => {
		setTooltipState(stateName);
		setTooltipOpportunities(stateData?.opportunities || 0);
		setTooltipValue(stateData?.value || 0);
		setTooltipPosition({ x: evt.clientX, y: evt.clientY });
		setTooltipVisible(true);
	};

	const handleMouseMove = (evt) => {
		setTooltipPosition({ x: evt.clientX, y: evt.clientY });
	};

	const handleMouseLeave = () => {
		setTooltipVisible(false);
	};

	return (
		<div className='relative'>
			<ComposableMap
				projection='geoAlbersUsa'
				className='w-full h-[500px]'
				style={{ transition: 'all 0.3s ease-in-out' }}
			>
				<ZoomableGroup
					center={position.coordinates}
					zoom={position.zoom}
					onMoveEnd={handleMoveEnd}
					minZoom={1}
					maxZoom={12}
					translateExtent={[
						[-500, -300],
						[1300, 900],
					]}
				>
					<Geographies geography={geoUrl}>
						{({ geographies }) =>
							Array.isArray(geographies)
								? geographies.map((geo) => {
										const stateName = geo.properties.name;
										// Always lookup fresh data directly from props
										const stateData = fundingData.find(
											(d) => d.state === stateName
										);
										const isSelected = selectedState === stateName;
										const value = stateData
											? colorBy === 'amount'
												? stateData.value
												: stateData.opportunities
											: 0;

										return (
											<Geography
												key={geo.rsmKey}
												geography={geo}
												onClick={() => onStateClick(geo)}
												onMouseEnter={(evt) =>
													handleMouseEnter(evt, stateName, stateData)
												}
												onMouseMove={handleMouseMove}
												onMouseLeave={handleMouseLeave}
												style={{
													default: {
														fill: stateData ? colorScale(value) : '#EEE',
														stroke: '#FFF',
														strokeWidth: isSelected ? 2 : 0.5,
														outline: 'none',
													},
													hover: {
														fill: '#1890ff',
														stroke: '#FFF',
														strokeWidth: 1,
														outline: 'none',
														cursor: 'pointer',
													},
													pressed: {
														fill: '#003a8c',
														stroke: '#FFF',
														strokeWidth: 1,
														outline: 'none',
													},
												}}
											/>
										);
								  })
								: null
						}
					</Geographies>
				</ZoomableGroup>
			</ComposableMap>

			{/* Map Legend */}
			<div className='absolute bottom-2 right-2 bg-white dark:bg-neutral-800 p-3 rounded-md shadow-md text-xs'>
				<div className='mb-2 font-medium'>
					{colorBy === 'amount' ? 'Funding Amount' : 'Opportunity Count'}
				</div>
				<div className='space-y-1'>
					<div className='flex items-center'>
						<div className='w-3 h-3 bg-[#e6f7ff] mr-1'></div>
						<span>Low</span>
					</div>
					<div className='flex items-center'>
						<div className='w-3 h-3 bg-[#69c0ff] mr-1'></div>
						<span>Medium-Low</span>
					</div>
					<div className='flex items-center'>
						<div className='w-3 h-3 bg-[#1890ff] mr-1'></div>
						<span>Medium-High</span>
					</div>
					<div className='flex items-center'>
						<div className='w-3 h-3 bg-[#003a8c] mr-1'></div>
						<span>High</span>
					</div>
				</div>
			</div>

			{/* Tooltip using a fixed div at the bottom of the component, outside map boundaries */}
			{tooltipVisible && (
				<div
					id='map-tooltip'
					className='fixed bg-white dark:bg-neutral-800 p-2 border border-gray-200 dark:border-neutral-600 rounded shadow-lg text-xs z-[9999]'
					style={{
						left: tooltipPosition.x + 20,
						top: tooltipPosition.y - 10,
					}}>
					<div className='font-medium'>{tooltipState}</div>
					<div>Opportunities: {tooltipOpportunities}</div>
					<div>
						Per-Applicant Funding: ${formatFundingAmount(tooltipValue)}+
					</div>
				</div>
			)}
		</div>
	);
}

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

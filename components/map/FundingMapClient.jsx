'use client';

import { useState } from 'react';
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from 'react-simple-maps';
import { scaleLinear, scaleThreshold } from 'd3-scale';
import { Spinner } from '@/components/ui/spinner';

// US States GeoJSON
const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

export default function FundingMapClient({
	loading,
	error,
	fundingData,
	colorBy,
	selectedState,
	onStateClick,
	stateAbbreviations,
}) {
	// Tooltip state
	const [tooltipVisible, setTooltipVisible] = useState(false);
	const [tooltipState, setTooltipState] = useState('');
	const [tooltipOpportunities, setTooltipOpportunities] = useState(0);
	const [tooltipValue, setTooltipValue] = useState(0);
	const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

	// Fixed position - no zoom on state selection
	const position = { coordinates: [-96, 38], zoom: 1 };

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
					minZoom={1}
					maxZoom={4}
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

										// Dim non-selected states when one is selected
										const hasSelection = selectedState !== null;
										const opacity = hasSelection && !isSelected ? 0.5 : 1;

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
														stroke: isSelected ? '#1e3a5f' : '#FFF',
														strokeWidth: isSelected ? 2.5 : 0.5,
														outline: 'none',
														opacity: opacity,
														transition: 'all 0.2s ease-in-out',
													},
													hover: {
														fill: isSelected ? colorScale(value) : '#1890ff',
														stroke: isSelected ? '#1e3a5f' : '#FFF',
														strokeWidth: isSelected ? 2.5 : 1,
														outline: 'none',
														cursor: 'pointer',
														opacity: 1,
													},
													pressed: {
														fill: '#003a8c',
														stroke: '#1e3a5f',
														strokeWidth: 2,
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

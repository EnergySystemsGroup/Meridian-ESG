'use client';

import { useState, useEffect } from 'react';
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from 'react-simple-maps';
import {
	scaleQuantile,
	scaleLinear,
	scaleThreshold,
	extent,
	max,
} from 'd3-scale';
import { geoCentroid } from 'd3-geo';
import { Spinner } from '@/app/components/ui/spinner';

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
	// Check California data
	const california = fundingData.find((d) => d.state === 'California');
	console.log('FundingMapClient California data received:', california);

	const [tooltip, setTooltip] = useState({
		show: false,
		content: {},
		position: { x: 0, y: 0 },
	});

	// Log when tooltip changes
	useEffect(() => {
		if (tooltip.show && tooltip.content.state === 'California') {
			console.log('Tooltip effect - California content:', tooltip.content);
		}
	}, [tooltip]);

	// Get the values for coloring
	const values = fundingData.map((d) =>
		colorBy === 'amount' ? d.value : d.opportunities
	);

	// Find the maximum value and unique values
	const maxValue = Math.max(...values);
	const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
	console.log('Unique values for coloring:', uniqueValues);

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

	return (
		<div className='relative'>
			<ComposableMap projection='geoAlbersUsa' className='w-full h-[500px]'>
				<ZoomableGroup>
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
												onMouseEnter={(evt) => {
													// Log special debug info for California
													if (stateName === 'California') {
														console.log(
															'California hover - state name matches'
														);
														console.log(
															'California hover - stateData:',
															stateData
														);
														console.log(
															'California hover - direct lookup:',
															fundingData.find((d) => d.state === 'California')
														);
													}

													const tooltipContent = {
														state: stateName,
														opportunities: stateData?.opportunities || 0,
														value: stateData?.value || 0,
													};

													setTooltip({
														show: true,
														content: tooltipContent,
														position: {
															x: evt.clientX,
															y: evt.clientY,
														},
													});
												}}
												onMouseMove={(evt) => {
													setTooltip((tooltip) => ({
														...tooltip,
														position: {
															x: evt.clientX,
															y: evt.clientY,
														},
													}));
												}}
												onMouseLeave={() => {
													setTooltip({ ...tooltip, show: false });
												}}
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
			<div className='absolute bottom-2 right-2 bg-white p-3 rounded-md shadow-md text-xs'>
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

			{/* Tooltip */}
			{tooltip.show && (
				<div
					className='absolute bg-white p-2 rounded shadow-md text-xs z-10 pointer-events-none'
					style={{
						left: tooltip.position.x + 10,
						top: tooltip.position.y - 40,
					}}>
					<div className='font-medium'>{tooltip.content.state}</div>
					<div>Opportunities: {tooltip.content.opportunities}</div>
					<div>
						Total Funding: ${formatFundingAmount(tooltip.content.value)}
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

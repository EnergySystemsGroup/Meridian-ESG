'use client';

import { useState } from 'react';
import {
	ComposableMap,
	Geographies,
	Geography,
	ZoomableGroup,
} from 'react-simple-maps';
import { scaleQuantile } from 'd3-scale';
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
	const [tooltip, setTooltip] = useState({
		show: false,
		content: {},
		position: { x: 0, y: 0 },
	});

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
							geographies.map((geo) => {
								const stateName = geo.properties.name;
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
											setTooltip({
												show: true,
												content: {
													state: stateName,
													opportunities: stateData?.opportunities || 0,
													value: stateData?.value || 0,
												},
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
						}
					</Geographies>

					{/* Add state abbreviations and counts */}
					<Geographies geography={geoUrl}>
						{({ geographies }) =>
							geographies.map((geo) => {
								const centroid = geoCentroid(geo);
								const stateName = geo.properties.name;
								const stateAbbr = stateAbbreviations[stateName];
								const stateData = fundingData.find(
									(d) => d.state === stateName
								);

								return (
									<g key={geo.rsmKey + '-name'}>
										{stateAbbr && (
											<>
												<text
													x={centroid[0]}
													y={centroid[1]}
													style={{
														fontFamily: 'system-ui',
														fontSize: '10px',
														fontWeight: 'bold',
														fill: '#333',
														textAnchor: 'middle',
														alignmentBaseline: 'middle',
														pointerEvents: 'none',
													}}>
													{stateAbbr}
												</text>
												{stateData && stateData.opportunities > 0 && (
													<text
														x={centroid[0]}
														y={centroid[1] + 12}
														style={{
															fontFamily: 'system-ui',
															fontSize: '9px',
															fill: '#666',
															textAnchor: 'middle',
															alignmentBaseline: 'middle',
															pointerEvents: 'none',
														}}>
														{stateData.opportunities}
													</text>
												)}
											</>
										)}
									</g>
								);
							})
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
						<div className='w-3 h-3 bg-[#1890ff] mr-1'></div>
						<span>Medium</span>
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
						Total Funding: ${(tooltip.content.value / 1000000).toFixed(1)}M
					</div>
				</div>
			)}
		</div>
	);
}

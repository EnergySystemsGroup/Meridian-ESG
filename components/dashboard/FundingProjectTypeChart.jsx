'use client';

import { useState, useEffect } from 'react';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from 'recharts';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';

// Muted neutral bar body, semantic color only on the rounded top cap
const BAR_BODY_COLOR = 'hsl(220, 20%, 88%)';
const CAP_HEIGHT = 6;
const BORDER_RADIUS = 4;

// Custom bar shape: muted neutral body with a semantic-colored top cap
const TippedBar = (props) => {
	const { x, y, width, height, name } = props;
	if (!height || height <= 0) return null;
	const tipColor = getProjectTypeColor(name).color;
	const capH = Math.min(CAP_HEIGHT, height);
	const bodyH = height - capH;
	return (
		<g>
			{/* Body — muted neutral, flat top */}
			{bodyH > 0 && (
				<rect x={x} y={y + capH} width={width} height={bodyH} fill={BAR_BODY_COLOR} />
			)}
			{/* Cap — semantic color, rounded top corners */}
			<rect
				x={x}
				y={y}
				width={width}
				height={capH}
				fill={tipColor}
				rx={BORDER_RADIUS}
				ry={BORDER_RADIUS}
			/>
			{/* Fill the gap between cap bottom corners and body top */}
			{bodyH > 0 && capH >= BORDER_RADIUS && (
				<rect x={x} y={y + capH - BORDER_RADIUS} width={width} height={BORDER_RADIUS} fill={tipColor} />
			)}
		</g>
	);
};

const formatCurrency = (value) => {
	if (value === null || value === undefined) return '$0';
	if (value >= 1000000000) {
		return `$${(value / 1000000000).toFixed(0)}B`;
	} else if (value >= 1000000) {
		return `$${(value / 1000000).toFixed(0)}M`;
	} else if (value >= 1000) {
		return `$${(value / 1000).toFixed(0)}K`;
	}
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(value);
};

const tooltipFormatter = (value) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(value);
};

const CustomTooltip = ({ active, payload, label }) => {
	if (active && payload && payload.length) {
		const count = payload[0].payload.count;
		const typeColor = getProjectTypeColor(label).color;
		return (
			<div className='bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 shadow-lg rounded-lg text-sm'>
				<div className='flex items-center gap-2 mb-0.5'>
					<span className='w-2.5 h-2.5 rounded-sm shrink-0' style={{ backgroundColor: typeColor }} />
					<p className='font-semibold text-neutral-900 dark:text-neutral-100'>{label}</p>
				</div>
				<p className='text-neutral-600 dark:text-neutral-400 mt-0.5'>{`Per Applicant Funding: ${tooltipFormatter(payload[0].value)}`}</p>
				<p className='text-xs text-muted-foreground mt-0.5'>{`${count} Opportunities`}</p>
			</div>
		);
	}
	return null;
};

const ChartHeader = () => (
	<CardHeader className='pb-4'>
		<div className='flex items-center gap-2.5'>
			<div className='h-5 w-0.5 rounded-full bg-blue-500'></div>
			<CardTitle className='text-sm font-semibold'>Top 10 Project Types</CardTitle>
		</div>
	</CardHeader>
);

export default function FundingProjectTypeChart() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch('/api/funding/project-type-summary');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				let result = await response.json();

				if (!Array.isArray(result)) {
					console.warn('API response was not an array:', result);
					result = [];
				}

				const chartData = result.map((item) => ({
					name: item.category,
					value: item.total_funding,
					count: item.opportunity_count,
				}));

				setData(chartData);
			} catch (e) {
				console.error('Failed to fetch funding by project type data:', e);
				setError(e.message || 'Failed to load data');
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	if (loading) {
		return (
			<Card className='shadow-sm'>
				<ChartHeader />
				<CardContent>
					<Skeleton className='h-[400px] w-full rounded-lg' />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className='shadow-sm'>
				<ChartHeader />
				<CardContent>
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Could not load funding by project type data. {error}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card className='shadow-sm'>
				<ChartHeader />
				<CardContent>
					<div className='flex items-center justify-center h-[400px]'>
						<p className='text-muted-foreground'>
							No open funding data available by project type.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className='shadow-sm'>
			<ChartHeader />
			<CardContent>
				<ResponsiveContainer width='100%' height={400}>
					<BarChart
						data={data}
						margin={{
							top: 5,
							right: 30,
							left: 20,
							bottom: 80,
						}}
						barSize={24}>
						<CartesianGrid strokeDasharray='3 3' stroke='hsl(220, 10%, 92%)' vertical={false} />
						<XAxis
							dataKey='name'
							angle={-35}
							textAnchor='end'
							height={90}
							tick={{ fontSize: 12, fill: 'hsl(215, 15%, 46%)' }}
							interval={0}
						/>
						<YAxis
							tickFormatter={formatCurrency}
							tick={{ fontSize: 12, fill: 'hsl(215, 15%, 46%)' }}
							width={80}
						/>
						<Tooltip
							content={<CustomTooltip />}
							cursor={{ fill: 'hsl(221, 83%, 53%, 0.04)' }}
						/>
						<Bar dataKey='value' name='Total Funding' shape={<TippedBar />} />
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

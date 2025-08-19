'use client';

import { useState, useEffect } from 'react';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	Cell,
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

// Define consistent colors for categories if needed, otherwise use generated
const COLORS = [
	'#0088FE',
	'#00C49F',
	'#FFBB28',
	'#FF8042',
	'#8884d8',
	'#82ca9d',
	'#ffc658',
	'#a4de6c',
	'#d0ed57',
	'#ffc658',
];

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
		return (
			<div className='bg-background border p-2 shadow-lg rounded text-sm'>
				<p className='font-semibold'>{`${label}`}</p>
				<p>{`Per Applicant Funding: ${tooltipFormatter(payload[0].value)}`}</p>
				<p className='text-xs text-muted-foreground'>{`${count} Opportunities`}</p>
			</div>
		);
	}
	return null;
};

export default function FundingCategoryChart() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch('/api/funding/category-summary');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				let result = await response.json();

				if (!Array.isArray(result)) {
					console.warn('API response was not an array:', result);
					result = [];
				}

				const chartData = result
					.sort((a, b) => b.total_funding - a.total_funding)
					.slice(0, 10)
					.map((item) => ({
						name: item.category,
						value: item.total_funding,
						count: item.opportunity_count,
					}));

				setData(chartData);
			} catch (e) {
				console.error('Failed to fetch funding category data:', e);
				setError(e.message || 'Failed to load data');
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top 10 Funding Categories</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className='h-[400px] w-full' />
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top 10 Funding Categories</CardTitle>
				</CardHeader>
				<CardContent>
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>
							Could not load funding category data. {error}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Top 10 Funding Categories</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='flex items-center justify-center h-[400px]'>
						<p className='text-muted-foreground'>
							No open funding data available by category.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Top 10 Funding Categories</CardTitle>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width='100%' height={400}>
					<BarChart
						data={data}
						margin={{
							top: 5,
							right: 30,
							left: 20,
							bottom: 100,
						}}
						barSize={30}>
						<CartesianGrid strokeDasharray='3 3' />
						<XAxis
							dataKey='name'
							angle={-45}
							textAnchor='end'
							height={110}
							tick={{ fontSize: 12 }}
							interval={0}
						/>
						<YAxis
							tickFormatter={formatCurrency}
							tick={{ fontSize: 12 }}
							width={80}
						/>
						<Tooltip
							content={<CustomTooltip />}
							cursor={{ fill: 'transparent' }}
						/>
						<Bar dataKey='value' name='Total Funding'>
							{data.map((entry, index) => (
								<Cell
									key={`cell-${index}`}
									fill={COLORS[index % COLORS.length]}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}

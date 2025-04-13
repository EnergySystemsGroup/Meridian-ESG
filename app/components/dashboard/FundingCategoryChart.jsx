'use client';

import React, { useState, useEffect } from 'react';
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
} from '@/app/components/ui/card';

// Generate a consistent color based on index
const getCategoryColor = (index) => {
	const colors = [
		'#2563eb', // blue-600
		'#16a34a', // green-600
		'#ea580c', // orange-600
		'#8b5cf6', // violet-600
		'#d946ef', // fuchsia-600
		'#ec4899', // pink-600
		'#0891b2', // cyan-600
		'#84cc16', // lime-600
		'#ca8a04', // yellow-600
		'#e11d48', // rose-600
		'#475569', // slate-600
		'#6366f1', // indigo-600
	];
	return colors[index % colors.length];
};

// Format currency values
const formatCurrency = (value) => {
	if (value >= 1000000000) {
		return `$${(value / 1000000000).toFixed(1)}B`;
	} else if (value >= 1000000) {
		return `$${(value / 1000000).toFixed(1)}M`;
	} else if (value >= 1000) {
		return `$${(value / 1000).toFixed(1)}K`;
	}
	return `$${value}`;
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
	if (active && payload && payload.length) {
		return (
			<div className='bg-white p-3 border shadow-md rounded-md'>
				<p className='font-medium'>{`${label}`}</p>
				<p className='text-sm'>{`Total: ${formatCurrency(
					payload[0].value
				)}`}</p>
				<p className='text-xs text-gray-500'>{`${payload[0].payload.count} opportunities`}</p>
			</div>
		);
	}
	return null;
};

export default function FundingCategoryChart() {
	const [chartData, setChartData] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchCategoryData() {
			try {
				setIsLoading(true);
				const response = await fetch('/api/categories');
				if (!response.ok) {
					throw new Error('Failed to fetch category data');
				}

				const data = await response.json();

				if (!data.success) {
					throw new Error(data.error || 'Error fetching category data');
				}

				// Transform the data for the chart
				// We'll use the categoryGroups which has count information
				const chartReadyData = Object.entries(data.categoryGroups || {})
					.map(([category, info]) => {
						// Calculate the total funding amount for this category
						// For demo purposes, we'll generate a random amount based on the count
						// In production, you would use actual funding amount data
						const avgFundingPerOpportunity = Math.random() * 2000000 + 500000; // Between $500K and $2.5M
						const totalFunding = info.count * avgFundingPerOpportunity;

						return {
							name: category,
							amount: totalFunding,
							count: info.count,
						};
					})
					.sort((a, b) => b.amount - a.amount) // Sort by amount descending
					.slice(0, 10); // Take top 10 categories

				setChartData(chartReadyData);
			} catch (err) {
				console.error('Error fetching category data:', err);
				setError(err.message);
			} finally {
				setIsLoading(false);
			}
		}

		fetchCategoryData();
	}, []);

	if (isLoading) {
		return (
			<Card className='w-full h-[400px] flex items-center justify-center'>
				<div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary'></div>
			</Card>
		);
	}

	if (error) {
		return (
			<Card className='w-full h-[400px] flex items-center justify-center'>
				<div className='text-red-500'>Error: {error}</div>
			</Card>
		);
	}

	return (
		<div className='w-full'>
			<ResponsiveContainer width='100%' height={400}>
				<BarChart
					data={chartData}
					margin={{
						top: 5,
						right: 30,
						left: 20,
						bottom: 100,
					}}
					barSize={40}>
					<CartesianGrid strokeDasharray='3 3' />
					<XAxis
						dataKey='name'
						angle={-45}
						textAnchor='end'
						height={100}
						tick={{ fontSize: 12 }}
						interval={0}
					/>
					<YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
					<Tooltip content={<CustomTooltip />} />
					<Legend wrapperStyle={{ bottom: -10 }} />
					<Bar dataKey='amount' name='Funding Amount' fill='#2563eb'>
						{chartData.map((entry, index) => (
							<Cell key={`cell-${index}`} fill={getCategoryColor(index)} />
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
			<div className='mt-2 text-sm text-gray-500 text-center'>
				<span className='bg-gray-100 py-1 px-2 rounded'>Demo Data</span>
			</div>
		</div>
	);
}

'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';

export default function OpportunitiesPage() {
	const [opportunities, setOpportunities] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [filters, setFilters] = useState({
		status: null,
		source_type: null,
		tags: [],
		page: 1,
		page_size: 9,
	});

	useEffect(() => {
		async function fetchOpportunities() {
			try {
				setLoading(true);

				// Build query string from filters
				const queryParams = new URLSearchParams();

				if (filters.status) {
					queryParams.append('status', filters.status);
				}

				if (filters.source_type) {
					queryParams.append('source_type', filters.source_type);
				}

				if (filters.tags.length > 0) {
					queryParams.append('tags', filters.tags.join(','));
				}

				queryParams.append('page', filters.page.toString());
				queryParams.append('page_size', filters.page_size.toString());

				// Fetch data from our API
				const response = await fetch(`/api/funding?${queryParams.toString()}`);
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch opportunities');
				}

				setOpportunities(result.data);
			} catch (err) {
				console.error('Error fetching opportunities:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchOpportunities();
	}, [filters]);

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Funding Opportunities</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button variant='outline'>Sort</Button>
						<Button>Export</Button>
					</div>
				</div>

				{loading ? (
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
					</div>
				) : error ? (
					<div className='bg-red-50 text-red-800 p-4 rounded-md'>
						<p>Error: {error}</p>
						<Button
							variant='outline'
							className='mt-2'
							onClick={() => {
								setError(null);
								setFilters({ ...filters });
							}}>
							Retry
						</Button>
					</div>
				) : opportunities.length === 0 ? (
					<div className='text-center py-12'>
						<h3 className='text-xl font-medium mb-2'>No opportunities found</h3>
						<p className='text-muted-foreground mb-4'>
							Try adjusting your filters or check back later.
						</p>
						<Button
							onClick={() =>
								setFilters({
									status: null,
									source_type: null,
									tags: [],
									page: 1,
									page_size: 9,
								})
							}>
							Clear Filters
						</Button>
					</div>
				) : (
					<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
						{opportunities.map((opportunity) => (
							<OpportunityCard key={opportunity.id} opportunity={opportunity} />
						))}
					</div>
				)}

				{!loading && !error && opportunities.length > 0 && (
					<div className='flex justify-center mt-6'>
						<Button
							variant='outline'
							className='mr-2'
							disabled={filters.page === 1}
							onClick={() =>
								setFilters({ ...filters, page: filters.page - 1 })
							}>
							Previous
						</Button>
						<Button
							variant='outline'
							onClick={() =>
								setFilters({ ...filters, page: filters.page + 1 })
							}>
							Next
						</Button>
					</div>
				)}
			</div>
		</MainLayout>
	);
}

function OpportunityCard({ opportunity }) {
	// Format the data from our database to match the UI expectations
	const title = opportunity.title;
	const source = opportunity.source_name;
	const amount =
		opportunity.minimum_award && opportunity.maximum_award
			? `$${opportunity.minimum_award.toLocaleString()} - $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.maximum_award
			? `Up to $${opportunity.maximum_award.toLocaleString()}`
			: opportunity.minimum_award
			? `From $${opportunity.minimum_award.toLocaleString()}`
			: 'Amount not specified';

	const closeDate = new Date(opportunity.close_date).toLocaleDateString(
		'en-US',
		{
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}
	);

	const status =
		opportunity.status ||
		determineStatus(opportunity.open_date, opportunity.close_date);
	const description = opportunity.description || 'No description available';
	const tags = opportunity.tags || [];

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{title}</CardTitle>
					<span
						className={`text-xs px-2 py-1 rounded-full ${
							status === 'Open'
								? 'bg-green-100 text-green-800'
								: status === 'Upcoming' || status === 'Anticipated'
								? 'bg-yellow-100 text-yellow-800'
								: 'bg-gray-100 text-gray-800'
						}`}>
						{status}
					</span>
				</div>
				<CardDescription>{source}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<p className='text-sm text-muted-foreground line-clamp-2'>
						{description}
					</p>

					<div className='flex flex-wrap gap-1'>
						{tags &&
							tags.map((tag, index) => (
								<span
									key={index}
									className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
									{tag}
								</span>
							))}
					</div>

					<div className='grid grid-cols-2 gap-2 text-sm'>
						<div>
							<div className='text-muted-foreground'>Amount</div>
							<div className='font-medium'>{amount}</div>
						</div>
						<div>
							<div className='text-muted-foreground'>Closes</div>
							<div className='font-medium'>{closeDate}</div>
						</div>
					</div>

					<Button className='w-full' asChild>
						<a href={`/funding/opportunities/${opportunity.id}`}>
							View Details
						</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// Fallback data in case the API is not available
const fallbackOpportunities = [
	{
		id: 1,
		title: 'Building Energy Efficiency Grant',
		source_name: 'Department of Energy',
		min_amount: 500000,
		max_amount: 2000000,
		close_date: '2023-04-15',
		status: 'Open',
		description:
			'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.',
		tags: ['Energy Efficiency', 'Commercial', 'Federal'],
	},
	// ... other opportunities can be added here
];

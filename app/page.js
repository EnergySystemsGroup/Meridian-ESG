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
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
	//======================================
	// STATE MANAGEMENT
	//======================================
	// List of upcoming deadlines (for detail card)
	const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
	const [deadlinesLoading, setDeadlinesLoading] = useState(true);
	const [deadlinesError, setDeadlinesError] = useState(null);

	// Count of deadlines in the next 30 days (for summary card)
	const [thirtyDayCount, setThirtyDayCount] = useState(0);
	const [thirtyDayCountLoading, setThirtyDayCountLoading] = useState(true);
	const [thirtyDayCountError, setThirtyDayCountError] = useState(null);

	// Count of open funding opportunities
	const [openOpportunitiesCount, setOpenOpportunitiesCount] = useState(0);
	const [openOpportunitiesLoading, setOpenOpportunitiesLoading] =
		useState(true);

	//======================================
	// DATA FETCHING
	//======================================
	useEffect(() => {
		// Fetch the 5 closest upcoming deadlines for detail list
		async function fetchDeadlines() {
			try {
				setDeadlinesLoading(true);
				const response = await fetch('/api/deadlines?type=upcoming&limit=5');
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch deadlines');
				}

				setUpcomingDeadlines(result.data);
			} catch (err) {
				console.error('Error fetching deadlines:', err);
				setDeadlinesError(err.message);
				// Fall back to sample data if API fails
				setUpcomingDeadlines(sampleUpcomingDeadlines);
			} finally {
				setDeadlinesLoading(false);
			}
		}

		// Fetch count of deadlines in the next 30 days for summary card
		async function fetchThirtyDayCount() {
			try {
				setThirtyDayCountLoading(true);
				const response = await fetch('/api/deadlines?type=thirty_day_count');
				const result = await response.json();

				if (!result.success) {
					throw new Error(
						result.error || 'Failed to fetch 30-day deadline count'
					);
				}

				setThirtyDayCount(result.count);
			} catch (err) {
				console.error('Error fetching 30-day deadline count:', err);
				setThirtyDayCountError(err.message);
				// Fall back to a default value
				setThirtyDayCount(8); // Use the previous hardcoded value as fallback
			} finally {
				setThirtyDayCountLoading(false);
			}
		}

		// Fetch count of current open opportunities
		async function fetchOpenOpportunitiesCount() {
			try {
				setOpenOpportunitiesLoading(true);
				const response = await fetch('/api/counts?type=open_opportunities');
				const result = await response.json();

				if (!result.success) {
					throw new Error(
						result.error || 'Failed to fetch open opportunities count'
					);
				}

				setOpenOpportunitiesCount(result.count);
			} catch (err) {
				console.error('Error fetching open opportunities count:', err);
				// Fallback to a default value
				setOpenOpportunitiesCount(24); // Use the previous hardcoded value as fallback
			} finally {
				setOpenOpportunitiesLoading(false);
			}
		}

		// Execute all data fetching functions
		fetchDeadlines();
		fetchThirtyDayCount();
		fetchOpenOpportunitiesCount();
	}, []);

	//======================================
	// MAIN COMPONENT RENDER
	//======================================
	return (
		<MainLayout>
			<div className='container py-10'>
				{/* Dashboard Header */}
				<div className='flex flex-col gap-2 mb-8'>
					<h1 className='text-3xl font-bold text-neutral-900 dark:text-neutral-50'>
						Welcome to Meridian
					</h1>
					<p className='text-neutral-500 dark:text-neutral-400 max-w-3xl'>
						Your centralized platform for policy and funding intelligence. Track
						opportunities, monitor legislation, and match clients to relevant
						funding sources.
					</p>
				</div>

				{/* Top Summary Cards Row */}
				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8'>
					{/* Open Opportunities Summary Card */}
					<DashboardCard
						title='Open Opportunities'
						value={
							openOpportunitiesLoading
								? '...'
								: openOpportunitiesCount.toString()
						}
						description='Currently open funding opportunities'
						href='/funding/opportunities?status=Open'
						linkText='View All'
					/>
					{/* 30-Day Deadlines Summary Card */}
					<DashboardCard
						title='Upcoming Deadlines'
						value={thirtyDayCountLoading ? '...' : thirtyDayCount.toString()}
						description='Applications due in the next 30 days'
						href='/timeline'
						linkText='View Timeline'
					/>
					{/* Active Legislation Summary Card */}
					<DashboardCard
						title='Active Legislation'
						value='9'
						description='Bills and policies in progress'
						href='/legislation/bills'
						linkText='View Bills'
					/>
					{/* Client Matches Summary Card */}
					<DashboardCard
						title='Client Matches'
						value='81'
						description='New potential matches for clients'
						href='/clients'
						linkText='View Matches'
					/>
				</div>

				{/* Detail Cards Row */}
				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{/* Recent Opportunities Card */}
					<Card>
						<CardHeader>
							<CardTitle>Recent Opportunities</CardTitle>
							<CardDescription>
								Latest funding opportunities added
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className='space-y-4'>
								{recentOpportunities.map((item) => (
									<li
										key={`opportunity-${item.title}`}
										className='border-b pb-2 last:border-0'>
										<div className='font-medium'>{item.title}</div>
										<div className='text-sm text-muted-foreground'>
											{item.source}
										</div>
										<div className='flex justify-between items-center mt-1'>
											<span className='text-sm'>Closes: {item.closeDate}</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${
													item.status === 'Open'
														? 'bg-green-100 text-green-800'
														: 'bg-yellow-100 text-yellow-800'
												}`}>
												{item.status}
											</span>
										</div>
									</li>
								))}
							</ul>
							<div className='mt-4'>
								<Link
									href='/funding/opportunities?status=Open'
									className='inline-flex w-full justify-center items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View All Opportunities
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Legislative Updates Card */}
					<Card>
						<CardHeader>
							<CardTitle>Legislative Updates</CardTitle>
							<CardDescription>
								Recent changes to tracked legislation
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='mb-3 px-2 py-1 bg-amber-50 border border-amber-300 rounded-md'>
								<p className='text-xs text-amber-700 flex items-center'>
									<AlertTriangle className='h-3 w-3 mr-1 text-amber-500' />
									Demo data for illustration purposes only
								</p>
							</div>
							<ul className='space-y-4'>
								{legislativeUpdates.map((item) => (
									<li
										key={`legislative-${item.title}`}
										className='border-b pb-2 last:border-0'>
										<div className='font-medium'>{item.title}</div>
										<div className='text-sm text-muted-foreground'>
											{item.jurisdiction}
										</div>
										<div className='flex justify-between items-center mt-1'>
											<span className='text-sm'>Updated: {item.date}</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
													item.status
												)}`}>
												{item.status}
											</span>
										</div>
									</li>
								))}
							</ul>
							<div className='mt-4'>
								<Link
									href='/legislation/bills'
									className='inline-flex w-full justify-center items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View All Legislation
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Upcoming Deadlines Detail Card */}
					<Card>
						<CardHeader>
							<CardTitle>Upcoming Deadlines</CardTitle>
							<CardDescription>Applications due soon</CardDescription>
						</CardHeader>
						<CardContent>
							{deadlinesLoading ? (
								<div className='flex justify-center items-center h-40'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							) : deadlinesError ? (
								<div className='text-sm text-red-600 p-2'>
									<p>Error loading deadlines. Using sample data.</p>
								</div>
							) : (
								<ul className='space-y-4'>
									{upcomingDeadlines.map((item) => (
										<li
											key={`deadline-${item.id}`}
											className='border-b pb-2 last:border-0'>
											<div className='font-medium'>{item.title}</div>
											<div className='text-sm text-muted-foreground'>
												{item.source_name || 'Unknown Source'}
											</div>
											<div className='flex justify-between items-center mt-1'>
												<span className='text-sm'>
													Due: {item.formattedDate}
												</span>
												<span
													className={`text-xs px-2 py-1 rounded-full ${getDaysColor(
														item.daysLeft
													)}`}>
													{item.daysLeft} days left
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
							<div className='mt-4'>
								<Link
									href='/timeline'
									className='inline-flex w-full justify-center items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View Timeline
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Bottom Row - Chart and Quick Actions */}
				<div className='grid gap-6 md:grid-cols-3'>
					{/* Chart Card */}
					<Card className='md:col-span-2'>
						<CardHeader>
							<CardTitle>Funding by Category</CardTitle>
							<CardDescription>
								Distribution of available funding by category
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='h-80 flex items-center justify-center border rounded-md bg-muted/20'>
								<p className='text-muted-foreground'>
									Chart visualization will be implemented here
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Quick Actions Card */}
					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
							<CardDescription>Common tasks and shortcuts</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='space-y-2'>
								<Link
									href='/funding/opportunities'
									className='inline-flex w-full justify-start items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									Browse Opportunities
								</Link>
								<Link
									href='/funding/map'
									className='inline-flex w-full justify-start items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View Funding Map
								</Link>
								<Link
									href='/legislation/bills'
									className='inline-flex w-full justify-start items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									Track Legislation
								</Link>
								<Link
									href='/clients'
									className='inline-flex w-full justify-start items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									Match Clients
								</Link>
								<Link
									href='/timeline'
									className='inline-flex w-full justify-start items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View Timeline
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Recent Activity Section */}
				<div className='mb-8'>
					<h2 className='text-xl font-semibold mb-4'>Recent Activity</h2>
					<div className='border rounded-lg overflow-hidden'>
						<div className='bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b'>
							<div className='flex justify-between items-center'>
								<span className='font-medium'>Latest Updates</span>
								<Button variant='outline' size='sm'>
									View All
								</Button>
							</div>
						</div>
						<div className='divide-y'>
							{activityItems.map((item) => (
								<div
									key={`activity-${item.title}-${item.date}`}
									className='p-4 flex items-start gap-3'>
									<div
										className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(
											item.type
										)}`}></div>
									<div className='flex-1'>
										<div className='flex justify-between'>
											<span className='font-medium text-sm'>{item.title}</span>
											<span className='text-xs text-neutral-500'>
												{item.date}
											</span>
										</div>
										<p className='text-sm text-neutral-600 dark:text-neutral-400 mt-1'>
											{item.description}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

//======================================
// HELPER COMPONENTS
//======================================
// Reusable card component for dashboard summary metrics
function DashboardCard({ title, value, description, href, linkText }) {
	return (
		<Card className='overflow-hidden relative'>
			<div className='h-1 bg-blue-500'></div>
			{(title === 'Active Legislation' || title === 'Client Matches') && (
				<div className='absolute top-2 right-2 px-1 py-0.5 bg-amber-50 border border-amber-300 rounded-md'>
					<p className='text-[10px] text-amber-700 flex items-center'>
						<AlertTriangle className='h-2 w-2 mr-0.5 text-amber-500' />
						Demo Data
					</p>
				</div>
			)}
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm font-medium'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
					{value}
				</div>
				<p className='text-xs text-neutral-500 dark:text-neutral-400 mt-1'>
					{description}
				</p>
				<div className='mt-4'>
					<Link
						href={href}
						className='inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'>
						{linkText} →
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}

//======================================
// UTILITY FUNCTIONS
//======================================
// Get the appropriate color for various status types
function getStatusColor(status) {
	switch (status) {
		case 'opportunity':
			return 'bg-blue-500';
		case 'legislation':
			return 'bg-purple-500';
		case 'match':
			return 'bg-green-500';
		case 'deadline':
			return 'bg-red-500';
		case 'policy':
			return 'bg-amber-500';
		case 'Introduced':
			return 'bg-blue-100 text-blue-800';
		case 'Committee':
			return 'bg-purple-100 text-purple-800';
		case 'Passed':
			return 'bg-green-100 text-green-800';
		case 'Failed':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

// Get color coding based on number of days left until deadline
function getDaysColor(days) {
	if (days <= 7) return 'bg-red-100 text-red-800';
	if (days <= 14) return 'bg-yellow-100 text-yellow-800';
	return 'bg-blue-100 text-blue-800';
}

//======================================
// SAMPLE DATA
//======================================
// Sample data for the activity feed
const activityItems = [
	{
		title: 'New Funding Opportunity',
		date: '2 hours ago',
		type: 'opportunity',
		description:
			'Department of Energy released a new $50M funding opportunity for building electrification projects.',
	},
	{
		title: 'Legislation Update',
		date: '4 hours ago',
		type: 'legislation',
		description:
			'H.R. 123: Building Efficiency Act has moved to committee review.',
	},
	{
		title: 'Client Match',
		date: 'Yesterday',
		type: 'match',
		description:
			'Springfield School District matched with 3 new funding opportunities.',
	},
	{
		title: 'Deadline Approaching',
		date: 'Yesterday',
		type: 'deadline',
		description:
			'Energy Efficiency Block Grants application deadline is in 5 days.',
	},
	{
		title: 'New Policy Brief',
		date: '2 days ago',
		type: 'policy',
		description:
			'New analysis on the impact of recent energy efficiency legislation on funding availability.',
	},
];

// Sample data for recent opportunities section
const recentOpportunities = [
	{
		title: 'Building Energy Efficiency Grant',
		source: 'Department of Energy',
		closeDate: 'Apr 15, 2023',
		status: 'Open',
	},
	{
		title: 'School Modernization Program',
		source: 'Department of Education',
		closeDate: 'May 1, 2023',
		status: 'Open',
	},
	{
		title: 'Clean Energy Innovation Fund',
		source: 'California Energy Commission',
		closeDate: 'Apr 30, 2023',
		status: 'Open',
	},
	{
		title: 'Community Climate Resilience Grant',
		source: 'EPA',
		closeDate: 'May 15, 2023',
		status: 'Upcoming',
	},
];

// Sample data for legislation updates section
const legislativeUpdates = [
	{
		title: 'H.R. 123: Building Efficiency Act',
		jurisdiction: 'Federal',
		date: 'Mar 28, 2025',
		status: 'Committee',
	},
	{
		title: 'S.B. 456: Clean Energy Schools Initiative',
		jurisdiction: 'California',
		date: 'Mar 15, 2025',
		status: 'Introduced',
	},
	{
		title: 'H.R. 789: Infrastructure Investment Act',
		jurisdiction: 'Federal',
		date: 'Apr 02, 2025',
		status: 'Passed',
	},
	{
		title: 'A.B. 567: Building Standards Update',
		jurisdiction: 'California',
		date: 'Mar 10, 2025',
		status: 'Committee',
	},
];

// Sample data for upcoming deadlines (fallback if API fails)
const sampleUpcomingDeadlines = [
	{
		id: 1,
		title: 'Clean Energy Innovation Fund',
		source_name: 'California Energy Commission',
		formattedDate: 'Apr 30, 2023',
		daysLeft: 5,
		urgency: 'high',
	},
	{
		id: 2,
		title: 'School Modernization Program',
		source_name: 'Department of Education',
		formattedDate: 'May 1, 2023',
		daysLeft: 6,
		urgency: 'high',
	},
	{
		id: 3,
		title: 'Community Climate Resilience Grant',
		source_name: 'EPA',
		formattedDate: 'May 15, 2023',
		daysLeft: 20,
		urgency: 'medium',
	},
	{
		id: 4,
		title: 'Solar for Schools Initiative',
		source_name: 'California Energy Commission',
		formattedDate: 'May 20, 2023',
		daysLeft: 25,
		urgency: 'medium',
	},
	{
		id: 5,
		title: 'Zero Emission School Bus Program',
		source_name: 'EPA',
		formattedDate: 'May 30, 2023',
		daysLeft: 35,
		urgency: 'low',
	},
];

'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import FundingProjectTypeChart from '@/components/dashboard/FundingProjectTypeChart';

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

	// Recent opportunities
	const [recentOpportunities, setRecentOpportunities] = useState([]);
	const [recentOpportunitiesLoading, setRecentOpportunitiesLoading] =
		useState(true);
	const [recentOpportunitiesError, setRecentOpportunitiesError] =
		useState(null);

	// Client matches data
	const [clientMatchData, setClientMatchData] = useState({
		clientsWithMatches: 0,
		totalMatches: 0,
		totalClients: 0,
	});
	const [clientMatchesLoading, setClientMatchesLoading] = useState(true);

	// Max available funding
	const [maxFunding, setMaxFunding] = useState(0);
	const [maxFundingLoading, setMaxFundingLoading] = useState(true);

	// Top client matches
	const [topClientMatches, setTopClientMatches] = useState([]);
	const [topClientMatchesLoading, setTopClientMatchesLoading] = useState(true);

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

		// Fetch recent opportunities
		async function fetchRecentOpportunities() {
			try {
				setRecentOpportunitiesLoading(true);
				// Sort by created_at, descending order, limit to 5 results
				const response = await fetch(
					'/api/funding?sort_by=created_at&sort_direction=desc&page=1&page_size=5'
				);
				const result = await response.json();

				if (!result.success) {
					throw new Error(
						result.error || 'Failed to fetch recent opportunities'
					);
				}

				setRecentOpportunities(result.data);
			} catch (err) {
				console.error('Error fetching recent opportunities:', err);
				setRecentOpportunitiesError(err.message);
				// Fall back to sample data if API fails
				setRecentOpportunities(sampleRecentOpportunities);
			} finally {
				setRecentOpportunitiesLoading(false);
			}
		}

		// Fetch client matches data
		async function fetchClientMatchData() {
			try {
				setClientMatchesLoading(true);
				const response = await fetch('/api/client-matching/summary');
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch client matches data');
				}

				setClientMatchData({
					clientsWithMatches: result.clientsWithMatches,
					totalMatches: result.totalMatches,
					totalClients: result.totalClients,
				});
			} catch (err) {
				console.error('Error fetching client matches data:', err);
				// Fallback to default values
				setClientMatchData({
					clientsWithMatches: 0,
					totalMatches: 0,
					totalClients: 0,
				});
			} finally {
				setClientMatchesLoading(false);
			}
		}

		// Fetch max available funding
		async function fetchMaxFunding() {
			try {
				setMaxFundingLoading(true);
				const response = await fetch('/api/funding/total-available');
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch max funding');
				}

				setMaxFunding(result.total);
			} catch (err) {
				console.error('Error fetching max funding:', err);
				setMaxFunding(0);
			} finally {
				setMaxFundingLoading(false);
			}
		}

		// Fetch top client matches
		async function fetchTopClientMatches() {
			try {
				setTopClientMatchesLoading(true);
				const response = await fetch('/api/client-matching/top-matches');
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch top matches');
				}

				setTopClientMatches(result.matches);
			} catch (err) {
				console.error('Error fetching top client matches:', err);
				setTopClientMatches([]);
			} finally {
				setTopClientMatchesLoading(false);
			}
		}

		// Execute all data fetching functions
		fetchDeadlines();
		fetchThirtyDayCount();
		fetchOpenOpportunitiesCount();
		fetchRecentOpportunities();
		fetchClientMatchData();
		fetchMaxFunding();
		fetchTopClientMatches();
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
						Your centralized platform for funding intelligence. Track
						opportunities and match clients to relevant funding sources.
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
						linkText='View Open'
					/>
					{/* 30-Day Deadlines Summary Card */}
					<DashboardCard
						title='Upcoming Deadlines'
						value={thirtyDayCountLoading ? '...' : thirtyDayCount.toString()}
						description='Applications due in the next 30 days'
						href='/timeline'
						linkText='View Timeline'
					/>
					{/* Max Available Funding Summary Card */}
					<DashboardCard
						title='Max Available Funding'
						value={maxFundingLoading ? '...' : formatCurrency(maxFunding)}
						description='Per-applicant funding from open opportunities'
						href='/funding/opportunities?status=Open'
						linkText='View Opportunities'
					/>
					{/* Client Matches Summary Card */}
					<DashboardCard
						title='Client Matches'
						value={
							clientMatchesLoading
								? '...'
								: clientMatchData.clientsWithMatches.toString()
						}
						description={
							clientMatchesLoading
								? 'Loading...'
								: `of ${clientMatchData.totalClients} clients • ${clientMatchData.totalMatches} total matches`
						}
						href='/clients'
						linkText='View Matches'
					/>
				</div>

				{/* Detail Cards Row */}
				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{/* Recent Opportunities Card */}
					<Card className='flex flex-col h-full'>
						<CardHeader>
							<CardTitle>Recent Opportunities</CardTitle>
							<CardDescription>
								Latest funding opportunities added
							</CardDescription>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{recentOpportunitiesLoading ? (
								<div className='flex justify-center items-center h-40'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							) : recentOpportunitiesError ? (
								<div className='text-sm text-red-600 p-2'>
									<p>Error loading opportunities. Using sample data.</p>
								</div>
							) : (
								<ul className='space-y-4 flex-grow'>
									{recentOpportunities.map((item) => (
										<li
											key={`opportunity-${item.id}`}
											className='border-b pb-2 last:border-0'>
											<div className='font-medium'>{item.title}</div>
											<div className='text-sm text-muted-foreground'>
												{item.source_name}
											</div>
											<div className='flex justify-between items-center mt-1'>
												<span className='text-sm'>
													Added:{' '}
													{item.created_at
														? new Date(item.created_at).toLocaleDateString(
																'en-US',
																{
																	month: 'short',
																	day: 'numeric',
																	year: 'numeric',
																}
														  )
														: 'Unknown'}
												</span>
												<span
													className={`text-xs px-2 py-1 rounded-full ${item.relevance_score ? getScoreColor(item.relevance_score) : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
													{item.relevance_score
														? `Score: ${item.relevance_score.toFixed(1)}`
														: 'New'}
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
							<div className='mt-4'>
								<Link
									href='/funding/opportunities?sort=recent&sort_direction=desc'
									className='inline-flex w-full justify-center items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View All Opportunities
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Top Client Matches Card */}
					<Card className='flex flex-col h-full'>
						<CardHeader>
							<CardTitle>Top Client Matches</CardTitle>
							<CardDescription>
								Best opportunity matches for your clients
							</CardDescription>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{topClientMatchesLoading ? (
								<div className='flex justify-center items-center h-40'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							) : topClientMatches.length === 0 ? (
								<div className='text-sm text-muted-foreground p-2'>
									<p>No client matches found.</p>
								</div>
							) : (
								<ul className='space-y-4 flex-grow'>
									{topClientMatches.map((match) => (
										<li
											key={`match-${match.client_id}`}
											className='border-b pb-2 last:border-0'>
											<div className='font-medium'>{match.client_name}</div>
											<div className='text-sm text-muted-foreground line-clamp-1'>
												{match.top_opportunity_title}
											</div>
											<div className='flex justify-between items-center mt-1'>
												<span className='text-sm'>
													{match.match_count} matches
												</span>
												<span
													className={`text-xs px-2 py-1 rounded-full ${getMatchScoreColor(
														match.top_opportunity_score
													)}`}>
													Top match: {match.top_opportunity_score}%
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
							<div className='mt-4'>
								<Link
									href='/clients'
									className='inline-flex w-full justify-center items-center py-2 px-4 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors'>
									View All Clients
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Upcoming Deadlines Detail Card */}
					<Card className='flex flex-col h-full'>
						<CardHeader>
							<CardTitle>Upcoming Deadlines</CardTitle>
							<CardDescription>Applications due soon</CardDescription>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{deadlinesLoading ? (
								<div className='flex justify-center items-center h-40'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							) : deadlinesError ? (
								<div className='text-sm text-red-600 p-2'>
									<p>Error loading deadlines. Using sample data.</p>
								</div>
							) : (
								<ul className='space-y-4 flex-grow'>
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
					{/* Funding Project Type Chart */}
					<div className='md:col-span-2'>
						<FundingProjectTypeChart />
					</div>

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
// Get color coding based on number of days left until deadline
function getDaysColor(days) {
	if (days <= 7) return 'bg-red-100 text-red-800';
	if (days <= 14) return 'bg-yellow-100 text-yellow-800';
	return 'bg-blue-100 text-blue-800';
}

// Get color coding for match score
function getMatchScoreColor(score) {
	if (score >= 80) return 'bg-green-100 text-green-800';
	if (score >= 50) return 'bg-yellow-100 text-yellow-800';
	return 'bg-blue-100 text-blue-800';
}

// Get color coding for relevance score (0-10 scale)
function getScoreColor(score) {
	if (score >= 8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
	if (score >= 6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
	if (score >= 4) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
	return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

// Format currency for display (e.g., $1.2B, $500M, $50K)
function formatCurrency(amount) {
	if (amount >= 1000000000) {
		return `$${(amount / 1000000000).toFixed(1)}B`;
	}
	if (amount >= 1000000) {
		return `$${(amount / 1000000).toFixed(0)}M`;
	}
	if (amount >= 1000) {
		return `$${(amount / 1000).toFixed(0)}K`;
	}
	return `$${amount}`;
}

//======================================
// SAMPLE DATA (Fallbacks if API fails)
//======================================
// Sample data for recent opportunities (fallback if API fails)
const sampleRecentOpportunities = [
	{
		id: 1,
		title: 'Building Energy Efficiency Grant',
		source_name: 'Department of Energy',
		created_at: '2023-04-05',
		relevance_score: 0.85,
	},
	{
		id: 2,
		title: 'School Modernization Program',
		source_name: 'Department of Education',
		created_at: '2023-04-08',
		relevance_score: 0.78,
	},
	{
		id: 3,
		title: 'Clean Energy Innovation Fund',
		source_name: 'California Energy Commission',
		created_at: '2023-04-10',
		relevance_score: 0.92,
	},
	{
		id: 4,
		title: 'Community Climate Resilience Grant',
		source_name: 'EPA',
		created_at: '2023-04-12',
		relevance_score: 0.67,
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

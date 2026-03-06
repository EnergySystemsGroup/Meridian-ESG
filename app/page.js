'use client';

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
import {
	useUpcomingDeadlines,
	useThirtyDayDeadlineCount,
	useOpenOpportunitiesCount,
	useRecentOpportunities,
} from '@/lib/hooks/queries/useDashboard';
import {
	useClientMatchSummary,
	useTopClientMatches,
} from '@/lib/hooks/queries/useClients';
import { useFundingCount } from '@/lib/hooks/queries/useFunding';
import { useClientsFilterStore } from '@/lib/stores/clientsFilterStore';

export default function Home() {
	//======================================
	// DATA FETCHING (TanStack Query)
	//======================================
	const filterUserId = useClientsFilterStore((s) => s.filterUserId);
	const apiUserId = filterUserId === null ? undefined : filterUserId;
	const { data: deadlinesData, isLoading: deadlinesLoading, error: deadlinesError } = useUpcomingDeadlines(5);
	const upcomingDeadlines = deadlinesData?.data ?? sampleUpcomingDeadlines;

	const { data: thirtyDayData, isLoading: thirtyDayCountLoading } = useThirtyDayDeadlineCount();
	const thirtyDayCount = thirtyDayData?.count ?? 0;

	const { data: openOppData, isLoading: openOpportunitiesLoading } = useOpenOpportunitiesCount();
	const openOpportunitiesCount = openOppData?.count ?? 0;

	const { data: recentOppData, isLoading: recentOpportunitiesLoading, error: recentOpportunitiesError } = useRecentOpportunities();
	const recentOpportunities = recentOppData?.data ?? sampleRecentOpportunities;

	const { data: clientMatchRaw, isLoading: clientMatchesLoading } = useClientMatchSummary({ userId: apiUserId });
	const clientMatchData = clientMatchRaw
		? { clientsWithMatches: clientMatchRaw.clientsWithMatches, totalMatches: clientMatchRaw.totalMatches, totalClients: clientMatchRaw.totalClients }
		: { clientsWithMatches: 0, totalMatches: 0, totalClients: 0 };

	const { data: fundingData, isLoading: maxFundingLoading } = useFundingCount();
	const maxFunding = fundingData?.total ?? 0;

	const { data: topMatchesData, isLoading: topClientMatchesLoading } = useTopClientMatches({ userId: apiUserId });
	const topClientMatches = topMatchesData?.matches ?? [];

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

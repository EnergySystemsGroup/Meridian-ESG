'use client';

import MainLayout from '@/components/layout/main-layout';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Search, Map, Users, Calendar } from 'lucide-react';
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

	// Compute urgent deadlines count (within 7 days)
	const urgentDeadlineCount = deadlinesLoading ? 0 : upcomingDeadlines.filter(d => d.daysLeft <= 7).length;

	//======================================
	// MAIN COMPONENT RENDER
	//======================================
	return (
		<MainLayout>
			<div className='container py-8'>
				{/* Dashboard Header — compact operational strip */}
				<div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8'>
					<div>
						<h1 className='text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'>
							Dashboard
						</h1>
						<p className='text-sm text-muted-foreground mt-0.5'>
							Policy and funding intelligence overview
						</p>
					</div>
					<div className='flex items-center gap-3'>
						{urgentDeadlineCount > 0 && (
							<span
								role='status'
								aria-label={`${urgentDeadlineCount} urgent deadline${urgentDeadlineCount !== 1 ? 's' : ''} within 7 days`}
								className='inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-full ring-1 ring-inset ring-rose-200 dark:ring-rose-800/40'>
								<AlertTriangle className='h-3 w-3' />
								{urgentDeadlineCount} urgent deadline{urgentDeadlineCount !== 1 ? 's' : ''}
							</span>
						)}
						<span className='text-xs text-muted-foreground tabular-nums sm:hidden'>
							{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
						</span>
						<span className='text-xs text-muted-foreground tabular-nums hidden sm:block'>
							{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
						</span>
					</div>
				</div>

				{/* Top Summary Cards Row */}
				<div className='grid gap-4 grid-cols-2 lg:grid-cols-4 mb-10'>
					<DashboardCard
						title='Open Opportunities'
						value={openOpportunitiesLoading ? null : openOpportunitiesCount.toString()}
						description='Currently open funding opportunities'
						href='/funding/opportunities?status=Open'
						linkText='View open'
					/>
					<DashboardCard
						title='Upcoming Deadlines'
						value={thirtyDayCountLoading ? null : thirtyDayCount.toString()}
						description='Applications due in the next 30 days'
						href='/timeline'
						linkText='View timeline'
					/>
					<DashboardCard
						title='Max Available Funding'
						value={maxFundingLoading ? null : formatCurrency(maxFunding)}
						description='Per-applicant funding from open opportunities'
						href='/funding/opportunities?status=Open'
						linkText='View opportunities'
					/>
					<DashboardCard
						title='Client Matches'
						value={clientMatchesLoading ? null : clientMatchData.clientsWithMatches.toString()}
						description={
							clientMatchesLoading
								? 'Loading...'
								: `of ${clientMatchData.totalClients} clients \u00B7 ${clientMatchData.totalMatches} total matches`
						}
						href='/clients'
						linkText='View matches'
					/>
				</div>

				{/* Detail Cards Row — Deadlines first (urgency priority) */}
				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{/* Upcoming Deadlines Detail Card — first for urgency */}
					<Card className='flex flex-col h-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow hover:shadow-md transition-shadow duration-200'>
						<CardHeader className='pb-4'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2.5'>
									<div className='h-5 w-0.5 rounded-full bg-blue-500'></div>
									<CardTitle className='text-sm font-semibold'>Upcoming Deadlines</CardTitle>
								</div>
								{!deadlinesLoading && (
									<span className='text-xs text-muted-foreground tabular-nums'>{upcomingDeadlines.length} items</span>
								)}
							</div>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{deadlinesLoading ? (
								<ListSkeleton />
							) : deadlinesError ? (
								<div className='text-sm text-red-600 dark:text-red-400 p-2'>
									<p>Error loading deadlines. Using sample data.</p>
								</div>
							) : (
								<ul className='space-y-1 flex-grow'>
									{upcomingDeadlines.map((item) => (
										<li key={`deadline-${item.id}`}>
											<Link
												href={`/funding/opportunities/${item.id}`}
												className={`group/item flex items-start justify-between gap-3 rounded-lg px-3 py-3 -mx-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 relative ${item.daysLeft <= 7 ? 'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-rose-500' : ''}`}>
												<div className='min-w-0 flex-1'>
													<div className='text-sm font-medium leading-snug truncate text-neutral-900 dark:text-neutral-100'>{item.title}</div>
													<div className='text-xs text-muted-foreground mt-0.5'>{item.source_name || 'Unknown Source'}</div>
													<div className='text-xs text-muted-foreground mt-0.5'>Due: {item.formattedDate}</div>
												</div>
												<span className={`text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0 ring-1 ring-inset ${getDaysColor(item.daysLeft)}`}>
													{item.daysLeft}d left
												</span>
											</Link>
										</li>
									))}
								</ul>
							)}
							<div className='mt-auto pt-4 border-t border-border'>
								<Link
									href='/timeline'
									className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded'>
									All deadlines <ArrowRight className='h-3 w-3' />
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Top Client Matches Card */}
					<Card className='flex flex-col h-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow hover:shadow-md transition-shadow duration-200'>
						<CardHeader className='pb-4'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2.5'>
									<div className='h-5 w-0.5 rounded-full bg-blue-500'></div>
									<CardTitle className='text-sm font-semibold'>Top Client Matches</CardTitle>
								</div>
								{!topClientMatchesLoading && topClientMatches.length > 0 && (
									<span className='text-xs text-muted-foreground tabular-nums'>{topClientMatches.length} clients</span>
								)}
							</div>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{topClientMatchesLoading ? (
								<ListSkeleton count={3} />
							) : topClientMatches.length === 0 ? (
								<div className='text-sm text-muted-foreground p-2'>
									<p>No client matches found.</p>
								</div>
							) : (
								<ul className='space-y-1 flex-grow'>
									{topClientMatches.map((match) => (
										<li key={`match-${match.client_id}`}>
											<Link
												href={`/clients/${match.client_id}/matches`}
												className='group/item flex items-start justify-between gap-3 rounded-lg px-3 py-3 -mx-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'>
												<div className='min-w-0 flex-1'>
													<div className='text-sm font-medium leading-snug truncate text-neutral-900 dark:text-neutral-100'>{match.client_name}</div>
													<div className='text-xs text-muted-foreground mt-0.5 truncate'>{match.top_opportunity_title}</div>
													<div className='text-xs text-muted-foreground mt-0.5'>{match.match_count} matches</div>
												</div>
												<span className={`text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0 ring-1 ring-inset ${getMatchScoreColor(match.top_opportunity_score)}`}>
													{match.top_opportunity_score}%
												</span>
											</Link>
										</li>
									))}
								</ul>
							)}
							<div className='mt-auto pt-4 border-t border-border'>
								<Link
									href='/clients'
									className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded'>
									All clients <ArrowRight className='h-3 w-3' />
								</Link>
							</div>
						</CardContent>
					</Card>

					{/* Recent Opportunities Card */}
					<Card className='flex flex-col h-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow hover:shadow-md transition-shadow duration-200'>
						<CardHeader className='pb-4'>
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2.5'>
									<div className='h-5 w-0.5 rounded-full bg-blue-500'></div>
									<CardTitle className='text-sm font-semibold'>Recent Opportunities</CardTitle>
								</div>
								{!recentOpportunitiesLoading && (
									<span className='text-xs text-muted-foreground tabular-nums'>{recentOpportunities.length} items</span>
								)}
							</div>
						</CardHeader>
						<CardContent className='flex flex-col flex-grow'>
							{recentOpportunitiesLoading ? (
								<ListSkeleton />
							) : recentOpportunitiesError ? (
								<div className='text-sm text-red-600 dark:text-red-400 p-2'>
									<p>Error loading opportunities. Using sample data.</p>
								</div>
							) : (
								<ul className='space-y-1 flex-grow'>
									{recentOpportunities.map((item) => (
										<li key={`opportunity-${item.id}`}>
											<Link
												href={`/funding/opportunities/${item.id}`}
												className='group/item flex items-start justify-between gap-3 rounded-lg px-3 py-3 -mx-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'>
												<div className='min-w-0 flex-1'>
													<div className='text-sm font-medium leading-snug truncate text-neutral-900 dark:text-neutral-100'>{item.title}</div>
													<div className='text-xs text-muted-foreground mt-0.5'>{item.source_name}</div>
													<div className='text-xs text-muted-foreground mt-0.5'>
														Added:{' '}
														{item.created_at
															? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
															: 'Unknown'}
													</div>
												</div>
												<span className={`text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums shrink-0 ring-1 ring-inset ${item.relevance_score ? getScoreColor(item.relevance_score) : 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:ring-blue-800/40'}`}>
													{item.relevance_score ? `${item.relevance_score.toFixed(1)}` : 'New'}
												</span>
											</Link>
										</li>
									))}
								</ul>
							)}
							<div className='mt-auto pt-4 border-t border-border'>
								<Link
									href='/funding/opportunities?sort=recent&sort_direction=desc'
									className='inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded'>
									All opportunities <ArrowRight className='h-3 w-3' />
								</Link>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Bottom Row - Chart and Navigate */}
				<div className='grid gap-6 lg:grid-cols-[1fr_280px]'>
					<FundingProjectTypeChart />

					{/* Navigate Card */}
					<Card className='shadow-sm'>
						<CardHeader className='pb-4'>
							<div className='flex items-center gap-2.5'>
								<div className='h-5 w-0.5 rounded-full bg-blue-500'></div>
								<CardTitle className='text-sm font-semibold'>Navigate</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<div className='space-y-1'>
								{[
									{ href: '/funding/opportunities', label: 'Opportunity Explorer', desc: 'Browse all funding', icon: Search },
									{ href: '/map', label: 'Funding Map', desc: 'Geographic view', icon: Map },
									{ href: '/clients', label: 'Client Matching', desc: 'Review matches', icon: Users },
									{ href: '/timeline', label: 'Timeline', desc: 'Deadlines & milestones', icon: Calendar },
								].map((item) => (
									<Link
										key={item.href}
										href={item.href}
										className='group flex items-center justify-between py-3 px-3 -mx-3 rounded-lg text-sm hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'>
										<div className='flex items-center gap-2.5'>
											<item.icon className='h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors' />
											<div>
												<span className='font-medium text-neutral-900 dark:text-neutral-100 text-sm'>{item.label}</span>
												<span className='block text-xs text-muted-foreground mt-0.5 lg:hidden'>{item.desc}</span>
												<span className='ml-2 text-xs text-muted-foreground hidden lg:inline'>{item.desc}</span>
											</div>
										</div>
										<ArrowRight className='h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200' />
									</Link>
								))}
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

// Redesigned metric card — tinted background, large neutral value, uppercase label
function DashboardCard({ title, value, description, href, linkText }) {
	return (
		<Card className='group relative overflow-hidden border border-blue-100/60 dark:border-blue-900/20 bg-gradient-to-b from-blue-50/80 to-white dark:from-blue-950/30 dark:to-neutral-950 shadow-sm hover:shadow-md transition-all duration-200'>
			<CardHeader className='pb-1 pt-5 px-4 sm:px-5'>
				<CardTitle className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>{title}</CardTitle>
			</CardHeader>
			<CardContent className='px-4 sm:px-5 pb-4 sm:pb-5'>
				<div className='text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50'>
					{value !== null ? value : <Skeleton className='h-8 sm:h-9 w-20 rounded' />}
				</div>
				<p className='text-xs text-muted-foreground mt-1.5 leading-relaxed hidden sm:block'>
					{description}
				</p>
				<Link
					href={href}
					className='inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-3 py-2 -my-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded'>
					{linkText}
					<ArrowRight className='h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5' />
				</Link>
			</CardContent>
		</Card>
	);
}

// Skeleton loading pattern for detail card lists
function ListSkeleton({ count = 5 }) {
	return (
		<div className='space-y-1' role='status' aria-label='Loading'>
			{[...Array(count)].map((_, i) => (
				<div key={i} className='flex items-start justify-between gap-3 rounded-lg px-3 py-3 -mx-3' aria-hidden='true'>
					<div className='space-y-1.5 flex-1'>
						<Skeleton className='h-3.5 w-3/4' />
						<Skeleton className='h-3 w-1/2' />
					</div>
					<Skeleton className='h-5 w-14 rounded-md' />
				</div>
			))}
		</div>
	);
}

//======================================
// UTILITY FUNCTIONS
//======================================

// Unified semantic color system for badges
function getDaysColor(days) {
	if (days <= 7) return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-800/40';
	if (days <= 14) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40';
	return 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700';
}

function getMatchScoreColor(score) {
	if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/40';
	if (score >= 50) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40';
	return 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700';
}

function getScoreColor(score) {
	if (score >= 8) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/40';
	if (score >= 6) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40';
	if (score >= 4) return 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700';
	return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-800/40';
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, ArrowLeft, MapPin, Building, DollarSign, Target, EyeOff } from 'lucide-react';
import { ExportPDFButton } from '@/components/clients/ExportPDFButton';
import { HideMatchButton } from '@/components/clients/HideMatchButton';
import { HiddenMatchesPanel } from '@/components/clients/HiddenMatchesPanel';
import Link from 'next/link';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import {
	fetchClientMatches,
	formatMatchScore,
	generateProjectNeedsWithCounts,
	groupMatchesByFundingType,
	getMatchScoreBadgeStyles,
	getFundingGroupDotColor,
} from '@/lib/utils/clientMatching';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';

export default function ClientMatchesPage() {
	const params = useParams();
	const clientId = params.clientId;

	const [clientResult, setClientResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState('matches');
	const [hiddenCount, setHiddenCount] = useState(0);

	const loadClientMatches = useCallback(async () => {
		try {
			setLoading(true);
			const result = await fetchClientMatches(clientId);
			setClientResult(result);
			setHiddenCount(result.hiddenCount || 0);
		} catch (err) {
			console.error('Error loading client matches:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}, [clientId]);

	useEffect(() => {
		if (clientId) {
			loadClientMatches();
		}
	}, [clientId, loadClientMatches]);

	const handleMatchHidden = useCallback((opportunityId) => {
		setClientResult(prev => ({
			...prev,
			matches: prev.matches.filter(m => m.id !== opportunityId),
			matchCount: prev.matchCount - 1
		}));
		setHiddenCount(prev => prev + 1);
	}, []);

	const handleMatchRestored = useCallback(() => {
		loadClientMatches();
	}, [loadClientMatches]);

	if (loading) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='flex items-center gap-2'>
							<Loader2 className='h-6 w-6 animate-spin' />
							<span>Loading client matches...</span>
						</div>
					</div>
				</div>
			</MainLayout>
		);
	}

	if (error) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<Alert variant='destructive' className='mb-6'>
						<AlertTriangle className='h-4 w-4' />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</div>
			</MainLayout>
		);
	}

	if (!clientResult) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<Alert variant='destructive' className='mb-6'>
						<AlertTriangle className='h-4 w-4' />
						<AlertTitle>Client Not Found</AlertTitle>
						<AlertDescription>The requested client could not be found.</AlertDescription>
					</Alert>
				</div>
			</MainLayout>
		);
	}

	const { client, matches, matchCount } = clientResult;

	// Merged project needs with match counts
	const needsWithCounts = generateProjectNeedsWithCounts(client.project_needs, matches);

	// Group matches by funding type, sorted by relevance within each group
	const groupedMatches = groupMatchesByFundingType(matches);

	// Budget formatting with numeric fallback
	const budgetLabels = {
		small: 'Small ($50K - $500K)',
		medium: 'Medium ($500K - $5M)',
		large: 'Large ($5M - $50M)',
		very_large: 'Very Large ($50M+)'
	};
	const budgetDisplay = budgetLabels[client.budget]
		|| (typeof client.budget === 'number'
			? `$${client.budget.toLocaleString()}`
			: (typeof client.budget === 'string' && client.budget !== '' && !isNaN(Number(client.budget))
				? `$${Number(client.budget).toLocaleString()}`
				: client.budget || 'Not specified'));

	// Grouped summary for header badge (e.g., "3 Grants, 1 Tax Benefit")
	const groupedSummary = matchCount === 0
		? '0 Matches'
		: groupedMatches.map(g => {
			const label = g.matches.length === 1 ? g.label.replace(/s$/, '') : g.label;
			return `${g.matches.length} ${label}`;
		}).join(', ');

	return (
		<MainLayout>
			<div className='container py-10'>
				{/* Navigation and Actions */}
				<div className='mb-6 flex justify-between items-center'>
					<Button variant='outline' className='bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm min-h-[44px]' asChild>
						<Link href='/clients'>
							<ArrowLeft className='h-4 w-4 mr-2' />
							Back to Clients
						</Link>
					</Button>
					<ExportPDFButton client={client} matches={matches} />
				</div>

				{/* Client Card — unified white surface with blue accent */}
				<div className='mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-blue-500 shadow-sm overflow-hidden'>
					{/* Client Header */}
					<div className='px-6 pt-5 pb-4'>
						<div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3'>
							<div>
								<h1 className='text-3xl font-bold tracking-tight mb-2'>{client.name}</h1>
								<div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground'>
									<div className='flex items-center gap-1'>
										<Building className='h-4 w-4' />
										<span className='font-medium text-neutral-800 dark:text-neutral-200'>{client.type}</span>
									</div>
									<span className='text-neutral-300 dark:text-neutral-600 select-none'>&middot;</span>
									<div className='flex items-center gap-1'>
										<MapPin className='h-4 w-4' />
										<span className='font-medium text-neutral-800 dark:text-neutral-200'>
											{[client.city, client.state_code].filter(Boolean).join(', ') || client.address}
										</span>
									</div>
									<span className='text-neutral-300 dark:text-neutral-600 select-none'>&middot;</span>
									<div className='flex items-center gap-1'>
										<DollarSign className='h-4 w-4' />
										<span className='font-medium text-neutral-800 dark:text-neutral-200'>{budgetDisplay}</span>
									</div>
								</div>
							</div>
							<span className='text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 sm:whitespace-nowrap'>
								{groupedSummary}
							</span>
						</div>
					</div>

					{/* Project needs section within the card */}
					<div className='border-t border-neutral-100 dark:border-neutral-800 px-6 py-4'>
						<div className='space-y-3'>
							{/* Description */}
							{client.description && (
								<div>
									<p className='text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed'>{client.description}</p>
								</div>
							)}

							{/* Project Needs with match counts — tinted semantic colors */}
							<div>
								<p className='text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center gap-2'>
									<Target className='h-3.5 w-3.5' />
									Project Needs
								</p>
								<div className='flex flex-wrap gap-1.5'>
									{needsWithCounts.map((item, index) => {
										const typeColor = getProjectTypeColor(item.need);
										return (
											<span
												key={index}
												className='text-xs font-medium px-2 py-0.5 rounded-md border border-l-2 text-neutral-700 border-neutral-200 dark:text-neutral-300 dark:border-neutral-700'
												style={{ backgroundColor: typeColor.bgColor, borderLeftColor: typeColor.color }}
											>
												{item.count > 0 ? `${item.need} (${item.count})` : item.need}
											</span>
										);
									})}
								</div>
								{(!client.project_needs || client.project_needs.length === 0) && (
									<p className='text-sm text-muted-foreground italic'>No project needs specified</p>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Funding Opportunities — grouped by type */}
				<div className='mb-6'>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<div className='flex items-center justify-between mb-4'>
							<h2 className='text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 flex items-center gap-2'>
								<span className='w-1 h-5 rounded-full bg-blue-500 dark:bg-blue-400' />
								Funding Opportunities
							</h2>
							<TabsList>
								<TabsTrigger value='matches' className='min-h-[44px] px-4'>
									Matches ({matchCount})
								</TabsTrigger>
								<TabsTrigger value='hidden' className='min-h-[44px] px-4 flex items-center gap-1.5'>
									<EyeOff className='h-3.5 w-3.5' aria-hidden='true' />
									Hidden ({hiddenCount})
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent value='matches'>
							{matchCount > 0 ? (
								<div className='space-y-8'>
									{groupedMatches.map((group, groupIndex) => (
										<section key={group.key} aria-labelledby={`group-${group.key}`}>
											{/* Group header */}
											<div className={`flex items-center gap-3 mb-4 ${groupIndex > 0 ? 'pt-6 border-t border-neutral-300 dark:border-neutral-700' : ''}`}>
												<span className='w-2.5 h-2.5 rounded-full flex-shrink-0' style={{ backgroundColor: getFundingGroupDotColor(group.key) }} />
												<h3 id={`group-${group.key}`} className='text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300'>
													{group.label}
												</h3>
												<span className='text-xs text-neutral-500 dark:text-neutral-400'>
													{group.description}
												</span>
												<div className='flex-1 h-px bg-neutral-200 dark:bg-neutral-800' />
												<Badge variant='secondary' className='text-xs'>
													{group.matches.length}
												</Badge>
											</div>

											{/* Cards grid */}
											<div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
												{group.matches.map((match) => (
													<div key={match.id} className='rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 flex flex-col'>
														{/* Top accent bar */}
														<div className='h-1.5 w-full bg-blue-500 dark:bg-blue-400' />
														{/* Match context strip */}
														<div className='flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700'>
															<span
																className='text-xs font-medium px-2 py-0.5 rounded-full'
																style={getMatchScoreBadgeStyles(match.score)}
															>
																{formatMatchScore(match.score)}
															</span>
															<HideMatchButton
																clientId={clientId}
																opportunityId={match.id}
																opportunityTitle={match.title}
																onHidden={handleMatchHidden}
															/>
														</div>
														{/* Card — border/radius nullified, internal accent bars hidden (outer wrapper provides them) */}
														<div className='[&>a>div]:border-0 [&>a>div]:rounded-none [&>a]:rounded-none [&_.h-1\.5.w-full.bg-blue-500]:hidden [&_.h-1\.5.w-full.dark\:bg-blue-400]:hidden flex-grow'>
															<OpportunityCard opportunity={match} />
														</div>
														{/* Bottom accent bar */}
														<div className='h-1.5 w-full bg-blue-500 dark:bg-blue-400' />
													</div>
												))}
											</div>
										</section>
									))}
								</div>
							) : (
								<Alert>
									<AlertTriangle className='h-4 w-4' />
									<AlertTitle>No Matches Found</AlertTitle>
									<AlertDescription>
										No funding opportunities currently match this client&apos;s criteria. Try adjusting the client&apos;s project needs or location requirements.
									</AlertDescription>
								</Alert>
							)}
						</TabsContent>

						<TabsContent value='hidden'>
							<HiddenMatchesPanel
								clientId={clientId}
								onRestore={handleMatchRestored}
							/>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</MainLayout>
	);
}

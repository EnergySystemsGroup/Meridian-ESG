'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Loader2, ArrowLeft, User, MapPin, Building, DollarSign, Target, EyeOff } from 'lucide-react';
import { ExportPDFButton } from '@/components/clients/ExportPDFButton';
import { HideMatchButton } from '@/components/clients/HideMatchButton';
import { HiddenMatchesPanel } from '@/components/clients/HiddenMatchesPanel';
import Link from 'next/link';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import { fetchClientMatches, formatMatchScore, getMatchScoreBgColor, generateClientTags, formatProjectNeeds } from '@/lib/utils/clientMatching';

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

	// Handler for when a match is hidden
	const handleMatchHidden = useCallback((opportunityId) => {
		setClientResult(prev => ({
			...prev,
			matches: prev.matches.filter(m => m.id !== opportunityId),
			matchCount: prev.matchCount - 1
		}));
		setHiddenCount(prev => prev + 1);
	}, []);

	// Handler for when a match is restored
	const handleMatchRestored = useCallback(() => {
		// Refetch matches to get the restored one
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
	const tags = generateClientTags(client, matches);

	// Budget labels for display
	const budgetLabels = {
		small: 'Small ($50K - $500K)',
		medium: 'Medium ($500K - $5M)',
		large: 'Large ($5M - $50M)',
		very_large: 'Very Large ($50M+)'
	};

	const budgetDisplay = budgetLabels[client.budget] || client.budget || 'Not specified';

	return (
		<MainLayout>
			<div className='container py-10'>
				{/* Navigation and Actions */}
				<div className='mb-6 flex justify-between items-center'>
					<Button variant='outline' asChild>
						<Link href='/clients'>
							<ArrowLeft className='h-4 w-4 mr-2' />
							Back to Clients
						</Link>
					</Button>
					<ExportPDFButton client={client} matches={matches} />
				</div>

				{/* Client Header */}
				<div className='mb-8'>
					<div className='flex items-start justify-between mb-4'>
						<div>
							<h1 className='text-3xl font-bold mb-2'>{client.name}</h1>
							<div className='flex items-center gap-4 text-sm text-muted-foreground'>
								<div className='flex items-center gap-1'>
									<Building className='h-4 w-4' />
									{client.type}
								</div>
								<div className='flex items-center gap-1'>
									<MapPin className='h-4 w-4' />
									{[client.city, client.state_code].filter(Boolean).join(', ') || client.address}
								</div>
								<div className='flex items-center gap-1'>
									<DollarSign className='h-4 w-4' />
									{budgetDisplay}
								</div>
							</div>
						</div>
						<Badge variant='outline' className='text-lg px-3 py-1'>
							{matchCount} {matchCount === 1 ? 'Match' : 'Matches'}
						</Badge>
					</div>

					{/* Client Details Card */}
					<Card>
						<CardHeader>
							<CardTitle className='flex items-center gap-2'>
								<User className='h-5 w-5' />
								Client Profile
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className='space-y-4'>
								{/* Description */}
								{client.description && (
									<div>
										<h4 className='font-medium mb-2'>About</h4>
										<p className='text-sm text-muted-foreground'>{client.description}</p>
									</div>
								)}

								{/* Project Needs */}
								<div>
									<h4 className='font-medium mb-2 flex items-center gap-2'>
										<Target className='h-4 w-4' />
										Project Needs
									</h4>
									<div className='flex flex-wrap gap-2'>
										{formatProjectNeeds(client.project_needs).map((need, index) => (
											<Badge
												key={index}
												variant='outline'
												className='px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
											>
												{need}
											</Badge>
										))}
									</div>
									{(!client.project_needs || client.project_needs.length === 0) && (
										<p className='text-sm text-muted-foreground italic'>No project needs specified</p>
									)}
								</div>

								{/* Match Breakdown */}
								<div>
									<h4 className='font-medium mb-2'>Match Breakdown</h4>
									<div className='flex flex-wrap gap-2'>
										{tags.map((tag, index) => (
											<Badge key={index} variant='secondary'>
												{tag}
											</Badge>
										))}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Matches Section */}
				<div className='mb-6'>
					<Tabs value={activeTab} onValueChange={setActiveTab}>
						<div className='flex items-center justify-between mb-4'>
							<h2 className='text-2xl font-bold'>Funding Opportunities</h2>
							<TabsList>
								<TabsTrigger value='matches'>
									Matches ({matchCount})
								</TabsTrigger>
								<TabsTrigger value='hidden' className='flex items-center gap-1'>
									<EyeOff className='h-3 w-3' />
									Hidden ({hiddenCount})
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent value='matches'>
							{matchCount > 0 ? (
								<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
									{matches.map((match) => (
										<div key={match.id} className='relative group'>
											<OpportunityCard
												opportunity={match}
												badgeOverride={
													<span
														className='text-xs px-2 py-1 rounded-full flex-shrink-0 ml-2 font-medium'
														style={getMatchScoreBgColor(match.score)}
													>
														{formatMatchScore(match.score)}
													</span>
												}
											/>
											<div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
												<HideMatchButton
													clientId={clientId}
													opportunityId={match.id}
													opportunityTitle={match.title}
													onHidden={handleMatchHidden}
												/>
											</div>
										</div>
									))}
								</div>
							) : (
								<Alert>
									<AlertTriangle className='h-4 w-4' />
									<AlertTitle>No Matches Found</AlertTitle>
									<AlertDescription>
										No funding opportunities currently match this client's criteria. Try adjusting the client's project needs or location requirements.
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
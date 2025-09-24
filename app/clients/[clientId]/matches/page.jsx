'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, ArrowLeft, User, MapPin, Building, DollarSign, Target } from 'lucide-react';
import Link from 'next/link';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import { fetchClientMatches, formatMatchScore, getMatchScoreBgColor, generateClientTags, formatProjectNeeds } from '@/lib/utils/clientMatching';

export default function ClientMatchesPage() {
	const params = useParams();
	const clientId = params.clientId;

	const [clientResult, setClientResult] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function loadClientMatches() {
			try {
				setLoading(true);
				const result = await fetchClientMatches(clientId);
				setClientResult(result);
			} catch (err) {
				console.error('Error loading client matches:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		if (clientId) {
			loadClientMatches();
		}
	}, [clientId]);

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
	const tags = generateClientTags(client);

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
				{/* Navigation */}
				<div className='mb-6'>
					<Button variant='outline' asChild>
						<Link href='/clients'>
							<ArrowLeft className='h-4 w-4 mr-2' />
							Back to Clients
						</Link>
					</Button>
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
									{client.location}
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
										{formatProjectNeeds(client.projectNeeds).map((need, index) => (
											<Badge
												key={index}
												variant='outline'
												className='px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
											>
												{need}
											</Badge>
										))}
									</div>
									{(!client.projectNeeds || client.projectNeeds.length === 0) && (
										<p className='text-sm text-muted-foreground italic'>No project needs specified</p>
									)}
								</div>

								{/* Tags */}
								<div>
									<h4 className='font-medium mb-2'>Tags</h4>
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
					<h2 className='text-2xl font-bold mb-4'>Funding Opportunities ({matchCount})</h2>

					{matchCount > 0 ? (
						<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
							{matches.map((match) => (
								<div key={match.id} className='relative'>
									{/* Match Score Badge */}
									<div className='absolute top-2 right-2 z-10'>
										<span className={`text-xs font-medium px-2 py-1 rounded ${getMatchScoreBgColor(match.score)}`}>
											{formatMatchScore(match.score)} match
										</span>
									</div>
									<OpportunityCard opportunity={match} />
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
				</div>
			</div>
		</MainLayout>
	);
}
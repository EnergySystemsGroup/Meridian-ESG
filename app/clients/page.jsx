'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import ClientProfileModal from '@/components/clients/ClientProfileModal';
import Link from 'next/link';
import { fetchClientMatches, generateClientTags, formatMatchScore, getMatchScoreBgColor } from '@/lib/utils/clientMatching';

export default function ClientsPage() {
	const [clientMatches, setClientMatches] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedClient, setSelectedClient] = useState(null);
	const [showProfileModal, setShowProfileModal] = useState(false);

	useEffect(() => {
		async function loadClientMatches() {
			try {
				setLoading(true);
				const matches = await fetchClientMatches();
				setClientMatches(matches);
			} catch (err) {
				console.error('Error loading client matches:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		loadClientMatches();
	}, []);

	const handleViewProfile = (client) => {
		setSelectedClient(client);
		setShowProfileModal(true);
	};

	const clients = Object.values(clientMatches)
		.sort((a, b) => b.matchCount - a.matchCount);

	return (
		<MainLayout>
			<div className='container py-10'>
				<Alert className='mb-6 bg-blue-50 border-blue-300'>
					<AlertTriangle className='h-4 w-4 text-blue-500' />
					<AlertTitle className='text-blue-600'>Live Client Matching</AlertTitle>
					<AlertDescription className='text-blue-700'>
						Showing real-time matches between clients and current funding opportunities in the database.
					</AlertDescription>
				</Alert>

				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Client Matching</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button>Add Client</Button>
					</div>
				</div>

				{loading && (
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='flex items-center gap-2'>
							<Loader2 className='h-6 w-6 animate-spin' />
							<span>Loading client matches...</span>
						</div>
					</div>
				)}

				{error && (
					<Alert variant='destructive' className='mb-6'>
						<AlertTriangle className='h-4 w-4' />
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				{!loading && !error && (
					<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
						{clients.map((clientResult) => (
							<ClientCard
								key={clientResult.client.id}
								clientResult={clientResult}
								onViewProfile={handleViewProfile}
							/>
						))}
					</div>
				)}

				{!loading && !error && clients.length === 0 && (
					<div className='text-center py-12'>
						<h2 className='text-2xl font-bold mb-2'>No Clients Found</h2>
						<p className='text-muted-foreground mb-6'>
							No client data available for matching.
						</p>
					</div>
				)}

				<ClientProfileModal
					client={selectedClient}
					isOpen={showProfileModal}
					onClose={() => setShowProfileModal(false)}
				/>
			</div>
		</MainLayout>
	);
}

function ClientCard({ clientResult, onViewProfile }) {
	const { client, matchCount, topMatches } = clientResult;
	const tags = generateClientTags(client);

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{client.name}</CardTitle>
					<span className='text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'>
						{client.type}
					</span>
				</div>
				<CardDescription>{client.location}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<div className='flex flex-wrap gap-1 mb-2'>
						{tags.map((tag, index) => (
							<span
								key={`${client.name}-${tag}-${index}`}
								className='text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
					</div>

					<div>
						<div className='text-sm font-medium mb-2'>
							Top Opportunity Matches ({matchCount})
						</div>
						{topMatches && topMatches.length > 0 ? (
							<ul className='space-y-2'>
								{topMatches.map((match, index) => (
									<li
										key={`${client.name}-${match.id}-${index}`}
										className='text-sm border-l-2 border-blue-500 pl-3 py-1'>
										<div className='font-medium line-clamp-1'>{match.title}</div>
										<div className='flex justify-between items-center'>
											<span className='text-xs text-gray-500 dark:text-gray-400 line-clamp-1'>
												{match.agency_name || 'Unknown Agency'}
											</span>
											<span className={`text-xs font-medium px-2 py-0.5 rounded ${getMatchScoreBgColor(match.score)}`}>
												{formatMatchScore(match.score)}
											</span>
										</div>
									</li>
								))}
							</ul>
						) : (
							<p className='text-sm text-gray-500 italic'>No matches found</p>
						)}
					</div>

					<div className='flex gap-2'>
						<Button
							className='w-full'
							size='sm'
							onClick={() => onViewProfile(client)}
						>
							View Profile
						</Button>
						<Button
							className='w-full'
							variant='outline'
							size='sm'
							asChild
						>
							<Link href={`/clients/${client.id}/matches`}>
								View Matches
							</Link>
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

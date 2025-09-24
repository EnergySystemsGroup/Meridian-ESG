'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import ClientProfileModal from '@/components/clients/ClientProfileModal';
import Link from 'next/link';
import { fetchClientMatches, generateClientTags, formatMatchScore, getMatchScoreBgColor } from '@/lib/utils/clientMatching';

export default function ClientsPage() {
	const [clientMatches, setClientMatches] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedClient, setSelectedClient] = useState(null);
	const [showProfileModal, setShowProfileModal] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

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
		.filter(clientResult => {
			if (!searchQuery) return true;

			const query = searchQuery.toLowerCase();
			const client = clientResult.client;
			const tags = generateClientTags(client);

			return (
				client.name.toLowerCase().includes(query) ||
				client.type.toLowerCase().includes(query) ||
				client.location.toLowerCase().includes(query) ||
				client.description.toLowerCase().includes(query) ||
				(client.DAC && client.DAC.toLowerCase().includes(query)) ||
				tags.some(tag => tag.toLowerCase().includes(query)) ||
				client.projectNeeds.some(need => need.toLowerCase().includes(query))
			);
		})
		.sort((a, b) => b.matchCount - a.matchCount);

	return (
		<MainLayout>
			<div className='container py-10'>

				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Client Matching</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button>Add Client</Button>
					</div>
				</div>

				<div className='mb-6'>
					<div className='relative max-w-md'>
						<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
						<Input
							type='text'
							placeholder='Search clients, locations, project needs...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='pl-10'
						/>
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

				{!loading && !error && clients.length > 0 && (
					<>
						{searchQuery && (
							<div className='mb-4 text-sm text-gray-600 dark:text-gray-400'>
								Found {clients.length} client{clients.length !== 1 ? 's' : ''} matching "{searchQuery}"
							</div>
						)}
						<div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-8'>
							{clients.map((clientResult) => (
								<ClientCard
									key={clientResult.client.id}
									clientResult={clientResult}
									onViewProfile={handleViewProfile}
								/>
							))}
						</div>
					</>
				)}

				{!loading && !error && clients.length === 0 && (
					<div className='text-center py-12'>
						<h2 className='text-2xl font-bold mb-2'>
							{searchQuery ? 'No Search Results' : 'No Clients Found'}
						</h2>
						<p className='text-muted-foreground mb-6'>
							{searchQuery
								? `No clients match your search for "${searchQuery}". Try different keywords or clear the search.`
								: 'No client data available for matching.'
							}
						</p>
						{searchQuery && (
							<Button
								variant='outline'
								onClick={() => setSearchQuery('')}
								className='mt-4'
							>
								Clear Search
							</Button>
						)}
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
		<Card className='flex flex-col h-full'>
			<CardHeader className='pb-4'>
				<CardTitle className='text-xl font-bold'>{client.name}</CardTitle>
				<CardDescription className='text-sm text-muted-foreground'>{client.location}</CardDescription>
			</CardHeader>
			<CardContent className='px-6 pb-6 flex flex-col flex-1'>
				<div className='flex-1 space-y-5'>
					<div className='flex flex-wrap gap-1 mb-3'>
						{tags.map((tag, index) => (
							<span
								key={`${client.name}-${tag}-${index}`}
								className='text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
					</div>

					<div className='border-t border-gray-100 dark:border-gray-800 pt-4'>
						<div className='text-sm font-medium mb-3'>
							Top Opportunity Matches ({matchCount})
						</div>
						{topMatches && topMatches.length > 0 ? (
							<ul className='space-y-2'>
								{topMatches
									.sort((a, b) => b.score - a.score) // Sort matches by score descending
									.map((match, index) => (
									<li
										key={`${client.name}-${match.id}-${index}`}
										className='text-sm border-l-2 border-blue-500 pl-3 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors duration-200 cursor-pointer rounded-r'>
										<div className='font-medium truncate pr-12'>{match.title}</div>
										<div className='flex justify-between items-center'>
											<span className='text-xs text-gray-500 dark:text-gray-400 truncate flex-1 pr-2'>
												{match.agency_name || 'Unknown Agency'}
											</span>
											<span className={`text-xs font-medium px-2 py-0.5 rounded transition-all duration-200 hover:scale-105 flex-shrink-0 ${getMatchScoreBgColor(match.score)}`}>
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
				</div>

				<div className='flex gap-2 mt-5'>
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
			</CardContent>
		</Card>
	);
}

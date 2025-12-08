'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Search, Plus, Filter, X, ChevronDown } from 'lucide-react';
import ClientProfileModal from '@/components/clients/ClientProfileModal';
import ClientForm from '@/components/clients/ClientForm';
import Link from 'next/link';
import { fetchClientMatches, generateClientTags, formatMatchScore, getMatchScoreBgColor } from '@/lib/utils/clientMatching';

const SORT_OPTIONS = [
	{ value: 'matchCount-desc', label: 'Match Count (High to Low)' },
	{ value: 'matchCount-asc', label: 'Match Count (Low to High)' },
	{ value: 'name-asc', label: 'Name (A-Z)' },
	{ value: 'name-desc', label: 'Name (Z-A)' },
	{ value: 'location', label: 'Location (State, City)' },
];

const ITEMS_PER_PAGE = 12;

function ClientsPageContent() {
	const searchParams = useSearchParams();
	const router = useRouter();

	const [clientMatches, setClientMatches] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedClient, setSelectedClient] = useState(null);
	const [showProfileModal, setShowProfileModal] = useState(false);
	const [showAddClientModal, setShowAddClientModal] = useState(false);
	const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

	// Initialize state from URL params
	const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
	const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'matchCount-desc');
	const [filterTypes, setFilterTypes] = useState(
		searchParams.get('types')?.split(',').filter(Boolean) || []
	);
	const [filterStates, setFilterStates] = useState(
		searchParams.get('states')?.split(',').filter(Boolean) || []
	);
	const [filterHasMatches, setFilterHasMatches] = useState(
		searchParams.get('hasMatches') || 'all'
	);
	const [filterDac, setFilterDac] = useState(
		searchParams.get('dac') || 'all'
	);

	// Update URL when filters change
	const updateURL = useCallback((updates) => {
		const params = new URLSearchParams(searchParams.toString());

		Object.entries(updates).forEach(([key, value]) => {
			if (value === '' || value === 'all' || (Array.isArray(value) && value.length === 0)) {
				params.delete(key);
			} else if (Array.isArray(value)) {
				params.set(key, value.join(','));
			} else {
				params.set(key, value);
			}
		});

		const newUrl = params.toString() ? `?${params.toString()}` : '/clients';
		router.push(newUrl, { scroll: false });
	}, [searchParams, router]);

	// Extract available filter options from data
	const availableFilters = useMemo(() => {
		const clients = Object.values(clientMatches);
		const types = [...new Set(clients.map(c => c.client.type).filter(Boolean))].sort();
		const states = [...new Set(clients.map(c => c.client.state_code).filter(Boolean))].sort();
		return { types, states };
	}, [clientMatches]);

	useEffect(() => {
		async function loadClientMatches() {
			try {
				setLoading(true);
				const matches = await fetchClientMatches();
				setClientMatches(matches || {});
			} catch (err) {
				console.error('Error loading client matches:', err);
				if (err.message.includes('404') || err.message.includes('not found')) {
					setClientMatches({});
					setError(null);
				} else {
					setError(err.message);
				}
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

	const handleClientCreated = async () => {
		setShowAddClientModal(false);
		try {
			setLoading(true);
			const matches = await fetchClientMatches();
			setClientMatches(matches);
		} catch (err) {
			console.error('Error reloading client matches:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	// Filter and sort logic
	const filteredAndSortedClients = useMemo(() => {
		let result = Object.values(clientMatches);

		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			result = result.filter(clientResult => {
				const client = clientResult.client;
				const tags = generateClientTags(client, clientResult.matches);
				return (
					client.name.toLowerCase().includes(query) ||
					client.type.toLowerCase().includes(query) ||
					(client.address && client.address.toLowerCase().includes(query)) ||
					(client.city && client.city.toLowerCase().includes(query)) ||
					(client.state_code && client.state_code.toLowerCase().includes(query)) ||
					(client.description && client.description.toLowerCase().includes(query)) ||
					(client.dac && 'dac'.includes(query)) ||
					tags.some(tag => tag.toLowerCase().includes(query)) ||
					(client.project_needs && client.project_needs.some(need => need.toLowerCase().includes(query)))
				);
			});
		}

		// Type filter
		if (filterTypes.length > 0) {
			result = result.filter(c => filterTypes.includes(c.client.type));
		}

		// State filter
		if (filterStates.length > 0) {
			result = result.filter(c => filterStates.includes(c.client.state_code));
		}

		// Has matches filter
		if (filterHasMatches === 'yes') {
			result = result.filter(c => c.matchCount > 0);
		} else if (filterHasMatches === 'no') {
			result = result.filter(c => c.matchCount === 0);
		}

		// DAC filter
		if (filterDac === 'yes') {
			result = result.filter(c => c.client.dac === true);
		} else if (filterDac === 'no') {
			result = result.filter(c => c.client.dac !== true);
		}

		// Sorting
		result.sort((a, b) => {
			switch (sortBy) {
				case 'matchCount-desc':
					return b.matchCount - a.matchCount;
				case 'matchCount-asc':
					return a.matchCount - b.matchCount;
				case 'name-asc':
					return a.client.name.localeCompare(b.client.name);
				case 'name-desc':
					return b.client.name.localeCompare(a.client.name);
				case 'location':
					const locA = `${a.client.state_code || ''}-${a.client.city || ''}`;
					const locB = `${b.client.state_code || ''}-${b.client.city || ''}`;
					return locA.localeCompare(locB);
				default:
					return b.matchCount - a.matchCount;
			}
		});

		return result;
	}, [clientMatches, searchQuery, filterTypes, filterStates, filterHasMatches, filterDac, sortBy]);

	// Paginated clients
	const displayedClients = filteredAndSortedClients.slice(0, displayCount);
	const hasMore = displayCount < filteredAndSortedClients.length;
	const totalCount = Object.values(clientMatches).length;

	// Active filter count
	const activeFilterCount =
		filterTypes.length +
		filterStates.length +
		(filterHasMatches !== 'all' ? 1 : 0) +
		(filterDac !== 'all' ? 1 : 0);

	const clearAllFilters = () => {
		setFilterTypes([]);
		setFilterStates([]);
		setFilterHasMatches('all');
		setFilterDac('all');
		setDisplayCount(ITEMS_PER_PAGE);
		updateURL({ types: [], states: [], hasMatches: 'all', dac: 'all' });
	};

	const removeFilter = (type, value) => {
		switch (type) {
			case 'type':
				const newTypes = filterTypes.filter(t => t !== value);
				setFilterTypes(newTypes);
				updateURL({ types: newTypes });
				break;
			case 'state':
				const newStates = filterStates.filter(s => s !== value);
				setFilterStates(newStates);
				updateURL({ states: newStates });
				break;
			case 'hasMatches':
				setFilterHasMatches('all');
				updateURL({ hasMatches: 'all' });
				break;
			case 'dac':
				setFilterDac('all');
				updateURL({ dac: 'all' });
				break;
		}
		setDisplayCount(ITEMS_PER_PAGE);
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				{/* Header */}
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Client Matching</h1>
					<div className='flex gap-2'>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant='outline' className='relative'>
									<Filter className='h-4 w-4 mr-2' />
									Filter
									{activeFilterCount > 0 && (
										<Badge
											variant='secondary'
											className='ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-blue-500 text-white'
										>
											{activeFilterCount}
										</Badge>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className='w-80' align='end'>
								<div className='space-y-4'>
									<h4 className='font-medium'>Filters</h4>

									{/* Client Type Filter */}
									<div className='space-y-2'>
										<label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
											Client Type
										</label>
										<div className='max-h-32 overflow-y-auto space-y-1'>
											{availableFilters.types.map(type => (
												<div key={type} className='flex items-center space-x-2'>
													<Checkbox
														id={`type-${type}`}
														checked={filterTypes.includes(type)}
														onCheckedChange={(checked) => {
															const newTypes = checked
																? [...filterTypes, type]
																: filterTypes.filter(t => t !== type);
															setFilterTypes(newTypes);
															setDisplayCount(ITEMS_PER_PAGE);
															updateURL({ types: newTypes });
														}}
													/>
													<label
														htmlFor={`type-${type}`}
														className='text-sm cursor-pointer'
													>
														{type}
													</label>
												</div>
											))}
										</div>
									</div>

									{/* State Filter */}
									<div className='space-y-2'>
										<label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
											State
										</label>
										<div className='max-h-32 overflow-y-auto space-y-1'>
											{availableFilters.states.map(state => (
												<div key={state} className='flex items-center space-x-2'>
													<Checkbox
														id={`state-${state}`}
														checked={filterStates.includes(state)}
														onCheckedChange={(checked) => {
															const newStates = checked
																? [...filterStates, state]
																: filterStates.filter(s => s !== state);
															setFilterStates(newStates);
															setDisplayCount(ITEMS_PER_PAGE);
															updateURL({ states: newStates });
														}}
													/>
													<label
														htmlFor={`state-${state}`}
														className='text-sm cursor-pointer'
													>
														{state}
													</label>
												</div>
											))}
										</div>
									</div>

									{/* Has Matches Filter */}
									<div className='space-y-2'>
										<label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
											Match Status
										</label>
										<Select
											value={filterHasMatches}
											onValueChange={(value) => {
												setFilterHasMatches(value);
												setDisplayCount(ITEMS_PER_PAGE);
												updateURL({ hasMatches: value });
											}}
										>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='all'>All Clients</SelectItem>
												<SelectItem value='yes'>Has Matches</SelectItem>
												<SelectItem value='no'>No Matches</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* DAC Filter */}
									<div className='space-y-2'>
										<label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
											DAC Status
										</label>
										<Select
											value={filterDac}
											onValueChange={(value) => {
												setFilterDac(value);
												setDisplayCount(ITEMS_PER_PAGE);
												updateURL({ dac: value });
											}}
										>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='all'>All Clients</SelectItem>
												<SelectItem value='yes'>DAC Only</SelectItem>
												<SelectItem value='no'>Non-DAC Only</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{activeFilterCount > 0 && (
										<Button
											variant='ghost'
											size='sm'
											onClick={clearAllFilters}
											className='w-full'
										>
											Clear All Filters
										</Button>
									)}
								</div>
							</PopoverContent>
						</Popover>
						<Button onClick={() => setShowAddClientModal(true)}>
							<Plus className='h-4 w-4 mr-2' />
							Add Client
						</Button>
					</div>
				</div>

				{/* Search and Sort Row */}
				<div className='flex flex-col sm:flex-row gap-4 mb-4'>
					<div className='relative flex-1 max-w-md'>
						<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
						<Input
							type='text'
							placeholder='Search clients, locations, project needs...'
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								setDisplayCount(ITEMS_PER_PAGE);
								updateURL({ q: e.target.value });
							}}
							className='pl-10'
						/>
					</div>
					<div className='flex items-center gap-2'>
						<span className='text-sm text-gray-500 whitespace-nowrap'>Sort by:</span>
						<Select
							value={sortBy}
							onValueChange={(value) => {
								setSortBy(value);
								updateURL({ sort: value });
							}}
						>
							<SelectTrigger className='w-[200px]'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SORT_OPTIONS.map(option => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Active Filters */}
				{activeFilterCount > 0 && (
					<div className='flex flex-wrap items-center gap-2 mb-4'>
						<span className='text-sm text-gray-500'>Active filters:</span>
						{filterTypes.map(type => (
							<Badge key={`type-${type}`} variant='secondary' className='gap-1'>
								{type}
								<X
									className='h-3 w-3 cursor-pointer'
									onClick={() => removeFilter('type', type)}
								/>
							</Badge>
						))}
						{filterStates.map(state => (
							<Badge key={`state-${state}`} variant='secondary' className='gap-1'>
								{state}
								<X
									className='h-3 w-3 cursor-pointer'
									onClick={() => removeFilter('state', state)}
								/>
							</Badge>
						))}
						{filterHasMatches !== 'all' && (
							<Badge variant='secondary' className='gap-1'>
								{filterHasMatches === 'yes' ? 'Has Matches' : 'No Matches'}
								<X
									className='h-3 w-3 cursor-pointer'
									onClick={() => removeFilter('hasMatches')}
								/>
							</Badge>
						)}
						{filterDac !== 'all' && (
							<Badge variant='secondary' className='gap-1'>
								{filterDac === 'yes' ? 'DAC' : 'Non-DAC'}
								<X
									className='h-3 w-3 cursor-pointer'
									onClick={() => removeFilter('dac')}
								/>
							</Badge>
						)}
						<Button
							variant='ghost'
							size='sm'
							onClick={clearAllFilters}
							className='text-gray-500 hover:text-gray-700'
						>
							Clear all
						</Button>
					</div>
				)}

				{/* Results Count */}
				{!loading && !error && (
					<div className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
						Showing {displayedClients.length} of {filteredAndSortedClients.length} clients
						{filteredAndSortedClients.length !== totalCount && (
							<span> (filtered from {totalCount} total)</span>
						)}
					</div>
				)}

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

				{!loading && !error && displayedClients.length > 0 && (
					<>
						<div className='grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-8'>
							{displayedClients.map((clientResult) => (
								<ClientCard
									key={clientResult.client.id}
									clientResult={clientResult}
									onViewProfile={handleViewProfile}
								/>
							))}
						</div>

						{/* Load More Button */}
						{hasMore && (
							<div className='flex justify-center mt-8'>
								<Button
									variant='outline'
									onClick={() => setDisplayCount(prev => prev + ITEMS_PER_PAGE)}
									className='px-8'
								>
									Load More ({filteredAndSortedClients.length - displayCount} remaining)
									<ChevronDown className='h-4 w-4 ml-2' />
								</Button>
							</div>
						)}
					</>
				)}

				{!loading && !error && filteredAndSortedClients.length === 0 && (
					<div className='text-center py-12'>
						<h2 className='text-2xl font-bold mb-2'>
							{searchQuery || activeFilterCount > 0 ? 'No Results Found' : 'No Clients Yet'}
						</h2>
						<p className='text-muted-foreground mb-6'>
							{searchQuery || activeFilterCount > 0
								? 'Try adjusting your search or filters to find what you\'re looking for.'
								: 'Get started by adding your first client. Click the "Add Client" button above.'
							}
						</p>
						{(searchQuery || activeFilterCount > 0) ? (
							<Button
								variant='outline'
								onClick={() => {
									setSearchQuery('');
									clearAllFilters();
									updateURL({ q: '' });
								}}
								className='mt-4'
							>
								Clear Search & Filters
							</Button>
						) : (
							<Button
								onClick={() => setShowAddClientModal(true)}
								className='mt-4'
							>
								<Plus className='h-4 w-4 mr-2' />
								Add Your First Client
							</Button>
						)}
					</div>
				)}

				<ClientProfileModal
					client={selectedClient}
					isOpen={showProfileModal}
					onClose={() => setShowProfileModal(false)}
				/>

				<Dialog open={showAddClientModal} onOpenChange={setShowAddClientModal}>
					<DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
						<DialogHeader>
							<DialogTitle>Add New Client</DialogTitle>
						</DialogHeader>
						<ClientForm
							onSuccess={handleClientCreated}
							onCancel={() => setShowAddClientModal(false)}
						/>
					</DialogContent>
				</Dialog>
			</div>
		</MainLayout>
	);
}

// Wrap in Suspense for useSearchParams
export default function ClientsPage() {
	return (
		<Suspense fallback={
			<MainLayout>
				<div className='container py-10'>
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='flex items-center gap-2'>
							<Loader2 className='h-6 w-6 animate-spin' />
							<span>Loading...</span>
						</div>
					</div>
				</div>
			</MainLayout>
		}>
			<ClientsPageContent />
		</Suspense>
	);
}

function ClientCard({ clientResult, onViewProfile }) {
	const { client, matchCount, topMatches, matches } = clientResult;
	const tags = generateClientTags(client, matches);

	// Format location from database fields
	const locationParts = [client.city, client.state_code].filter(Boolean);
	const location = locationParts.length > 0 ? locationParts.join(', ') : client.address;

	return (
		<Card className='flex flex-col h-full'>
			<CardHeader className='pb-4'>
				<CardTitle className='text-xl font-bold'>{client.name}</CardTitle>
				<CardDescription className='text-sm text-muted-foreground'>{location}</CardDescription>
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
								{topMatches.map((match, index) => (
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

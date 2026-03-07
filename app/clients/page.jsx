'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
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
import { AlertTriangle, Loader2, Search, Plus, Filter, X, ChevronDown, Users } from 'lucide-react';
import ClientProfileModal from '@/components/clients/ClientProfileModal';
import ClientForm from '@/components/clients/ClientForm';
import Link from 'next/link';
import { generateClientTags, formatMatchScore, getMatchScoreBadgeStyles } from '@/lib/utils/clientMatching';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';
import { useClientMatches } from '@/lib/hooks/queries/useClients';
import { useUsers } from '@/lib/hooks/queries/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useClientsFilterStore, ITEMS_PER_PAGE } from '@/lib/stores/clientsFilterStore';
import { queryKeys } from '@/lib/queries/queryKeys';

const SORT_OPTIONS = [
	{ value: 'matchCount-desc', label: 'Match Count (High to Low)' },
	{ value: 'matchCount-asc', label: 'Match Count (Low to High)' },
	{ value: 'name-asc', label: 'Name (A-Z)' },
	{ value: 'name-desc', label: 'Name (Z-A)' },
	{ value: 'location', label: 'Location (State, City)' },
];

function ClientsPageContent() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();

	// Zustand store for filter/sort state
	const {
		searchQuery, sortBy, filterTypes, filterStates,
		filterHasMatches, filterDac, filterUserId, displayCount,
		setSearchQuery, setSortBy, setFilterTypes, setFilterStates,
		setFilterHasMatches, setFilterDac, setFilterUserId, setDisplayCount, loadMore,
	} = useClientsFilterStore();

	// Resolve the user_id param to send to the API
	// null (default) = don't send param → API defaults to current user
	// 'all' = send user_id=all → no filtering
	// uuid = send user_id=<uuid> → specific user
	const apiUserId = filterUserId === null ? undefined : filterUserId;

	// TanStack Query for data fetching
	const { data: clientMatches = {}, isLoading: loading, error: queryError } = useClientMatches(undefined, {
		userId: apiUserId,
		select: (data) => data?.results || {},
	});
	const error = queryError?.message || null;

	// Fetch workspace users for the filter dropdown
	const { data: usersData } = useUsers();
	const allUsers = usersData?.users || [];

	// Smart fallback: if "My Clients" returns empty, switch to "All Clients"
	const hasAutoFallenBack = useRef(false);
	useEffect(() => {
		if (!loading && filterUserId === null && !hasAutoFallenBack.current && Object.keys(clientMatches).length === 0) {
			hasAutoFallenBack.current = true;
			setFilterUserId('all');
		}
	}, [loading, filterUserId, clientMatches, setFilterUserId]);

	// UI-only local state
	const [selectedClient, setSelectedClient] = useState(null);
	const [showProfileModal, setShowProfileModal] = useState(false);
	const [showAddClientModal, setShowAddClientModal] = useState(false);

	// Initialize store from URL params on mount
	const initializedFromUrl = useRef(false);
	useEffect(() => {
		if (initializedFromUrl.current) return;
		initializedFromUrl.current = true;

		const q = searchParams.get('q');
		const sort = searchParams.get('sort');
		const types = searchParams.get('types')?.split(',').filter(Boolean);
		const states = searchParams.get('states')?.split(',').filter(Boolean);
		const hasMatches = searchParams.get('hasMatches');
		const dac = searchParams.get('dac');
		const userId = searchParams.get('userId');

		if (q) setSearchQuery(q);
		if (sort) setSortBy(sort);
		if (types?.length) setFilterTypes(types);
		if (states?.length) setFilterStates(states);
		if (hasMatches) setFilterHasMatches(hasMatches);
		if (dac) setFilterDac(dac);
		if (userId) setFilterUserId(userId);
	}, [searchParams, setSearchQuery, setSortBy, setFilterTypes, setFilterStates, setFilterHasMatches, setFilterDac, setFilterUserId]);

	// Update URL when filters change
	const updateURL = useCallback((updates) => {
		const params = new URLSearchParams(searchParams.toString());

		Object.entries(updates).forEach(([key, value]) => {
			// userId uses 'all' as a meaningful value (not default), so don't delete it
			const isDefault = key === 'userId'
				? (value === '' || value === null || value === undefined)
				: (value === '' || value === 'all' || (Array.isArray(value) && value.length === 0));
			if (isDefault) {
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

	const invalidateMatches = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: queryKeys.clientMatching.all });
	}, [queryClient]);

	const handleClientUpdated = useCallback((updatedClient) => {
		if (updatedClient) {
			setSelectedClient(updatedClient);
		}
		invalidateMatches();
	}, [invalidateMatches]);

	const handleViewProfile = (client) => {
		setSelectedClient(client);
		setShowProfileModal(true);
	};

	const handleClientCreated = () => {
		setShowAddClientModal(false);
		invalidateMatches();
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

	// Active filter count (user filter counted separately since it has its own UI)
	const activeFilterCount =
		filterTypes.length +
		filterStates.length +
		(filterHasMatches !== 'all' ? 1 : 0) +
		(filterDac !== 'all' ? 1 : 0);

	// Resolve user filter display label
	const userFilterLabel = useMemo(() => {
		if (filterUserId === null) return 'My Clients';
		if (filterUserId === 'all') return 'All Clients';
		const found = allUsers.find(u => u.id === filterUserId);
		return found?.display_name || 'Unknown User';
	}, [filterUserId, allUsers]);

	const clearAllFilters = () => {
		setFilterTypes([]);
		setFilterStates([]);
		setFilterHasMatches('all');
		setFilterDac('all');
		setDisplayCount(ITEMS_PER_PAGE);
		updateURL({ types: [], states: [], hasMatches: 'all', dac: 'all' });
		// Note: user filter is not cleared by "Clear All Filters" — it's a separate scope control
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
					<div>
						<h1 className='text-2xl font-semibold tracking-tight text-foreground'>Client Matching</h1>
						{!loading && !error && (
							<p className='text-sm text-muted-foreground mt-1'>
								{totalCount} client{totalCount !== 1 ? 's' : ''} &middot; {filteredAndSortedClients.filter(c => c.matchCount > 0).length} with matches
							</p>
						)}
					</div>
					<div className='flex gap-2'>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant='outline' className='relative bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm' aria-label='Filter clients'>
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
							<PopoverContent className='w-[340px] p-5' align='end'>
								<div className='space-y-4'>
									<div className='flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800'>
										<span className='text-xs font-semibold uppercase tracking-wider text-neutral-500'>Filters</span>
										{activeFilterCount > 0 && (
											<Button variant='ghost' size='sm' onClick={clearAllFilters} className='h-6 text-xs text-muted-foreground hover:text-foreground'>
												Clear all
											</Button>
										)}
									</div>

									{/* Client Type Filter */}
									<div className='space-y-2'>
										<label className='text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400'>
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

									<div className='h-px bg-neutral-200 dark:bg-neutral-700' />

									{/* State Filter */}
									<div className='space-y-2'>
										<label className='text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400'>
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

									<div className='h-px bg-neutral-200 dark:bg-neutral-700' />

									{/* Has Matches Filter */}
									<div className='space-y-2'>
										<label className='text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400'>
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

									<div className='h-px bg-neutral-200 dark:bg-neutral-700' />

									{/* DAC Filter */}
									<div className='space-y-2'>
										<label className='text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400'>
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

								</div>
							</PopoverContent>
						</Popover>
						<Select
							value={filterUserId === null ? '__me__' : filterUserId}
							onValueChange={(value) => {
								const newUserId = value === '__me__' ? null : value;
								setFilterUserId(newUserId);
								setDisplayCount(ITEMS_PER_PAGE);
								updateURL({ userId: newUserId === null ? '' : newUserId });
							}}
						>
							<SelectTrigger className='w-[160px] bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm' aria-label='Filter by team member'>
								<Users className='h-4 w-4 mr-2 flex-shrink-0' />
								<SelectValue>{userFilterLabel}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='__me__'>My Clients</SelectItem>
								<SelectItem value='all'>All Clients</SelectItem>
								{allUsers
									.filter(u => u.id !== user?.id)
									.map(u => (
										<SelectItem key={u.id} value={u.id}>
											{u.display_name}
										</SelectItem>
									))
								}
							</SelectContent>
						</Select>
						<Button onClick={() => setShowAddClientModal(true)}>
							<Plus className='h-4 w-4 mr-2' />
							Add Client
						</Button>
					</div>
				</div>

				{/* Search and Sort Row */}
				<div className='flex flex-col sm:flex-row gap-4 mb-4'>
					<div className='relative flex-1 max-w-md'>
						<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 h-4 w-4' />
						<Input
							type='text'
							placeholder='Search clients, locations, project needs...'
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
								setDisplayCount(ITEMS_PER_PAGE);
								updateURL({ q: e.target.value });
							}}
							className='pl-10 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm focus-visible:shadow-md transition-shadow'
							aria-label='Search clients by name, location, or project needs'
						/>
					</div>
					<div className='flex items-center gap-2'>
						<span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>Sort by:</span>
						<Select
							value={sortBy}
							onValueChange={(value) => {
								setSortBy(value);
								updateURL({ sort: value });
							}}
						>
							<SelectTrigger className='w-[200px] bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm' aria-label='Sort clients'>
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
						<span className='text-xs text-muted-foreground'>Active filters:</span>
						{filterTypes.map(type => (
							<Badge key={`type-${type}`} variant='outline' className='gap-1 pr-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'>
								{type}
								<button
									onClick={() => removeFilter('type', type)}
									className='ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									aria-label={`Remove ${type} filter`}
								>
									<X className='h-3 w-3' />
								</button>
							</Badge>
						))}
						{filterStates.map(state => (
							<Badge key={`state-${state}`} variant='outline' className='gap-1 pr-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'>
								{state}
								<button
									onClick={() => removeFilter('state', state)}
									className='ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									aria-label={`Remove ${state} filter`}
								>
									<X className='h-3 w-3' />
								</button>
							</Badge>
						))}
						{filterHasMatches !== 'all' && (
							<Badge variant='outline' className='gap-1 pr-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'>
								{filterHasMatches === 'yes' ? 'Has Matches' : 'No Matches'}
								<button
									onClick={() => removeFilter('hasMatches')}
									className='ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									aria-label='Remove match status filter'
								>
									<X className='h-3 w-3' />
								</button>
							</Badge>
						)}
						{filterDac !== 'all' && (
							<Badge variant='outline' className='gap-1 pr-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'>
								{filterDac === 'yes' ? 'DAC' : 'Non-DAC'}
								<button
									onClick={() => removeFilter('dac')}
									className='ml-1 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									aria-label='Remove DAC filter'
								>
									<X className='h-3 w-3' />
								</button>
							</Badge>
						)}
						<Button
							variant='ghost'
							size='sm'
							onClick={clearAllFilters}
							className='text-muted-foreground hover:text-foreground'
						>
							Clear all
						</Button>
					</div>
				)}

				{/* Results Count */}
				{!loading && !error && (
					<div className='text-xs text-muted-foreground mb-4'>
						Showing {displayedClients.length} of {filteredAndSortedClients.length} clients
						{filteredAndSortedClients.length !== totalCount && (
							<span className='text-neutral-400 dark:text-neutral-500'> (filtered from {totalCount} total)</span>
						)}
						{filterUserId !== 'all' && (
							<span className='text-neutral-400 dark:text-neutral-500'> &middot; {userFilterLabel}</span>
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
						<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
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
									onClick={loadMore}
									className='px-8 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600 shadow-sm'
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
						<Users className='h-10 w-10 text-blue-200 dark:text-blue-800 mb-4 mx-auto' />
						<h2 className='text-lg font-semibold text-foreground mb-2'>
							{searchQuery || activeFilterCount > 0 ? 'No Results Found' : 'No Clients Yet'}
						</h2>
						<p className='text-sm text-muted-foreground mb-6'>
							{searchQuery || activeFilterCount > 0
								? 'Try adjusting your search or filters to find what you\'re looking for.'
								: 'Add your first client to start discovering funding matches.'
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
					onClientUpdate={handleClientUpdated}
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

	// Find the most recent new match within 7 days
	const newestNewMatch = useMemo(() => {
		if (!matches || matches.length === 0) return null;
		const now = new Date();
		const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
		let newest = null;
		for (const m of matches) {
			if (m.is_new && m.first_matched_at) {
				const matchDate = new Date(m.first_matched_at);
				if (now - matchDate <= sevenDaysMs) {
					if (!newest || matchDate > new Date(newest.first_matched_at)) {
						newest = m;
					}
				}
			}
		}
		return newest;
	}, [matches]);

	const newMatchLabel = useMemo(() => {
		if (!newestNewMatch) return null;
		const today = new Date();
		const matchDate = new Date(newestNewMatch.first_matched_at);
		today.setHours(0, 0, 0, 0);
		matchDate.setHours(0, 0, 0, 0);
		const daysAgo = Math.round((today - matchDate) / (1000 * 60 * 60 * 24));
		if (daysAgo === 0) return 'New Match · Today';
		if (daysAgo === 1) return 'New Match · Yesterday';
		return `New Match · ${daysAgo}d ago`;
	}, [newestNewMatch]);

	return (
		<Card className='overflow-hidden flex flex-col h-full hover:shadow-lg hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 ease-out'>
			{/* Brand accent bar */}
			<div className='h-1.5 w-full bg-blue-500 dark:bg-blue-400' />
			<CardHeader className='pb-4'>
				<div className='flex items-start justify-between gap-2'>
					<div>
						<CardTitle className='text-base font-semibold leading-tight'>{client.name}</CardTitle>
						<CardDescription className='text-sm text-muted-foreground'>{location}</CardDescription>
					</div>
					{newMatchLabel && (
						<span className='flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap flex-shrink-0'>
							<span className='w-2 h-2 rounded-full bg-blue-500 motion-safe:animate-pulse' />
							{newMatchLabel}
						</span>
					)}
				</div>
			</CardHeader>
			<CardContent className='px-6 pb-6 flex flex-col flex-1'>
				<div className='flex-1 space-y-5'>
					<div className='flex flex-wrap gap-1.5'>
						{tags.map((tag, index) => {
							const projectTypeName = tag.replace(/\s*\(\d+\)$/, '');
							const typeColor = getProjectTypeColor(projectTypeName);
							return (
								<span
									key={`${client.name}-${tag}-${index}`}
									className='text-[11px] font-medium px-2 py-0.5 rounded-md border border-l-2 text-neutral-700 border-neutral-200 dark:text-neutral-300 dark:border-neutral-700'
									style={{ backgroundColor: typeColor.bgColor, borderLeftColor: typeColor.color }}>
									{tag}
								</span>
							);
						})}
					</div>

					<div className='border-t border-neutral-100 dark:border-neutral-800 pt-3'>
						<div className='flex items-center justify-between mb-3'>
							<span className='text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500'>Top Matches</span>
							<span className='text-sm font-bold tabular-nums text-neutral-700 dark:text-neutral-300'>{matchCount}</span>
						</div>
						{topMatches && topMatches.length > 0 ? (
							<ul className='space-y-2'>
								{topMatches.map((match, index) => (
									<li
										key={`${client.name}-${match.id}-${index}`}
										className='text-sm border-l-2 border-blue-500 pl-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors duration-200 cursor-pointer rounded-r'>
										<div className='font-medium truncate pr-12'>
											{match.is_new && (
												<span className='inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 mr-1.5'>
													<span className='w-1.5 h-1.5 rounded-full bg-blue-500' />
													New
												</span>
											)}
											{match.title}
										</div>
										<div className='flex justify-between items-center'>
											<span className='text-[11px] text-neutral-400 dark:text-neutral-500 truncate flex-1 pr-2'>
												{match.agency_name || 'Unknown Agency'}
											</span>
											<span
												className='text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0'
												style={getMatchScoreBadgeStyles(match.score)}>
												{formatMatchScore(match.score)}
											</span>
										</div>
									</li>
								))}
							</ul>
						) : (
							<p className='text-sm text-neutral-500 italic'>No matches found</p>
						)}
					</div>
				</div>

				<div className='flex gap-2 mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-4'>
					<Button
						className='w-full'
						size='sm'
						asChild
					>
						<Link href={`/clients/${client.id}/matches`}>
							View Matches
						</Link>
					</Button>
					<Button
						className='w-full'
						variant='ghost'
						size='sm'
						onClick={() => onViewProfile(client)}
					>
						View Profile
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

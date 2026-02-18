'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

// --- Helpers ---

function formatDate(dateStr) {
	if (!dateStr) return '—';
	return new Date(dateStr).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function formatAward(min, max) {
	const fmt = (n) => {
		if (n == null) return null;
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n}`;
	};
	const fMin = fmt(min);
	const fMax = fmt(max);
	if (fMin && fMax) return `${fMin} – ${fMax}`;
	if (fMax) return `Up to ${fMax}`;
	if (fMin) return `From ${fMin}`;
	return '—';
}

function ScoreBadge({ score }) {
	if (score == null) return <span className="text-muted-foreground">—</span>;
	const rounded = score.toFixed(1);
	if (score >= 7) return <Badge className="bg-green-600 hover:bg-green-700 text-white">{rounded}</Badge>;
	if (score >= 4) return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">{rounded}</Badge>;
	return <Badge variant="destructive">{rounded}</Badge>;
}

function StatusBadge({ status }) {
	if (status === 'pending_review') return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Pending</Badge>;
	if (status === 'promoted') return <Badge className="bg-green-600 hover:bg-green-700 text-white">Promoted</Badge>;
	if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
	return <Badge variant="outline">{status || 'Unknown'}</Badge>;
}

// --- Main Component ---

export default function AdminReviewPage() {
	// Data state
	const [data, setData] = useState([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(true);

	// Filter state
	const [statusFilter, setStatusFilter] = useState('pending_review');
	const [searchText, setSearchText] = useState('');
	const [stateFilter, setStateFilter] = useState('');
	const [minScoreFilter, setMinScoreFilter] = useState('');
	const [sortBy, setSortBy] = useState('created_at');
	const [sortDirection, setSortDirection] = useState('desc');
	const [page, setPage] = useState(1);
	const pageSize = 50;

	// Selection state
	const [selectedIds, setSelectedIds] = useState(new Set());

	// Dialog state
	const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
	const [rejectNotes, setRejectNotes] = useState('');

	// Notification state
	const [notifications, setNotifications] = useState([]);

	const addNotification = (message, type = 'info') => {
		const id = Date.now();
		setNotifications(prev => [...prev, { id, message, type }]);
		setTimeout(() => {
			setNotifications(prev => prev.filter(n => n.id !== id));
		}, 5000);
	};

	// --- Data Fetching ---

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				status: statusFilter,
				page: String(page),
				page_size: String(pageSize),
				sort_by: sortBy,
				sort_direction: sortDirection,
			});
			if (searchText) params.set('search', searchText);
			if (stateFilter) params.set('state', stateFilter);
			if (minScoreFilter) params.set('min_score', minScoreFilter);

			const res = await fetch(`/api/admin/review?${params}`);
			if (!res.ok) throw new Error('Failed to fetch review data');
			const json = await res.json();

			setData(json.data || []);
			setTotalCount(json.total_count || 0);
		} catch (err) {
			console.error('Error fetching review data:', err);
			addNotification(`Error loading data: ${err.message}`, 'error');
		} finally {
			setLoading(false);
		}
	}, [statusFilter, searchText, stateFilter, minScoreFilter, sortBy, sortDirection, page]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// Reset page when filters change
	useEffect(() => {
		setPage(1);
		setSelectedIds(new Set());
	}, [statusFilter, searchText, stateFilter, minScoreFilter, sortBy, sortDirection]);

	// --- Debounced search ---
	const [searchInput, setSearchInput] = useState('');
	useEffect(() => {
		const timer = setTimeout(() => setSearchText(searchInput), 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	// --- Selection ---

	const toggleSelect = (id) => {
		setSelectedIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (selectedIds.size === data.length) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(data.map(d => d.id)));
		}
	};

	const clearSelection = () => setSelectedIds(new Set());

	// --- Actions ---

	const handleApprove = async (ids) => {
		try {
			const res = await fetch('/api/admin/review/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: [...ids], reviewed_by: 'admin' }),
			});
			if (!res.ok) throw new Error('Approve request failed');
			const json = await res.json();
			addNotification(`Approved ${json.updated_count} record(s)`, 'success');
			setSelectedIds(new Set());
			fetchData();
		} catch (err) {
			addNotification(`Error approving: ${err.message}`, 'error');
		}
	};

	const handleReject = async () => {
		try {
			const ids = [...selectedIds];
			const res = await fetch('/api/admin/review/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ids,
					reviewed_by: 'admin',
					review_notes: rejectNotes || undefined,
				}),
			});
			if (!res.ok) throw new Error('Reject request failed');
			const json = await res.json();
			addNotification(`Rejected ${json.updated_count} record(s)`, 'success');
			setSelectedIds(new Set());
			setRejectDialogOpen(false);
			setRejectNotes('');
			fetchData();
		} catch (err) {
			addNotification(`Error rejecting: ${err.message}`, 'error');
		}
	};

	const handleQuickApprove = (id) => handleApprove([id]);

	const handleQuickReject = (id) => {
		setSelectedIds(new Set([id]));
		setRejectDialogOpen(true);
	};

	// --- Column Sort ---

	const handleSort = (column) => {
		if (sortBy === column) {
			setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
		} else {
			setSortBy(column);
			setSortDirection('desc');
		}
	};

	const SortIndicator = ({ column }) => {
		if (sortBy !== column) return null;
		return <span className="ml-1">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>;
	};

	// --- Pagination ---

	const totalPages = Math.ceil(totalCount / pageSize) || 1;

	// --- Counts for header ---

	const pendingCount = statusFilter === 'pending_review' ? totalCount : null;

	return (
		<div className="p-6 max-w-[1400px] mx-auto">
			{/* Notifications */}
			<div className="fixed top-4 right-4 z-50 space-y-2">
				{notifications.map(n => (
					<div
						key={n.id}
						className={`px-4 py-2 rounded shadow-lg text-white text-sm ${
							n.type === 'error' ? 'bg-red-500' :
							n.type === 'success' ? 'bg-green-500' :
							'bg-blue-500'
						}`}
					>
						{n.message}
					</div>
				))}
			</div>

			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-2xl font-bold">Opportunity Review Queue</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Review and approve manually discovered funding opportunities
					</p>
				</div>
				{totalCount > 0 && (
					<Badge variant="outline" className="text-base px-3 py-1">
						{totalCount} record{totalCount !== 1 ? 's' : ''}
					</Badge>
				)}
			</div>

			{/* Filter Bar */}
			<div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4 space-y-3">
				<div className="flex flex-wrap gap-3 items-end">
					{/* Search */}
					<div className="flex-1 min-w-[200px]">
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
						<Input
							placeholder="Search title or agency..."
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
						/>
					</div>

					{/* Status */}
					<div className="w-[160px]">
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="pending_review">Pending</SelectItem>
								<SelectItem value="rejected">Rejected</SelectItem>
								<SelectItem value="promoted">Promoted</SelectItem>
								<SelectItem value="all">All</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* State */}
					<div className="w-[100px]">
						<label className="text-xs font-medium text-muted-foreground mb-1 block">State</label>
						<Input
							placeholder="e.g. OR"
							value={stateFilter}
							onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
							maxLength={2}
						/>
					</div>

					{/* Min Score */}
					<div className="w-[100px]">
						<label className="text-xs font-medium text-muted-foreground mb-1 block">Min Score</label>
						<Input
							type="number"
							placeholder="0"
							min="0"
							max="10"
							step="0.5"
							value={minScoreFilter}
							onChange={(e) => setMinScoreFilter(e.target.value)}
						/>
					</div>

					{/* Refresh */}
					<Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
						Refresh
					</Button>
				</div>
			</div>

			{/* Bulk Action Bar */}
			{selectedIds.size > 0 && (
				<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 flex items-center gap-3 sticky top-0 z-40">
					<span className="text-sm font-medium">
						{selectedIds.size} selected
					</span>
					<Button variant="outline" size="sm" onClick={clearSelection}>
						Clear
					</Button>
					<div className="flex-1" />
					{statusFilter === 'pending_review' && (
						<>
							<Button
								size="sm"
								className="bg-green-600 hover:bg-green-700 text-white"
								onClick={() => handleApprove([...selectedIds])}
							>
								Approve Selected
							</Button>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => setRejectDialogOpen(true)}
							>
								Reject Selected
							</Button>
						</>
					)}
				</div>
			)}

			{/* Table */}
			{loading ? (
				<div className="space-y-3">
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : data.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					No records found matching your filters.
				</div>
			) : (
				<div className="border rounded-lg">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-10">
									<Checkbox
										checked={data.length > 0 && selectedIds.size === data.length}
										onCheckedChange={toggleSelectAll}
									/>
								</TableHead>
								<TableHead
									className="cursor-pointer select-none"
									onClick={() => handleSort('title')}
								>
									Title <SortIndicator column="title" />
								</TableHead>
								<TableHead>Source</TableHead>
								<TableHead>State</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Award Range</TableHead>
								<TableHead
									className="cursor-pointer select-none"
									onClick={() => handleSort('relevance_score')}
								>
									Score <SortIndicator column="relevance_score" />
								</TableHead>
								<TableHead>Status</TableHead>
								<TableHead
									className="cursor-pointer select-none"
									onClick={() => handleSort('created_at')}
								>
									Created <SortIndicator column="created_at" />
								</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((opp) => (
								<TableRow key={opp.id}>
									<TableCell>
										<Checkbox
											checked={selectedIds.has(opp.id)}
											onCheckedChange={() => toggleSelect(opp.id)}
										/>
									</TableCell>
									<TableCell className="max-w-[300px]">
										<Link
											href={`/funding/opportunities/${opp.id}`}
											className="text-blue-600 hover:underline font-medium line-clamp-2"
										>
											{opp.title}
										</Link>
										{opp.agency_name && (
											<div className="text-xs text-muted-foreground mt-0.5 truncate">
												{opp.agency_name}
											</div>
										)}
									</TableCell>
									<TableCell className="text-sm">
										{opp.source_display_name ? (
											<div>
												<div className="truncate max-w-[150px]">{opp.source_display_name}</div>
												{opp.source_type_display && (
													<div className="text-xs text-muted-foreground">{opp.source_type_display}</div>
												)}
											</div>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										{opp.is_national ? (
											<Badge variant="outline" className="text-xs">National</Badge>
										) : opp.coverage_state_codes?.length > 0 ? (
											<span className="text-sm">{opp.coverage_state_codes.join(', ')}</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell className="text-sm">
										{opp.funding_type || '—'}
									</TableCell>
									<TableCell className="text-sm whitespace-nowrap">
										{formatAward(opp.minimum_award, opp.maximum_award)}
									</TableCell>
									<TableCell>
										<ScoreBadge score={opp.relevance_score} />
									</TableCell>
									<TableCell>
										<StatusBadge status={opp.promotion_status} />
									</TableCell>
									<TableCell className="text-sm whitespace-nowrap">
										{formatDate(opp.created_at)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex gap-1 justify-end">
											{opp.promotion_status === 'pending_review' && (
												<>
													<Button
														size="sm"
														variant="outline"
														className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
														onClick={() => handleQuickApprove(opp.id)}
													>
														Approve
													</Button>
													<Button
														size="sm"
														variant="outline"
														className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
														onClick={() => handleQuickReject(opp.id)}
													>
														Reject
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-between mt-4">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => setPage(p => p - 1)}
					>
						Previous
					</Button>
					<span className="text-sm text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => setPage(p => p + 1)}
					>
						Next
					</Button>
				</div>
			)}

			{/* Reject Dialog */}
			<Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject {selectedIds.size} Record{selectedIds.size !== 1 ? 's' : ''}</DialogTitle>
						<DialogDescription>
							Rejected records will be hidden from end users. Add an optional note explaining the reason.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="Rejection reason (optional)..."
						value={rejectNotes}
						onChange={(e) => setRejectNotes(e.target.value)}
						rows={3}
					/>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setRejectDialogOpen(false);
								setRejectNotes('');
							}}
						>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleReject}>
							Reject
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

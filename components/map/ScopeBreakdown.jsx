'use client';

import { useState, useEffect } from 'react';
import { Globe, Building2, MapPin, Zap, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ScopeBreakdown - Interactive scope filter with counts
 * Shows opportunity counts by scope type and allows toggling scopes on/off
 */
export default function ScopeBreakdown({
	stateCode,
	stateName,
	filters = {},
	onScopeChange,
	onBreakdownLoaded,
	selectedScopes = ['national', 'state_wide', 'county', 'utility'],
}) {
	const [breakdown, setBreakdown] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchBreakdown() {
			try {
				setLoading(true);
				const params = new URLSearchParams();

				if (filters.status && filters.status !== 'all') {
					params.append('status', filters.status);
				}
				if (filters.projectTypes?.length > 0) {
					params.append('projectTypes', filters.projectTypes.join(','));
				}

				// Use different endpoint for nationwide vs state-specific
				const endpoint = stateCode
					? `/api/map/scope-breakdown/${stateCode}?${params}`
					: `/api/map/scope-breakdown/US?${params}`;

				const response = await fetch(endpoint);
				const result = await response.json();

				if (result.success) {
					setBreakdown(result.data);
					onBreakdownLoaded?.(result.data);
				}
			} catch (error) {
				console.error('Error fetching scope breakdown:', error);
			} finally {
				setLoading(false);
			}
		}

		fetchBreakdown();
	}, [stateCode, filters.status, filters.projectTypes]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-6">
				<Loader2 className="h-6 w-6 animate-spin text-blue-500" />
			</div>
		);
	}

	if (!breakdown) return null;

	const scopes = [
		{
			key: 'national',
			label: 'National',
			count: breakdown.national || 0,
			icon: Globe,
			color: 'text-blue-600',
			bgColor: 'bg-blue-50 dark:bg-blue-950',
			borderColor: 'border-blue-500',
			description: 'Available nationwide',
		},
		{
			key: 'state_wide',
			label: 'State-wide',
			count: breakdown.state_wide || 0,
			icon: Building2,
			color: 'text-green-600',
			bgColor: 'bg-green-50 dark:bg-green-950',
			borderColor: 'border-green-500',
			description: stateCode ? `Across all of ${stateName}` : 'State-level programs',
		},
		{
			key: 'county',
			label: 'County',
			count: breakdown.county || 0,
			icon: MapPin,
			color: 'text-orange-600',
			bgColor: 'bg-orange-50 dark:bg-orange-950',
			borderColor: 'border-orange-500',
			description: 'County-specific programs',
		},
		{
			key: 'utility',
			label: 'Utility',
			count: breakdown.utility || 0,
			icon: Zap,
			color: 'text-purple-600',
			bgColor: 'bg-purple-50 dark:bg-purple-950',
			borderColor: 'border-purple-500',
			description: 'Utility-specific programs',
		},
	];

	// Calculate total based on selected scopes only
	const totalCount = scopes
		.filter((s) => selectedScopes.includes(s.key))
		.reduce((sum, s) => sum + s.count, 0);

	const handleToggleScope = (scopeKey) => {
		if (!onScopeChange) return;

		const newScopes = selectedScopes.includes(scopeKey)
			? selectedScopes.filter((s) => s !== scopeKey)
			: [...selectedScopes, scopeKey];

		// Ensure at least one scope is selected
		if (newScopes.length > 0) {
			onScopeChange(newScopes);
		}
	};

	const handleSelectAll = () => {
		onScopeChange?.(['national', 'state_wide', 'county', 'utility']);
	};

	const handleClearToOne = () => {
		// Keep only national when clearing
		onScopeChange?.(['national']);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
					Filter by Scope
				</h3>
				<div className="flex items-center gap-2">
					<button
						onClick={handleSelectAll}
						className="text-xs text-blue-600 hover:underline"
					>
						All
					</button>
					<span className="text-muted-foreground">|</span>
					<button
						onClick={handleClearToOne}
						className="text-xs text-blue-600 hover:underline"
					>
						Clear
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{scopes.map((scope) => {
					const Icon = scope.icon;
					const isSelected = selectedScopes.includes(scope.key);

					return (
						<button
							key={scope.key}
							onClick={() => handleToggleScope(scope.key)}
							className={cn(
								'relative p-3 rounded-lg border-2 transition-all text-left',
								'cursor-pointer hover:shadow-sm',
								isSelected
									? `${scope.borderColor} ${scope.bgColor}`
									: 'border-gray-200 dark:border-gray-700 opacity-60'
							)}
						>
							<div className="flex items-start gap-2">
								{/* Checkbox indicator */}
								<div
									className={cn(
										'flex items-center justify-center w-5 h-5 rounded border-2 transition-all flex-shrink-0',
										isSelected
											? `${scope.borderColor} ${scope.bgColor}`
											: 'border-gray-300 dark:border-gray-600'
									)}
								>
									{isSelected && (
										<Check className={cn('h-3 w-3', scope.color)} />
									)}
								</div>

								<div className={cn('p-1.5 rounded', scope.bgColor)}>
									<Icon className={cn('h-4 w-4', scope.color)} />
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<span
											className={cn(
												'text-sm font-medium',
												!isSelected && 'text-muted-foreground'
											)}
										>
											{scope.label}
										</span>
										<span
											className={cn(
												'text-lg font-bold',
												isSelected ? scope.color : 'text-muted-foreground'
											)}
										>
											{scope.count}
										</span>
									</div>
								</div>
							</div>
						</button>
					);
				})}
			</div>

			{/* Selected count indicator */}
			<div className="flex items-center justify-between pt-2 border-t">
				<span className="text-xs text-muted-foreground">
					{selectedScopes.length} of 4 scopes selected
				</span>
				<span className="text-sm font-semibold">
					{totalCount} opportunities
				</span>
			</div>
		</div>
	);
}

'use client';

import { Globe, Building2, MapPin, Zap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * ScopeFilter - Checkboxes to filter opportunities by scope type
 * Controls what opportunities are displayed in the side panel cards
 */
export default function ScopeFilter({
	value = ['national', 'state_wide', 'county', 'utility'],
	onChange,
	viewMode = 'us',
	counts = null,
	disabled = false,
}) {
	const scopes = [
		{
			id: 'national',
			label: 'National',
			icon: Globe,
			description: 'Nationwide opportunities',
			count: counts?.national || 0,
		},
		{
			id: 'state_wide',
			label: 'State-wide',
			icon: Building2,
			description: 'Entire state coverage',
			count: counts?.state_wide || 0,
		},
		{
			id: 'county',
			label: 'County',
			icon: MapPin,
			description: 'County-specific programs',
			count: counts?.county || 0,
		},
		{
			id: 'utility',
			label: 'Utility',
			icon: Zap,
			description: 'Utility-specific programs',
			count: counts?.utility || 0,
		},
	];

	// Determine which scopes should be disabled based on view mode
	const getScopeDisabled = (scopeId) => {
		if (disabled) return true;

		// In national view, only national is enabled
		if (viewMode === 'national') {
			return scopeId !== 'national';
		}

		// In US view (no state selected), all are available
		if (viewMode === 'us') {
			return false;
		}

		// In state/county/utility view, all are available
		return false;
	};

	const handleToggle = (scopeId) => {
		if (getScopeDisabled(scopeId)) return;

		const newValue = value.includes(scopeId)
			? value.filter((s) => s !== scopeId)
			: [...value, scopeId];

		// Ensure at least one scope is selected
		if (newValue.length > 0) {
			onChange?.(newValue);
		}
	};

	const handleSelectAll = () => {
		const enabledScopes = scopes
			.filter((s) => !getScopeDisabled(s.id))
			.map((s) => s.id);
		onChange?.(enabledScopes);
	};

	const handleClearAll = () => {
		// Keep at least national if clearing all
		onChange?.(['national']);
	};

	const allSelected = scopes
		.filter((s) => !getScopeDisabled(s.id))
		.every((s) => value.includes(s.id));

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">Filter by Scope</span>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleSelectAll}
						className="text-xs text-blue-600 hover:underline"
						disabled={disabled}
					>
						All
					</button>
					<span className="text-muted-foreground">|</span>
					<button
						type="button"
						onClick={handleClearAll}
						className="text-xs text-blue-600 hover:underline"
						disabled={disabled}
					>
						Clear
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2">
				{scopes.map((scope) => {
					const Icon = scope.icon;
					const isChecked = value.includes(scope.id);
					const isDisabled = getScopeDisabled(scope.id);

					return (
						<div
							key={scope.id}
							role="button"
							tabIndex={isDisabled ? -1 : 0}
							onClick={() => !isDisabled && handleToggle(scope.id)}
							onKeyDown={(e) => {
								if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									handleToggle(scope.id);
								}
							}}
							className={cn(
								'flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
								isChecked
									? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
									: 'border-gray-200 dark:border-gray-700',
								isDisabled
									? 'opacity-50 cursor-not-allowed'
									: 'hover:border-blue-300 cursor-pointer'
							)}
						>
							<Checkbox
								checked={isChecked}
								disabled={isDisabled}
								className="pointer-events-none"
								tabIndex={-1}
							/>
							<Icon
								className={cn(
									'h-4 w-4',
									isChecked ? 'text-blue-600' : 'text-muted-foreground'
								)}
							/>
							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between">
									<span
										className={cn(
											'text-sm font-medium',
											isDisabled && 'text-muted-foreground'
										)}
									>
										{scope.label}
									</span>
									{counts && (
										<span
											className={cn(
												'text-xs',
												isChecked
													? 'text-blue-600 font-medium'
													: 'text-muted-foreground'
											)}
										>
											{scope.count}
										</span>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Selected count indicator */}
			<div className="text-xs text-muted-foreground text-center">
				{value.length} of {scopes.filter((s) => !getScopeDisabled(s.id)).length}{' '}
				scopes selected
			</div>
		</div>
	);
}

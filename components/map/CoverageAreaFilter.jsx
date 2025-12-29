'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Globe, Building2, MapPin, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Coverage area definitions with icons and colors
const COVERAGE_AREAS = [
	{
		key: 'national',
		label: 'National',
		icon: Globe,
		color: 'text-blue-600',
		bgColor: 'bg-blue-100 dark:bg-blue-950',
		dotColor: '#2563eb',
	},
	{
		key: 'state_wide',
		label: 'State-wide',
		icon: Building2,
		color: 'text-green-600',
		bgColor: 'bg-green-100 dark:bg-green-950',
		dotColor: '#16a34a',
	},
	{
		key: 'county',
		label: 'County',
		icon: MapPin,
		color: 'text-orange-600',
		bgColor: 'bg-orange-100 dark:bg-orange-950',
		dotColor: '#ea580c',
	},
	{
		key: 'utility',
		label: 'Utility',
		icon: Zap,
		color: 'text-purple-600',
		bgColor: 'bg-purple-100 dark:bg-purple-950',
		dotColor: '#9333ea',
	},
];

/**
 * CoverageAreaFilter - Multi-select dropdown for coverage area types
 * Used in map filter bar to filter opportunities by geographic coverage
 */
export default function CoverageAreaFilter({
	value = ['national', 'state_wide', 'county', 'utility'],
	onChange,
	stateCode = null,
	filters = {},
	disabled = false,
	className,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [counts, setCounts] = useState({});
	const [loading, setLoading] = useState(true);
	const dropdownRef = useRef(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Fetch counts from scope breakdown endpoint
	useEffect(() => {
		async function fetchCounts() {
			try {
				setLoading(true);
				const params = new URLSearchParams();

				// Pass through relevant filters
				if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
					params.append('status', filters.status.join(','));
				} else if (filters.status && filters.status !== 'all') {
					params.append('status', filters.status);
				}
				if (filters.projectTypes?.length > 0) {
					params.append('projectTypes', filters.projectTypes.join(','));
				}

				// Use state-specific or nationwide endpoint
				const endpoint = stateCode
					? `/api/map/scope-breakdown/${stateCode}?${params}`
					: `/api/map/scope-breakdown/US?${params}`;

				const response = await fetch(endpoint);
				const result = await response.json();

				if (result.success) {
					setCounts(result.data || {});
				}
			} catch (error) {
				console.error('Error fetching coverage area counts:', error);
			} finally {
				setLoading(false);
			}
		}

		fetchCounts();
	}, [stateCode, filters.status, filters.projectTypes]);

	const handleToggle = (key) => {
		if (disabled) return;

		const newValue = value.includes(key)
			? value.filter((k) => k !== key)
			: [...value, key];

		// Ensure at least one area is selected
		if (newValue.length > 0) {
			onChange?.(newValue);
		}
	};

	const handleSelectAll = () => {
		onChange?.(COVERAGE_AREAS.map((a) => a.key));
	};

	const handleClearAll = () => {
		// Keep at least one - default to national
		onChange?.(['national']);
	};

	const selectedCount = value.length;
	const allSelected = selectedCount === COVERAGE_AREAS.length;
	const displayText = allSelected
		? 'All Coverage'
		: selectedCount > 0
		? `Coverage (${selectedCount})`
		: 'Coverage Area';

	return (
		<div className={cn('relative', className)} ref={dropdownRef}>
			<Button
				variant="outline"
				onClick={() => setIsOpen(!isOpen)}
				disabled={disabled}
				className={cn(
					'h-10 w-[150px] justify-between',
					isOpen && 'border-blue-500 ring-1 ring-blue-200',
					selectedCount > 0 && !allSelected && 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
				)}
			>
				<span className="truncate">{displayText}</span>
				<ChevronDown
					className={cn(
						'h-4 w-4 opacity-50 transition-transform',
						isOpen && 'rotate-180'
					)}
				/>
			</Button>

			{isOpen && (
				<div className="absolute left-0 z-50 mt-2 w-64 origin-top-left bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-600">
					<div className="p-3">
						{/* Loading state */}
						{loading && (
							<div className="py-4 text-center text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
								Loading...
							</div>
						)}

						{/* Coverage areas list */}
						{!loading && (
							<div className="space-y-1">
								{COVERAGE_AREAS.map((area) => {
									const Icon = area.icon;
									const isSelected = value.includes(area.key);
									const count = counts[area.key] || 0;

									return (
										<div
											key={area.key}
											className={cn(
												'flex items-center justify-between py-2 px-2 rounded cursor-pointer transition-colors',
												isSelected
													? area.bgColor
													: 'hover:bg-gray-50 dark:hover:bg-neutral-700'
											)}
											onClick={() => handleToggle(area.key)}
										>
											<div className="flex items-center gap-2 flex-1 min-w-0">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => {}}
													className="h-4 w-4 rounded border-gray-300"
												/>
												<div className={cn('p-1 rounded', area.bgColor)}>
													<Icon className={cn('h-3.5 w-3.5', area.color)} />
												</div>
												<span className="text-sm">{area.label}</span>
											</div>
											<span className={cn(
												'text-sm font-medium ml-2 flex-shrink-0',
												isSelected ? area.color : 'text-muted-foreground'
											)}>
												{count}
											</span>
										</div>
									);
								})}
							</div>
						)}

						{/* Actions */}
						<div className="mt-3 pt-3 border-t flex justify-between">
							<Button
								variant="link"
								size="sm"
								className="text-blue-600 hover:text-blue-800 p-0 h-auto"
								onClick={handleSelectAll}
							>
								Select all
							</Button>
							{selectedCount > 1 && (
								<Button
									variant="link"
									size="sm"
									className="text-blue-600 hover:text-blue-800 p-0 h-auto"
									onClick={handleClearAll}
								>
									Clear
								</Button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

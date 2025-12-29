'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProjectTypeColor } from '@/lib/utils/uiHelpers';
import { cn } from '@/lib/utils';

/**
 * ProjectTypesFilter - Multi-select dropdown for project types
 * Used in map filter bar to filter opportunities by project type
 */
export default function ProjectTypesFilter({
	value = [],
	onChange,
	disabled = false,
	className,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [projectTypes, setProjectTypes] = useState([]);
	const [projectTypeCounts, setProjectTypeCounts] = useState({});
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

	// Fetch project types
	useEffect(() => {
		async function fetchProjectTypes() {
			try {
				setLoading(true);
				const response = await fetch('/api/project-types');
				const result = await response.json();

				if (result.success) {
					setProjectTypes(result.projectTypes || []);
					setProjectTypeCounts(result.projectTypeGroups || {});
				}
			} catch (error) {
				console.error('Error fetching project types:', error);
			} finally {
				setLoading(false);
			}
		}

		fetchProjectTypes();
	}, []);

	const handleToggle = (type) => {
		if (disabled) return;

		const newValue = value.includes(type)
			? value.filter((t) => t !== type)
			: [...value, type];

		onChange?.(newValue);
	};

	const handleClearAll = () => {
		onChange?.([]);
		setSearchQuery('');
	};

	// Filter by search
	const filteredTypes = searchQuery
		? projectTypes.filter((type) =>
				type.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: projectTypes;

	const selectedCount = value.length;
	const displayText =
		selectedCount > 0 ? `Project Types (${selectedCount})` : 'Project Types';

	return (
		<div className={cn('relative', className)} ref={dropdownRef}>
			<Button
				variant="outline"
				onClick={() => setIsOpen(!isOpen)}
				disabled={disabled}
				className={cn(
					'h-10 w-[160px] justify-between',
					isOpen && 'border-blue-500 ring-1 ring-blue-200',
					selectedCount > 0 && 'bg-blue-50 border-blue-200'
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
				<div className="absolute left-0 z-50 mt-2 w-80 origin-top-left bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-600">
					<div className="p-3">
						{/* Search */}
						<div className="relative mb-3">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<input
								type="text"
								placeholder="Search project types..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-9 pr-8 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-white dark:placeholder-neutral-400"
							/>
							{searchQuery && (
								<X
									className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
									onClick={() => setSearchQuery('')}
								/>
							)}
						</div>

						{/* Loading */}
						{loading && (
							<div className="py-4 text-center text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
								Loading...
							</div>
						)}

						{/* Project types list */}
						{!loading && (
							<div className="max-h-60 overflow-y-auto space-y-1">
								{filteredTypes.map((type) => {
									const isSelected = value.includes(type);
									const typeColor = getProjectTypeColor(type);
									const count = projectTypeCounts[type]?.count || 0;

									return (
										<div
											key={type}
											className={cn(
												'flex items-center justify-between py-2 px-2 rounded cursor-pointer transition-colors',
												isSelected
													? 'bg-blue-50 dark:bg-blue-950'
													: 'hover:bg-gray-50 dark:hover:bg-neutral-700'
											)}
											onClick={() => handleToggle(type)}
										>
											<div className="flex items-center gap-2 flex-1 min-w-0">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => {}}
													className="h-4 w-4 rounded border-gray-300"
												/>
												<span
													className="w-2.5 h-2.5 rounded-full flex-shrink-0"
													style={{ backgroundColor: typeColor.color }}
												/>
												<span className="text-sm truncate">{type}</span>
											</div>
											<span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
												{count}
											</span>
										</div>
									);
								})}
							</div>
						)}

						{/* No results */}
						{!loading && filteredTypes.length === 0 && (
							<div className="py-4 text-center text-sm text-muted-foreground">
								No project types found
							</div>
						)}

						{/* Clear button */}
						{selectedCount > 0 && (
							<div className="mt-3 pt-3 border-t flex justify-end">
								<Button
									variant="link"
									size="sm"
									className="text-blue-600 hover:text-blue-800"
									onClick={handleClearAll}
								>
									Clear all
								</Button>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

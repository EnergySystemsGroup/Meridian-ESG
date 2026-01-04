'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sort options with display names and default directions
const SORT_OPTIONS = [
	{ key: 'relevance', label: 'Relevance', defaultDirection: 'desc' },
	{ key: 'deadline', label: 'Deadline', defaultDirection: 'asc' },
	{ key: 'amount', label: 'Amount', defaultDirection: 'desc' },
	{ key: 'recent', label: 'Recently added', defaultDirection: 'desc' },
];

/**
 * OpportunitySortDropdown - Compact sort selector for filter bar
 * Allows sorting by relevance, deadline, amount, or date added
 */
export default function OpportunitySortDropdown({
	value = 'relevance',
	direction = 'desc',
	onChange,
	disabled = false,
	className,
}) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};

		const handleEscapeKey = (event) => {
			if (event.key === 'Escape' && isOpen) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscapeKey);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscapeKey);
		};
	}, [isOpen]);

	const handleSelect = (optionKey) => {
		if (disabled) return;

		const option = SORT_OPTIONS.find((o) => o.key === optionKey);
		if (!option) return;

		if (optionKey === value) {
			// Toggle direction if same option selected
			const newDirection = direction === 'asc' ? 'desc' : 'asc';
			onChange?.(optionKey, newDirection);
		} else {
			// New option with its default direction
			onChange?.(optionKey, option.defaultDirection);
		}

		setIsOpen(false);
	};

	const currentOption = SORT_OPTIONS.find((o) => o.key === value) || SORT_OPTIONS[0];
	const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown;

	return (
		<div className={cn('relative', className)} ref={dropdownRef}>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground hidden sm:inline">Sort:</span>
				<Button
					variant="outline"
					onClick={() => setIsOpen(!isOpen)}
					disabled={disabled}
					className={cn(
						'h-8 px-3 flex items-center gap-1',
						isOpen && 'border-blue-500 ring-1 ring-blue-200'
					)}
				>
					<span className="text-sm">{currentOption.label}</span>
					<DirectionIcon className="h-3.5 w-3.5 ml-0.5" />
				</Button>
			</div>

			{isOpen && (
				<div className="absolute right-0 z-50 mt-1 w-44 origin-top-right bg-white dark:bg-neutral-800 rounded-md shadow-lg border border-gray-200 dark:border-neutral-600">
					<div className="p-2 text-xs text-muted-foreground border-b border-gray-100 dark:border-neutral-700">
						Sort By
					</div>
					<div className="py-1">
						{SORT_OPTIONS.map((option) => {
							const isSelected = value === option.key;

							return (
								<div
									key={option.key}
									className={cn(
										'flex justify-between items-center px-3 py-2 text-sm cursor-pointer transition-colors',
										isSelected
											? 'bg-blue-50 dark:bg-blue-950'
											: 'hover:bg-gray-50 dark:hover:bg-neutral-700'
									)}
									onClick={() => handleSelect(option.key)}
								>
									<span>{option.label}</span>
									{isSelected && (
										<div className="flex items-center text-blue-600">
											{direction === 'asc' ? (
												<ArrowUp className="h-4 w-4" />
											) : (
												<ArrowDown className="h-4 w-4" />
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

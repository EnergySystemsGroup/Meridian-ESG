'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Status options with colors
const STATUS_OPTIONS = [
	{ key: 'Open', label: 'Open', color: '#22c55e', bgColor: 'bg-green-100 dark:bg-green-900' },
	{ key: 'Upcoming', label: 'Upcoming', color: '#3b82f6', bgColor: 'bg-blue-100 dark:bg-blue-900' },
	{ key: 'Closed', label: 'Closed', color: '#9ca3af', bgColor: 'bg-gray-100 dark:bg-gray-800' },
];

/**
 * StatusFilter - Multi-select dropdown for opportunity status
 * Used in map filter bar to filter opportunities by status
 */
export default function StatusFilter({
	value = ['Open', 'Upcoming'],
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

	const handleToggle = (key) => {
		if (disabled) return;

		const newValue = value.includes(key)
			? value.filter((k) => k !== key)
			: [...value, key];

		// Ensure at least one status is selected
		if (newValue.length > 0) {
			onChange?.(newValue);
		}
	};

	const handleSelectDefault = () => {
		onChange?.(['Open', 'Upcoming']);
		setIsOpen(false);
	};

	const handleSelectAll = () => {
		onChange?.(STATUS_OPTIONS.map((s) => s.key));
		setIsOpen(false);
	};

	// Determine display text
	const selectedCount = value.length;
	const isDefault = selectedCount === 2 && value.includes('Open') && value.includes('Upcoming');
	const displayText = isDefault
		? 'Open & Upcoming'
		: selectedCount === 1
		? value[0]
		: selectedCount === STATUS_OPTIONS.length
		? 'All Statuses'
		: `Status (${selectedCount})`;

	return (
		<div className={cn('relative', className)} ref={dropdownRef}>
			<Button
				variant="outline"
				onClick={() => setIsOpen(!isOpen)}
				disabled={disabled}
				className={cn(
					'h-10 w-full sm:w-[150px] justify-between',
					isOpen && 'border-blue-500 ring-1 ring-blue-200',
					!isDefault && 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
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
				<div className="absolute left-0 z-50 mt-2 w-48 origin-top-left bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-600">
					<div className="p-3">
						<div className="space-y-1">
							{STATUS_OPTIONS.map((status) => {
								const isSelected = value.includes(status.key);

								return (
									<div
										key={status.key}
										className={cn(
											'flex items-center justify-between py-2 px-2 rounded cursor-pointer transition-colors',
											isSelected
												? status.bgColor
												: 'hover:bg-gray-50 dark:hover:bg-neutral-700'
										)}
										onClick={() => handleToggle(status.key)}
									>
										<div className="flex items-center gap-2 flex-1 min-w-0">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => {}}
												className="h-4 w-4 rounded border-gray-300"
											/>
											<span
												className="w-3 h-3 rounded-full"
												style={{ backgroundColor: status.color }}
											/>
											<span className="text-sm">{status.label}</span>
										</div>
									</div>
								);
							})}
						</div>

						{/* Actions */}
						<div className="mt-3 pt-3 border-t flex justify-between">
							<Button
								variant="link"
								size="sm"
								className="text-blue-600 hover:text-blue-800 p-0 h-auto"
								onClick={handleSelectAll}
							>
								All
							</Button>
							<Button
								variant="link"
								size="sm"
								className="text-blue-600 hover:text-blue-800 p-0 h-auto"
								onClick={handleSelectDefault}
							>
								Default
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

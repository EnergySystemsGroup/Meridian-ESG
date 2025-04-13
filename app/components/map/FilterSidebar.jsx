'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Filter, CalendarIcon, ChevronDown, Search, X } from 'lucide-react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Slider } from '@/app/components/ui/slider';
import { format } from 'date-fns';
import { cn } from '@/app/lib/utils';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/app/components/ui/popover';
import { Calendar as CalendarComponent } from '@/app/components/ui/calendar';
import TAXONOMIES from '@/app/lib/constants/taxonomies';
import { Input } from '@/app/components/ui/input';
import {
	getCategoryColor,
	formatCategoryForDisplay,
} from '@/app/lib/utils/uiHelpers';

export default function FilterSidebar({
	filters,
	onFilterChange,
	onResetFilters,
	horizontal = false,
	categoriesOnly = false,
}) {
	// State for categories from API
	const [availableCategories, setAvailableCategories] = useState([]);
	const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
	const [categoryMapping, setCategoryMapping] = useState({});
	const [categoriesApiResponse, setCategoriesApiResponse] = useState(null);

	// State for category dropdown and search
	const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
	const [categorySearchInput, setCategorySearchInput] = useState('');
	const categoryDropdownRef = useRef(null);

	// Fetch categories from API
	useEffect(() => {
		async function fetchAllCategories() {
			try {
				setIsCategoriesLoading(true);
				const response = await fetch('/api/categories');
				const result = await response.json();

				if (result.success) {
					setCategoriesApiResponse(result);
					setAvailableCategories(result.categories);
					setCategoryMapping(result.rawToNormalizedMap);
					console.log(
						'Loaded normalized categories:',
						result.categories.length
					);
					console.log('Category groups:', result.categoryGroups);
				} else {
					console.error('Error fetching categories:', result.error);
				}
			} catch (err) {
				console.error('Failed to fetch categories:', err);
			} finally {
				setIsCategoriesLoading(false);
			}
		}

		fetchAllCategories();
	}, []);

	// Filtered categories based on search input
	const filteredCategories = categorySearchInput
		? availableCategories.filter((category) =>
				category.toLowerCase().includes(categorySearchInput.toLowerCase())
		  )
		: availableCategories;

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event) {
			if (
				categoryDropdownRef.current &&
				!categoryDropdownRef.current.contains(event.target)
			) {
				setCategoryDropdownOpen(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	// Handle category selection
	const handleCategorySelect = (category) => {
		let newCategories = [...(filters.categories || [])];

		if (newCategories.includes(category)) {
			newCategories = newCategories.filter((c) => c !== category);
		} else {
			newCategories.push(category);
		}

		onFilterChange('categories', newCategories);
	};

	// Clear all selected categories
	const clearCategories = () => {
		onFilterChange('categories', []);
	};

	// Categories filter component
	const renderCategoryFilter = () => {
		// Count selected categories for display
		const selectedCount = filters.categories?.length || 0;
		const displayText =
			selectedCount > 0 ? `Categories (${selectedCount})` : 'Categories';

		return (
			<div className='relative inline-block text-left w-full'>
				<div>
					<Button
						variant='outline'
						onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
						className={cn(
							'w-full h-10 flex items-center justify-between',
							categoryDropdownOpen
								? 'bg-blue-50 text-blue-800 border-blue-200'
								: '',
							categoryDropdownOpen && selectedCount > 0 ? 'bg-blue-100' : ''
						)}>
						<span className='truncate'>{displayText}</span>
						<ChevronDown
							size={16}
							className={cn(
								'ml-2 h-4 w-4 shrink-0 opacity-50',
								categoryDropdownOpen ? 'rotate-180 transform' : ''
							)}
						/>
					</Button>
				</div>

				{categoryDropdownOpen && (
					<div
						className='absolute left-0 z-20 mt-2 w-[280px] origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
						tabIndex={-1}
						ref={categoryDropdownRef}>
						<div className='p-3'>
							{/* Search input */}
							<div className='mb-3'>
								<div className='relative'>
									<Search
										className='absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400'
										size={16}
									/>
									<Input
										type='text'
										className='w-full pl-8 h-9 text-sm'
										placeholder='Search categories...'
										value={categorySearchInput}
										onChange={(e) => setCategorySearchInput(e.target.value)}
									/>
									{categorySearchInput && (
										<X
											className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer'
											size={16}
											onClick={() => setCategorySearchInput('')}
										/>
									)}
								</div>
							</div>

							{/* Loading indicator for categories */}
							{isCategoriesLoading && (
								<div className='py-3 text-center text-sm text-gray-500'>
									<div className='inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2'></div>
									Loading categories...
								</div>
							)}

							{/* Categories list */}
							{!isCategoriesLoading && (
								<div className='max-h-[240px] overflow-y-auto'>
									{filteredCategories.map((category) => {
										const isSelected = filters.categories?.includes(category);
										const categoryColor = getCategoryColor(category);
										const count =
											categoriesApiResponse?.categoryGroups?.[category]
												?.count || 0;
										return (
											<div
												key={category}
												className='flex items-center justify-between py-1.5 px-1 cursor-pointer hover:bg-gray-50 rounded'
												onClick={() => handleCategorySelect(category)}>
												<div className='flex items-center gap-2'>
													<input
														type='checkbox'
														className='rounded border-gray-300'
														checked={isSelected}
														readOnly
													/>
													<span
														className='w-2.5 h-2.5 rounded-full'
														style={{ backgroundColor: categoryColor.color }}
													/>
													<span className='text-sm'>
														{formatCategoryForDisplay(category)}
													</span>
												</div>
												<span className='text-xs text-gray-500 ml-1'>
													{count}
												</span>
											</div>
										);
									})}
								</div>
							)}

							{/* No results */}
							{!isCategoriesLoading && filteredCategories.length === 0 && (
								<div className='py-3 text-center text-sm text-gray-500'>
									No categories found
								</div>
							)}

							{/* Clear selections button if any selected */}
							{selectedCount > 0 && (
								<div className='mt-3 pt-3 border-t border-gray-200 flex justify-end'>
									<Button
										variant='ghost'
										size='sm'
										className='text-blue-600 hover:text-blue-800 hover:bg-blue-50'
										onClick={clearCategories}>
										Clear selections
									</Button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		);
	};

	// If categoriesOnly prop is true, only render the category filter
	if (categoriesOnly) {
		return renderCategoryFilter();
	}

	// Render selected category pills
	const renderSelectedCategories = () => {
		if (!filters.categories?.length) return null;

		return (
			<div className='flex flex-wrap gap-1 mt-2'>
				{filters.categories.map((category) => {
					const categoryColor = getCategoryColor(category);
					return (
						<span
							key={category}
							className='flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium'
							style={{
								backgroundColor: categoryColor.bgColor,
								color: categoryColor.color,
							}}>
							{formatCategoryForDisplay(category)}
							<X
								size={14}
								className='cursor-pointer'
								onClick={() => {
									const updatedCategories = filters.categories.filter(
										(c) => c !== category
									);
									onFilterChange('categories', updatedCategories);
								}}
							/>
						</span>
					);
				})}
			</div>
		);
	};

	// If horizontal is true, don't render the card container
	const filterContent = (
		<div className={`${horizontal ? 'flex items-center gap-6' : 'space-y-6'}`}>
			{/* Status filter - Smaller trigger, no label */}
			{horizontal ? null : (
				<label className='text-sm font-medium mb-1 block'>Status</label>
			)}
			<Select
				value={filters.status}
				onValueChange={(value) => onFilterChange('status', value)}>
				<SelectTrigger className={horizontal ? 'h-8 w-32 text-xs' : ''}>
					<SelectValue placeholder='Status' />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='all'>All Status</SelectItem>
					<SelectItem value='Open'>Open</SelectItem>
					<SelectItem value='Upcoming'>Upcoming</SelectItem>
					<SelectItem value='Closed'>Closed</SelectItem>
				</SelectContent>
			</Select>

			{/* Category Filter - Using the new component */}
			{renderCategoryFilter()}

			{/* Source Type filter - Smaller trigger, no label */}
			{horizontal ? null : (
				<label className='text-sm font-medium mb-1 block'>Source Type</label>
			)}
			<Select
				value={filters.sourceType}
				onValueChange={(value) => onFilterChange('sourceType', value)}>
				<SelectTrigger
					className={cn('h-8 text-xs', horizontal ? 'w-40 flex-shrink-0' : '')}>
					<SelectValue placeholder='Source Type' />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='all'>All Sources</SelectItem>
					<SelectItem value='Federal'>Federal</SelectItem>
					<SelectItem value='State'>State</SelectItem>
					<SelectItem value='Local'>Local</SelectItem>
					<SelectItem value='Private'>Private</SelectItem>
				</SelectContent>
			</Select>

			{/* Funding amount slider - Updated label and display format */}
			<div
				className={
					horizontal ? 'min-w-[200px] max-w-[280px] flex-shrink-0 pl-2' : ''
				}>
				<div
					className={`flex items-center ${
						horizontal ? 'justify-between' : 'justify-between'
					} mb-1`}>
					{horizontal ? (
						<label className='text-xs font-medium mr-2 whitespace-nowrap'>
							Award Amount:
						</label>
					) : (
						<label className='text-sm font-medium'>Award Amount</label>
					)}
					<span className='text-xs text-muted-foreground whitespace-nowrap'>
						${(filters.maxAmount / 1000000).toFixed(1)}M+
					</span>
				</div>
				<Slider
					value={[filters.maxAmount]}
					max={10000000}
					step={500000}
					onValueChange={(values) => onFilterChange('maxAmount', values[0])}
					className={cn('w-full', horizontal && 'h-auto')}
				/>
			</div>

			{/* Include National - Commented out intentionally */}
			{/* <div
				className={
					horizontal
						? 'flex items-center gap-1.5'
						: 'flex items-center justify-between'
				}>
				{horizontal ? null : (
					<div>
						<label className='text-sm font-medium'>Include National</label>
						<div className='text-xs text-gray-500'>
							Show opportunities available nationwide
						</div>
					</div>
				)}
				{horizontal && (
					<label className='text-xs text-muted-foreground'>National</label>
				)}
				<Switch
					className={horizontal ? 'scale-75' : ''}
					checked={filters.showNational}
					onCheckedChange={(checked) => onFilterChange('showNational', checked)}
				/>
			</div> */}
		</div>
	);

	// If horizontal, return just the content without the selected category pills
	if (horizontal) {
		return filterContent;
	}

	// Otherwise wrap in a Card
	return (
		<Card>
			<CardHeader className='pb-2'>
				<CardTitle className='flex items-center'>
					<Filter className='h-5 w-5 mr-2' />
					Filters
				</CardTitle>
			</CardHeader>
			<CardContent className='p-4 pt-2'>
				{filterContent}
				{/* Still include the category pills in the non-horizontal (sidebar) view */}
				{renderSelectedCategories()}
			</CardContent>
			<div className='px-6 pb-4'>
				<Button variant='outline' onClick={onResetFilters} className='w-full'>
					Reset All Filters
				</Button>
			</div>
		</Card>
	);
}

'use client';

import React from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Filter, CalendarIcon } from 'lucide-react';
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

export default function FilterSidebar({
	filters,
	onFilterChange,
	onResetFilters,
	horizontal = false,
}) {
	// Common funding categories
	const categories = [
		'Energy',
		'Infrastructure',
		'Climate',
		'Transportation',
		'Water',
		'Housing',
		'Healthcare',
		'Education',
		'Agriculture',
		'Research',
		'Economic Development',
		'Disaster Relief',
	];

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

			{/* Category Filter - Smaller trigger, no label */}
			{horizontal ? null : (
				<label className='text-sm font-medium mb-1 block'>Category</label>
			)}
			<Select
				value={filters.category || 'all'}
				onValueChange={(value) => onFilterChange('category', value)}>
				<SelectTrigger
					className={cn(
						'h-8 text-xs',
						horizontal ? 'w-[200px] flex-shrink-0' : ''
					)}>
					<SelectValue placeholder='Category' />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value='all'>All Categories</SelectItem>
					{categories.map((category) => (
						<SelectItem key={category} value={category}>
							{category}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

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

			{/* Funding amount slider - Smaller label, takes remaining space */}
			<div className={horizontal ? 'min-w-[200px] pl-2' : ''}>
				<div
					className={`flex items-center ${
						horizontal ? 'justify-between' : 'justify-between'
					} mb-1`}>
					{horizontal ? (
						<label className='text-xs font-medium mr-2'>Max Amount:</label>
					) : (
						<label className='text-sm font-medium'>Max Amount</label>
					)}
					<span className='text-xs text-muted-foreground'>
						${(filters.maxAmount / 1000000).toFixed(1)}M
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

			{/* Include National - Commented out */}
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

	// If horizontal, return just the content
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
			<CardContent className='p-4 pt-2'>{filterContent}</CardContent>
			<div className='px-6 pb-4'>
				<Button variant='outline' onClick={onResetFilters} className='w-full'>
					Reset All Filters
				</Button>
			</div>
		</Card>
	);
}

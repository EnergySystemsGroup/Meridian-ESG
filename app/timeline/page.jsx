'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function TimelinePage() {
	const [timelineData, setTimelineData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [filter, setFilter] = useState('All');

	useEffect(() => {
		async function fetchTimelineData() {
			try {
				setLoading(true);

				// Fetch a larger number of deadlines for the timeline
				const response = await fetch('/api/deadlines?limit=20');
				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch timeline data');
				}

				// Organize deadlines by month
				const deadlines = result.data;
				const organizedData = organizeByMonth(deadlines);

				setTimelineData(organizedData);
			} catch (err) {
				console.error('Error fetching timeline data:', err);
				setError(err.message);
				// Fall back to sample data
				setTimelineData(timelineMonths);
			} finally {
				setLoading(false);
			}
		}

		fetchTimelineData();
	}, []);

	// Function to organize deadlines by month
	function organizeByMonth(deadlines) {
		const months = {};

		// Sort deadlines by date
		deadlines.sort((a, b) => new Date(a.close_date) - new Date(b.close_date));

		// Group by month
		deadlines.forEach((deadline) => {
			const date = new Date(deadline.close_date);
			const monthYear = date.toLocaleDateString('en-US', {
				month: 'long',
				year: 'numeric',
			});

			if (!months[monthYear]) {
				months[monthYear] = {
					label: monthYear,
					events: [],
				};
			}

			// Convert deadline to timeline event format
			const event = {
				id: deadline.id,
				title: deadline.title,
				date: deadline.formattedDate,
				type: 'Funding Deadline',
				description: deadline.description || `Deadline for ${deadline.title}`,
				status: deadline.daysLeft <= 7 ? 'Due Soon' : 'Upcoming',
				daysLeft: deadline.daysLeft,
			};

			months[monthYear].events.push(event);
		});

		// Convert to array and sort by date
		return Object.values(months).sort((a, b) => {
			const dateA = new Date(a.label);
			const dateB = new Date(b.label);
			return dateA - dateB;
		});
	}

	// Filter events based on selected filter
	const filteredTimelineData = timelineData
		.map((month) => ({
			...month,
			events: month.events.filter(
				(event) => filter === 'All' || event.type === filter
			),
		}))
		.filter((month) => month.events.length > 0);

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Timeline</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button variant='outline'>Today</Button>
						<Button>Add Event</Button>
					</div>
				</div>

				<div className='mb-8'>
					<div className='flex gap-4 mb-4 overflow-x-auto pb-2'>
						<Button
							variant={filter === 'All' ? 'default' : 'outline'}
							className='rounded-full'
							onClick={() => setFilter('All')}>
							All
						</Button>
						<Button
							variant={filter === 'Funding Deadline' ? 'default' : 'outline'}
							className='rounded-full'
							onClick={() => setFilter('Funding Deadline')}>
							Funding Deadlines
						</Button>
						<Button
							variant={filter === 'Legislative Event' ? 'default' : 'outline'}
							className='rounded-full'
							onClick={() => setFilter('Legislative Event')}>
							Legislative Events
						</Button>
						<Button
							variant={filter === 'Task' ? 'default' : 'outline'}
							className='rounded-full'
							onClick={() => setFilter('Task')}>
							Tasks
						</Button>
					</div>

					{loading ? (
						<div className='flex justify-center items-center min-h-[400px]'>
							<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
						</div>
					) : error ? (
						<div className='bg-red-50 text-red-800 p-4 rounded-md mb-4'>
							<p>Error: {error}</p>
							<Button
								variant='outline'
								className='mt-2'
								onClick={() => {
									setError(null);
									fetchTimelineData();
								}}>
								Retry
							</Button>
						</div>
					) : filteredTimelineData.length === 0 ? (
						<div className='text-center py-12'>
							<h3 className='text-xl font-medium mb-2'>No events found</h3>
							<p className='text-muted-foreground mb-4'>
								Try adjusting your filters or check back later.
							</p>
							<Button onClick={() => setFilter('All')}>Show All Events</Button>
						</div>
					) : (
						<div className='relative'>
							{/* Timeline axis */}
							<div className='absolute left-0 top-0 bottom-0 w-px bg-border ml-6 md:ml-[120px]'></div>

							{/* Timeline events */}
							<div className='space-y-8'>
								{filteredTimelineData.map((month, monthIndex) => (
									<div key={monthIndex}>
										<h2 className='text-xl font-bold mb-4 pl-12 md:pl-[140px] relative'>
											<span className='absolute left-0 top-1/2 -translate-y-1/2 w-12 md:w-[120px] pr-4 text-right text-sm font-normal text-muted-foreground'>
												{month.label}
											</span>
											<span className='absolute left-6 md:left-[120px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary'></span>
										</h2>

										<div className='space-y-4 pl-12 md:pl-[140px]'>
											{month.events.map((event, eventIndex) => (
												<TimelineEvent
													key={event.id || eventIndex}
													event={event}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</MainLayout>
	);
}

function TimelineEvent({ event }) {
	const { title, date, type, description, status } = event;

	return (
		<div className='relative'>
			{/* Event dot */}
			<div className='absolute left-[-24px] md:left-[-20px] top-4 w-3 h-3 rounded-full bg-secondary border-2 border-primary'></div>

			{/* Event card */}
			<Card className={`relative max-w-2xl ${getEventBorderClass(type)}`}>
				<CardContent className='p-4'>
					<div className='flex justify-between items-start mb-2'>
						<div>
							<h3 className='font-medium'>{title}</h3>
							<p className='text-sm text-muted-foreground'>{date}</p>
						</div>
						<span
							className={`text-xs px-2 py-1 rounded-full ${getEventTypeClass(
								type
							)}`}>
							{type}
						</span>
					</div>

					<p className='text-sm mb-3'>{description}</p>

					<div className='flex justify-between items-center'>
						<span
							className={`text-xs px-2 py-1 rounded-full ${getStatusClass(
								status
							)}`}>
							{status}
						</span>
						<Button size='sm' variant='outline'>
							View Details
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function getEventBorderClass(type) {
	switch (type) {
		case 'Funding Deadline':
			return 'border-l-4 border-l-blue-500';
		case 'Legislative Event':
			return 'border-l-4 border-l-purple-500';
		case 'Task':
			return 'border-l-4 border-l-amber-500';
		default:
			return 'border-l-4 border-l-gray-500';
	}
}

function getEventTypeClass(type) {
	switch (type) {
		case 'Funding Deadline':
			return 'bg-blue-100 text-blue-800';
		case 'Legislative Event':
			return 'bg-purple-100 text-purple-800';
		case 'Task':
			return 'bg-amber-100 text-amber-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

function getStatusClass(status) {
	switch (status) {
		case 'Upcoming':
			return 'bg-yellow-100 text-yellow-800';
		case 'Due Soon':
			return 'bg-red-100 text-red-800';
		case 'Completed':
			return 'bg-green-100 text-green-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

// Sample data for fallback
const timelineMonths = [
	{
		label: 'April 2023',
		events: [
			{
				id: 1,
				title: 'Energy Efficiency Block Grants Application Deadline',
				date: 'April 5, 2023',
				type: 'Funding Deadline',
				description:
					'Final submission deadline for Department of Energy Energy Efficiency Block Grants program.',
				status: 'Due Soon',
			},
			{
				id: 2,
				title: 'School HVAC Improvement Program Deadline',
				date: 'April 10, 2023',
				type: 'Funding Deadline',
				description:
					'Application deadline for California Energy Commission School HVAC Improvement Program.',
				status: 'Upcoming',
			},
			{
				id: 3,
				title: 'H.R. 123 Committee Hearing',
				date: 'April 12, 2023',
				type: 'Legislative Event',
				description:
					'House Energy Committee hearing on the Building Energy Efficiency Act (H.R. 123).',
				status: 'Upcoming',
			},
			// ... other events
		],
	},
	{
		label: 'May 2023',
		events: [
			{
				id: 4,
				title: 'School Modernization Program Deadline',
				date: 'May 1, 2023',
				type: 'Funding Deadline',
				description:
					'Department of Education School Modernization Program application deadline.',
				status: 'Upcoming',
			},
			{
				id: 5,
				title: 'S.B. 456 Floor Vote',
				date: 'May 5, 2023',
				type: 'Legislative Event',
				description:
					'California Senate floor vote scheduled for Clean Energy Schools Initiative (S.B. 456).',
				status: 'Upcoming',
			},
			// ... other events
		],
	},
	// ... other months
];

'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

export default function TimelinePage() {
	const [timelineData, setTimelineData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

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
				description: deadline.program_overview ||
					(deadline.actionable_summary ?
						deadline.actionable_summary.length > 200 ?
							deadline.actionable_summary.substring(0, 200) + '...' :
							deadline.actionable_summary
						: `Deadline for ${deadline.title}`),
				daysLeft: deadline.daysLeft,
				relevanceScore: deadline.relevance_score,
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

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='mb-8'>
					<h1 className='text-3xl font-bold tracking-tight'>Timeline</h1>
					<div className='flex items-center gap-2 mt-2 text-muted-foreground'>
						<CalendarDays className='h-4 w-4' />
						<span className='text-sm'>
							{loading ? (
								'Loading deadlines...'
							) : timelineData.length === 0 ? (
								'No upcoming deadlines'
							) : (
								<>
									Showing next{' '}
									<span className='font-medium text-foreground'>
										{timelineData.reduce((acc, month) => acc + month.events.length, 0)}
									</span>{' '}
									funding deadlines
								</>
							)}
						</span>
					</div>
				</div>

				<div className='mb-8'>
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
								onClick={() => window.location.reload()}>
								Retry
							</Button>
						</div>
					) : timelineData.length === 0 ? (
						<div className='text-center py-12'>
							<h3 className='text-xl font-medium mb-2'>No upcoming deadlines</h3>
							<p className='text-muted-foreground'>
								Check back later for new funding deadlines.
							</p>
						</div>
					) : (
						<div className='relative'>
							{/* Timeline axis */}
							<div className='absolute left-0 top-0 bottom-0 w-px bg-border ml-6 md:ml-[120px]'></div>

							{/* Timeline events */}
							<div className='space-y-8'>
								{timelineData.map((month, monthIndex) => (
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
	const { title, date, type, description, daysLeft, relevanceScore } = event;

	// Format days left text
	const daysLeftText = daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`;

	return (
		<div className='relative'>
			{/* Event dot */}
			<div className='absolute left-[-24px] md:left-[-20px] top-4 w-3 h-3 rounded-full bg-secondary border-2 border-primary'></div>

			{/* Event card */}
			<Card className={`relative max-w-2xl ${getEventBorderClass(type)}`}>
				<CardContent className='p-4'>
					<div className='flex justify-between items-start mb-2 gap-3'>
						<div className='flex-1 min-w-0'>
							<h3 className='font-medium pr-2 break-words'>{title}</h3>
							<p className='text-sm text-muted-foreground'>{date}</p>
						</div>
						<span
							className={`text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${getEventTypeClass(
								type
							)}`}>
							{type}
						</span>
					</div>

					<p className='text-sm mb-3'>{description}</p>

					<div className='flex justify-between items-center'>
						<div className='flex items-center gap-2'>
							<span
								className={`text-xs px-2 py-1 rounded-full ${getDaysLeftClass(daysLeft)}`}>
								{daysLeftText}
							</span>
							{relevanceScore !== null && relevanceScore !== undefined && (
								<span
									className={`text-xs px-2 py-1 rounded-full ${getScorePillClass(relevanceScore)}`}>
									relevance: <span className='font-medium'>{Math.min(10, relevanceScore).toFixed(1)}</span>
								</span>
							)}
						</div>
						<Button size='sm' variant='outline' asChild>
							<Link href={`/funding/opportunities/${event.id}`}>
								View Details
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// Get Tailwind classes for days left pill
function getDaysLeftClass(days) {
	if (days <= 3) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
	if (days <= 7) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
	if (days <= 14) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
	return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
}

// Get Tailwind classes for score pill based on relevance score (0-10 scale)
function getScorePillClass(score) {
	const normalizedScore = Math.min(10, Math.max(0, score));
	if (normalizedScore >= 8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
	if (normalizedScore >= 6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
	if (normalizedScore >= 4) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
	return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
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

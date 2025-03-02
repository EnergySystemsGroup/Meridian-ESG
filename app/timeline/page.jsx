import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';

export default function TimelinePage() {
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
					<div className='flex gap-4 mb-4'>
						<Button variant='outline' className='rounded-full'>
							All
						</Button>
						<Button variant='outline' className='rounded-full'>
							Funding Deadlines
						</Button>
						<Button variant='outline' className='rounded-full'>
							Legislative Events
						</Button>
						<Button variant='outline' className='rounded-full'>
							Tasks
						</Button>
					</div>

					<div className='relative'>
						{/* Timeline axis */}
						<div className='absolute left-0 top-0 bottom-0 w-px bg-border ml-6 md:ml-[120px]'></div>

						{/* Timeline events */}
						<div className='space-y-8'>
							{timelineMonths.map((month, monthIndex) => (
								<div key={monthIndex}>
									<h2 className='text-xl font-bold mb-4 pl-12 md:pl-[140px] relative'>
										<span className='absolute left-0 top-1/2 -translate-y-1/2 w-12 md:w-[120px] pr-4 text-right text-sm font-normal text-muted-foreground'>
											{month.label}
										</span>
										<span className='absolute left-6 md:left-[120px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary'></span>
									</h2>

									<div className='space-y-4 pl-12 md:pl-[140px]'>
										{month.events.map((event, eventIndex) => (
											<TimelineEvent key={eventIndex} event={event} />
										))}
									</div>
								</div>
							))}
						</div>
					</div>
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

// Sample data
const timelineMonths = [
	{
		label: 'April 2023',
		events: [
			{
				title: 'Energy Efficiency Block Grants Application Deadline',
				date: 'April 5, 2023',
				type: 'Funding Deadline',
				description:
					'Final submission deadline for Department of Energy Energy Efficiency Block Grants program.',
				status: 'Due Soon',
			},
			{
				title: 'School HVAC Improvement Program Deadline',
				date: 'April 10, 2023',
				type: 'Funding Deadline',
				description:
					'Application deadline for California Energy Commission School HVAC Improvement Program.',
				status: 'Upcoming',
			},
			{
				title: 'H.R. 123 Committee Hearing',
				date: 'April 12, 2023',
				type: 'Legislative Event',
				description:
					'House Energy Committee hearing on the Building Energy Efficiency Act (H.R. 123).',
				status: 'Upcoming',
			},
			{
				title: 'Clean School Bus Program Deadline',
				date: 'April 15, 2023',
				type: 'Funding Deadline',
				description:
					'EPA Clean School Bus Program application submission deadline.',
				status: 'Upcoming',
			},
			{
				title: 'Prepare Client Application Materials',
				date: 'April 18, 2023',
				type: 'Task',
				description:
					'Finalize application materials for Springfield School District for the Building Retrofit Incentives program.',
				status: 'Upcoming',
			},
			{
				title: 'Building Retrofit Incentives Deadline',
				date: 'April 20, 2023',
				type: 'Funding Deadline',
				description:
					'Department of Energy Building Retrofit Incentives program application deadline.',
				status: 'Upcoming',
			},
		],
	},
	{
		label: 'May 2023',
		events: [
			{
				title: 'School Modernization Program Deadline',
				date: 'May 1, 2023',
				type: 'Funding Deadline',
				description:
					'Department of Education School Modernization Program application deadline.',
				status: 'Upcoming',
			},
			{
				title: 'S.B. 456 Floor Vote',
				date: 'May 5, 2023',
				type: 'Legislative Event',
				description:
					'California Senate floor vote scheduled for Clean Energy Schools Initiative (S.B. 456).',
				status: 'Upcoming',
			},
			{
				title: 'Client Webinar: Funding Opportunities',
				date: 'May 10, 2023',
				type: 'Task',
				description:
					'Host webinar for clients on upcoming funding opportunities and application strategies.',
				status: 'Upcoming',
			},
			{
				title: 'Community Climate Resilience Grant Deadline',
				date: 'May 15, 2023',
				type: 'Funding Deadline',
				description:
					'EPA Community Climate Resilience Grant application deadline.',
				status: 'Upcoming',
			},
			{
				title: 'Solar for Schools Initiative Deadline',
				date: 'May 20, 2023',
				type: 'Funding Deadline',
				description:
					'California Energy Commission Solar for Schools Initiative application deadline.',
				status: 'Upcoming',
			},
			{
				title: 'Zero Emission School Bus Program Deadline',
				date: 'May 30, 2023',
				type: 'Funding Deadline',
				description:
					'EPA Zero Emission School Bus Program application deadline.',
				status: 'Upcoming',
			},
		],
	},
	{
		label: 'June 2023',
		events: [
			{
				title: 'Municipal Building Retrofit Program Deadline',
				date: 'June 1, 2023',
				type: 'Funding Deadline',
				description:
					'Department of Energy Municipal Building Retrofit Program application deadline.',
				status: 'Upcoming',
			},
			{
				title: 'H.B. 234 Final Reading',
				date: 'June 5, 2023',
				type: 'Legislative Event',
				description:
					'Washington State House final reading of Energy Storage Incentive Program bill (H.B. 234).',
				status: 'Upcoming',
			},
			{
				title: 'Quarterly Funding Report',
				date: 'June 10, 2023',
				type: 'Task',
				description:
					'Prepare quarterly report on funding application status and success rates.',
				status: 'Upcoming',
			},
			{
				title: 'Building Electrification Program Deadline',
				date: 'June 15, 2023',
				type: 'Funding Deadline',
				description:
					'Oregon Department of Energy Building Electrification Program application deadline.',
				status: 'Upcoming',
			},
			{
				title: 'S.B. 301 Committee Hearing',
				date: 'June 20, 2023',
				type: 'Legislative Event',
				description:
					'California Senate Energy Committee hearing on Zero Emission Building Standard (S.B. 301).',
				status: 'Upcoming',
			},
		],
	},
];

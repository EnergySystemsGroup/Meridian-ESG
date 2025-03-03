import MainLayout from '@/app/components/layout/main-layout';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

export default function Home() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex flex-col gap-2 mb-8'>
					<h1 className='text-3xl font-bold text-neutral-900 dark:text-neutral-50'>
						Welcome to Meridian
					</h1>
					<p className='text-neutral-500 dark:text-neutral-400 max-w-3xl'>
						Your centralized platform for policy and funding intelligence. Track
						opportunities, monitor legislation, and match clients to relevant
						funding sources.
					</p>
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8'>
					<DashboardCard
						title='Open Opportunities'
						value='24'
						description='Currently open funding opportunities'
						href='/funding/opportunities'
						linkText='View All'
					/>
					<DashboardCard
						title='Upcoming Deadlines'
						value='8'
						description='Applications due in the next 30 days'
						href='/timeline'
						linkText='View Timeline'
					/>
					<DashboardCard
						title='Active Legislation'
						value='12'
						description='Bills and policies in progress'
						href='/legislation/bills'
						linkText='View Bills'
					/>
					<DashboardCard
						title='Client Matches'
						value='36'
						description='New potential matches for clients'
						href='/clients'
						linkText='View Matches'
					/>
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					<Card>
						<CardHeader>
							<CardTitle>Recent Opportunities</CardTitle>
							<CardDescription>
								Latest funding opportunities added
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className='space-y-4'>
								{recentOpportunities.map((item, index) => (
									<li key={index} className='border-b pb-2 last:border-0'>
										<div className='font-medium'>{item.title}</div>
										<div className='text-sm text-muted-foreground'>
											{item.source}
										</div>
										<div className='flex justify-between items-center mt-1'>
											<span className='text-sm'>Closes: {item.closeDate}</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${
													item.status === 'Open'
														? 'bg-green-100 text-green-800'
														: 'bg-yellow-100 text-yellow-800'
												}`}>
												{item.status}
											</span>
										</div>
									</li>
								))}
							</ul>
							<div className='mt-4'>
								<Button variant='outline' className='w-full' asChild>
									<a href='/funding/opportunities'>View All Opportunities</a>
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Legislative Updates</CardTitle>
							<CardDescription>
								Recent changes to tracked legislation
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className='space-y-4'>
								{legislativeUpdates.map((item, index) => (
									<li key={index} className='border-b pb-2 last:border-0'>
										<div className='font-medium'>{item.title}</div>
										<div className='text-sm text-muted-foreground'>
											{item.jurisdiction}
										</div>
										<div className='flex justify-between items-center mt-1'>
											<span className='text-sm'>Updated: {item.date}</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
													item.status
												)}`}>
												{item.status}
											</span>
										</div>
									</li>
								))}
							</ul>
							<div className='mt-4'>
								<Button variant='outline' className='w-full' asChild>
									<a href='/legislation/bills'>View All Legislation</a>
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Upcoming Deadlines</CardTitle>
							<CardDescription>Applications due soon</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className='space-y-4'>
								{upcomingDeadlines.map((item, index) => (
									<li key={index} className='border-b pb-2 last:border-0'>
										<div className='font-medium'>{item.title}</div>
										<div className='text-sm text-muted-foreground'>
											{item.source}
										</div>
										<div className='flex justify-between items-center mt-1'>
											<span className='text-sm'>Due: {item.dueDate}</span>
											<span
												className={`text-xs px-2 py-1 rounded-full ${getDaysColor(
													item.daysLeft
												)}`}>
												{item.daysLeft} days left
											</span>
										</div>
									</li>
								))}
							</ul>
							<div className='mt-4'>
								<Button variant='outline' className='w-full' asChild>
									<a href='/timeline'>View Timeline</a>
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className='grid gap-6 md:grid-cols-3'>
					<Card className='md:col-span-2'>
						<CardHeader>
							<CardTitle>Funding by Category</CardTitle>
							<CardDescription>
								Distribution of available funding by category
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='h-80 flex items-center justify-center border rounded-md bg-muted/20'>
								<p className='text-muted-foreground'>
									Chart visualization will be implemented here
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
							<CardDescription>Common tasks and shortcuts</CardDescription>
						</CardHeader>
						<CardContent>
							<div className='space-y-2'>
								<Button
									className='w-full justify-start'
									variant='outline'
									asChild>
									<a href='/funding/opportunities'>Browse Opportunities</a>
								</Button>
								<Button
									className='w-full justify-start'
									variant='outline'
									asChild>
									<a href='/funding/map'>View Funding Map</a>
								</Button>
								<Button
									className='w-full justify-start'
									variant='outline'
									asChild>
									<a href='/legislation/bills'>Track Legislation</a>
								</Button>
								<Button
									className='w-full justify-start'
									variant='outline'
									asChild>
									<a href='/clients'>Match Clients</a>
								</Button>
								<Button
									className='w-full justify-start'
									variant='outline'
									asChild>
									<a href='/timeline'>View Timeline</a>
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Recent Activity Section */}
				<div className='mb-8'>
					<h2 className='text-xl font-semibold mb-4'>Recent Activity</h2>
					<div className='border rounded-lg overflow-hidden'>
						<div className='bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b'>
							<div className='flex justify-between items-center'>
								<span className='font-medium'>Latest Updates</span>
								<Button variant='outline' size='sm'>
									View All
								</Button>
							</div>
						</div>
						<div className='divide-y'>
							{activityItems.map((item, index) => (
								<div key={index} className='p-4 flex items-start gap-3'>
									<div
										className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(
											item.type
										)}`}></div>
									<div className='flex-1'>
										<div className='flex justify-between'>
											<span className='font-medium text-sm'>{item.title}</span>
											<span className='text-xs text-neutral-500'>
												{item.date}
											</span>
										</div>
										<p className='text-sm text-neutral-600 dark:text-neutral-400 mt-1'>
											{item.description}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Upcoming Deadlines Section */}
				<div className='mb-8'>
					<h2 className='text-xl font-semibold mb-4'>Upcoming Deadlines</h2>
					<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
						{upcomingDeadlines.map((deadline, index) => (
							<Card key={index} className='overflow-hidden'>
								<div className={`h-1 ${getDaysColor(deadline.daysLeft)}`}></div>
								<CardHeader className='pb-2'>
									<div className='flex justify-between'>
										<CardTitle className='text-base'>
											{deadline.title}
										</CardTitle>
										<span
											className={`text-xs px-2 py-1 rounded-full ${getDaysColor(
												deadline.daysLeft
											)} bg-opacity-10`}>
											{deadline.daysLeft} days left
										</span>
									</div>
									<CardDescription className='text-xs'>
										{deadline.agency}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className='text-sm mb-3'>{deadline.description}</p>
									<div className='flex justify-between items-center'>
										<span className='text-xs text-neutral-500'>
											Due: {deadline.dueDate}
										</span>
										<Button size='sm' variant='outline'>
											View Details
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

function DashboardCard({ title, value, description, href, linkText }) {
	return (
		<Card className='overflow-hidden'>
			<div className='h-1 bg-blue-500'></div>
			<CardHeader className='pb-2'>
				<CardTitle className='text-sm font-medium'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
					{value}
				</div>
				<p className='text-xs text-neutral-500 dark:text-neutral-400 mt-1'>
					{description}
				</p>
				<div className='mt-4'>
					<Button
						variant='ghost'
						size='sm'
						className='px-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
						asChild>
						<a href={href}>{linkText} →</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function getStatusColor(status) {
	switch (status) {
		case 'opportunity':
			return 'bg-blue-500';
		case 'legislation':
			return 'bg-purple-500';
		case 'match':
			return 'bg-green-500';
		case 'deadline':
			return 'bg-red-500';
		case 'policy':
			return 'bg-amber-500';
		case 'Introduced':
			return 'bg-blue-100 text-blue-800';
		case 'Committee':
			return 'bg-purple-100 text-purple-800';
		case 'Passed':
			return 'bg-green-100 text-green-800';
		case 'Failed':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

function getDaysColor(days) {
	if (days <= 7) return 'bg-red-100 text-red-800';
	if (days <= 14) return 'bg-yellow-100 text-yellow-800';
	return 'bg-blue-100 text-blue-800';
}

// Sample data for the dashboard
const activityItems = [
	{
		title: 'New Funding Opportunity',
		date: '2 hours ago',
		type: 'opportunity',
		description:
			'Department of Energy released a new $50M funding opportunity for building electrification projects.',
	},
	{
		title: 'Legislation Update',
		date: '4 hours ago',
		type: 'legislation',
		description:
			'H.R. 123: Building Efficiency Act has moved to committee review.',
	},
	{
		title: 'Client Match',
		date: 'Yesterday',
		type: 'match',
		description:
			'Springfield School District matched with 3 new funding opportunities.',
	},
	{
		title: 'Deadline Approaching',
		date: 'Yesterday',
		type: 'deadline',
		description:
			'Energy Efficiency Block Grants application deadline is in 5 days.',
	},
	{
		title: 'New Policy Brief',
		date: '2 days ago',
		type: 'policy',
		description:
			'New analysis on the impact of recent energy efficiency legislation on funding availability.',
	},
];

const recentOpportunities = [
	{
		title: 'Building Energy Efficiency Grant',
		source: 'Department of Energy',
		closeDate: 'Apr 15, 2023',
		status: 'Open',
	},
	{
		title: 'School Modernization Program',
		source: 'Department of Education',
		closeDate: 'May 1, 2023',
		status: 'Open',
	},
	{
		title: 'Clean Energy Innovation Fund',
		source: 'California Energy Commission',
		closeDate: 'Apr 30, 2023',
		status: 'Open',
	},
	{
		title: 'Community Climate Resilience Grant',
		source: 'EPA',
		closeDate: 'May 15, 2023',
		status: 'Upcoming',
	},
];

const legislativeUpdates = [
	{
		title: 'H.R. 123: Building Efficiency Act',
		jurisdiction: 'Federal',
		date: 'Mar 28, 2023',
		status: 'Committee',
	},
	{
		title: 'S.B. 456: Clean Energy Schools Initiative',
		jurisdiction: 'California',
		date: 'Mar 25, 2023',
		status: 'Introduced',
	},
	{
		title: 'H.R. 789: Infrastructure Investment Act',
		jurisdiction: 'Federal',
		date: 'Mar 22, 2023',
		status: 'Passed',
	},
	{
		title: 'A.B. 567: Building Standards Update',
		jurisdiction: 'California',
		date: 'Mar 20, 2023',
		status: 'Committee',
	},
];

const upcomingDeadlines = [
	{
		title: 'Energy Efficiency Block Grants',
		agency: 'Department of Energy',
		dueDate: 'Apr 5, 2023',
		daysLeft: 5,
		description:
			'Funding for local governments to implement energy efficiency improvements in public buildings and facilities.',
	},
	{
		title: 'School HVAC Improvement Program',
		agency: 'California Energy Commission',
		dueDate: 'Apr 10, 2023',
		daysLeft: 10,
		description:
			'Grants for K-12 schools to upgrade HVAC systems for improved energy efficiency and indoor air quality.',
	},
	{
		title: 'Clean School Bus Program',
		agency: 'EPA',
		dueDate: 'Apr 15, 2023',
		daysLeft: 15,
		description:
			'Funding to replace existing diesel school buses with zero-emission and clean alternatives.',
	},
	{
		title: 'Building Retrofit Incentives',
		agency: 'Department of Energy',
		dueDate: 'Apr 20, 2023',
		daysLeft: 20,
		description:
			'Financial incentives for commercial building owners to implement energy-saving retrofits and upgrades.',
	},
];

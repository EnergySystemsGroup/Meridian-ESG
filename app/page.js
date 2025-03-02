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
				<h1 className='text-4xl font-bold mb-6'>
					Policy & Funding Intelligence Dashboard
				</h1>

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
						value='16'
						description='Bills and policies being tracked'
						href='/legislation/bills'
						linkText='View Bills'
					/>
					<DashboardCard
						title='Total Available Funding'
						value='$1.2B'
						description='Across all open opportunities'
						href='/funding/map'
						linkText='View Map'
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
			</div>
		</MainLayout>
	);
}

function DashboardCard({ title, value, description, href, linkText }) {
	return (
		<Card>
			<CardHeader className='flex flex-row items-center justify-between pb-2'>
				<CardTitle className='text-sm font-medium'>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className='text-2xl font-bold'>{value}</div>
				<p className='text-xs text-muted-foreground'>{description}</p>
				<div className='mt-4'>
					<Button variant='ghost' size='sm' className='px-0' asChild>
						<a href={href}>{linkText} →</a>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function getStatusColor(status) {
	switch (status) {
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
		source: 'Department of Energy',
		dueDate: 'Apr 5, 2023',
		daysLeft: 5,
	},
	{
		title: 'School HVAC Improvement Program',
		source: 'California Energy Commission',
		dueDate: 'Apr 10, 2023',
		daysLeft: 10,
	},
	{
		title: 'Clean School Bus Program',
		source: 'EPA',
		dueDate: 'Apr 15, 2023',
		daysLeft: 15,
	},
	{
		title: 'Building Retrofit Incentives',
		source: 'Department of Energy',
		dueDate: 'Apr 20, 2023',
		daysLeft: 20,
	},
];

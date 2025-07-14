import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function LegislationPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<Alert variant='warning' className='mb-6 bg-amber-50 border-amber-300'>
					<AlertTriangle className='h-4 w-4 text-amber-500' />
					<AlertTitle className='text-amber-600'>Demo Data</AlertTitle>
					<AlertDescription className='text-amber-700'>
						This section currently displays sample data for demonstration
						purposes only. Live legislative data integration is coming soon.
					</AlertDescription>
				</Alert>

				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Legislation Tracker</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button variant='outline'>Sort</Button>
						<Button>Export</Button>
					</div>
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{bills.map((bill) => (
						<BillCard key={`${bill.jurisdiction}-${bill.number}`} bill={bill} />
					))}
				</div>
			</div>
		</MainLayout>
	);
}

function BillCard({ bill }) {
	const {
		title,
		number,
		jurisdiction,
		status,
		lastAction,
		summary,
		tags,
		relevance,
	} = bill;

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{title}</CardTitle>
					<span
						className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
							status
						)}`}>
						{status}
					</span>
				</div>
				<CardDescription>
					{number} | {jurisdiction}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<p className='text-sm text-muted-foreground line-clamp-2'>
						{summary}
					</p>

					<div className='flex flex-wrap gap-1'>
						{tags.map((tag) => (
							<span
								key={`${number}-${tag}`}
								className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
					</div>

					<div className='grid grid-cols-2 gap-2 text-sm'>
						<div>
							<div className='text-muted-foreground'>Last Action</div>
							<div className='font-medium'>{lastAction.date}</div>
						</div>
						<div>
							<div className='text-muted-foreground'>Relevance</div>
							<div className='flex items-center'>
								<div className='w-full bg-secondary rounded-full h-2 mr-2'>
									<div
										className='bg-primary h-2 rounded-full'
										style={{ width: `${relevance}%` }}></div>
								</div>
								<span>{relevance}%</span>
							</div>
						</div>
					</div>

					<Button className='w-full'>View Details</Button>
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

// Sample data
const bills = [
	{
		title: 'Building Energy Efficiency Act',
		number: 'H.R. 123',
		jurisdiction: 'Federal',
		status: 'Committee',
		lastAction: {
			action: 'Referred to Subcommittee on Energy',
			date: 'Mar 28, 2025',
		},
		summary:
			'Establishes new energy efficiency standards for commercial buildings and provides funding for retrofits and upgrades to meet these standards.',
		tags: ['Energy Efficiency', 'Commercial', 'Standards'],
		relevance: 85,
	},
	{
		title: 'Clean Energy Schools Initiative',
		number: 'S.B. 456',
		jurisdiction: 'California',
		status: 'Introduced',
		lastAction: {
			action: 'Introduced in Senate',
			date: 'Mar 15, 2025',
		},
		summary:
			'Provides funding for K-12 schools to implement clean energy projects including solar installations, energy efficiency upgrades, and electric vehicle infrastructure.',
		tags: ['K-12', 'Clean Energy', 'California'],
		relevance: 90,
	},
	{
		title: 'Infrastructure Investment Act',
		number: 'H.R. 789',
		jurisdiction: 'Federal',
		status: 'Passed',
		lastAction: {
			action: 'Signed by President',
			date: 'Apr 02, 2025',
		},
		summary:
			'Comprehensive infrastructure bill that includes significant funding for energy efficiency improvements in public buildings and transportation electrification.',
		tags: ['Infrastructure', 'Public Buildings', 'Transportation'],
		relevance: 75,
	},
	{
		title: 'Building Standards Update',
		number: 'A.B. 567',
		jurisdiction: 'California',
		status: 'Committee',
		lastAction: {
			action:
				'Hearing scheduled in Assembly Committee on Housing and Community Development',
			date: 'Mar 10, 2025',
		},
		summary:
			'Updates building energy codes to require higher efficiency standards and electrification readiness in new construction and major renovations.',
		tags: ['Building Codes', 'Electrification', 'California'],
		relevance: 80,
	},
	{
		title: 'Renewable Energy Tax Credit Extension',
		number: 'S. 345',
		jurisdiction: 'Federal',
		status: 'Introduced',
		lastAction: {
			action: 'Introduced in Senate',
			date: 'Feb 05, 2025',
		},
		summary:
			'Extends and expands tax credits for renewable energy installations including solar, wind, and geothermal systems for commercial and residential buildings.',
		tags: ['Tax Credits', 'Renewable Energy', 'Federal'],
		relevance: 70,
	},
	{
		title: 'School Facility Modernization Act',
		number: 'H.R. 567',
		jurisdiction: 'Federal',
		status: 'Committee',
		lastAction: {
			action: 'Hearing in House Education Committee',
			date: 'Mar 30, 2025',
		},
		summary:
			'Authorizes funding for K-12 school facility improvements with emphasis on energy efficiency, indoor air quality, and modernization of learning environments.',
		tags: ['K-12', 'Facilities', 'Federal'],
		relevance: 95,
	},
	{
		title: 'Clean Transportation Initiative',
		number: 'S.B. 789',
		jurisdiction: 'Oregon',
		status: 'Passed',
		lastAction: {
			action: 'Signed by Governor',
			date: 'Mar 25, 2025',
		},
		summary:
			'Establishes incentives and requirements for transportation electrification including EV charging infrastructure at public buildings and schools.',
		tags: ['Transportation', 'Electrification', 'Oregon'],
		relevance: 65,
	},
	{
		title: 'Energy Storage Incentive Program',
		number: 'H.B. 234',
		jurisdiction: 'Washington',
		status: 'Committee',
		lastAction: {
			action: 'Passed House Committee on Energy',
			date: 'Apr 01, 2025',
		},
		summary:
			'Creates incentives for installation of energy storage systems paired with renewable energy generation at commercial and institutional facilities.',
		tags: ['Energy Storage', 'Renewable Energy', 'Washington'],
		relevance: 75,
	},
	{
		title: 'Zero Emission Building Standard',
		number: 'S.B. 301',
		jurisdiction: 'California',
		status: 'Introduced',
		lastAction: {
			action: 'Introduced in Senate',
			date: 'Mar 08, 2025',
		},
		summary:
			'Establishes timeline and requirements for new construction to achieve zero net carbon emissions through efficiency, electrification, and renewable energy.',
		tags: ['Zero Emissions', 'Building Standards', 'California'],
		relevance: 85,
	},
];

import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';

export default function OpportunitiesPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Funding Opportunities</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button variant='outline'>Sort</Button>
						<Button>Export</Button>
					</div>
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{opportunities.map((opportunity, index) => (
						<OpportunityCard key={index} opportunity={opportunity} />
					))}
				</div>
			</div>
		</MainLayout>
	);
}

function OpportunityCard({ opportunity }) {
	const { title, source, amount, closeDate, status, description, tags } =
		opportunity;

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{title}</CardTitle>
					<span
						className={`text-xs px-2 py-1 rounded-full ${
							status === 'Open'
								? 'bg-green-100 text-green-800'
								: status === 'Upcoming'
								? 'bg-yellow-100 text-yellow-800'
								: 'bg-gray-100 text-gray-800'
						}`}>
						{status}
					</span>
				</div>
				<CardDescription>{source}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<p className='text-sm text-muted-foreground line-clamp-2'>
						{description}
					</p>

					<div className='flex flex-wrap gap-1'>
						{tags.map((tag, index) => (
							<span
								key={index}
								className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
					</div>

					<div className='grid grid-cols-2 gap-2 text-sm'>
						<div>
							<div className='text-muted-foreground'>Amount</div>
							<div className='font-medium'>{amount}</div>
						</div>
						<div>
							<div className='text-muted-foreground'>Closes</div>
							<div className='font-medium'>{closeDate}</div>
						</div>
					</div>

					<Button className='w-full'>View Details</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// Sample data
const opportunities = [
	{
		title: 'Building Energy Efficiency Grant',
		source: 'Department of Energy',
		amount: '$500K - $2M',
		closeDate: 'Apr 15, 2023',
		status: 'Open',
		description:
			'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.',
		tags: ['Energy Efficiency', 'Commercial', 'Federal'],
	},
	{
		title: 'School Modernization Program',
		source: 'Department of Education',
		amount: '$1M - $5M',
		closeDate: 'May 1, 2023',
		status: 'Open',
		description:
			'Grants for K-12 schools to modernize facilities with a focus on energy efficiency, indoor air quality, and sustainability improvements.',
		tags: ['K-12', 'Modernization', 'Federal'],
	},
	{
		title: 'Clean Energy Innovation Fund',
		source: 'California Energy Commission',
		amount: '$250K - $1M',
		closeDate: 'Apr 30, 2023',
		status: 'Open',
		description:
			'Funding for innovative clean energy projects that reduce greenhouse gas emissions and promote energy independence.',
		tags: ['Clean Energy', 'Innovation', 'California'],
	},
	{
		title: 'Community Climate Resilience Grant',
		source: 'EPA',
		amount: '$100K - $500K',
		closeDate: 'May 15, 2023',
		status: 'Upcoming',
		description:
			'Support for communities to develop and implement climate resilience strategies, including building upgrades and infrastructure improvements.',
		tags: ['Climate', 'Resilience', 'Federal'],
	},
	{
		title: 'Municipal Building Retrofit Program',
		source: 'Department of Energy',
		amount: '$500K - $3M',
		closeDate: 'Jun 1, 2023',
		status: 'Upcoming',
		description:
			'Funding for local governments to retrofit municipal buildings for improved energy efficiency and reduced operational costs.',
		tags: ['Municipal', 'Retrofit', 'Federal'],
	},
	{
		title: 'Solar for Schools Initiative',
		source: 'California Energy Commission',
		amount: '$100K - $750K',
		closeDate: 'May 20, 2023',
		status: 'Open',
		description:
			'Grants to install solar photovoltaic systems on K-12 school facilities to reduce energy costs and provide educational opportunities.',
		tags: ['Solar', 'K-12', 'California'],
	},
	{
		title: 'Building Electrification Program',
		source: 'Oregon Department of Energy',
		amount: '$50K - $250K',
		closeDate: 'Jun 15, 2023',
		status: 'Upcoming',
		description:
			'Incentives for building owners to convert from fossil fuel systems to electric alternatives for heating, cooling, and water heating.',
		tags: ['Electrification', 'Oregon', 'State'],
	},
	{
		title: 'Energy Storage Demonstration Grant',
		source: 'Department of Energy',
		amount: '$1M - $4M',
		closeDate: 'Jul 1, 2023',
		status: 'Upcoming',
		description:
			'Funding for demonstration projects that integrate energy storage with renewable energy systems in commercial and institutional buildings.',
		tags: ['Energy Storage', 'Renewable', 'Federal'],
	},
	{
		title: 'Zero Emission School Bus Program',
		source: 'EPA',
		amount: '$300K - $2M',
		closeDate: 'May 30, 2023',
		status: 'Open',
		description:
			'Grants to replace diesel school buses with zero-emission electric buses and install necessary charging infrastructure.',
		tags: ['Electric Vehicles', 'K-12', 'Federal'],
	},
];

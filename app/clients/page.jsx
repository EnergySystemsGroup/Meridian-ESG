import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';

export default function ClientsPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Client Matching</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Filter</Button>
						<Button>Add Client</Button>
					</div>
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{clients.map((client, index) => (
						<ClientCard key={index} client={client} />
					))}
				</div>
			</div>
		</MainLayout>
	);
}

function ClientCard({ client }) {
	const { name, type, location, matchCount, topMatches, tags } = client;

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{name}</CardTitle>
					<span className='text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'>
						{type}
					</span>
				</div>
				<CardDescription>{location}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className='space-y-4'>
					<div className='flex flex-wrap gap-1 mb-2'>
						{tags.map((tag, index) => (
							<span
								key={index}
								className='text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
					</div>

					<div>
						<div className='text-sm font-medium mb-2'>
							Top Opportunity Matches ({matchCount})
						</div>
						<ul className='space-y-2'>
							{topMatches.map((match, index) => (
								<li
									key={index}
									className='text-sm border-l-2 border-blue-500 pl-3 py-1'>
									<div className='font-medium'>{match.title}</div>
									<div className='flex justify-between items-center'>
										<span className='text-xs text-gray-500 dark:text-gray-400'>
											{match.source}
										</span>
										<span className='text-xs font-medium'>
											{match.score}% match
										</span>
									</div>
								</li>
							))}
						</ul>
					</div>

					<div className='flex gap-2'>
						<Button className='w-full' size='sm'>
							View Profile
						</Button>
						<Button className='w-full' variant='outline' size='sm'>
							View Matches
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Sample data
const clients = [
	{
		name: 'Springfield School District',
		type: 'K-12',
		location: 'Springfield, CA',
		matchCount: 12,
		topMatches: [
			{
				title: 'School Modernization Program',
				source: 'Department of Education',
				score: 95,
			},
			{
				title: 'Clean Energy Schools Initiative',
				source: 'California Energy Commission',
				score: 90,
			},
			{
				title: 'Zero Emission School Bus Program',
				source: 'EPA',
				score: 85,
			},
		],
		tags: ['K-12', 'California', 'Public'],
	},
	{
		name: 'Oakdale Community College',
		type: 'Higher Ed',
		location: 'Oakdale, CA',
		matchCount: 8,
		topMatches: [
			{
				title: 'Building Energy Efficiency Grant',
				source: 'Department of Energy',
				score: 88,
			},
			{
				title: 'Clean Energy Innovation Fund',
				source: 'California Energy Commission',
				score: 82,
			},
			{
				title: 'Community Climate Resilience Grant',
				source: 'EPA',
				score: 75,
			},
		],
		tags: ['Higher Ed', 'California', 'Public'],
	},
	{
		name: 'Riverdale City Government',
		type: 'Municipal',
		location: 'Riverdale, OR',
		matchCount: 10,
		topMatches: [
			{
				title: 'Municipal Building Retrofit Program',
				source: 'Department of Energy',
				score: 92,
			},
			{
				title: 'Building Electrification Program',
				source: 'Oregon Department of Energy',
				score: 88,
			},
			{
				title: 'Community Climate Resilience Grant',
				source: 'EPA',
				score: 80,
			},
		],
		tags: ['Municipal', 'Oregon', 'Government'],
	},
	{
		name: 'Westview School District',
		type: 'K-12',
		location: 'Westview, WA',
		matchCount: 9,
		topMatches: [
			{
				title: 'School Modernization Program',
				source: 'Department of Energy',
				score: 90,
			},
			{
				title: 'Energy Storage Incentive Program',
				source: 'Washington State',
				score: 85,
			},
			{
				title: 'Zero Emission School Bus Program',
				source: 'EPA',
				score: 82,
			},
		],
		tags: ['K-12', 'Washington', 'Public'],
	},
	{
		name: 'Lakeside County Government',
		type: 'County',
		location: 'Lakeside County, CA',
		matchCount: 11,
		topMatches: [
			{
				title: 'Building Energy Efficiency Grant',
				source: 'Department of Energy',
				score: 87,
			},
			{
				title: 'Clean Energy Innovation Fund',
				source: 'California Energy Commission',
				score: 85,
			},
			{
				title: 'Infrastructure Investment Act Funding',
				source: 'Federal',
				score: 80,
			},
		],
		tags: ['County', 'California', 'Government'],
	},
	{
		name: 'Greenfield University',
		type: 'Higher Ed',
		location: 'Greenfield, OR',
		matchCount: 7,
		topMatches: [
			{
				title: 'Building Energy Efficiency Grant',
				source: 'Department of Energy',
				score: 89,
			},
			{
				title: 'Building Electrification Program',
				source: 'Oregon Department of Energy',
				score: 84,
			},
			{
				title: 'Energy Storage Demonstration Grant',
				source: 'Department of Energy',
				score: 78,
			},
		],
		tags: ['Higher Ed', 'Oregon', 'Private'],
	},
	{
		name: 'Sunnyvale School District',
		type: 'K-12',
		location: 'Sunnyvale, CA',
		matchCount: 14,
		topMatches: [
			{
				title: 'School Modernization Program',
				source: 'Department of Education',
				score: 96,
			},
			{
				title: 'Solar for Schools Initiative',
				source: 'California Energy Commission',
				score: 93,
			},
			{
				title: 'Clean Energy Schools Initiative',
				source: 'California',
				score: 90,
			},
		],
		tags: ['K-12', 'California', 'Public'],
	},
	{
		name: 'Pinecrest City Government',
		type: 'Municipal',
		location: 'Pinecrest, WA',
		matchCount: 9,
		topMatches: [
			{
				title: 'Municipal Building Retrofit Program',
				source: 'Department of Energy',
				score: 91,
			},
			{
				title: 'Energy Storage Incentive Program',
				source: 'Washington State',
				score: 86,
			},
			{
				title: 'Community Climate Resilience Grant',
				source: 'EPA',
				score: 79,
			},
		],
		tags: ['Municipal', 'Washington', 'Government'],
	},
	{
		name: 'Redwood Community College',
		type: 'Higher Ed',
		location: 'Redwood, CA',
		matchCount: 10,
		topMatches: [
			{
				title: 'Building Energy Efficiency Grant',
				source: 'Department of Energy',
				score: 90,
			},
			{
				title: 'Clean Energy Innovation Fund',
				source: 'California Energy Commission',
				score: 87,
			},
			{
				title: 'Energy Storage Demonstration Grant',
				source: 'Department of Energy',
				score: 82,
			},
		],
		tags: ['Higher Ed', 'California', 'Public'],
	},
];

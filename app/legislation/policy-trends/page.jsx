import MainLayout from '@/components/layout/main-layout';
import { TrendingUp } from 'lucide-react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PolicyTrendsPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Policy Trends Analysis</h1>
				</div>

				<Card className='border-2 border-dashed border-muted-foreground/20'>
					<CardHeader>
						<div className='flex items-center space-x-2'>
							<TrendingUp className='h-5 w-5 text-green-500' />
							<CardTitle>Coming Soon</CardTitle>
						</div>
						<CardDescription>
							This feature is currently under development
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col items-center justify-center space-y-4 p-6'>
						<div className='rounded-full bg-green-50 p-6'>
							<svg
								className='h-12 w-12 text-green-500'
								xmlns='http://www.w3.org/2000/svg'
								width='24'
								height='24'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'>
								<path d='m22 7-8.5 8.5-5-5L2 17' />
								<path d='M16 7h6v6' />
							</svg>
						</div>
						<div className='max-w-md text-center'>
							<p className='mb-4 text-muted-foreground'>
								The Policy Trends feature will identify emerging patterns and
								shifts in policy focus across multiple jurisdictions. Track how
								energy, sustainability, and infrastructure policies are evolving
								and get ahead of upcoming regulatory changes before they impact
								your organization.
							</p>
							<Button variant='outline' asChild>
								<Link href='/legislation/bills'>View Current Legislation</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</MainLayout>
	);
}

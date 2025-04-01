import MainLayout from '@/app/components/layout/main-layout';
import { LineChart } from 'lucide-react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

export default function ImpactAnalysisPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Legislative Impact Analysis</h1>
				</div>

				<Card className='border-2 border-dashed border-muted-foreground/20'>
					<CardHeader>
						<div className='flex items-center space-x-2'>
							<LineChart className='h-5 w-5 text-purple-500' />
							<CardTitle>Coming Soon</CardTitle>
						</div>
						<CardDescription>
							This feature is currently under development
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col items-center justify-center space-y-4 p-6'>
						<div className='rounded-full bg-purple-50 p-6'>
							<svg
								className='h-12 w-12 text-purple-500'
								xmlns='http://www.w3.org/2000/svg'
								width='24'
								height='24'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'>
								<path d='M3 3v18h18' />
								<path d='m19 9-5 5-4-4-3 3' />
							</svg>
						</div>
						<div className='max-w-md text-center'>
							<p className='mb-4 text-muted-foreground'>
								The Impact Analysis feature will provide detailed assessments of
								how pending and passed legislation may affect your organization,
								clients, and sectors. Quantitative and qualitative analyses will
								help you understand potential outcomes and prepare accordingly.
							</p>
							<Button variant='outline' asChild>
								<a href='/legislation/bills'>View Current Legislation</a>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</MainLayout>
	);
}

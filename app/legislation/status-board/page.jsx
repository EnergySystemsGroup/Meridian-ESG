import MainLayout from '@/app/components/layout/main-layout';
import { AlertTriangle } from 'lucide-react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

export default function StatusBoardPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Legislation Status Board</h1>
				</div>

				<Card className='border-2 border-dashed border-muted-foreground/20'>
					<CardHeader>
						<div className='flex items-center space-x-2'>
							<AlertTriangle className='h-5 w-5 text-blue-500' />
							<CardTitle>Coming Soon</CardTitle>
						</div>
						<CardDescription>
							This feature is currently under development
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-col items-center justify-center space-y-4 p-6'>
						<div className='rounded-full bg-blue-50 p-6'>
							<svg
								className='h-12 w-12 text-blue-500'
								xmlns='http://www.w3.org/2000/svg'
								width='24'
								height='24'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'>
								<rect width='18' height='18' x='3' y='3' rx='2' />
								<path d='M8 12h8' />
								<path d='M12 8v8' />
							</svg>
						</div>
						<div className='max-w-md text-center'>
							<p className='mb-4 text-muted-foreground'>
								The Status Board will provide a visual overview of legislation
								progress, tracking key milestones and statuses across all
								monitored bills. Check back soon as we complete this feature!
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

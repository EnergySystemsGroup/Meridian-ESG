import MainLayout from '@/components/layout/main-layout';
import { AlertTriangle } from 'lucide-react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';

export default function BillTrackerPage() {
	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Bill Tracker</h1>
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
								<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
								<polyline points='14 2 14 8 20 8' />
								<line x1='16' y1='13' x2='8' y2='13' />
								<line x1='16' y1='17' x2='8' y2='17' />
								<polyline points='10 9 9 9 8 9' />
							</svg>
						</div>
						<div className='max-w-md text-center'>
							<p className='mb-4 text-muted-foreground'>
								The Bill Tracker will help you monitor relevant legislation and
								policy changes affecting your organization. Track bills through
								their legislative journey and stay informed on key policy
								developments. Check back soon as we complete this feature!
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</MainLayout>
	);
}

import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
	return (
		<div className='container flex flex-col items-center justify-center min-h-[70vh] py-12 text-center'>
			<h1 className='text-6xl font-bold mb-4'>404</h1>
			<h2 className='text-2xl font-semibold mb-6'>Page Not Found</h2>
			<p className='text-muted-foreground mb-8 max-w-md'>
				The page you are looking for doesn't exist or has been moved.
			</p>
			<Button asChild>
				<Link href='/'>
					<ArrowLeft className='mr-2 h-4 w-4' />
					Return to Home
				</Link>
			</Button>
		</div>
	);
}

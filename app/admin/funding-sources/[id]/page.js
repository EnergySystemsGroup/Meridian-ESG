'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function FundingSourceDetail() {
	const params = useParams();
	const router = useRouter();
	const supabase = createClientComponentClient();
	const [source, setSource] = useState(null);
	const [loading, setLoading] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [opportunities, setOpportunities] = useState([]);
	const [loadingOpportunities, setLoadingOpportunities] = useState(true);

	useEffect(() => {
		async function fetchSource() {
			try {
				setLoading(true);
				const { data, error } = await supabase
					.from('funding_sources')
					.select('*')
					.eq('id', params.id)
					.single();

				if (error) throw error;
				setSource(data);
			} catch (error) {
				console.error('Error fetching funding source:', error);
				toast.error('Failed to load funding source');
			} finally {
				setLoading(false);
			}
		}

		async function fetchOpportunities() {
			try {
				setLoadingOpportunities(true);
				const { data, error } = await supabase
					.from('funding_opportunities')
					.select('id, title, status, open_date, close_date')
					.eq('source_id', params.id)
					.order('created_at', { ascending: false })
					.limit(10);

				if (error) throw error;
				setOpportunities(data || []);
			} catch (error) {
				console.error('Error fetching opportunities:', error);
				toast.error('Failed to load opportunities');
			} finally {
				setLoadingOpportunities(false);
			}
		}

		fetchSource();
		fetchOpportunities();
	}, [params.id, supabase]);

	const handleDelete = async () => {
		if (
			!confirm(
				'Are you sure you want to delete this funding source? This action cannot be undone.'
			)
		) {
			return;
		}

		try {
			setDeleting(true);
			const { error } = await supabase
				.from('funding_sources')
				.delete()
				.eq('id', params.id);

			if (error) throw error;
			toast.success('Funding source deleted successfully');
			router.push('/admin/funding-sources');
		} catch (error) {
			console.error('Error deleting funding source:', error);
			toast.error('Failed to delete funding source');
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/admin/funding-sources'>
							<ArrowLeft className='mr-2 h-4 w-4' />
							Back to Funding Sources
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<Skeleton className='h-8 w-1/3 mb-2' />
						<Skeleton className='h-4 w-1/2' />
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>
							<Skeleton className='h-4 w-full' />
							<Skeleton className='h-4 w-full' />
							<Skeleton className='h-4 w-2/3' />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!source) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/admin/funding-sources'>
							<ArrowLeft className='mr-2 h-4 w-4' />
							Back to Funding Sources
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Funding Source Not Found</CardTitle>
						<CardDescription>
							The requested funding source could not be found.
						</CardDescription>
					</CardHeader>
					<CardFooter>
						<Button asChild>
							<Link href='/admin/funding-sources'>
								Return to Funding Sources
							</Link>
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className='container py-8'>
			<div className='flex items-center justify-between mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href='/admin/funding-sources'>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Funding Sources
					</Link>
				</Button>
				<div className='flex space-x-2'>
					<Button variant='outline' size='sm' asChild>
						<Link href={`/admin/funding-sources/${params.id}/edit`}>
							<Edit className='mr-2 h-4 w-4' />
							Edit
						</Link>
					</Button>
					<Button
						variant='destructive'
						size='sm'
						onClick={handleDelete}
						disabled={deleting}>
						<Trash2 className='mr-2 h-4 w-4' />
						{deleting ? 'Deleting...' : 'Delete'}
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{source.name}</CardTitle>
					<CardDescription>Funding Source Details</CardDescription>
				</CardHeader>
				<CardContent>
					<div className='space-y-4'>
						<div>
							<h3 className='text-sm font-medium'>Type</h3>
							<p className='text-sm text-muted-foreground capitalize'>
								{source.type || 'Not specified'}
							</p>
						</div>
						<div>
							<h3 className='text-sm font-medium'>Agency Type</h3>
							<p className='text-sm text-muted-foreground capitalize'>
								{source.agency_type || 'Not specified'}
							</p>
						</div>
						<div>
							<h3 className='text-sm font-medium'>Description</h3>
							<p className='text-sm text-muted-foreground'>
								{source.description || 'No description provided'}
							</p>
						</div>
						{source.website && (
							<div>
								<h3 className='text-sm font-medium'>Website</h3>
								<p className='text-sm text-muted-foreground'>
									<a
										href={source.website}
										target='_blank'
										rel='noopener noreferrer'
										className='text-blue-600 hover:underline'>
										{source.website}
									</a>
								</p>
							</div>
						)}
						{source.contact_email && (
							<div>
								<h3 className='text-sm font-medium'>Contact Email</h3>
								<p className='text-sm text-muted-foreground'>
									<a
										href={`mailto:${source.contact_email}`}
										className='text-blue-600 hover:underline'>
										{source.contact_email}
									</a>
								</p>
							</div>
						)}
						{source.contact_phone && (
							<div>
								<h3 className='text-sm font-medium'>Contact Phone</h3>
								<p className='text-sm text-muted-foreground'>
									{source.contact_phone}
								</p>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<div className='mt-8'>
				<h2 className='text-xl font-semibold mb-4'>Recent Opportunities</h2>
				<Separator className='mb-4' />

				{loadingOpportunities ? (
					<div className='space-y-4'>
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
						<Skeleton className='h-12 w-full' />
					</div>
				) : opportunities.length > 0 ? (
					<div className='space-y-4'>
						{opportunities.map((opp) => (
							<Card key={opp.id}>
								<CardContent className='p-4'>
									<div className='flex justify-between items-center'>
										<div>
											<h3 className='font-medium'>{opp.title}</h3>
											<p className='text-sm text-muted-foreground'>
												{opp.status ? `Status: ${opp.status}` : ''}
												{opp.open_date
													? ` • Opens: ${new Date(
															opp.open_date
													  ).toLocaleDateString()}`
													: ''}
												{opp.close_date
													? ` • Closes: ${new Date(
															opp.close_date
													  ).toLocaleDateString()}`
													: ''}
											</p>
										</div>
										<Button variant='outline' size='sm' asChild>
											<Link href={`/admin/funding-opportunities/${opp.id}`}>
												View
											</Link>
										</Button>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<p className='text-muted-foreground'>
						No opportunities found for this funding source.
					</p>
				)}
			</div>
		</div>
	);
}

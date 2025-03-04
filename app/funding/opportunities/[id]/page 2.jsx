'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/app/components/layout/main-layout';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import {
	ArrowLeft,
	Calendar,
	DollarSign,
	FileText,
	Globe,
	Mail,
	MapPin,
	Building,
	Tag,
	Clock,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';

export default function OpportunityDetailPage() {
	const params = useParams();
	const router = useRouter();
	const [opportunity, setOpportunity] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		async function fetchOpportunityDetails() {
			try {
				setLoading(true);
				const response = await fetch('/api/funding', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ id: params.id }),
				});

				const result = await response.json();

				if (!result.success) {
					throw new Error(
						result.error || 'Failed to fetch opportunity details'
					);
				}

				setOpportunity(result.data);
			} catch (err) {
				console.error('Error fetching opportunity details:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		if (params.id) {
			fetchOpportunityDetails();
		}
	}, [params.id]);

	if (loading) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<div className='flex justify-center items-center min-h-[400px]'>
						<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
					</div>
				</div>
			</MainLayout>
		);
	}

	if (error) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<div className='bg-red-50 text-red-800 p-4 rounded-md'>
						<p>Error: {error}</p>
						<Button
							variant='outline'
							className='mt-2'
							onClick={() => router.back()}>
							Go Back
						</Button>
					</div>
				</div>
			</MainLayout>
		);
	}

	if (!opportunity) {
		return (
			<MainLayout>
				<div className='container py-10'>
					<div className='text-center py-12'>
						<h2 className='text-2xl font-bold mb-2'>Opportunity Not Found</h2>
						<p className='text-muted-foreground mb-6'>
							The funding opportunity you're looking for could not be found.
						</p>
						<Button onClick={() => router.back()}>Go Back</Button>
					</div>
				</div>
			</MainLayout>
		);
	}

	// Format data for display
	const status =
		opportunity.status ||
		determineStatus(opportunity.open_date, opportunity.close_date);
	const daysLeft = opportunity.close_date
		? calculateDaysLeft(opportunity.close_date)
		: null;

	const formatDate = (dateString) => {
		if (!dateString) return 'Not specified';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		});
	};

	const formatCurrency = (amount) => {
		if (!amount && amount !== 0) return 'Not specified';
		return `$${Number(amount).toLocaleString()}`;
	};

	return (
		<MainLayout>
			<div className='container py-10'>
				<Button
					variant='ghost'
					className='mb-6 pl-0'
					onClick={() => router.back()}>
					<ArrowLeft className='mr-2 h-4 w-4' />
					Back to Opportunities
				</Button>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					{/* Main Content */}
					<div className='lg:col-span-2 space-y-6'>
						<Card>
							<CardHeader>
								<div className='flex justify-between items-start'>
									<div>
										<CardTitle className='text-2xl'>
											{opportunity.title}
										</CardTitle>
										<CardDescription className='text-base mt-1'>
											{opportunity.source_name}
										</CardDescription>
									</div>
									<span
										className={`text-sm px-3 py-1 rounded-full ${
											status === 'Open'
												? 'bg-green-100 text-green-800'
												: status === 'Upcoming' || status === 'Anticipated'
												? 'bg-yellow-100 text-yellow-800'
												: 'bg-gray-100 text-gray-800'
										}`}>
										{status}
									</span>
								</div>
							</CardHeader>
							<CardContent>
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-medium mb-2'>Description</h3>
										<p className='text-muted-foreground'>
											{opportunity.description || 'No description available.'}
										</p>
									</div>

									{opportunity.program_name && (
										<div>
											<h3 className='text-lg font-medium mb-2'>Program</h3>
											<p className='text-muted-foreground'>
												{opportunity.program_name}
											</p>
										</div>
									)}

									{opportunity.eligibility_criteria && (
										<div>
											<h3 className='text-lg font-medium mb-2'>Eligibility</h3>
											<p className='text-muted-foreground'>
												{typeof opportunity.eligibility_criteria === 'object'
													? JSON.stringify(
															opportunity.eligibility_criteria,
															null,
															2
													  )
													: opportunity.eligibility_criteria}
											</p>
										</div>
									)}

									{opportunity.notes && (
										<div>
											<h3 className='text-lg font-medium mb-2'>
												Additional Notes
											</h3>
											<p className='text-muted-foreground'>
												{opportunity.notes}
											</p>
										</div>
									)}

									{opportunity.tags && opportunity.tags.length > 0 && (
										<div>
											<h3 className='text-lg font-medium mb-2'>Tags</h3>
											<div className='flex flex-wrap gap-2'>
												{opportunity.tags.map((tag, index) => (
													<span
														key={index}
														className='text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-full'>
														{tag}
													</span>
												))}
											</div>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						{(opportunity.application_url || opportunity.guidelines_url) && (
							<Card>
								<CardHeader>
									<CardTitle className='text-xl'>
										Application Resources
									</CardTitle>
								</CardHeader>
								<CardContent className='space-y-4'>
									{opportunity.application_url && (
										<div className='flex items-center'>
											<Globe className='h-5 w-5 mr-2 text-muted-foreground' />
											<a
												href={opportunity.application_url}
												target='_blank'
												rel='noopener noreferrer'
												className='text-blue-600 hover:underline'>
												Application Portal
											</a>
										</div>
									)}
									{opportunity.guidelines_url && (
										<div className='flex items-center'>
											<FileText className='h-5 w-5 mr-2 text-muted-foreground' />
											<a
												href={opportunity.guidelines_url}
												target='_blank'
												rel='noopener noreferrer'
												className='text-blue-600 hover:underline'>
												Guidelines Document
											</a>
										</div>
									)}
								</CardContent>
							</Card>
						)}
					</div>

					{/* Sidebar */}
					<div className='space-y-6'>
						<Card>
							<CardHeader>
								<CardTitle className='text-xl'>Key Details</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4'>
								<div className='flex items-start'>
									<DollarSign className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Award Amount</div>
										<div className='text-muted-foreground'>
											{opportunity.minimum_award && opportunity.maximum_award
												? `${formatCurrency(
														opportunity.minimum_award
												  )} - ${formatCurrency(opportunity.maximum_award)}`
												: opportunity.maximum_award
												? `Up to ${formatCurrency(opportunity.maximum_award)}`
												: opportunity.minimum_award
												? `From ${formatCurrency(opportunity.minimum_award)}`
												: 'Not specified'}
										</div>
										{opportunity.amount_available && (
											<div className='text-sm text-muted-foreground mt-1'>
												Total available:{' '}
												{formatCurrency(opportunity.amount_available)}
											</div>
										)}
									</div>
								</div>

								<div className='flex items-start'>
									<Calendar className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Important Dates</div>
										<div className='grid grid-cols-2 gap-x-4 text-sm'>
											<div className='text-muted-foreground'>Opens:</div>
											<div>{formatDate(opportunity.open_date)}</div>
											<div className='text-muted-foreground'>Closes:</div>
											<div>{formatDate(opportunity.close_date)}</div>
											{daysLeft !== null && (
												<>
													<div className='text-muted-foreground'>
														Time Left:
													</div>
													<div
														className={`font-medium ${
															daysLeft < 7
																? 'text-red-600'
																: daysLeft < 30
																? 'text-yellow-600'
																: ''
														}`}>
														{daysLeft > 0 ? `${daysLeft} days` : 'Closed'}
													</div>
												</>
											)}
										</div>
									</div>
								</div>

								{opportunity.cost_share_required !== null && (
									<div className='flex items-start'>
										<Tag className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
										<div>
											<div className='font-medium'>Cost Share</div>
											<div className='text-muted-foreground'>
												{opportunity.cost_share_required
													? `Required (${
															opportunity.cost_share_percentage || ''
													  }${opportunity.cost_share_percentage ? '%' : ''})`
													: 'Not required'}
											</div>
										</div>
									</div>
								)}

								<div className='flex items-start'>
									<Building className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Source</div>
										<div className='text-muted-foreground'>
											{opportunity.source_name}
										</div>
										<div className='text-sm text-muted-foreground'>
											{opportunity.source_type} •{' '}
											{opportunity.jurisdiction || 'National'}
										</div>
									</div>
								</div>

								{opportunity.fiscal_year && (
									<div className='flex items-start'>
										<Clock className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
										<div>
											<div className='font-medium'>Fiscal Year</div>
											<div className='text-muted-foreground'>
												{opportunity.fiscal_year}
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className='text-xl'>Actions</CardTitle>
							</CardHeader>
							<CardContent className='space-y-3'>
								<Button className='w-full'>Track This Opportunity</Button>
								<Button variant='outline' className='w-full'>
									Export Details
								</Button>
								<Button variant='outline' className='w-full'>
									Share
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

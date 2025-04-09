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
	Lightbulb,
	Users,
	Target,
	Info,
	Star,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/app/lib/supabase';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/app/components/ui/tabs';
import { Separator } from '@/app/components/ui/separator';

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
				<div className='flex justify-between items-center mb-6'>
					<Button
						variant='ghost'
						className='pl-0'
						onClick={() => router.back()}>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Opportunities
					</Button>

					<div className='flex gap-2'>
						<Button variant='outline' size='sm'>
							<ArrowLeft className='h-4 w-4 mr-2' /> Previous
						</Button>
						<Button variant='outline' size='sm'>
							Next <ArrowLeft className='h-4 w-4 ml-2 rotate-180' />
						</Button>
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
					{/* Main Content */}
					<div className='lg:col-span-2 space-y-6'>
						<Card className='border-t-4 border-t-blue-500'>
							<CardHeader>
								<div className='flex justify-between items-start'>
									<div>
										<CardTitle className='text-2xl'>
											{opportunity.title}
										</CardTitle>
										<CardDescription className='text-base mt-1'>
											{opportunity.agency_name ||
												opportunity.source_display_name}
										</CardDescription>
									</div>
									<span
										className={`text-sm px-3 py-1 rounded-full ${
											status.toLowerCase() === 'open'
												? 'bg-green-100 text-green-800'
												: status.toLowerCase() === 'upcoming' ||
												  status.toLowerCase() === 'anticipated'
												? 'bg-blue-100 text-blue-800'
												: 'bg-gray-100 text-gray-800'
										}`}>
										{status}
									</span>
								</div>
							</CardHeader>
							<CardContent>
								<Tabs defaultValue='overview' className='w-full'>
									<TabsList className='mb-4'>
										<TabsTrigger value='overview'>Overview</TabsTrigger>
										<TabsTrigger value='details'>Full Details</TabsTrigger>
										<TabsTrigger value='eligibility'>Eligibility</TabsTrigger>
										<TabsTrigger value='relevance'>Relevance</TabsTrigger>
									</TabsList>

									<TabsContent value='overview'>
										{opportunity.actionable_summary && (
											<div className='mb-6 bg-amber-50 p-4 rounded-lg border border-amber-200'>
												<div className='flex items-start mb-2'>
													<Lightbulb className='h-5 w-5 text-amber-500 mr-2 mt-0.5' />
													<h3 className='text-lg font-medium text-amber-800'>
														Actionable Summary
													</h3>
												</div>
												<p className='text-amber-900'>
													{opportunity.actionable_summary}
												</p>
											</div>
										)}

										<div className='mb-6'>
											<h3 className='text-lg font-medium mb-2'>Description</h3>
											<p className='text-muted-foreground whitespace-pre-line'>
												{opportunity.description || 'No description available.'}
											</p>
										</div>

										{opportunity.categories &&
											opportunity.categories.length > 0 && (
												<div className='mb-6'>
													<h3 className='text-lg font-medium mb-2'>
														Categories
													</h3>
													<div className='flex flex-wrap gap-2'>
														{opportunity.categories.map((category, index) => (
															<Badge
																key={index}
																variant='secondary'
																className='px-2 py-1'>
																{category}
															</Badge>
														))}
													</div>
												</div>
											)}

										{opportunity.funding_type && (
											<div className='mb-6'>
												<h3 className='text-lg font-medium mb-2'>
													Funding Type
												</h3>
												<Badge className='bg-blue-100 text-blue-800 hover:bg-blue-100'>
													{opportunity.funding_type}
												</Badge>
											</div>
										)}

										{opportunity.tags && opportunity.tags.length > 0 && (
											<div className='mb-6'>
												<h3 className='text-lg font-medium mb-2'>Tags</h3>
												<div className='flex flex-wrap gap-2'>
													{opportunity.tags.map((tag, index) => (
														<Badge key={index} variant='outline'>
															{tag}
														</Badge>
													))}
												</div>
											</div>
										)}
									</TabsContent>

									<TabsContent value='details'>
										<div className='space-y-6'>
											<div>
												<h3 className='text-lg font-medium mb-2'>
													Full Description
												</h3>
												<p className='text-muted-foreground whitespace-pre-line'>
													{opportunity.description ||
														'No description available.'}
												</p>
											</div>

											{opportunity.opportunity_number && (
												<div>
													<h3 className='text-lg font-medium mb-2'>
														Opportunity Number
													</h3>
													<p className='font-mono bg-gray-50 px-3 py-1 rounded inline-block'>
														{opportunity.opportunity_number}
													</p>
												</div>
											)}

											{opportunity.program_name && (
												<div>
													<h3 className='text-lg font-medium mb-2'>Program</h3>
													<p className='text-muted-foreground'>
														{opportunity.program_name}
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
										</div>
									</TabsContent>

									<TabsContent value='eligibility'>
										<div className='space-y-6'>
											{opportunity.eligible_applicants &&
												opportunity.eligible_applicants.length > 0 && (
													<div>
														<div className='flex items-start mb-2'>
															<Users className='h-5 w-5 text-gray-600 mr-2 mt-0.5' />
															<h3 className='text-lg font-medium'>
																Eligible Applicants
															</h3>
														</div>
														<ul className='list-disc pl-8 space-y-1'>
															{opportunity.eligible_applicants.map(
																(applicant, index) => (
																	<li
																		key={index}
																		className='text-muted-foreground'>
																		{applicant}
																	</li>
																)
															)}
														</ul>
													</div>
												)}

											{opportunity.eligible_project_types &&
												opportunity.eligible_project_types.length > 0 && (
													<div>
														<div className='flex items-start mb-2'>
															<Target className='h-5 w-5 text-gray-600 mr-2 mt-0.5' />
															<h3 className='text-lg font-medium'>
																Eligible Project Types
															</h3>
														</div>
														<ul className='list-disc pl-8 space-y-1'>
															{opportunity.eligible_project_types.map(
																(project, index) => (
																	<li
																		key={index}
																		className='text-muted-foreground'>
																		{project}
																	</li>
																)
															)}
														</ul>
													</div>
												)}

											<div>
												<div className='flex items-start mb-2'>
													<MapPin className='h-5 w-5 text-gray-600 mr-2 mt-0.5' />
													<h3 className='text-lg font-medium'>
														Geographic Eligibility
													</h3>
												</div>

												{opportunity.is_national ? (
													<p className='flex items-center gap-2 text-green-700'>
														<Globe className='h-5 w-5' />
														<span>National - Available across all states</span>
													</p>
												) : opportunity.eligible_states &&
												  opportunity.eligible_states.length > 0 ? (
													<div>
														<p className='mb-2'>
															Available in {opportunity.eligible_states.length}{' '}
															states:
														</p>
														<div className='flex flex-wrap gap-1'>
															{opportunity.eligible_states
																.sort()
																.map((state, index) => (
																	<Badge
																		key={index}
																		variant='outline'
																		className='text-xs'>
																		{state}
																	</Badge>
																))}
														</div>
													</div>
												) : (
													<p className='text-muted-foreground'>
														Geographic eligibility information not available
													</p>
												)}
											</div>

											{opportunity.eligibility_criteria && (
												<div>
													<div className='flex items-start mb-2'>
														<Info className='h-5 w-5 text-gray-600 mr-2 mt-0.5' />
														<h3 className='text-lg font-medium'>
															Additional Eligibility Information
														</h3>
													</div>
													<p className='text-muted-foreground whitespace-pre-line'>
														{typeof opportunity.eligibility_criteria ===
														'object'
															? JSON.stringify(
																	opportunity.eligibility_criteria,
																	null,
																	2
															  )
															: opportunity.eligibility_criteria}
													</p>
												</div>
											)}
										</div>
									</TabsContent>

									<TabsContent value='relevance'>
										<div className='space-y-6'>
											{opportunity.relevance_score !== null && (
												<div>
													<div className='flex items-start mb-2'>
														<Star className='h-5 w-5 text-amber-500 mr-2 mt-0.5' />
														<h3 className='text-lg font-medium'>
															Relevance Score
														</h3>
													</div>

													<div className='mb-2'>
														<div className='flex justify-between mb-1'>
															<span className='text-sm text-muted-foreground'>
																Less Relevant
															</span>
															<span className='text-sm text-muted-foreground'>
																More Relevant
															</span>
														</div>
														<Progress
															value={opportunity.relevance_score * 10}
															className='h-2'
														/>
														<div className='flex justify-end mt-1'>
															<span className='text-sm font-medium'>
																{opportunity.relevance_score}/10
															</span>
														</div>
													</div>
												</div>
											)}

											{opportunity.relevance_reasoning && (
												<div>
													<h3 className='text-lg font-medium mb-2'>
														Why This Is Relevant
													</h3>
													<div className='bg-blue-50 p-4 rounded-lg border border-blue-100'>
														<p className='text-muted-foreground whitespace-pre-line'>
															{opportunity.relevance_reasoning}
														</p>
													</div>
												</div>
											)}
										</div>
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>

						{opportunity.url && (
							<Card>
								<CardHeader>
									<CardTitle className='text-xl'>
										Application Resources
									</CardTitle>
								</CardHeader>
								<CardContent className='space-y-4'>
									<div className='flex items-center'>
										<Globe className='h-5 w-5 mr-2 text-muted-foreground' />
										<a
											href={opportunity.url}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-600 hover:underline'>
											View Official Opportunity
										</a>
									</div>
									{opportunity.application_url && (
										<div className='flex items-center'>
											<FileText className='h-5 w-5 mr-2 text-muted-foreground' />
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
						<Card className='border-l-4 border-l-blue-500'>
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
										{opportunity.total_funding_available && (
											<div className='text-sm text-muted-foreground mt-1'>
												Total available:{' '}
												{formatCurrency(opportunity.total_funding_available)}
											</div>
										)}
									</div>
								</div>

								<div className='flex items-start'>
									<Calendar className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Important Dates</div>
										<div className='grid grid-cols-2 gap-x-4 text-sm'>
											<div className='text-muted-foreground'>Posted:</div>
											<div>{formatDate(opportunity.posted_date)}</div>
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

								<Separator />

								<div className='flex items-start'>
									<Building className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Source Information</div>
										<div className='text-muted-foreground'>
											<strong>Agency:</strong>{' '}
											{opportunity.agency_name || 'Not specified'}
										</div>
										<div className='text-sm text-muted-foreground mt-1'>
											<strong>Source:</strong>{' '}
											{opportunity.source_display_name || 'Unknown'}
										</div>
										<div className='text-sm text-muted-foreground'>
											<strong>Type:</strong>{' '}
											{opportunity.source_type_display || 'Not specified'}
										</div>
										<div className='text-sm text-muted-foreground'>
											<strong>Scope:</strong>{' '}
											{opportunity.is_national ? 'National' : 'Regional'}
										</div>
									</div>
								</div>

								<div className='flex items-start'>
									<Info className='h-5 w-5 mr-2 text-muted-foreground mt-0.5' />
									<div>
										<div className='font-medium'>Opportunity Details</div>
										{opportunity.opportunity_number && (
											<div className='text-sm text-muted-foreground'>
												<strong>Number:</strong>{' '}
												{opportunity.opportunity_number}
											</div>
										)}
										<div className='text-sm text-muted-foreground'>
											<strong>Last Updated:</strong>{' '}
											{formatDate(opportunity.updated_at)}
										</div>
										<div className='text-sm text-muted-foreground'>
											<strong>Added On:</strong>{' '}
											{formatDate(opportunity.created_at)}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className='text-xl'>Actions</CardTitle>
							</CardHeader>
							<CardContent className='space-y-3'>
								<Button className='w-full'>Track This Opportunity</Button>
								<Button
									variant='outline'
									className='w-full flex items-center justify-center'>
									<FileText className='h-4 w-4 mr-2' />
									Export PDF
								</Button>
								<Button
									variant='outline'
									className='w-full flex items-center justify-center'>
									<Mail className='h-4 w-4 mr-2' />
									Share by Email
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

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
						<Card className='border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden'>
							{/* Add subtle gradient overlay */}
							<div className='absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600' />

							<CardHeader className='bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/10 dark:to-transparent pb-4'>
								<div className='flex justify-between items-start'>
									<div>
										<CardTitle className='text-2xl font-semibold text-neutral-900 dark:text-neutral-50'>
											{opportunity.title}
										</CardTitle>
										<CardDescription className='text-base mt-1.5 text-neutral-600 dark:text-neutral-400'>
											{opportunity.agency_name ||
												opportunity.source_display_name}
										</CardDescription>
									</div>
									<span
										className={`text-sm px-3 py-1 rounded-full shadow-sm font-medium transition-all ${
											status.toLowerCase() === 'open'
												? 'bg-gradient-to-r from-green-100 to-green-50 text-green-800 border border-green-200'
												: status.toLowerCase() === 'upcoming' ||
												  status.toLowerCase() === 'anticipated'
												? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200'
												: 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-800 border border-gray-200'
										}`}>
										{status}
									</span>
								</div>
							</CardHeader>
							<CardContent className='px-6 pt-2 pb-6'>
								<Tabs defaultValue='overview' className='w-full'>
									<TabsList className='mb-6 bg-neutral-100/70 dark:bg-neutral-900/30 p-1 rounded-lg'>
										{['overview', 'details', 'eligibility', 'relevance'].map(
											(tab) => (
												<TabsTrigger
													key={tab}
													value={tab}
													className='capitalize data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all duration-200 rounded-md'>
													{tab}
												</TabsTrigger>
											)
										)}
									</TabsList>

									<TabsContent
										value='overview'
										className='animate-in fade-in-50 duration-300'>
										{opportunity.actionable_summary && (
											<div className='mb-6 bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-900/20 dark:to-amber-900/5 p-5 rounded-lg border border-amber-200/70 dark:border-amber-800/30 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-800/30 dark:to-amber-700/20 shadow-sm'>
														<Lightbulb className='h-5 w-5 text-amber-600 dark:text-amber-400' />
													</div>
													<h3 className='text-lg font-medium text-amber-800 dark:text-amber-400'>
														Actionable Summary
													</h3>
												</div>
												<p className='text-amber-900 dark:text-amber-300 pl-10'>
													{opportunity.actionable_summary}
												</p>
											</div>
										)}

										<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
											<h3 className='text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-200'>
												Description
											</h3>
											<p className='text-neutral-700 dark:text-neutral-300 whitespace-pre-line leading-relaxed'>
												{opportunity.description || 'No description available.'}
											</p>
										</div>

										{opportunity.categories &&
											opportunity.categories.length > 0 && (
												<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
													<h3 className='text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-200'>
														Categories
													</h3>
													<div className='flex flex-wrap gap-2'>
														{opportunity.categories.map((category, index) => (
															<Badge
																key={index}
																variant='secondary'
																className='px-3 py-1.5 text-sm bg-gradient-to-r from-blue-50 to-blue-100/70 dark:from-blue-900/20 dark:to-blue-800/10 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors duration-200 cursor-default shadow-sm'>
																{category}
															</Badge>
														))}
													</div>
												</div>
											)}

										{opportunity.funding_type && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
												<h3 className='text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-200'>
													Funding Type
												</h3>
												<Badge className='px-3 py-1.5 text-sm bg-gradient-to-r from-purple-50 to-purple-100/70 dark:from-purple-900/20 dark:to-purple-800/10 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30 shadow-sm'>
													{opportunity.funding_type}
												</Badge>
											</div>
										)}

										{opportunity.tags && opportunity.tags.length > 0 && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
												<h3 className='text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-200'>
													Tags
												</h3>
												<div className='flex flex-wrap gap-2'>
													{opportunity.tags.map((tag, index) => (
														<Badge
															key={index}
															variant='outline'
															className='px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-200 cursor-default border-neutral-300 dark:border-neutral-700'>
															{tag}
														</Badge>
													))}
												</div>
											</div>
										)}
									</TabsContent>

									<TabsContent
										value='details'
										className='animate-in fade-in-50 duration-300'>
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
							<Card className='shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden'>
								<CardHeader className='border-b border-neutral-100 dark:border-neutral-800 pb-3 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/10 dark:to-transparent'>
									<CardTitle className='text-xl font-semibold text-blue-700 dark:text-blue-400'>
										Application Resources
									</CardTitle>
								</CardHeader>
								<CardContent className='space-y-4 pt-5 px-6 pb-6'>
									<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
										<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 shadow-sm'>
											<Globe className='h-5 w-5 text-blue-600 dark:text-blue-400' />
										</div>
										<a
											href={opportunity.url}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium'>
											View Official Opportunity
										</a>
									</div>
									{opportunity.application_url && (
										<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
											<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/30 dark:to-neutral-700/20 shadow-sm'>
												<FileText className='h-5 w-5 text-neutral-600 dark:text-neutral-400' />
											</div>
											<a
												href={opportunity.application_url}
												target='_blank'
												rel='noopener noreferrer'
												className='text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium'>
												Application Portal
											</a>
										</div>
									)}
									{opportunity.guidelines_url && (
										<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
											<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/30 dark:to-neutral-700/20 shadow-sm'>
												<FileText className='h-5 w-5 text-neutral-600 dark:text-neutral-400' />
											</div>
											<a
												href={opportunity.guidelines_url}
												target='_blank'
												rel='noopener noreferrer'
												className='text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium'>
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
						<Card className='overflow-hidden shadow-sm hover:shadow-md transition-all duration-300'>
							<CardHeader className='relative border-b border-neutral-100 dark:border-neutral-800 pb-3'>
								<CardTitle className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
									Key Details
								</CardTitle>
							</CardHeader>

							<CardContent className='relative space-y-5 pt-5'>
								{/* Award Amount Section */}
								<div className='flex items-start'>
									<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20'>
										<DollarSign className='h-5 w-5 text-amber-600 dark:text-amber-400' />
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100'>
											Award Amount
										</div>
										<div className='text-lg font-semibold text-amber-700 dark:text-amber-300 mt-0.5'>
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
											<div className='text-sm text-neutral-600 dark:text-neutral-400 mt-1'>
												Total available pool:{' '}
												{formatCurrency(opportunity.total_funding_available)}
											</div>
										)}
									</div>
								</div>

								{/* Important Dates Section with improved layout */}
								<div className='flex items-start'>
									<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20'>
										<Calendar className='h-5 w-5 text-blue-600 dark:text-blue-400' />
									</div>
									<div className='flex-1'>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1.5'>
											Important Dates
										</div>
										<div className='grid grid-cols-2 gap-x-4 gap-y-2'>
											<div className='text-sm text-neutral-600 dark:text-neutral-400 font-medium'>
												Opens:
											</div>
											<div className='text-sm'>
												{formatDate(opportunity.open_date)}
											</div>

											<div className='text-sm text-neutral-600 dark:text-neutral-400 font-medium'>
												Closes:
											</div>
											<div className='text-sm font-medium'>
												{formatDate(opportunity.close_date)}
											</div>

											{daysLeft !== null && (
												<>
													<div className='text-sm text-neutral-600 dark:text-neutral-400 font-medium'>
														Time Left:
													</div>
													<div
														className={`text-sm font-medium ${
															daysLeft < 7
																? 'text-red-600 dark:text-red-400'
																: daysLeft < 30
																? 'text-amber-600 dark:text-amber-400'
																: 'text-green-600 dark:text-green-400'
														}`}>
														{daysLeft > 0 ? `${daysLeft} days` : 'Closed'}
													</div>
												</>
											)}
										</div>
									</div>
								</div>

								{/* Cost Share Section */}
								{opportunity.cost_share_required !== null && (
									<div className='flex items-start'>
										<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20'>
											<Tag className='h-5 w-5 text-purple-600 dark:text-purple-400' />
										</div>
										<div>
											<div className='font-medium text-neutral-900 dark:text-neutral-100'>
												Cost Share
											</div>
											<div className='text-neutral-700 dark:text-neutral-300 mt-0.5'>
												{opportunity.cost_share_required
													? `Required (${
															opportunity.cost_share_percentage || ''
													  }${opportunity.cost_share_percentage ? '%' : ''})`
													: 'Not required'}
											</div>
										</div>
									</div>
								)}

								{/* Elegant separator with gradient */}
								<div className='py-1'>
									<div className='h-px w-full bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent' />
								</div>

								{/* Source Information Section */}
								<div className='flex items-start'>
									<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20'>
										<Building className='h-5 w-5 text-green-600 dark:text-green-400' />
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1'>
											Source Information
										</div>
										<div className='grid gap-y-1'>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium'>
													Source:
												</span>{' '}
												<span className='text-neutral-800 dark:text-neutral-200'>
													{opportunity.source_display_name || 'Unknown'}
												</span>
											</div>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium'>
													Type:
												</span>{' '}
												<span className='text-neutral-800 dark:text-neutral-200'>
													{opportunity.source_type_display || 'Not specified'}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* Eligible Locations Section */}
								<div className='flex items-start'>
									<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20'>
										<MapPin className='h-5 w-5 text-blue-600 dark:text-blue-400' />
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1'>
											Eligible Locations
										</div>
										{opportunity.is_national ? (
											<div className='text-sm text-neutral-800 dark:text-neutral-200'>
												National - All states
											</div>
										) : opportunity.eligible_states &&
										  opportunity.eligible_states.length > 0 ? (
											<div>
												<div className='text-sm text-neutral-800 dark:text-neutral-200 mb-1'>
													Available in {opportunity.eligible_states.length}{' '}
													states:
												</div>
												<div className='flex flex-wrap gap-1 max-w-[240px]'>
													{opportunity.eligible_states
														.sort()
														.map((state, index) => (
															<Badge
																key={index}
																variant='outline'
																className='text-xs border-neutral-200 dark:border-neutral-700'>
																{state}
															</Badge>
														))}
												</div>
											</div>
										) : (
											<div className='text-sm text-neutral-500 dark:text-neutral-400'>
												Not specified
											</div>
										)}
									</div>
								</div>

								{/* Opportunity Details Section */}
								<div className='flex items-start'>
									<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/30 dark:to-neutral-700/20'>
										<Info className='h-5 w-5 text-neutral-600 dark:text-neutral-400' />
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1'>
											Opportunity Details
										</div>
										<div className='grid gap-y-1'>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium'>
													Last Updated:
												</span>{' '}
												<span className='text-neutral-800 dark:text-neutral-200'>
													{formatDate(opportunity.updated_at)}
												</span>
											</div>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium'>
													Added On:
												</span>{' '}
												<span className='text-neutral-800 dark:text-neutral-200'>
													{formatDate(opportunity.created_at)}
												</span>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className='overflow-hidden shadow-sm hover:shadow-md transition-all duration-300'>
							<CardHeader className='relative border-b border-neutral-100 dark:border-neutral-800 pb-3'>
								<CardTitle className='text-xl font-semibold text-blue-700 dark:text-blue-400'>
									Actions
								</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4 pt-4'>
								<Button className='w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200'>
									Track This Opportunity
								</Button>
								<Button
									variant='outline'
									className='w-full flex items-center justify-center border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200'>
									<FileText className='h-4 w-4 mr-2 text-blue-700 dark:text-blue-400' />
									Export PDF
								</Button>
								<Button
									variant='outline'
									className='w-full flex items-center justify-center border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200'>
									<Mail className='h-4 w-4 mr-2 text-blue-700 dark:text-blue-400' />
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

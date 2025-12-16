'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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
import { calculateDaysLeft, determineStatus } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useTrackedOpportunities } from '@/hooks/useTrackedOpportunities';
import {
	getCategoryColor,
	formatCategoryForDisplay,
} from '@/lib/utils/uiHelpers';

export default function OpportunityDetailPage() {
	const params = useParams();
	const router = useRouter();
	const [opportunity, setOpportunity] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Use our custom hook for tracking opportunities
	const { isTracked, toggleTracked } = useTrackedOpportunities();

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

					{/* Comment out Previous/Next buttons
					<div className='flex gap-2'>
						<Button variant='outline' size='sm'>
							<ArrowLeft className='h-4 w-4 mr-2' /> Previous
						</Button>
						<Button variant='outline' size='sm'>
							Next <ArrowLeft className='h-4 w-4 ml-2 rotate-180' />
						</Button>
					</div>
					*/}
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
										{['overview', 'eligibility', 'relevance'].map((tab) => (
											<TabsTrigger
												key={tab}
												value={tab}
												className='capitalize data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all duration-200 rounded-md'>
												{tab}
											</TabsTrigger>
										))}
									</TabsList>

									<TabsContent
										value='overview'
										className='animate-in fade-in-50 duration-300'>
										{/* 1. Program Overview */}
										{opportunity.program_overview && (
											<div className='mb-6 bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-900/20 dark:to-blue-900/5 p-5 rounded-lg border border-blue-200/70 dark:border-blue-800/30 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800/30 dark:to-blue-700/20 shadow-sm'>
														<Info className='h-5 w-5 text-blue-600 dark:text-blue-400' />
													</div>
													<h3 className='text-lg font-medium text-blue-800 dark:text-blue-400'>
														Program Overview
													</h3>
												</div>
												<p className='text-blue-900 dark:text-blue-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_overview}
												</p>
											</div>
										)}

										{/* 2. Application Summary */}
										{opportunity.application_summary && (
											<div className='mb-6 bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-900/20 dark:to-green-900/5 p-5 rounded-lg border border-green-200/70 dark:border-green-800/30 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-green-100 to-green-50 dark:from-green-800/30 dark:to-green-700/20 shadow-sm'>
														<FileText className='h-5 w-5 text-green-600 dark:text-green-400' />
													</div>
													<h3 className='text-lg font-medium text-green-800 dark:text-green-400'>
														Application Summary
													</h3>
												</div>
												<p className='text-green-900 dark:text-green-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.application_summary}
												</p>
											</div>
										)}

										{/* 3. Program Insights */}
										{opportunity.program_insights && (
											<div className='mb-6 bg-gradient-to-br from-purple-50 to-purple-50/50 dark:from-purple-900/20 dark:to-purple-900/5 p-5 rounded-lg border border-purple-200/70 dark:border-purple-800/30 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-800/30 dark:to-purple-700/20 shadow-sm'>
														<Lightbulb className='h-5 w-5 text-purple-600 dark:text-purple-400' />
													</div>
													<h3 className='text-lg font-medium text-purple-800 dark:text-purple-400'>
														Program Insights
													</h3>
												</div>
												<p className='text-purple-900 dark:text-purple-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_insights}
												</p>
											</div>
										)}

										{/* 4. Program Use Cases */}
										{opportunity.program_use_cases && (
											<div className='mb-6 bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-900/20 dark:to-amber-900/5 p-5 rounded-lg border border-amber-200/70 dark:border-amber-800/30 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-800/30 dark:to-amber-700/20 shadow-sm'>
														<Target className='h-5 w-5 text-amber-600 dark:text-amber-400' />
													</div>
													<h3 className='text-lg font-medium text-amber-800 dark:text-amber-400'>
														Program Use Cases
													</h3>
												</div>
												<p className='text-amber-900 dark:text-amber-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_use_cases}
												</p>
											</div>
										)}

										{opportunity.categories &&
											opportunity.categories.length > 0 && (
												<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
													<h3 className='text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-200'>
														Categories
													</h3>
													<div className='flex flex-wrap gap-2'>
														{opportunity.categories.map((category, index) => {
															const categoryColor = getCategoryColor(category);
															return (
																<Badge
																	key={index}
																	variant='secondary'
																	className='px-3 py-1.5 text-sm border hover:bg-opacity-90 transition-colors duration-200 cursor-default shadow-sm'
																	style={{
																		backgroundColor: categoryColor.bgColor,
																		color: categoryColor.color,
																		borderColor: `${categoryColor.color}20`,
																	}}>
																	{category}
																</Badge>
															);
														})}
													</div>
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

									<TabsContent value='eligibility'>
										<div className='space-y-6'>
											{opportunity.eligible_applicants &&
												opportunity.eligible_applicants.length > 0 && (
													<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
														<div className='flex items-start mb-4'>
															<div className='mr-3 flex-shrink-0 h-9 w-9'>
																<svg
																	viewBox='0 0 36 36'
																	className='h-full w-full'>
																	<rect
																		x='3'
																		y='5'
																		width='30'
																		height='26'
																		rx='2'
																		fill='#5c6bc0'
																	/>
																	<rect
																		x='7'
																		y='9'
																		width='22'
																		height='18'
																		rx='1'
																		fill='#e8eaf6'
																	/>
																	<circle
																		cx='13'
																		cy='13'
																		r='3.5'
																		fill='#5c6bc0'
																	/>
																	<circle
																		cx='23'
																		cy='13'
																		r='3.5'
																		fill='#5c6bc0'
																	/>
																	<circle
																		cx='18'
																		cy='20'
																		r='3.5'
																		fill='#5c6bc0'
																	/>
																	<rect
																		x='6'
																		y='27'
																		width='24'
																		height='3'
																		rx='1'
																		fill='#3949ab'
																	/>
																</svg>
															</div>
															<h3 className='text-lg font-medium text-neutral-900 dark:text-neutral-200'>
																Eligible Applicants
															</h3>
														</div>
														<div className='pl-10 space-y-2'>
															{opportunity.eligible_applicants.map(
																(applicant, index) => (
																	<div
																		key={index}
																		className='flex items-center p-2 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors'>
																		<Badge
																			variant='outline'
																			className='mr-2 bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'>
																			{index + 1}
																		</Badge>
																		<span className='text-neutral-700 dark:text-neutral-300'>
																			{applicant}
																		</span>
																	</div>
																)
															)}
														</div>
													</div>
												)}

											{opportunity.eligible_project_types &&
												opportunity.eligible_project_types.length > 0 && (
													<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
														<div className='flex items-start mb-4'>
															<div className='mr-3 flex-shrink-0 h-9 w-9'>
																<svg
																	viewBox='0 0 36 36'
																	className='h-full w-full'>
																	<rect
																		x='4'
																		y='4'
																		width='28'
																		height='28'
																		rx='3'
																		fill='#43a047'
																	/>
																	<circle
																		cx='18'
																		cy='18'
																		r='9'
																		fill='#e8f5e9'
																		stroke='#2e7d32'
																		strokeWidth='1.5'
																	/>
																	<circle
																		cx='18'
																		cy='18'
																		r='5'
																		fill='#66bb6a'
																	/>
																	<path
																		d='M15,18 L17,20 L22,15'
																		stroke='#fff'
																		strokeWidth='1.5'
																		fill='none'
																		strokeLinecap='round'
																		strokeLinejoin='round'
																	/>
																</svg>
															</div>
															<h3 className='text-lg font-medium text-neutral-900 dark:text-neutral-200'>
																Eligible Project Types
															</h3>
														</div>
														<div className='pl-10 grid gap-2 md:grid-cols-2'>
															{opportunity.eligible_project_types.map(
																(project, index) => (
																	<div
																		key={index}
																		className='flex items-center p-2 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors'>
																		<div className='h-2 w-2 rounded-full bg-green-500 mr-2'></div>
																		<span className='text-neutral-700 dark:text-neutral-300'>
																			{project}
																		</span>
																	</div>
																)
															)}
														</div>
													</div>
												)}

											<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
												<div className='flex items-start mb-4'>
													<div className='mr-3 flex-shrink-0 h-9 w-9'>
														<svg
															viewBox='0 0 36 36'
															className='h-full w-full'>
															<rect
																x='4'
																y='4'
																width='28'
																height='28'
																rx='3'
																fill='#2196f3'
															/>
															<rect
																x='8'
																y='8'
																width='20'
																height='20'
																rx='2'
																fill='#e3f2fd'
															/>
															<rect
																x='11'
																y='12'
																width='14'
																height='2'
																rx='1'
																fill='#1976d2'
															/>
															<rect
																x='11'
																y='16'
																width='10'
																height='2'
																rx='1'
																fill='#1976d2'
															/>
															<rect
																x='11'
																y='20'
																width='12'
																height='2'
																rx='1'
																fill='#1976d2'
															/>
															<circle
																cx='26'
																cy='10'
																r='6'
																fill='#4caf50'
															/>
															<path
																d='M23 10 L25 12 L29 8'
																stroke='white'
																strokeWidth='2'
																fill='none'
																strokeLinecap='round'
																strokeLinejoin='round'
															/>
														</svg>
													</div>
													<h3 className='text-lg font-medium text-neutral-900 dark:text-neutral-200'>
														Eligible Activities
													</h3>
												</div>

												<div className='pl-10'>
													{opportunity.eligible_activities && opportunity.eligible_activities.length > 0 ? (
														<div>
															<div className='mb-3 p-2 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20 dark:to-transparent rounded-md'>
																<span className='text-blue-700 dark:text-blue-300 font-medium'>
																	This funding supports {opportunity.eligible_activities.length} types of activities
																</span>
															</div>
															<div className='flex flex-wrap gap-2 max-w-[600px]'>
																{opportunity.eligible_activities.map((activity, index) => (
																	<Badge
																		key={index}
																		variant='outline'
																		className='px-2.5 py-1 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'>
																		{activity}
																	</Badge>
																))}
															</div>
														</div>
													) : (
														<div className='p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md text-neutral-500 dark:text-neutral-400'>
															Eligible activities information not available
														</div>
													)}
												</div>
											</div>

											{opportunity.eligibility_criteria && (
												<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
													<div className='flex items-start mb-4'>
														<div className='mr-3 flex-shrink-0 h-9 w-9'>
															<svg
																viewBox='0 0 36 36'
																className='h-full w-full'>
																<rect
																	x='4'
																	y='4'
																	width='28'
																	height='28'
																	rx='3'
																	fill='#9c27b0'
																/>
																<rect
																	x='8'
																	y='8'
																	width='20'
																	height='20'
																	rx='2'
																	fill='#f3e5f5'
																/>
																<rect
																	x='11'
																	y='14'
																	width='14'
																	height='2'
																	rx='1'
																	fill='#9c27b0'
																/>
																<rect
																	x='11'
																	y='20'
																	width='14'
																	height='2'
																	rx='1'
																	fill='#9c27b0'
																/>
																<circle
																	cx='18'
																	cy='10'
																	r='2.5'
																	fill='#9c27b0'
																/>
															</svg>
														</div>
														<h3 className='text-lg font-medium text-neutral-900 dark:text-neutral-200'>
															Additional Eligibility Information
														</h3>
													</div>
													<div className='pl-10 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-md whitespace-pre-line text-neutral-700 dark:text-neutral-300'>
														{typeof opportunity.eligibility_criteria ===
														'object'
															? JSON.stringify(
																	opportunity.eligibility_criteria,
																	null,
																	2
															  )
															: opportunity.eligibility_criteria}
													</div>
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
									<CardTitle className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
										Application Resources
									</CardTitle>
								</CardHeader>
								<CardContent className='space-y-4 pt-5 px-6 pb-6'>
									<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
										<Globe className='h-5 w-5 mr-3 text-blue-600 dark:text-blue-400' />
										<a
											href={opportunity.url || '#'}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium'>
											View Official Opportunity
										</a>
									</div>
									{opportunity.api_source_url && (
										<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
											<Info className='h-5 w-5 mr-3 text-blue-600 dark:text-blue-400' />
											<a
												href={opportunity.api_source_url}
												target='_blank'
												rel='noopener noreferrer'
												className='text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium'>
												Data Source
											</a>
										</div>
									)}
									{opportunity.application_url && (
										<div className='flex items-center hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-lg p-2 transition-colors duration-200 -mx-2'>
											<FileText className='h-5 w-5 mr-3 text-neutral-600 dark:text-neutral-400' />
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
											<FileText className='h-5 w-5 mr-3 text-neutral-600 dark:text-neutral-400' />
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
									<div className='mr-3 flex-shrink-0 h-9 w-9'>
										<svg viewBox='0 0 36 36' className='h-full w-full'>
											<rect
												x='3'
												y='6'
												width='30'
												height='24'
												rx='2'
												fill='#81c784'
											/>
											<rect
												x='6'
												y='10'
												width='24'
												height='16'
												rx='1'
												fill='#e8f5e9'
											/>
											<text
												x='18'
												y='21'
												fontFamily='Arial'
												fontSize='12'
												fontWeight='bold'
												fill='#2e7d32'
												textAnchor='middle'>
												$
											</text>
											<circle
												cx='10'
												cy='16'
												r='4'
												fill='#e8f5e9'
												opacity='0.8'
											/>
											<circle
												cx='26'
												cy='20'
												r='4'
												fill='#e8f5e9'
												opacity='0.8'
											/>
										</svg>
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

								{/* Funding Type Section */}
								{opportunity.funding_type && (
									<div className='flex items-start'>
										<div className='mr-3 flex-shrink-0 h-9 w-9'>
											<svg viewBox='0 0 36 36' className='h-full w-full'>
												<rect
													x='6'
													y='8'
													width='24'
													height='20'
													rx='2'
													fill='#9575cd'
												/>
												<rect
													x='8'
													y='10'
													width='20'
													height='16'
													rx='1'
													fill='#ede7f6'
												/>
												<rect
													x='10'
													y='12'
													width='16'
													height='3'
													rx='0.5'
													fill='#7e57c2'
												/>
												<rect
													x='10'
													y='17'
													width='10'
													height='2'
													rx='0.5'
													fill='#7e57c2'
												/>
												<rect
													x='10'
													y='21'
													width='14'
													height='2'
													rx='0.5'
													fill='#7e57c2'
												/>
											</svg>
										</div>
										<div>
											<div className='font-medium text-neutral-900 dark:text-neutral-100'>
												Funding Type
											</div>
											<div className='text-neutral-700 dark:text-neutral-300 mt-0.5'>
												{opportunity.funding_type}
											</div>
										</div>
									</div>
								)}

								{/* Important Dates Section with improved layout */}
								<div className='flex items-start'>
									<div className='mr-3 flex-shrink-0 h-9 w-9'>
										<svg viewBox='0 0 36 36' className='h-full w-full'>
											<rect
												x='4'
												y='5'
												width='28'
												height='26'
												rx='2'
												fill='#2196f3'
											/>
											<rect
												x='6'
												y='10'
												width='24'
												height='19'
												rx='1'
												fill='#e3f2fd'
											/>
											<rect
												x='4'
												y='5'
												width='28'
												height='5'
												rx='1'
												fill='#1976d2'
											/>
											<text
												x='10'
												y='9'
												fontFamily='Arial'
												fontSize='6'
												fontWeight='bold'
												fill='white'>
												MON
											</text>
											<text
												x='20'
												y='9'
												fontFamily='Arial'
												fontSize='6'
												fontWeight='bold'
												fill='white'>
												TUE
											</text>
											<text
												x='30'
												y='9'
												fontFamily='Arial'
												fontSize='6'
												fontWeight='bold'
												fill='white'>
												WED
											</text>
											<circle cx='18' cy='18' r='4' fill='#1976d2' />
											<text
												x='18'
												y='20'
												fontFamily='Arial'
												fontSize='5'
												fontWeight='bold'
												fill='white'
												textAnchor='middle'>
												15
											</text>
										</svg>
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
										<div className='mr-3 flex-shrink-0 h-9 w-9'>
											<svg viewBox='0 0 36 36' className='h-full w-full'>
												<path
													d='M18,5 L7,16 L7,26 C7,27.1 7.9,28 9,28 L27,28 C28.1,28 29,27.1 29,26 L29,16 L18,5 Z'
													fill='#9c27b0'
												/>
												<path d='M18,5 L7,16 L29,16 L18,5 Z' fill='#ce93d8' />
												<text
													x='18'
													y='24'
													fontFamily='Arial'
													fontSize='12'
													fontWeight='bold'
													fill='white'
													textAnchor='middle'>
													%
												</text>
											</svg>
										</div>
										<div>
											<div className='font-medium text-neutral-900 dark:text-neutral-100'>
												Cost Share
											</div>
											<div className='text-neutral-700 dark:text-neutral-300 mt-0.5'>
												{opportunity.cost_share_required
													? opportunity.cost_share_percentage
														? `Required (${opportunity.cost_share_percentage}%)`
														: 'Required'
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
									<div className='mr-3 flex-shrink-0 h-9 w-9'>
										<svg viewBox='0 0 36 36' className='h-full w-full'>
											<rect
												x='6'
												y='4'
												width='24'
												height='28'
												rx='2'
												fill='#4caf50'
											/>
											<rect
												x='10'
												y='10'
												width='16'
												height='16'
												rx='1'
												fill='#e8f5e9'
											/>
											<rect
												x='10'
												y='5'
												width='16'
												height='3'
												rx='1'
												fill='#c8e6c9'
											/>
											<rect
												x='13'
												y='14'
												width='10'
												height='2'
												fill='#4caf50'
											/>
											<rect
												x='13'
												y='18'
												width='10'
												height='2'
												fill='#4caf50'
											/>
											<rect x='13' y='22' width='5' height='2' fill='#4caf50' />
										</svg>
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1'>
											Source Information
										</div>
										<div className='grid gap-y-1'>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium inline-block w-14'>
													Source:
												</span>{' '}
												<span className='text-neutral-800 dark:text-neutral-200'>
													{opportunity.source_display_name || 'Unknown'}
												</span>
											</div>
											<div className='text-sm'>
												<span className='text-neutral-600 dark:text-neutral-400 font-medium inline-block w-14'>
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
									<div className='mr-3 flex-shrink-0 h-9 w-9'>
										<svg viewBox='0 0 36 36' className='h-full w-full'>
											<path
												d='M18,4 C12.48,4 8,8.48 8,14 C8,22 18,32 18,32 C18,32 28,22 28,14 C28,8.48 23.52,4 18,4 Z'
												fill='#ff9800'
											/>
											<path
												d='M18,8 C15,8 12.5,10.5 12.5,13.5 C12.5,16.5 15,19 18,19 C21,19 23.5,16.5 23.5,13.5 C23.5,10.5 21,8 18,8 Z'
												fill='#ffe082'
											/>
											<path
												d='M18,9 C15.5,9 13.5,11 13.5,13.5 C13.5,16 15.5,18 18,18 C20.5,18 22.5,16 22.5,13.5 C22.5,11 20.5,9 18,9 Z'
												fill='#ffecb3'
											/>
										</svg>
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100 mb-1'>
											Eligible Locations
										</div>
										{opportunity.is_national ? (
											<div className='text-sm text-neutral-800 dark:text-neutral-200'>
												National - All states
											</div>
										) : opportunity.coverage_area_codes &&
										  opportunity.coverage_area_codes.length > 0 ? (
											<div>
												<div className='text-sm text-neutral-800 dark:text-neutral-200 mb-1'>
													Available in {opportunity.coverage_area_codes.length}{' '}
													location{opportunity.coverage_area_codes.length > 1 ? 's' : ''}:
												</div>
												<div className='flex flex-wrap gap-1 max-w-[240px]'>
													{opportunity.coverage_area_codes.map((code, index) => (
														<Badge
															key={index}
															variant='outline'
															className='text-xs border-neutral-200 dark:border-neutral-700'>
															{code}
														</Badge>
													))}
												</div>
											</div>
										) : opportunity.eligible_states &&
										  opportunity.eligible_states.length > 0 ? (
											<div>
												<div className='text-sm text-neutral-800 dark:text-neutral-200 mb-1'>
													Available in {opportunity.eligible_states.length}{' '}
													state{opportunity.eligible_states.length > 1 ? 's' : ''}:
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
										) : opportunity.eligible_locations &&
										  opportunity.eligible_locations.length > 0 ? (
											<div>
												<div className='flex flex-wrap gap-1 max-w-[240px]'>
													{opportunity.eligible_locations.map((loc, index) => (
														<Badge
															key={index}
															variant='outline'
															className='text-xs border-neutral-200 dark:border-neutral-700'>
															{loc}
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
									<div className='mr-3 flex-shrink-0 h-9 w-9'>
										<svg viewBox='0 0 36 36' className='h-full w-full'>
											<circle cx='18' cy='18' r='12' fill='#9e9e9e' />
											<circle cx='18' cy='18' r='10' fill='#f5f5f5' />
											<rect x='17' y='10' width='2' height='8' fill='#616161' />
											<rect x='17' y='20' width='2' height='2' fill='#616161' />
										</svg>
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
								<CardTitle className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
									Actions
								</CardTitle>
							</CardHeader>
							<CardContent className='space-y-4 pt-4'>
								<Button
									className={`w-full flex items-center justify-center ${
										isTracked(opportunity.id)
											? 'bg-amber-500 hover:bg-amber-600 text-white'
											: 'bg-blue-600 hover:bg-blue-700 text-white'
									} shadow-sm transition-all duration-200`}
									onClick={() => toggleTracked(opportunity.id)}>
									<Star
										className={`h-4 w-4 mr-2 ${
											isTracked(opportunity.id) ? 'fill-white' : ''
										}`}
									/>
									{isTracked(opportunity.id)
										? 'Untrack Opportunity'
										: 'Track This Opportunity'}
								</Button>
								{/* Comment out Export PDF button
								<Button
									variant='outline'
									className='w-full flex items-center justify-center border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200'>
									<FileText className='h-4 w-4 mr-2 text-blue-700 dark:text-blue-400' />
									Export PDF
								</Button>
								*/}
								{/* Comment out Share by Email button
								<Button
									variant='outline'
									className='w-full flex items-center justify-center border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-200'>
									<Mail className='h-4 w-4 mr-2 text-blue-700 dark:text-blue-400' />
									Share by Email
								</Button>
								*/}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</MainLayout>
	);
}

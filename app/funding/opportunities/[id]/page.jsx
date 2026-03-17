'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
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
	Wrench,
	ClipboardList,
	CheckCircle2,
	AlertTriangle,
} from 'lucide-react';
import { calculateDaysLeft, determineStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useOpportunityDetail } from '@/lib/hooks/queries/useFunding';
import { useTrackedOpportunitiesStore } from '@/lib/stores/trackedOpportunitiesStore';
import { queryKeys } from '@/lib/queries/queryKeys';
import {
	getCategoryColor,
	formatCategoryForDisplay,
} from '@/lib/utils/uiHelpers';

function parseActionableSummary(text) {
	if (!text || !text.startsWith('VERDICT:')) return null;

	const sections = {};
	const labels = ['VERDICT', 'WHO', 'WHAT', 'MONEY', 'PROCESS', 'CRITERIA', 'FLAGS'];

	for (let i = 0; i < labels.length; i++) {
		const label = labels[i];
		const nextLabel = labels[i + 1];
		const startPattern = `${label}:`;
		const startIdx = text.indexOf(startPattern);
		if (startIdx === -1) continue;

		const contentStart = startIdx + startPattern.length;
		const endIdx = nextLabel
			? text.indexOf(`\n${nextLabel}:`, contentStart)
			: text.length;
		const content = text.slice(contentStart, endIdx === -1 ? text.length : endIdx).trim();

		if (label === 'VERDICT') {
			const scoreMatch = content.match(/^([\d.]+)\/10\s*[—–-]\s*(.*)/s);
			sections.verdict = scoreMatch
				? { score: parseFloat(scoreMatch[1]), description: scoreMatch[2].trim() }
				: { score: null, description: content };
		} else {
			sections[label.toLowerCase()] = content;
		}
	}
	return sections;
}

function getScoreColor(score) {
	if (score >= 7) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' };
	if (score >= 4) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
	return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
}

const SUMMARY_SECTIONS = [
	{ key: 'who', label: 'Who', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'border-l-blue-400' },
	{ key: 'what', label: 'What', icon: Wrench, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'border-l-blue-400' },
	{ key: 'money', label: 'Money', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', accent: 'border-l-emerald-400' },
	{ key: 'process', label: 'Process', icon: ClipboardList, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'border-l-blue-400' },
	{ key: 'criteria', label: 'Criteria', icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', accent: 'border-l-blue-400' },
	{ key: 'flags', label: 'Flags', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', accent: 'border-l-amber-400' },
];

export default function OpportunityDetailPage() {
	const params = useParams();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: opportunity, isLoading, error } = useOpportunityDetail(params.id);

	const { isAdmin } = useAuth();
	const trackedIds = useTrackedOpportunitiesStore((s) => s.trackedOpportunityIds);
	const toggleTracked = useTrackedOpportunitiesStore((s) => s.toggleTracked);
	const isTracked = (id) => trackedIds.includes(id);

	// Admin review state
	const [adminActionLoading, setAdminActionLoading] = useState(false);
	const [adminNotification, setAdminNotification] = useState(null);
	const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
	const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
	const [reviewNotes, setReviewNotes] = useState('');

	if (isLoading) {
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
						<p>Error: {error.message}</p>
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

	// Admin review action handlers
	const showAdminNotification = (message, type = 'info') => {
		setAdminNotification({ message, type });
		setTimeout(() => setAdminNotification(null), 4000);
	};

	const handleAdminApprove = async () => {
		setAdminActionLoading(true);
		try {
			const res = await fetch('/api/admin/review/approve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: [opportunity.id], reviewed_by: 'admin' }),
			});
			if (!res.ok) throw new Error('Approve failed');
			queryClient.setQueryData(queryKeys.funding.detail(params.id), (prev) => ({ ...prev, promotion_status: 'promoted', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }));
			showAdminNotification('Record approved successfully', 'success');
		} catch (err) {
			showAdminNotification(`Error: ${err.message}`, 'error');
		} finally {
			setAdminActionLoading(false);
		}
	};

	const handleAdminReject = async () => {
		setAdminActionLoading(true);
		try {
			const res = await fetch('/api/admin/review/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: [opportunity.id], reviewed_by: 'admin', review_notes: reviewNotes || undefined }),
			});
			if (!res.ok) throw new Error('Reject failed');
			queryClient.setQueryData(queryKeys.funding.detail(params.id), (prev) => ({ ...prev, promotion_status: 'rejected', reviewed_by: 'admin', reviewed_at: new Date().toISOString(), review_notes: reviewNotes || null }));
			setRejectDialogOpen(false);
			setReviewNotes('');
			showAdminNotification('Record rejected', 'success');
		} catch (err) {
			showAdminNotification(`Error: ${err.message}`, 'error');
		} finally {
			setAdminActionLoading(false);
		}
	};

	const handleAdminDowngrade = async () => {
		setAdminActionLoading(true);
		try {
			const res = await fetch('/api/admin/review/demote', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: opportunity.id, reviewed_by: 'admin', review_notes: reviewNotes || undefined }),
			});
			if (!res.ok) throw new Error('Downgrade failed');
			queryClient.setQueryData(queryKeys.funding.detail(params.id), (prev) => ({ ...prev, promotion_status: 'rejected', reviewed_by: 'admin', reviewed_at: new Date().toISOString(), review_notes: reviewNotes || null }));
			setDowngradeDialogOpen(false);
			setReviewNotes('');
			showAdminNotification('Record downgraded to rejected', 'success');
		} catch (err) {
			showAdminNotification(`Error: ${err.message}`, 'error');
		} finally {
			setAdminActionLoading(false);
		}
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
						<Card className='border-t-4 border-t-blue-600 shadow-md transition-all duration-300 overflow-hidden'>

							<CardHeader className='bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/20 dark:to-transparent pb-4'>
								<div className='flex justify-between items-start'>
									<div>
										<CardTitle className='text-2xl font-semibold text-neutral-900 dark:text-neutral-50'>
											{opportunity.title}
										</CardTitle>
										<CardDescription className='text-base mt-1.5 text-neutral-600 dark:text-neutral-400'>
											{opportunity.agency_name ||
												opportunity.source_display_name}
										</CardDescription>
										{/* Inline data bar for quick qualification */}
										<div className='flex items-center gap-3 mt-3 text-sm flex-wrap'>
											<span className='flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold'>
												<DollarSign className='h-3.5 w-3.5' />
												{opportunity.minimum_award && opportunity.maximum_award
													? `${formatCurrency(opportunity.minimum_award)} – ${formatCurrency(opportunity.maximum_award)}`
													: opportunity.maximum_award
													? `Up to ${formatCurrency(opportunity.maximum_award)}`
													: opportunity.minimum_award
													? `From ${formatCurrency(opportunity.minimum_award)}`
													: 'Amount TBD'}
											</span>
											<span className='text-neutral-300 dark:text-neutral-600'>|</span>
											<span className='flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400'>
												<Calendar className='h-3.5 w-3.5' />
												{opportunity.close_date ? formatDate(opportunity.close_date) : 'Rolling'}
											</span>
											{(opportunity.is_national || (opportunity.coverage_area_names && opportunity.coverage_area_names.length > 0)) && (
												<>
													<span className='text-neutral-300 dark:text-neutral-600'>|</span>
													<span className='flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400'>
														<MapPin className='h-3.5 w-3.5' />
														{opportunity.is_national ? 'National' : opportunity.coverage_area_names?.slice(0, 2).join(', ')}
													</span>
												</>
											)}
										</div>
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
							<CardContent className='px-4 sm:px-6 pt-2 pb-6'>
								<Tabs defaultValue='summary' className='w-full'>
									<TabsList className='mb-6 bg-neutral-100 dark:bg-neutral-800/50 p-1.5 rounded-lg'>
										{(isAdmin
										? ['summary', 'narrative', 'eligibility', 'relevance', 'admin']
										: ['summary', 'narrative', 'eligibility']
									).map((tab) => (
											<TabsTrigger
												key={tab}
												value={tab}
												className='capitalize min-h-[36px] px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-neutral-100 data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] data-[state=active]:font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all duration-200 rounded-md'>
												{tab}
											</TabsTrigger>
										))}
									</TabsList>

									<TabsContent
										value='summary'
										className='animate-in fade-in-50 duration-300'>
										{(() => {
											const parsed = parseActionableSummary(opportunity.actionable_summary);
											if (!parsed) {
												return (
													<div className='bg-neutral-50 dark:bg-neutral-900/30 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800'>
														<p className='text-neutral-500 dark:text-neutral-400 text-sm'>
															{opportunity.actionable_summary || 'No summary available for this opportunity.'}
														</p>
													</div>
												);
											}
											const scoreColor = parsed.verdict.score !== null ? getScoreColor(parsed.verdict.score) : null;
											return (
												<div className='space-y-4'>
													{/* VERDICT Hero */}
													<div className='flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-lg bg-gradient-to-br from-neutral-50 to-neutral-50/50 dark:from-neutral-900/40 dark:to-neutral-900/20 border border-neutral-200 dark:border-neutral-700 border-l-4 border-l-blue-500 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'>
														{scoreColor && parsed.verdict.score !== null && (
															<div className={`flex-shrink-0 w-16 h-16 rounded-2xl ${scoreColor.bg} ${scoreColor.border} border-2 flex flex-col items-center justify-center shadow-sm`}>
																<span className={`text-2xl font-bold tracking-tight ${scoreColor.text}`}>
																	{parsed.verdict.score}
																</span>
																<span className={`text-[10px] font-semibold ${scoreColor.text} opacity-60`}>/10</span>
															</div>
														)}
														<div className='flex-1 min-w-0'>
															<p className='text-neutral-800 dark:text-neutral-200 text-base leading-relaxed'>
																{parsed.verdict.description}
															</p>
														</div>
													</div>

													{/* Detail Sections */}
													<div className='grid gap-3'>
														{SUMMARY_SECTIONS.map(({ key, label, icon: Icon, color, bg, accent }) => {
															const content = parsed[key];
															if (!content) return null;
															const isFlags = key === 'flags';
															return (
																<div
																	key={key}
																	className={`flex items-start gap-3 p-3 sm:p-4 rounded-lg border border-l-4 shadow-sm ${accent} ${
																		isFlags
																			? 'bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-900/20 dark:to-amber-900/5 border-amber-200/70 dark:border-amber-800/30'
																			: 'bg-white dark:bg-neutral-900/30 border-neutral-200/70 dark:border-neutral-800/30'
																	}`}>
																	<div className={`flex-shrink-0 p-2 rounded-lg ${bg}`}>
																		<Icon className={`h-4 w-4 ${color}`} />
																	</div>
																	<div className='min-w-0'>
																		<span className={`text-sm font-semibold uppercase tracking-wider ${isFlags ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-700 dark:text-neutral-400'}`}>
																			{label}
																		</span>
																		<p className={`text-sm leading-relaxed mt-0.5 ${isFlags ? 'text-amber-900 dark:text-amber-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
																			{content}
																		</p>
																	</div>
																</div>
															);
														})}
													</div>
												</div>
											);
										})()}
									</TabsContent>

									<TabsContent
										value='narrative'
										className='animate-in fade-in-50 duration-300'>
										{/* 1. Program Overview */}
										{opportunity.program_overview && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 border-l-4 border-l-blue-500 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20'>
														<Info className='h-5 w-5 text-blue-600 dark:text-blue-400' />
													</div>
													<h3 className='text-base font-semibold text-neutral-900 dark:text-neutral-100'>
														Program Overview
													</h3>
												</div>
												<p className='text-neutral-700 dark:text-neutral-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_overview}
												</p>
											</div>
										)}

										{/* 2. Program Use Cases */}
										{opportunity.program_use_cases && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 border-l-4 border-l-blue-500 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20'>
														<Target className='h-5 w-5 text-blue-600 dark:text-blue-400' />
													</div>
													<h3 className='text-base font-semibold text-neutral-900 dark:text-neutral-100'>
														Program Use Cases
													</h3>
												</div>
												<p className='text-neutral-700 dark:text-neutral-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_use_cases}
												</p>
											</div>
										)}

										{/* 3. Program Insights */}
										{opportunity.program_insights && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 border-l-4 border-l-amber-500 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20'>
														<Lightbulb className='h-5 w-5 text-amber-600 dark:text-amber-400' />
													</div>
													<h3 className='text-base font-semibold text-neutral-900 dark:text-neutral-100'>
														Program Insights
													</h3>
												</div>
												<p className='text-neutral-700 dark:text-neutral-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.program_insights}
												</p>
											</div>
										)}

										{/* 4. Application Summary */}
										{opportunity.application_summary && (
											<div className='mb-6 bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 border-l-4 border-l-green-500 shadow-sm'>
												<div className='flex items-start mb-2'>
													<div className='mr-3 p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20'>
														<FileText className='h-5 w-5 text-green-600 dark:text-green-400' />
													</div>
													<h3 className='text-base font-semibold text-neutral-900 dark:text-neutral-100'>
														Application Summary
													</h3>
												</div>
												<p className='text-neutral-700 dark:text-neutral-300 pl-10 whitespace-pre-line leading-relaxed'>
													{opportunity.application_summary}
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
															<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
																<Users className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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
															<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
																<CheckCircle2 className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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
													<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
														<ClipboardList className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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
														<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
															<Info className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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
									<TabsContent value='admin'>
										<div className='space-y-6'>
											{/* Admin notification */}
											{adminNotification && (
												<div className={`p-3 rounded-md text-sm ${
													adminNotification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
													adminNotification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
													'bg-blue-50 text-blue-800 border border-blue-200'
												}`}>
													{adminNotification.message}
												</div>
											)}

											{/* Current Status */}
											<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
												<h3 className='text-lg font-medium mb-3'>Promotion Status</h3>
												<div className='flex items-center gap-3'>
													{opportunity.promotion_status === 'pending_review' && (
														<Badge className='bg-amber-500 text-white px-3 py-1 text-sm'>Pending Review</Badge>
													)}
													{opportunity.promotion_status === 'promoted' && (
														<Badge className='bg-green-600 text-white px-3 py-1 text-sm'>Promoted (Visible)</Badge>
													)}
													{opportunity.promotion_status === 'rejected' && (
														<Badge variant='destructive' className='px-3 py-1 text-sm'>Rejected (Hidden)</Badge>
													)}
													{opportunity.promotion_status === null && (
														<Badge variant='outline' className='px-3 py-1 text-sm'>API Record (Legacy)</Badge>
													)}
												</div>
											</div>

											{/* Review Metadata */}
											{opportunity.reviewed_by && (
												<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
													<h3 className='text-lg font-medium mb-3'>Review History</h3>
													<div className='grid gap-2 text-sm'>
														<div>
															<span className='text-muted-foreground font-medium'>Reviewed by:</span>{' '}
															<span>{opportunity.reviewed_by}</span>
														</div>
														<div>
															<span className='text-muted-foreground font-medium'>Reviewed at:</span>{' '}
															<span>{opportunity.reviewed_at ? formatDate(opportunity.reviewed_at) : '—'}</span>
														</div>
														{opportunity.review_notes && (
															<div>
																<span className='text-muted-foreground font-medium'>Notes:</span>
																<div className='mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-sm'>
																	{opportunity.review_notes}
																</div>
															</div>
														)}
													</div>
												</div>
											)}

											{/* Action Buttons */}
											<div className='bg-white dark:bg-neutral-900/30 p-5 rounded-lg border border-neutral-200/70 dark:border-neutral-800/30 shadow-sm'>
												<h3 className='text-lg font-medium mb-3'>Admin Actions</h3>
												<div className='flex flex-wrap gap-3'>
													{opportunity.promotion_status === 'pending_review' && (
														<>
															<Button
																className='bg-green-600 hover:bg-green-700 text-white'
																onClick={handleAdminApprove}
																disabled={adminActionLoading}
															>
																Approve
															</Button>
															<Button
																variant='destructive'
																onClick={() => setRejectDialogOpen(true)}
																disabled={adminActionLoading}
															>
																Reject
															</Button>
														</>
													)}
													{(opportunity.promotion_status === 'promoted' || opportunity.promotion_status === null) && (
														<Button
															variant='destructive'
															onClick={() => setDowngradeDialogOpen(true)}
															disabled={adminActionLoading}
														>
															Downgrade to Rejected
														</Button>
													)}
													{opportunity.promotion_status === 'rejected' && (
														<Button
															className='bg-green-600 hover:bg-green-700 text-white'
															onClick={handleAdminApprove}
															disabled={adminActionLoading}
														>
															Re-approve
														</Button>
													)}
												</div>
											</div>
										</div>
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>

						{opportunity.url && (
							<Card className='shadow-sm overflow-hidden'>
								<CardHeader className='border-b border-neutral-100 dark:border-neutral-800 pb-3'>
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
						<Card className='overflow-hidden shadow-sm'>
							<CardHeader className='relative border-b border-neutral-100 dark:border-neutral-800 pb-3'>
								<CardTitle className='text-xl font-semibold text-neutral-900 dark:text-neutral-100'>
									Key Details
								</CardTitle>
							</CardHeader>

							<CardContent className='relative space-y-4 pt-5'>
								{/* Award Amount Section */}
								<div className='flex items-start'>
									<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
										<DollarSign className='h-5 w-5 text-blue-600 dark:text-blue-400' />
									</div>
									<div>
										<div className='font-medium text-neutral-900 dark:text-neutral-100'>
											Award Amount
										</div>
										<div className='text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5'>
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
										<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
											<FileText className='h-5 w-5 text-blue-600 dark:text-blue-400' />
										</div>
										<div>
											<div className='font-medium text-neutral-900 dark:text-neutral-100'>
												Funding Type
											</div>
											<div className='text-neutral-700 dark:text-neutral-300 mt-0.5'>
												{opportunity.funding_type}
											</div>
											{opportunity.incentive_structure && (
												<div className='text-sm text-neutral-500 dark:text-neutral-400 mt-1'>
													{opportunity.incentive_structure.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Separator */}
								<div className='py-0.5'>
									<div className='h-px w-full bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent' />
								</div>

								{/* Important Dates Section */}
								<div className='flex items-start'>
									<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
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
										<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
											<Building className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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

								{/* Separator */}
								<div className='py-0.5'>
									<div className='h-px w-full bg-gradient-to-r from-transparent via-neutral-200 dark:via-neutral-700 to-transparent' />
								</div>

								{/* Source Information Section */}
								<div className='flex items-start'>
									<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
										<Globe className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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
									<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
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
										) : opportunity.coverage_area_names &&
										  opportunity.coverage_area_names.length > 0 ? (
											<div>
												<div className='text-sm text-neutral-800 dark:text-neutral-200 mb-1'>
													Available in {opportunity.coverage_area_names.length}{' '}
													location{opportunity.coverage_area_names.length > 1 ? 's' : ''}:
												</div>
												<div className='flex flex-wrap gap-1 max-w-[240px]'>
													{opportunity.coverage_area_names.map((name, index) => (
														<Badge
															key={index}
															variant='outline'
															className='text-xs border-neutral-200 dark:border-neutral-700'>
															{name}
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
												<div className='text-xs text-amber-600 dark:text-amber-500 mt-1'>
													Coverage areas not linked
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
									<div className='mr-3 flex-shrink-0 h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center'>
										<Info className='h-5 w-5 text-blue-600 dark:text-blue-400' />
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

						<Card className='overflow-hidden shadow-sm'>
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

			{/* Reject Dialog */}
			<Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject Record</DialogTitle>
						<DialogDescription>
							This record will be hidden from end users. Add an optional note.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="Rejection reason (optional)..."
						value={reviewNotes}
						onChange={(e) => setReviewNotes(e.target.value)}
						rows={3}
					/>
					<DialogFooter>
						<Button variant='outline' onClick={() => { setRejectDialogOpen(false); setReviewNotes(''); }}>
							Cancel
						</Button>
						<Button variant='destructive' onClick={handleAdminReject} disabled={adminActionLoading}>
							Reject
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Downgrade Dialog */}
			<Dialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Downgrade Record</DialogTitle>
						<DialogDescription>
							This will change the record's status to rejected, hiding it from end users.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="Reason for downgrade (optional)..."
						value={reviewNotes}
						onChange={(e) => setReviewNotes(e.target.value)}
						rows={3}
					/>
					<DialogFooter>
						<Button variant='outline' onClick={() => { setDowngradeDialogOpen(false); setReviewNotes(''); }}>
							Cancel
						</Button>
						<Button variant='destructive' onClick={handleAdminDowngrade} disabled={adminActionLoading}>
							Downgrade
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</MainLayout>
	);
}

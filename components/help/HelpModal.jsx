'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	X,
	ChevronDown,
	ChevronUp,
	Lightbulb,
	Search,
	Users,
	Calendar,
	Mail,
	HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const gettingStartedSteps = [
	{
		number: 1,
		title: 'Explore Funding Opportunities',
		icon: Search,
		points: [
			'Browse grants, rebates, and incentives from government and utility programs',
			'Use filters to narrow by location, project type, and eligibility',
			'Check relevance scores to see what\'s most applicable to your needs',
		],
		tip: 'Start with the Map View to see what\'s available in your region',
	},
	{
		number: 2,
		title: 'Add Your Clients',
		icon: Users,
		points: [
			'Create client profiles with their location and project needs',
			'The system automatically matches clients to relevant opportunities',
			'Higher match scores indicate a better fit for your client',
		],
		tip: 'Be specific about project needs for better matches',
	},
	{
		number: 3,
		title: 'Track Deadlines',
		icon: Calendar,
		points: [
			'Timeline shows upcoming application deadlines at a glance',
			'Color-coded urgency helps you prioritize (red = due soon)',
			'Never miss a funding window for your clients',
		],
		tip: 'Check the dashboard regularly for deadline alerts',
	},
];

export default function HelpModal({ open, onClose }) {
	const [mounted, setMounted] = useState(false);
	const [showDataInfo, setShowDataInfo] = useState(false);
	const [animateIn, setAnimateIn] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (open) {
			requestAnimationFrame(() => {
				setAnimateIn(true);
			});
		} else {
			setAnimateIn(false);
		}
	}, [open]);

	useEffect(() => {
		const handleEscape = (e) => {
			if (e.key === 'Escape' && open) {
				onClose();
			}
		};
		window.addEventListener('keydown', handleEscape);
		return () => window.removeEventListener('keydown', handleEscape);
	}, [open, onClose]);

	if (!mounted || !open) return null;

	return createPortal(
		<div
			className={cn(
				'fixed inset-0 z-50 flex items-center justify-center p-4',
				'transition-opacity duration-200',
				animateIn ? 'opacity-100' : 'opacity-0'
			)}
			onClick={onClose}>
			{/* Backdrop */}
			<div className='absolute inset-0 bg-black/60 backdrop-blur-sm' />

			{/* Modal */}
			<div
				className={cn(
					'relative w-full max-w-xl max-h-[90vh] overflow-hidden',
					'bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl',
					'border border-neutral-200 dark:border-neutral-800',
					'transition-all duration-300 ease-out',
					animateIn ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
				)}
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className='relative px-6 pt-6 pb-4 border-b border-neutral-100 dark:border-neutral-800'>
					<button
						onClick={onClose}
						className='absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors'>
						<X className='w-5 h-5 text-neutral-500' />
					</button>
					<div className='flex items-center gap-3'>
						<div className='p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30'>
							<HelpCircle className='w-6 h-6 text-blue-600 dark:text-blue-400' />
						</div>
						<div>
							<h2 className='text-xl font-bold text-neutral-900 dark:text-white'>
								Getting Started
							</h2>
							<p className='text-sm text-neutral-500 dark:text-neutral-400'>
								Learn how to use Meridian
							</p>
						</div>
					</div>
				</div>

				{/* Scrollable Content */}
				<div className='overflow-y-auto max-h-[calc(90vh-160px)] px-6 py-5'>
					{/* Welcome */}
					<p className='text-neutral-700 dark:text-neutral-300 mb-6 text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-lg py-4 px-5'>
						<span className='font-semibold text-blue-600 dark:text-blue-400'>Meridian</span>{' '}
						helps you discover funding opportunities and match them to your clients.
					</p>

					{/* Getting Started Steps */}
					<div className='space-y-5 mb-6'>
						{gettingStartedSteps.map((step) => (
							<StepCard key={step.number} step={step} />
						))}
					</div>

					{/* Understanding the Data - Collapsible */}
					<div className='border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden'>
						<button
							onClick={() => setShowDataInfo(!showDataInfo)}
							className='w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors'>
							<span className='font-medium text-neutral-700 dark:text-neutral-300'>
								Understanding the Data
							</span>
							{showDataInfo ? (
								<ChevronUp className='w-4 h-4 text-neutral-400' />
							) : (
								<ChevronDown className='w-4 h-4 text-neutral-400' />
							)}
						</button>
						<div
							className={cn(
								'overflow-hidden transition-all duration-200',
								showDataInfo ? 'max-h-[500px]' : 'max-h-0'
							)}>
							<div className='px-4 pb-4 pt-2 space-y-4 text-sm'>
								{/* Relevance Scores */}
								<div>
									<h4 className='font-medium text-neutral-800 dark:text-neutral-200 mb-2'>
										Relevance Scores (1-10)
									</h4>
									<ul className='space-y-1 text-neutral-600 dark:text-neutral-400'>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-green-500'></span>
											<span><strong>8-10:</strong> Excellent match — prioritize these</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-yellow-500'></span>
											<span><strong>6-7:</strong> Good potential — worth reviewing</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-orange-500'></span>
											<span><strong>4-5:</strong> Possible fit — check eligibility</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-red-500'></span>
											<span><strong>Below 4:</strong> Likely not a match</span>
										</li>
									</ul>
								</div>

								{/* Deadline Colors */}
								<div>
									<h4 className='font-medium text-neutral-800 dark:text-neutral-200 mb-2'>
										Deadline Urgency
									</h4>
									<ul className='space-y-1 text-neutral-600 dark:text-neutral-400'>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-red-500'></span>
											<span>3 days or less — act now</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-orange-500'></span>
											<span>Within a week</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-yellow-500'></span>
											<span>Within 2 weeks</span>
										</li>
										<li className='flex items-center gap-2'>
											<span className='w-2 h-2 rounded-full bg-green-500'></span>
											<span>More than 2 weeks — plenty of time</span>
										</li>
									</ul>
								</div>

								{/* Opportunity Status */}
								<div>
									<h4 className='font-medium text-neutral-800 dark:text-neutral-200 mb-2'>
										Opportunity Status
									</h4>
									<ul className='space-y-1 text-neutral-600 dark:text-neutral-400'>
										<li><strong>Open:</strong> Currently accepting applications</li>
										<li><strong>Closing Soon:</strong> Deadline approaching</li>
										<li><strong>Closed:</strong> No longer accepting</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className='px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50'>
					<div className='flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400'>
						<Mail className='w-4 h-4' />
						<span>
							Questions?{' '}
							<a
								href='mailto:gborh@esg.email'
								className='text-blue-600 dark:text-blue-400 hover:underline'>
								gborh@esg.email
							</a>
						</span>
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}

function StepCard({ step }) {
	const Icon = step.icon;

	return (
		<div className='relative'>
			{/* Step content */}
			<div className='flex gap-4'>
				{/* Number circle */}
				<div className='flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center'>
					<span className='text-sm font-bold text-blue-600 dark:text-blue-400'>
						{step.number}
					</span>
				</div>

				<div className='flex-1 min-w-0'>
					{/* Title */}
					<div className='flex items-center gap-2 mb-2'>
						<Icon className='w-4 h-4 text-neutral-500 dark:text-neutral-400' />
						<h3 className='font-semibold text-neutral-900 dark:text-white'>
							{step.title}
						</h3>
					</div>

					{/* Points */}
					<ul className='space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400 mb-3'>
						{step.points.map((point, i) => (
							<li key={i} className='flex items-start gap-2'>
								<span className='text-neutral-400 mt-1'>•</span>
								<span>{point}</span>
							</li>
						))}
					</ul>

					{/* Tip */}
					<div className='flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2'>
						<Lightbulb className='w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0' />
						<p className='text-sm text-amber-800 dark:text-amber-300'>
							<span className='font-medium'>Tip:</span> {step.tip}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

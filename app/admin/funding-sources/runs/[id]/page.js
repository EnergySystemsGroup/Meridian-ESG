'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RunStageCard } from '@/app/components/admin/RunStageCard';
import { toast } from 'sonner';

export default function RunDetailPage() {
	const supabase = createClientComponentClient();
	const router = useRouter();
	const { id } = useParams();
	const [run, setRun] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchRun();
		subscribeToRun();
	}, [id]);

	async function fetchRun() {
		try {
			const { data, error } = await supabase
				.from('api_source_runs')
				.select('*, api_sources(*)')
				.eq('id', id)
				.single();

			if (error) throw error;
			setRun(data);
		} catch (error) {
			console.error('Error fetching run:', error);
			toast.error('Failed to load run details');
		} finally {
			setLoading(false);
		}
	}

	function subscribeToRun() {
		const channel = supabase
			.channel('run_updates')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'api_source_runs',
					filter: `id=eq.${id}`,
				},
				(payload) => {
					if (payload.new) {
						setRun((currentRun) => ({
							...currentRun,
							...payload.new,
						}));
					}
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}

	const stages = [
		{
			title: 'Source Manager',
			description:
				'Analyzing API source configuration and setting up request parameters',
			status: run?.source_manager_status,
			metrics: run?.source_manager_metrics,
		},
		{
			title: 'API Handler',
			description: 'Making API calls and performing first-stage filtering',
			status: run?.api_handler_status,
			metrics: run?.api_handler_metrics,
		},
		{
			title: 'Detail Processor',
			description: 'Conducting deep analysis and second-stage filtering',
			status: run?.detail_processor_status,
			metrics: run?.detail_processor_metrics,
		},
		{
			title: 'Data Processor',
			description: 'Normalizing and storing opportunities',
			status: run?.data_processor_status,
			metrics: run?.data_processor_metrics,
		},
	];

	return (
		<div className='container py-8 space-y-8'>
			<div className='flex items-center justify-between'>
				<div className='flex items-center gap-4'>
					<Button variant='ghost' size='icon' onClick={() => router.back()}>
						<ArrowLeft className='h-4 w-4' />
					</Button>
					<div>
						<h1 className='text-2xl font-bold'>Processing Run Details</h1>
						{run && (
							<p className='text-muted-foreground'>
								{run.api_sources.name} -{' '}
								{new Date(run.created_at).toLocaleString()}
							</p>
						)}
					</div>
				</div>
			</div>

			<div className='grid gap-6 md:grid-cols-2'>
				{stages.map((stage) => (
					<RunStageCard
						key={stage.title}
						title={stage.title}
						description={stage.description}
						status={stage.status}
						metrics={stage.metrics}
						loading={loading}
					/>
				))}
			</div>
		</div>
	);
}

'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/app/components/ui/tabs';
import { toast } from 'sonner';

export default function DebugPage() {
	const supabase = createClientComponentClient();
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState(null);
	const [activeTab, setActiveTab] = useState('initial-route');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const [loadingSources, setLoadingSources] = useState(true);

	useEffect(() => {
		fetchSources();
	}, []);

	async function fetchSources() {
		try {
			setLoadingSources(true);
			const { data, error } = await supabase
				.from('api_sources')
				.select('id, name, organization, type')
				.order('name');

			if (error) throw error;
			setSources(data || []);
		} catch (error) {
			console.error('Error fetching sources:', error);
			toast.error('Failed to load API sources');
		} finally {
			setLoadingSources(false);
		}
	}

	async function runDebugTest() {
		if (!selectedSource) {
			toast.error('Please select a source first');
			return;
		}

		setLoading(true);
		setResult(null);

		try {
			const response = await fetch(`/api/admin/debug/${activeTab}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					sourceId: selectedSource,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Debug test failed');
			}

			const data = await response.json();
			setResult(data);
			toast.success(`${activeTab} test completed successfully`);
		} catch (error) {
			console.error(`Error running ${activeTab} test:`, error);
			toast.error(error.message || 'Debug test failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='container py-8'>
			<h1 className='text-3xl font-bold mb-6'>API Processing Debug</h1>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
				<Card>
					<CardHeader>
						<CardTitle>Select API Source</CardTitle>
						<CardDescription>
							Choose a source to debug its processing
						</CardDescription>
					</CardHeader>
					<CardContent>
						{loadingSources ? (
							<div className='text-center py-4'>Loading sources...</div>
						) : (
							<div className='space-y-2'>
								{sources.map((source) => (
									<div
										key={source.id}
										className={`p-3 border rounded cursor-pointer ${
											selectedSource === source.id
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200 hover:bg-gray-50'
										}`}
										onClick={() => setSelectedSource(source.id)}>
										<div className='font-medium'>{source.name}</div>
										<div className='text-sm text-gray-500'>
											{source.organization} ({source.type})
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='md:col-span-2'>
					<CardHeader>
						<CardTitle>Debug Components</CardTitle>
						<CardDescription>
							Test individual components of the API processing pipeline
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className='space-y-4'>
							<TabsList className='grid grid-cols-3 md:grid-cols-5 gap-2'>
								<TabsTrigger value='initial-route'>Initial Route</TabsTrigger>
								<TabsTrigger value='process-coordinator'>
									Process Coordinator
								</TabsTrigger>
								<TabsTrigger value='run-manager'>Run Manager</TabsTrigger>
								<TabsTrigger value='source-manager'>Source Manager</TabsTrigger>
								<TabsTrigger value='api-handler'>API Handler</TabsTrigger>
								<TabsTrigger value='detail-processor'>
									Detail Processor
								</TabsTrigger>
								<TabsTrigger value='data-processor'>Data Processor</TabsTrigger>
								<TabsTrigger value='api-endpoint'>API Endpoint</TabsTrigger>
								<TabsTrigger value='db-schema'>DB Schema</TabsTrigger>
							</TabsList>

							<div className='pt-4'>
								<Button
									onClick={runDebugTest}
									disabled={loading || !selectedSource}>
									{loading ? 'Running Test...' : `Run ${activeTab} Test`}
								</Button>
							</div>
						</Tabs>
					</CardContent>
				</Card>
			</div>

			{result && (
				<Card>
					<CardHeader>
						<CardTitle>Test Results</CardTitle>
						<CardDescription>Results from the {activeTab} test</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='bg-gray-50 p-4 rounded-md overflow-auto max-h-[600px]'>
							<pre className='text-sm'>{JSON.stringify(result, null, 2)}</pre>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

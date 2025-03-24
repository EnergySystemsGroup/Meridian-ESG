'use client';

import { useState } from 'react';

export default function ProcessSourcesPage() {
	const [isProcessing, setIsProcessing] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);
	const [processedSources, setProcessedSources] = useState([]);

	const processNextSource = async () => {
		setIsProcessing(true);
		setError(null);

		try {
			const response = await fetch('/api/funding/process-next-source', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to process source');
			}

			setResult(data);

			if (data.source) {
				setProcessedSources((prev) => [data, ...prev]);
			}
		} catch (err) {
			console.error('Error processing source:', err);
			setError(err.message);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div className='container mx-auto py-8 px-4'>
			<h1 className='text-3xl font-bold mb-6'>Process API Sources</h1>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
				<div className='border rounded-lg shadow-sm overflow-hidden'>
					<div className='p-4 border-b bg-gray-50'>
						<h2 className='text-xl font-semibold'>Process Next Source</h2>
						<p className='text-sm text-gray-500'>
							Process the next API source in the queue based on priority and
							last check time
						</p>
					</div>
					<div className='p-4'>
						<p className='text-sm text-gray-500 mb-4'>
							This will use the Source Manager Agent to determine how to process
							the source, followed by the API Handler Agent to extract
							opportunities.
						</p>
					</div>
					<div className='p-4 bg-gray-50 border-t'>
						<button
							onClick={processNextSource}
							disabled={isProcessing}
							className={`w-full py-2 px-4 rounded font-medium ${
								isProcessing
									? 'bg-gray-300 cursor-not-allowed'
									: 'bg-blue-600 hover:bg-blue-700 text-white'
							}`}>
							{isProcessing ? 'Processing...' : 'Process Next Source'}
						</button>
					</div>
				</div>

				<div className='border rounded-lg shadow-sm overflow-hidden'>
					<div className='p-4 border-b bg-gray-50'>
						<h2 className='text-xl font-semibold'>Current Status</h2>
						<p className='text-sm text-gray-500'>
							Status of the most recent processing attempt
						</p>
					</div>
					<div className='p-4'>
						{error && (
							<div className='p-4 mb-4 border border-red-200 bg-red-50 rounded-lg text-red-800'>
								<h3 className='font-semibold'>Error</h3>
								<p>{error}</p>
							</div>
						)}

						{result && (
							<div className='space-y-4'>
								{result.message === 'No sources to process' ? (
									<div className='p-4 border border-yellow-200 bg-yellow-50 rounded-lg text-yellow-800'>
										<h3 className='font-semibold'>No Sources Available</h3>
										<p>
											There are no sources ready to be processed at this time.
										</p>
									</div>
								) : (
									<div className='p-4 border border-green-200 bg-green-50 rounded-lg text-green-800'>
										<h3 className='font-semibold'>Success</h3>
										<p>
											Successfully processed source: {result.source.name}
											<div className='mt-2 flex gap-2'>
												<span className='inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded'>
													{result.opportunitiesFound} Opportunities
												</span>
												<span className='inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded border border-gray-200'>
													{result.source.type}
												</span>
											</div>
										</p>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			<div className='border rounded-lg shadow-sm overflow-hidden'>
				<div className='p-4 border-b bg-gray-50'>
					<h2 className='text-xl font-semibold'>Processing History</h2>
					<p className='text-sm text-gray-500'>
						Recently processed sources in this session
					</p>
				</div>
				<div className='p-4'>
					{processedSources.length === 0 ? (
						<p className='text-sm text-gray-500'>
							No sources have been processed yet.
						</p>
					) : (
						<div className='space-y-4'>
							{processedSources.map((item, index) => (
								<div key={index} className='border rounded-lg p-4'>
									<div className='flex justify-between items-start'>
										<div>
											<h3 className='font-medium'>{item.source.name}</h3>
											<p className='text-sm text-gray-500'>
												{item.source.organization}
											</p>
										</div>
										<span className='inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded'>
											{item.opportunitiesFound} Opportunities
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

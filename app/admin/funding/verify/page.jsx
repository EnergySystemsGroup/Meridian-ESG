'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Remove all UI component imports and use native HTML elements
// We'll only keep the Button import which we know exists
import { Button } from '@/components/ui/button';

export default function VerifyFundingPage() {
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState(null);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState('api-call');

	async function verifyGrantsGov() {
		setLoading(true);
		setError(null);

		try {
			console.log('Making API request');
			const response = await fetch('/api/funding/verify/grants-gov');
			console.log('API response status:', response.status);
			const data = await response.json();
			console.log('API response data:', data);

			if (!response.ok) {
				throw new Error(data.error || 'Verification failed');
			}

			setResults(data);
			console.log('Results set:', data);
		} catch (err) {
			console.error('Error in verification:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='container mx-auto py-8'>
			<div className='flex items-center mb-6'>
				<Link href='/admin/funding-sources' className='mr-4'>
					<Button variant='outline' size='sm'>
						<ArrowLeft className='h-4 w-4 mr-2' />
						Back to Sources
					</Button>
				</Link>
				<h1 className='text-2xl font-bold'>Funding API Verification</h1>
			</div>

			<div className='mb-6'>
				<Button onClick={verifyGrantsGov} disabled={loading}>
					{loading && (
						<div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
					)}
					Verify Grants.gov Integration
				</Button>
			</div>

			{error && (
				<div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6'>
					<p className='font-bold'>Error</p>
					<p>{error}</p>
				</div>
			)}

			{results && (
				<div className='space-y-6'>
					<SourceOverview source={results.source} stats={results.stats} />

					<div className='border-b border-gray-200'>
						<nav className='-mb-px flex space-x-8' aria-label='Tabs'>
							{[
								'api-call',
								'first-filter',
								'detail-calls',
								'second-filter',
								'storage',
							].map((tab) => (
								<button
									key={tab}
									onClick={() => setActiveTab(tab)}
									className={`
										whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
										${
											activeTab === tab
												? 'border-blue-500 text-blue-600'
												: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
										}
									`}>
									{tab
										.split('-')
										.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
										.join(' ')}
								</button>
							))}
						</nav>
					</div>

					{activeTab === 'api-call' && (
						<ApiCallDetails stats={results.stats.initialApiCall} />
					)}
					{activeTab === 'first-filter' && (
						<FirstStageFilterDetails stats={results.stats.firstStageFilter} />
					)}
					{activeTab === 'detail-calls' && (
						<DetailApiCallDetails stats={results.stats.detailApiCalls} />
					)}
					{activeTab === 'second-filter' && (
						<SecondStageFilterDetails stats={results.stats.secondStageFilter} />
					)}
					{activeTab === 'storage' && (
						<DatabaseStorageDetails stats={results.stats.databaseStorage} />
					)}
				</div>
			)}
		</div>
	);
}

function SourceOverview({ source, stats }) {
	// Calculate funnel metrics
	const initialCount = stats.initialApiCall?.totalHitCount || 0;
	const firstFilterCount =
		stats.firstStageFilter?.opportunitiesPassingFirstFilter || 0;
	const detailCallsCount = stats.detailApiCalls?.successfulDetailCalls || 0;
	const secondFilterCount =
		stats.secondStageFilter?.opportunitiesPassingSecondFilter || 0;
	const storedCount = stats.databaseStorage?.storedCount || 0;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>Processing Pipeline Overview</h3>
			<div className='grid grid-cols-5 gap-4 mb-6'>
				<div className='text-center'>
					<p className='text-sm text-gray-500'>Initial Results</p>
					<p className='text-2xl font-bold'>{initialCount}</p>
				</div>
				<div className='text-center'>
					<p className='text-sm text-gray-500'>First Filter</p>
					<p className='text-2xl font-bold'>{firstFilterCount}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							firstFilterCount / initialCount < 0.2
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{initialCount
							? ((firstFilterCount / initialCount) * 100).toFixed(1)
							: 0}
						%
					</span>
				</div>
				<div className='text-center'>
					<p className='text-sm text-gray-500'>Detail Calls</p>
					<p className='text-2xl font-bold'>{detailCallsCount}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							detailCallsCount < firstFilterCount
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{firstFilterCount
							? ((detailCallsCount / firstFilterCount) * 100).toFixed(1)
							: 0}
						%
					</span>
				</div>
				<div className='text-center'>
					<p className='text-sm text-gray-500'>Second Filter</p>
					<p className='text-2xl font-bold'>{secondFilterCount}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							secondFilterCount / detailCallsCount < 0.5
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{detailCallsCount
							? ((secondFilterCount / detailCallsCount) * 100).toFixed(1)
							: 0}
						%
					</span>
				</div>
				<div className='text-center'>
					<p className='text-sm text-gray-500'>Stored</p>
					<p className='text-2xl font-bold'>{storedCount}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							storedCount / initialCount < 0.05
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{initialCount ? ((storedCount / initialCount) * 100).toFixed(1) : 0}
						%
					</span>
				</div>
			</div>

			<div className='w-full h-8 bg-gray-100 rounded-full overflow-hidden'>
				<div className='flex h-full'>
					<div
						className='bg-blue-500 h-full'
						style={{
							width: `${
								initialCount ? (firstFilterCount / initialCount) * 100 : 0
							}%`,
						}}
					/>
					<div
						className='bg-green-500 h-full'
						style={{
							width: `${
								initialCount ? (secondFilterCount / initialCount) * 100 : 0
							}%`,
						}}
					/>
					<div
						className='bg-purple-500 h-full'
						style={{
							width: `${
								initialCount ? (storedCount / initialCount) * 100 : 0
							}%`,
						}}
					/>
				</div>
			</div>

			<div className='mt-4 text-sm text-gray-500'>
				<p>Processing completed in {stats.processingTime}s</p>
			</div>
		</div>
	);
}

function ApiCallDetails({ stats }) {
	if (!stats || Object.keys(stats).length === 0) {
		return (
			<div className='bg-white shadow rounded-lg p-6'>
				<p>No API call data available</p>
			</div>
		);
	}

	const {
		totalHitCount,
		responseTime,
		apiEndpoint,
		sampleResults,
		executionDate,
	} = stats;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>Initial API Call Results</h3>

			<div className='grid grid-cols-3 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Total Results</p>
					<p className='text-2xl font-bold'>{totalHitCount}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Response Time</p>
					<p className='text-2xl font-bold'>{responseTime}ms</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>API Endpoint</p>
					<p className='text-sm font-mono truncate'>{apiEndpoint}</p>
				</div>
			</div>

			<h4 className='text-md font-medium mb-2'>Sample Results</h4>
			<div className='overflow-x-auto'>
				<table className='min-w-full divide-y divide-gray-200'>
					<thead className='bg-gray-50'>
						<tr>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Title
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Opportunity ID
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Close Date
							</th>
						</tr>
					</thead>
					<tbody className='bg-white divide-y divide-gray-200'>
						{sampleResults?.map((result, i) => (
							<tr key={i}>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
									{result.title}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{result.id}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{result.closeDate
										? new Date(result.closeDate).toLocaleDateString()
										: 'N/A'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{executionDate && (
				<p className='mt-4 text-sm text-gray-500'>
					Execution date: {new Date(executionDate).toLocaleString()}
				</p>
			)}
		</div>
	);
}

function FirstStageFilterDetails({ stats }) {
	if (!stats || Object.keys(stats).length === 0) {
		return (
			<div className='bg-white shadow rounded-lg p-6'>
				<p>No first-stage filtering data available</p>
			</div>
		);
	}

	const {
		inputOpportunitiesCount,
		opportunitiesPassingFirstFilter,
		filterPassRate,
		filteringTime,
		filterCriteria,
		rejectionReasons,
	} = stats;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>
				First-Stage Filtering Results
			</h3>

			<div className='grid grid-cols-4 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Input Count</p>
					<p className='text-2xl font-bold'>{inputOpportunitiesCount}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Passed Filter</p>
					<p className='text-2xl font-bold'>
						{opportunitiesPassingFirstFilter}
					</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Pass Rate</p>
					<p className='text-2xl font-bold'>{filterPassRate?.toFixed(1)}%</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Filtering Time</p>
					<p className='text-2xl font-bold'>{filteringTime}ms</p>
				</div>
			</div>

			{filterCriteria && (
				<div className='mb-6'>
					<h4 className='text-md font-medium mb-2'>Filter Criteria</h4>
					<div className='bg-blue-50 p-4 rounded-lg'>
						<ul className='list-disc pl-5 space-y-1'>
							{Object.entries(filterCriteria).map(([key, value], i) => (
								<li key={i} className='text-sm text-blue-800'>
									{key}:{' '}
									{typeof value === 'object' ? JSON.stringify(value) : value}
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{rejectionReasons && Object.keys(rejectionReasons).length > 0 && (
				<div className='mb-6'>
					<h4 className='text-md font-medium mb-2'>Rejection Reasons</h4>
					<div className='bg-yellow-50 p-4 rounded-lg'>
						<ul className='list-disc pl-5 space-y-1'>
							{Object.entries(rejectionReasons).map(([reason, count], i) => (
								<li key={i} className='text-sm text-yellow-800'>
									{reason}: {count} opportunities
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}

function DetailApiCallDetails({ stats }) {
	if (!stats || Object.keys(stats).length === 0) {
		return (
			<div className='bg-white shadow rounded-lg p-6'>
				<p>No detail API call data available</p>
			</div>
		);
	}

	const {
		opportunitiesRequiringDetails,
		successfulDetailCalls,
		failedDetailCalls,
		detailCallErrors,
		averageDetailResponseTime,
		totalDetailCallTime,
		executionDate,
	} = stats;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>Detail API Call Results</h3>

			<div className='grid grid-cols-3 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>
						Opportunities Requiring Details
					</p>
					<p className='text-2xl font-bold'>{opportunitiesRequiringDetails}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Successful Calls</p>
					<p className='text-2xl font-bold'>{successfulDetailCalls}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							successfulDetailCalls / opportunitiesRequiringDetails < 0.9
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{opportunitiesRequiringDetails
							? (
									(successfulDetailCalls / opportunitiesRequiringDetails) *
									100
							  ).toFixed(1)
							: 0}
						%
					</span>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Failed Calls</p>
					<p className='text-2xl font-bold'>{failedDetailCalls}</p>
					<span
						className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
							failedDetailCalls > 0
								? 'bg-red-100 text-red-800'
								: 'bg-green-100 text-green-800'
						}`}>
						{opportunitiesRequiringDetails
							? (
									(failedDetailCalls / opportunitiesRequiringDetails) *
									100
							  ).toFixed(1)
							: 0}
						%
					</span>
				</div>
			</div>

			<div className='grid grid-cols-2 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Avg Response Time</p>
					<p className='text-2xl font-bold'>{averageDetailResponseTime}ms</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Total Call Time</p>
					<p className='text-2xl font-bold'>{totalDetailCallTime}ms</p>
				</div>
			</div>

			{detailCallErrors && detailCallErrors.length > 0 && (
				<div className='mb-6'>
					<h4 className='text-md font-medium mb-2'>Error Summary</h4>
					<div className='bg-red-50 p-4 rounded-lg'>
						<ul className='list-disc pl-5'>
							{detailCallErrors.map((error, i) => (
								<li key={i} className='text-sm text-red-700'>
									{error}
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{executionDate && (
				<p className='mt-4 text-sm text-gray-500'>
					Last execution: {new Date(executionDate).toLocaleString()}
				</p>
			)}
		</div>
	);
}

function SecondStageFilterDetails({ stats }) {
	if (!stats || Object.keys(stats).length === 0) {
		return (
			<div className='bg-white shadow rounded-lg p-6'>
				<p>No second-stage filtering data available</p>
			</div>
		);
	}

	const {
		inputOpportunitiesCount,
		opportunitiesPassingSecondFilter,
		filterPassRate,
		scoreDistribution,
		sampleFinalOpportunities,
		filteringTime,
		rejectionReasons,
	} = stats;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>
				Second-Stage Filtering Results
			</h3>

			<div className='grid grid-cols-4 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Input Count</p>
					<p className='text-2xl font-bold'>{inputOpportunitiesCount}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Passed Filter</p>
					<p className='text-2xl font-bold'>
						{opportunitiesPassingSecondFilter}
					</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Pass Rate</p>
					<p className='text-2xl font-bold'>{filterPassRate?.toFixed(1)}%</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Filtering Time</p>
					<p className='text-2xl font-bold'>{filteringTime}ms</p>
				</div>
			</div>

			{scoreDistribution && Object.keys(scoreDistribution).length > 0 && (
				<div className='mb-6'>
					<h4 className='text-md font-medium mb-2'>Score Distribution</h4>
					<div className='flex items-end h-40 space-x-2'>
						{Object.entries(scoreDistribution)
							.sort((a, b) => Number(a[0]) - Number(b[0]))
							.map(([score, count]) => (
								<div key={score} className='flex flex-col items-center'>
									<div
										className='bg-green-500 w-8'
										style={{
											height: `${
												(count /
													Math.max(...Object.values(scoreDistribution))) *
												100
											}%`,
										}}></div>
									<p className='text-xs mt-1'>{score}</p>
									<p className='text-xs'>{count}</p>
								</div>
							))}
					</div>
				</div>
			)}

			{rejectionReasons && Object.keys(rejectionReasons).length > 0 && (
				<div className='mb-6'>
					<h4 className='text-md font-medium mb-2'>Rejection Reasons</h4>
					<div className='bg-yellow-50 p-4 rounded-lg'>
						<ul className='list-disc pl-5 space-y-1'>
							{Object.entries(rejectionReasons).map(([reason, count], i) => (
								<li key={i} className='text-sm text-yellow-800'>
									{reason}: {count} opportunities
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			<h4 className='text-md font-medium mb-2'>Sample Final Opportunities</h4>
			<div className='overflow-x-auto'>
				<table className='min-w-full divide-y divide-gray-200'>
					<thead className='bg-gray-50'>
						<tr>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Title
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Score
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Focus Areas
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Client Types
							</th>
						</tr>
					</thead>
					<tbody className='bg-white divide-y divide-gray-200'>
						{sampleFinalOpportunities?.map((opp, i) => (
							<tr key={i}>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
									{opp.title}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{opp.relevanceScore}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{opp.focusAreas?.join(', ') || 'N/A'}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{opp.clientTypes?.join(', ') || 'N/A'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function DatabaseStorageDetails({ stats }) {
	if (!stats || Object.keys(stats).length === 0) {
		return (
			<div className='bg-white shadow rounded-lg p-6'>
				<p>No database storage data available</p>
			</div>
		);
	}

	const {
		opportunitiesToStore,
		storedCount,
		recentlyStoredCount,
		storedOpportunities,
	} = stats;

	return (
		<div className='bg-white shadow rounded-lg p-6'>
			<h3 className='text-lg font-medium mb-4'>Database Storage Results</h3>

			<div className='grid grid-cols-3 gap-4 mb-6'>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Opportunities to Store</p>
					<p className='text-2xl font-bold'>{opportunitiesToStore}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Total Stored</p>
					<p className='text-2xl font-bold'>{storedCount}</p>
				</div>
				<div className='text-center p-4 bg-gray-50 rounded-lg'>
					<p className='text-sm text-gray-500'>Stored in Last 24h</p>
					<p className='text-2xl font-bold'>{recentlyStoredCount}</p>
				</div>
			</div>

			<h4 className='text-md font-medium mb-2'>
				Recently Stored Opportunities
			</h4>
			<div className='overflow-x-auto'>
				<table className='min-w-full divide-y divide-gray-200'>
					<thead className='bg-gray-50'>
						<tr>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Title
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Opportunity Number
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Close Date
							</th>
							<th
								scope='col'
								className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Status
							</th>
						</tr>
					</thead>
					<tbody className='bg-white divide-y divide-gray-200'>
						{storedOpportunities?.map((opp, i) => (
							<tr key={i}>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
									{opp.title}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{opp.opportunityNumber}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									{opp.closeDate
										? new Date(opp.closeDate).toLocaleDateString()
										: 'N/A'}
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
									<span
										className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
											opp.status === 'new'
												? 'bg-green-100 text-green-800'
												: 'bg-blue-100 text-blue-800'
										}`}>
										{opp.status === 'new' ? 'New' : 'Updated'}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

# API Source Run Tracking Implementation

## System Overview

This document outlines the implementation of a run tracking system for API source processing. Each time an API source is processed (whether manually triggered or automated), the system creates a comprehensive record of the entire process.

## Implementation Steps

### Step 1: Create Database Table

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Create the api_source_runs table
create table api_source_runs (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references api_sources(id),
  status text not null default 'started',
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,

  -- Tracking data
  initial_api_call jsonb,
  first_stage_filter jsonb,
  detail_api_calls jsonb,
  second_stage_filter jsonb,
  storage_results jsonb,

  error_details text,
  total_processing_time numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add necessary indexes
create index idx_api_source_runs_source_id on api_source_runs(source_id);
create index idx_api_source_runs_status on api_source_runs(status);
```

### Step 2: Create Run Manager Service

Create a new file at `app/lib/services/runManager.js` with the following content:

```javascript
import { createSupabaseClient } from '@/app/lib/supabase';

export class RunManager {
	constructor(existingRunId) {
		this.supabase = createSupabaseClient();
		this.runId = existingRunId || null;
	}

	async startRun(sourceId) {
		const { data, error } = await this.supabase
			.from('api_source_runs')
			.insert({
				source_id: sourceId,
				status: 'started',
			})
			.select()
			.single();

		if (error) throw error;
		this.runId = data.id;
		return data.id;
	}

	async updateInitialApiCall(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				initial_api_call: stats,
				status: 'processing',
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateFirstStageFilter(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				first_stage_filter: stats,
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateDetailApiCalls(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				detail_api_calls: stats,
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateSecondStageFilter(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				second_stage_filter: stats,
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async updateStorageResults(stats) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				storage_results: stats,
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}

	async completeRun(totalTime) {
		if (!this.runId) throw new Error('No active run');

		const updateData = {
			status: 'completed',
			completed_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		if (totalTime) {
			updateData.total_processing_time = totalTime;
		}

		return await this.supabase
			.from('api_source_runs')
			.update(updateData)
			.eq('id', this.runId);
	}

	async updateRunError(error) {
		if (!this.runId) throw new Error('No active run');

		return await this.supabase
			.from('api_source_runs')
			.update({
				status: 'failed',
				error_details: error.message,
				completed_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.eq('id', this.runId);
	}
}
```

### Step 3: Modify Process Endpoint

Update the file at `app/api/funding/sources/[id]/process/route.js` with the following changes:

```javascript
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';
import { sourceManagerAgent } from '@/app/lib/agents/sourceManagerAgent';
import { apiHandlerAgent } from '@/app/lib/agents/apiHandlerAgent';
import { dataProcessorAgent } from '@/app/lib/agents/dataProcessorAgent';
import { processDetailedInfo } from '@/app/lib/agents/detailProcessorAgent';
import { RunManager } from '@/app/lib/services/runManager';

// POST /api/funding/sources/[id]/process - Process a specific API source
export async function POST(request, context) {
	const runManager = new RunManager();
	const startTime = Date.now();

	try {
		const { id } = context.params;
		const supabase = createSupabaseClient();

		// Start a new run
		const runId = await runManager.startRun(id);

		// Get the source with configurations
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.select('*')
			.eq('id', id)
			.single();

		if (sourceError) {
			if (sourceError.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'API source not found' },
					{ status: 404 }
				);
			}
			throw sourceError;
		}

		// Get the source configurations
		const { data: configurations, error: configError } = await supabase
			.from('api_source_configurations')
			.select('*')
			.eq('source_id', id);

		if (configError) {
			throw configError;
		}

		// Format configurations as an object
		const configObject = {};
		configurations.forEach((config) => {
			configObject[config.config_type] = config.configuration;
		});

		// Add configurations to the source
		const sourceWithConfig = {
			...source,
			configurations: configObject,
		};

		// Process the source with the Source Manager Agent
		const initialApiStartTime = Date.now();
		const processingDetails = await sourceManagerAgent(sourceWithConfig);

		// Update run with initial API call results
		await runManager.updateInitialApiCall({
			totalHitCount: processingDetails.totalHits || 0,
			retrievedCount: processingDetails.opportunities?.length || 0,
			firstPageCount: processingDetails.firstPageCount || 0,
			totalPages: processingDetails.totalPages || 0,
			sampleOpportunities: (processingDetails.opportunities || []).slice(0, 3),
			apiEndpoint: processingDetails.apiEndpoint || '',
			responseTime: Date.now() - initialApiStartTime,
			apiCallTime: Date.now() - initialApiStartTime,
		});

		// Process the source with the API Handler Agent
		const firstFilterStartTime = Date.now();
		const handlerResult = await apiHandlerAgent(
			sourceWithConfig,
			processingDetails
		);

		// Update run with first stage filter results
		await runManager.updateFirstStageFilter({
			inputCount: handlerResult.totalOpportunities || 0,
			passedCount: handlerResult.opportunities?.length || 0,
			filterReasoning:
				handlerResult.filteringResults || 'No filtering reasoning provided',
			processingTime: Date.now() - firstFilterStartTime,
			sampleOpportunities: (handlerResult.opportunities || []).slice(0, 3),
		});

		let opportunities = handlerResult.opportunities || [];

		// Check if this is a two-step API source
		const isDetailEnabled =
			processingDetails.detailConfig && processingDetails.detailConfig.enabled;

		if (isDetailEnabled && opportunities.length > 0) {
			// Process with Detail Processor
			const detailStartTime = Date.now();
			const detailResult = await processDetailedInfo(
				opportunities,
				sourceWithConfig
			);

			// Update run with detail API call results
			await runManager.updateDetailApiCalls({
				opportunitiesRequiringDetails: opportunities.length,
				successfulDetailCalls: detailResult.successCount || 0,
				failedDetailCalls: detailResult.errorCount || 0,
				detailCallErrors: detailResult.errors || [],
				averageDetailResponseTime: detailResult.averageResponseTime || 0,
				totalDetailCallTime: Date.now() - detailStartTime,
			});

			// Update opportunities with detailed info
			opportunities = detailResult.opportunities || opportunities;

			// Second stage filtering with detailed information
			const secondFilterStartTime = Date.now();
			const secondStageResult = await detailProcessorAgent(
				opportunities,
				sourceWithConfig
			);

			// Update run with second stage filter results
			await runManager.updateSecondStageFilter({
				inputCount: opportunities.length,
				passedCount: secondStageResult.opportunities?.length || 0,
				filterReasoning:
					secondStageResult.filteringResults ||
					'No second-stage filtering reasoning provided',
				processingTime: Date.now() - secondFilterStartTime,
				sampleOpportunities: (secondStageResult.opportunities || []).slice(
					0,
					3
				),
				llmAnalysis:
					secondStageResult.llmAnalysis || 'No LLM analysis provided',
			});

			// Update opportunities with second stage filtered results
			opportunities = secondStageResult.opportunities || opportunities;
		}

		// Process with Data Processor Agent
		const storageStartTime = Date.now();
		const finalResult = await dataProcessorAgent(
			opportunities,
			handlerResult.rawResponseId
		);

		// Update run with storage results
		await runManager.updateStorageResults({
			attemptedCount: opportunities.length,
			storedCount: finalResult.storedCount || 0,
			updatedCount: finalResult.updatedCount || 0,
			skippedCount: finalResult.skippedCount || 0,
			skippedReasons: finalResult.skippedReasons || {},
			processingTime: Date.now() - storageStartTime,
		});

		// Complete the run
		await runManager.completeRun((Date.now() - startTime) / 1000);

		return NextResponse.json({
			success: true,
			runId,
			source: sourceWithConfig.name,
			opportunities: opportunities.length,
			storedCount: finalResult.storedCount,
			processingTime: (Date.now() - startTime) / 1000,
		});
	} catch (error) {
		console.error('Processing error:', error);
		await runManager.updateRunError(error);

		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
```

### Step 4: Admin UI for Viewing Runs

For the admin UI, we'll implement two main views:

```javascript
// Inside the apiHandlerAgent function, add tracking for filtered opportunities
export async function apiHandlerAgent(source, processingDetails) {
	const startTime = Date.now();
	// ... existing code ...

	// After filtering opportunities, add detailed filtering results
	const filteringResults = {
		totalOpportunities: allOpportunities.length,
		filteredOpportunities: opportunities.length,
		filteringCriteria: processingDetails.filteringCriteria || [],
		filteringTime: Date.now() - filterStartTime,
	};

	return {
		opportunities,
		totalOpportunities: allOpportunities.length,
		filteringResults,
		rawResponseId,
		processingTime: Date.now() - startTime,
	};
}
```

### Step 5: Update Detail Processor Agent

Update `app/lib/agents/detailProcessorAgent.js` to include more detailed tracking for the second stage filter:

```javascript
export async function detailProcessorAgent(detailedOpportunities, source) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// ... existing code ...

		// Process opportunities with LLM
		const llmStartTime = Date.now();
		const llmResults = await processWithLLM(detailedOpportunities);

		// Track detailed second-stage filtering metrics
		const secondStageMetrics = {
			inputCount: detailedOpportunities.length,
			passedCount: llmResults.filteredOpportunities.length,
			rejectionReasons: llmResults.rejectionReasons || {},
			confidenceScores: llmResults.confidenceScores || {},
			llmProcessingTime: Date.now() - llmStartTime,
			llmAnalysis: llmResults.analysisNotes || 'No analysis provided',
		};

		return {
			opportunities: llmResults.filteredOpportunities,
			filteredCount: llmResults.filteredOpportunities.length,
			filteringResults: secondStageMetrics,
			processingMetrics: {
				averageScoreBeforeFiltering: llmResults.averageInitialScore || 0,
				averageScoreAfterFiltering: llmResults.averageFinalScore || 0,
				tokenUsage: llmResults.tokenUsage || 0,
			},
			llmAnalysis: llmResults.analysisNotes,
		};
	} catch (error) {
		console.error('Detail processor error:', error);
		throw error;
	}
}
```

### Step 6: Create Admin UI for Viewing Runs (Optional)

Create a new page at `app/admin/funding/runs/page.jsx`:

```jsx
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';

export default function ApiSourceRunsPage() {
	const [runs, setRuns] = useState([]);
	const [loading, setLoading] = useState(true);
	const supabase = createClientComponentClient();

	useEffect(() => {
		async function fetchRuns() {
			setLoading(true);
			const { data, error } = await supabase
				.from('api_source_runs')
				.select(
					`
					*,
					api_sources(name)
				`
				)
				.order('created_at', { ascending: false })
				.limit(50);

			if (error) {
				console.error('Error fetching runs:', error);
			} else {
				setRuns(data || []);
			}
			setLoading(false);
		}

		fetchRuns();
	}, []);

	return (
		<div className='container mx-auto p-4'>
			<h1 className='text-2xl font-bold mb-4'>API Source Processing Runs</h1>

			{loading ? (
				<p>Loading runs...</p>
			) : (
				<div className='overflow-x-auto'>
					<table className='min-w-full bg-white'>
						<thead>
							<tr className='bg-gray-100'>
								<th className='py-2 px-4 border'>Source</th>
								<th className='py-2 px-4 border'>Status</th>
								<th className='py-2 px-4 border'>Started</th>
								<th className='py-2 px-4 border'>Initial Results</th>
								<th className='py-2 px-4 border'>After First Filter</th>
								<th className='py-2 px-4 border'>After Second Filter</th>
								<th className='py-2 px-4 border'>Stored</th>
								<th className='py-2 px-4 border'>Processing Time</th>
								<th className='py-2 px-4 border'>Actions</th>
							</tr>
						</thead>
						<tbody>
							{runs.map((run) => (
								<tr key={run.id} className='hover:bg-gray-50'>
									<td className='py-2 px-4 border'>
										{run.api_sources?.name || 'Unknown'}
									</td>
									<td className='py-2 px-4 border'>
										<span
											className={`px-2 py-1 rounded ${
												run.status === 'completed'
													? 'bg-green-100 text-green-800'
													: run.status === 'failed'
													? 'bg-red-100 text-red-800'
													: 'bg-blue-100 text-blue-800'
											}`}>
											{run.status}
										</span>
									</td>
									<td className='py-2 px-4 border'>
										{format(new Date(run.started_at), 'MMM d, yyyy HH:mm:ss')}
									</td>
									<td className='py-2 px-4 border'>
										{run.initial_api_call?.retrievedCount || 0}
									</td>
									<td className='py-2 px-4 border'>
										{run.first_stage_filter?.passedCount || 0}
									</td>
									<td className='py-2 px-4 border'>
										{run.second_stage_filter?.passedCount || 0}
									</td>
									<td className='py-2 px-4 border'>
										{run.storage_results?.storedCount || 0}
									</td>
									<td className='py-2 px-4 border'>
										{run.total_processing_time
											? `${run.total_processing_time.toFixed(2)}s`
											: '-'}
									</td>
									<td className='py-2 px-4 border'>
										<a
											href={`/admin/funding/runs/${run.id}`}
											className='text-blue-600 hover:underline'>
											View Details
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
```

## Expected Data Structures

### Initial API Call Stats

```json
{
	"totalHitCount": 500,
	"retrievedCount": 100,
	"firstPageCount": 50,
	"totalPages": 10,
	"sampleOpportunities": [],
	"apiEndpoint": "https://api.example.com/opportunities",
	"responseTime": 1500,
	"apiCallTime": 1500
}
```

### First Stage Filter Stats

```json
{
	"inputCount": 100,
	"passedCount": 30,
	"filterReasoning": "LLM analysis summary...",
	"processingTime": 5000,
	"sampleOpportunities": []
}
```

### Detail API Call Stats

```json
{
	"opportunitiesRequiringDetails": 30,
	"successfulDetailCalls": 28,
	"failedDetailCalls": 2,
	"detailCallErrors": ["Timeout for ID 123", "404 for ID 456"],
	"averageDetailResponseTime": 800,
	"totalDetailCallTime": 24000
}
```

### Second Stage Filter Stats

```json
{
	"inputCount": 28,
	"passedCount": 25,
	"filterReasoning": "Detailed LLM analysis of opportunity content...",
	"processingTime": 8000,
	"sampleOpportunities": [],
	"llmAnalysis": "The LLM identified key patterns in the opportunities..."
}
```

### Storage Results

```json
{
	"attemptedCount": 25,
	"storedCount": 20,
	"updatedCount": 3,
	"skippedCount": 2,
	"skippedReasons": {
		"duplicate": 1,
		"invalid": 1
	},
	"processingTime": 1200
}
```

## Testing the Implementation

1. Create the database table using the SQL in Step 1
2. Create the RunManager service file
3. Update the process endpoint
4. Make a test API call to process an API source:
   ```
   POST /api/funding/sources/{sourceId}/process
   ```
5. Check the `api_source_runs` table to verify that a run record was created and updated

## Troubleshooting

If you encounter issues:

1. Check the database for errors in the `error_details` column
2. Verify that the RunManager is being instantiated correctly
3. Ensure that the process endpoint is correctly passing data to the RunManager
4. Check for JavaScript syntax errors

This implementation provides a complete audit trail of each processing run while maintaining the existing functionality of the system.

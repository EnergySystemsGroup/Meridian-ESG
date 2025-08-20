import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { RunManagerV2 } from '@/lib/services/runManagerV2';
import { JobQueueManager } from '@/lib/services/jobQueueManager';
import { getSourceById, analyzeSource } from '@/lib/agents-v2/core/sourceOrchestrator';
import { fetchAndChunkData } from '@/lib/agents-v2/core/apiCaller';

export async function POST(request, { params }) {
	try {
		console.log('[RouteV3] 🚀 Job creation API route called');

		// Await params before accessing id
		const { id } = await params;
		console.log(`[RouteV3] 📋 Creating jobs for source ID: ${id}`);

		// Parse request body for options
		const body = await request.json().catch(() => ({}));
		const options = {
			chunkSize: body.chunkSize || 5,
			forceFullProcessing: body.forceFullProcessing || false,
			...body
		};

		// Initialize Supabase client
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		);

		// Initialize managers
		const jobManager = new JobQueueManager();
		const runManager = new RunManagerV2(null, supabase);

		console.log('[RouteV3] 🔍 Step 1: Fetching and analyzing source');
		
		// Step 1: Get source and analyze with SourceOrchestrator
		const source = await getSourceById(id);
		if (!source) {
			return NextResponse.json(
				{ error: 'Source not found', sourceId: id },
				{ status: 404 }
			);
		}

		// Step 2: Create master run using RunManagerV2
		const runId = await runManager.startRun(id, {
			pipeline_version: 'v3.0-job-queue',
			job_creation_only: true,
			chunk_size: options.chunkSize,
			force_full_processing: options.forceFullProcessing,
			api_route: 'routeV3'
		});
		console.log(`[RouteV3] 📊 Created master run: ${runId}`);

		// Step 1: Track SourceOrchestrator stage
		// Start tracking source orchestrator stage
		await runManager.updateV2SourceOrchestrator(
			'processing',
			null, // stageResults (will update on completion)
			{}, // performanceMetrics (will update on completion)
			0, // tokensUsed (no LLM calls in source analysis)
			0, // apiCalls (configuration analysis only)
			0, // inputCount (orchestrator has no input)
			0  // outputCount (will update on completion)
		);
		
		const sourceAnalysisStart = Date.now();
		const processingInstructions = await analyzeSource(source, null);
		const sourceAnalysisTime = Date.now() - sourceAnalysisStart;
		
		// Complete tracking source orchestrator stage
		await runManager.updateV2SourceOrchestrator(
			'completed',
			processingInstructions,
			{ executionTime: sourceAnalysisTime },
			0, // tokensUsed (no LLM calls in source analysis)
			0, // apiCalls (configuration analysis only)
			0, // inputCount (orchestrator has no input)
			1  // outputCount (produces 1 analysis result)
		);
		
		console.log(`[RouteV3] ✅ Source analyzed: ${processingInstructions.workflow} workflow`);

		// Step 2: Track ApiFetch stage (API calling and chunking)
		console.log('[RouteV3] 📡 Step 2: Fetching and chunking API data');
		
		// Start ApiFetch stage tracking
		await runManager.updateV2ApiFetch(
			'processing',
			null, // stageResults (will update on completion)
			{}, // performanceMetrics (will update on completion)
			0, // tokensUsed (no LLM in API calls)
			0, // apiCalls (will update on completion)
			1, // inputCount (1 source analysis input)
			0  // outputCount (will update on completion)
		);
		
		const apiStartTime = Date.now();
		const fetchResult = await fetchAndChunkData(
			source, 
			processingInstructions, 
			options.chunkSize
		);
		const apiTime = Date.now() - apiStartTime;

		// Complete ApiFetch stage tracking
		await runManager.updateV2ApiFetch(
			'completed',
			{
				chunks: fetchResult.chunks.length,
				rawResponseId: fetchResult.rawResponseId,
				workflow: processingInstructions.workflow
			},
			{ 
				executionTime: apiTime,
				totalFound: fetchResult.apiMetrics.totalFound || fetchResult.apiMetrics.opportunityCount,
				totalRetrieved: fetchResult.apiMetrics.opportunityCount,
				responseSize: fetchResult.apiMetrics.responseSize,
				retryAttempts: fetchResult.apiMetrics.retryAttempts || 0,
				errorCount: fetchResult.apiMetrics.errors?.length || 0
			},
			0, // tokensUsed (no LLM in API calls)
			fetchResult.apiMetrics.apiCalls, // apiCalls (actual API calls made)
			1, // inputCount (1 source analysis input)
			fetchResult.apiMetrics.opportunityCount // outputCount (opportunities fetched)
		);

		console.log(`[RouteV3] ✅ Data fetched and chunked: ${fetchResult.chunks.length} chunks in ${apiTime}ms`);

		// Step 3: Create jobs for each chunk
		console.log('[RouteV3] 📦 Step 3: Creating processing jobs');
		const jobCreationStart = Date.now();
		const createdJobs = [];

		// Clean processing config by removing any potential circular references
		const cleanProcessingInstructions = {
			workflow: processingInstructions.workflow,
			apiEndpoint: processingInstructions.apiEndpoint,
			requestConfig: processingInstructions.requestConfig,
			queryParameters: processingInstructions.queryParameters,
			requestBody: processingInstructions.requestBody,
			responseConfig: processingInstructions.responseConfig,
			paginationConfig: processingInstructions.paginationConfig,
			detailConfig: processingInstructions.detailConfig,
			responseMapping: processingInstructions.responseMapping,
			authMethod: processingInstructions.authMethod,
			authDetails: processingInstructions.authDetails,
			handlerType: processingInstructions.handlerType,
			apiNotes: processingInstructions.apiNotes,
			processingNotes: processingInstructions.processingNotes,
			executionTime: processingInstructions.executionTime
		};

		// Clean API metrics by removing any potential circular references
		const cleanApiMetrics = {
			fetchTime: fetchResult.apiMetrics.fetchTime,
			apiCalls: fetchResult.apiMetrics.apiCalls,
			responseSize: fetchResult.apiMetrics.responseSize,
			opportunityCount: fetchResult.apiMetrics.opportunityCount,
			retryAttempts: fetchResult.apiMetrics.retryAttempts,
			errors: fetchResult.apiMetrics.errors || [],
			totalFound: fetchResult.apiMetrics.totalFound || 0,
			totalRetrieved: fetchResult.apiMetrics.totalRetrieved || 0
		};

		for (let i = 0; i < fetchResult.chunks.length; i++) {
			const chunk = fetchResult.chunks[i];
			const job = await jobManager.createJob(
				id,
				runId,
				i,
				fetchResult.chunks.length,
				chunk,
				{
					sourceName: source.name,
					sourceId: id,
					rawResponseId: fetchResult.rawResponseId,
					processingInstructions: cleanProcessingInstructions,
					forceFullProcessing: options.forceFullProcessing,
					apiMetrics: cleanApiMetrics
				}
			);
			createdJobs.push({
				jobId: job.id,
				chunkIndex: i,
				opportunityCount: chunk.length
			});
		}

		const jobCreationTime = Date.now() - jobCreationStart;
		console.log(`[RouteV3] ✅ Created ${createdJobs.length} jobs in ${jobCreationTime}ms`);

		const totalTime = Date.now() - apiStartTime; // Total time from API start
		
		// Complete the run using RunManagerV2
		const finalResults = {
			// Job queue metrics
			jobs_created: createdJobs.length,
			chunks_created: fetchResult.chunks.length,
			chunk_size: options.chunkSize,
			job_creation_only: true,
			processing_mode: 'job_queue',
			
			// API fetch metrics  
			total_found: fetchResult.apiMetrics.totalFound || fetchResult.apiMetrics.opportunityCount,
			total_retrieved: fetchResult.apiMetrics.opportunityCount,
			api_calls_made: fetchResult.apiMetrics.apiCalls,
			response_size_bytes: fetchResult.apiMetrics.responseSize,
			retry_attempts: fetchResult.apiMetrics.retryAttempts || 0,
			api_errors: fetchResult.apiMetrics.errors?.length || 0,
			
			// Timing metrics
			source_analysis_time_ms: sourceAnalysisTime,
			api_fetch_time_ms: apiTime,
			job_creation_time_ms: jobCreationTime,
			
			// Processing efficiency
			opportunities_per_job: Math.round(fetchResult.apiMetrics.opportunityCount / createdJobs.length),
			chunking_efficiency: ((fetchResult.apiMetrics.opportunityCount / options.chunkSize) / createdJobs.length * 100).toFixed(1) + '%'
		};
		
		await runManager.completeRun(totalTime, finalResults);
		
		console.log(`[RouteV3] ✅ Job creation completed - ${createdJobs.length} jobs ready for processing`);

		return NextResponse.json({
			success: true,
			message: 'Jobs created successfully',
			version: 'v3.0',
			pipeline: 'job-queue-based',
			sourceId: id,
			sourceName: source.name,
			runId,
			status: 'jobs_created',
			createdAt: new Date().toISOString(),
			summary: {
				totalOpportunities: fetchResult.apiMetrics.opportunityCount,
				totalFound: fetchResult.apiMetrics.totalFound || fetchResult.apiMetrics.opportunityCount,
				chunksCreated: fetchResult.chunks.length,
				chunkSize: options.chunkSize,
				jobsCreated: createdJobs.length
			},
			jobs: createdJobs,
			metrics: {
				fetchTimeMs: apiTime,
				jobCreationTimeMs: jobCreationTime,
				totalTimeMs: totalTime,
				apiCalls: fetchResult.apiMetrics.apiCalls,
				responseSize: fetchResult.apiMetrics.responseSize
			},
			config: {
				workflow: processingInstructions.workflow,
				forceFullProcessing: options.forceFullProcessing,
				pipelineVersion: 'v3.0-job-queue'
			},
			nextSteps: {
				message: 'Jobs are queued for processing by cron workers',
				processingUrl: `/api/cron/process-jobs`,
				statusUrl: `/api/admin/runs/${runId}/status`
			}
		});

	} catch (error) {
		console.error('[RouteV3] ❌ Error creating jobs:', error);
		
		// Use RunManagerV2's error handling if we have a runManager
		let runManager;
		try {
			const supabase = createClient(
				process.env.NEXT_PUBLIC_SUPABASE_URL,
				process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
			);
			runManager = new RunManagerV2(null, supabase);
			await runManager.updateRunError(error, 'job_creation');
		} catch (runError) {
			console.error('[RouteV3] ❌ Failed to record run error:', runError);
		}
		
		return NextResponse.json(
			{
				error: 'Job creation failed',
				details: error.message,
				stack: error.stack,
				version: 'v3.0',
				pipeline: 'job-queue-based'
			},
			{ status: 500 }
		);
	}
}
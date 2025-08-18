───────────────────────────────────────────────────────────────────────────────────────────────╮
     │ Implementation Plan: Job Queue System for V2 Pipeline                                          │
     │                                                                                                │
     │ Overview                                                                                       │
     │                                                                                                │
     │ Refactor the V2 pipeline to handle long-running processes by:                                  │
     │ 1. Extracting API calling into a separate function                                             │
     │ 2. Implementing a job queue system with chunking                                               │
     │ 3. Processing chunks within Vercel's timeout limits                                            │
     │ 4. Maintaining all metrics and run tracking                                                    │
     │                                                                                                │
     │ Architecture Changes                                                                           │
     │                                                                                                │
     │ New Components                                                                                 │
     │                                                                                                │
     │ /lib/agents-v2/core/                                                                           │
     │ ├── apiCaller/           # NEW: Pure API calling functions                                     │
     │ │   └── index.js         # Fetches raw data and chunks it                                      │
     │ ├── jobProcessor/        # NEW: Job queue processing                                           │
     │ │   └── index.js         # Processes chunks from queue                                         │
     │ └── processChunkV2.js    # NEW: Modified pipeline for chunks                                   │
     │                                                                                                │
     │ Modified Flow                                                                                  │
     │                                                                                                │
     │ Before: routeV2 → processApiSourceV2 → [All stages in one execution]                           │
     │                                                                                                │
     │ After:  routeV2 → apiCaller → Queue chunks → Cron/trigger → processChunkV2 → [Pipeline stages] │
     │                                                                                                │
     │ Implementation Phases                                                                          │
     │                                                                                                │
     │ Phase 1: Create Job Queue Infrastructure                                                       │
     │                                                                                                │
     │ Files to create:                                                                               │
     │ - /supabase/migrations/[timestamp]_create_job_queue.sql                                        │
     │ - /lib/services/jobQueueManager.js                                                             │
     │                                                                                                │
     │ Database schema:                                                                               │
     │ CREATE TABLE processing_jobs (                                                                 │
     │   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                                               │
     │   source_id UUID REFERENCES api_sources(id),                                                   │
     │   master_run_id UUID REFERENCES pipeline_runs(id),                                             │
     │   chunk_index INTEGER,                                                                         │
     │   total_chunks INTEGER,                                                                        │
     │   status TEXT DEFAULT 'pending', -- pending, processing, completed, failed                     │
     │   raw_data JSONB, -- The chunk of opportunities                                                │
     │   processing_config JSONB, -- Source config, instructions                                      │
     │   error_details JSONB,                                                                         │
     │   retry_count INTEGER DEFAULT 0,                                                               │
     │   created_at TIMESTAMPTZ DEFAULT now(),                                                        │
     │   started_at TIMESTAMPTZ,                                                                      │
     │   completed_at TIMESTAMPTZ                                                                     │
     │ );                                                                                             │
     │                                                                                                │
     │ CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);                            │
     │ CREATE INDEX idx_processing_jobs_master_run ON processing_jobs(master_run_id);                 │
     │                                                                                                │
     │ Test plan:                                                                                     │
     │ - Create mock jobs                                                                             │
     │ - Test CRUD operations                                                                         │
     │ - Verify queue ordering                                                                        │
     │                                                                                                │
     │ Phase 2: Extract API Calling Function                                                          │
     │                                                                                                │
     │ Files to create:                                                                               │
     │ - /lib/agents-v2/core/apiCaller/index.js                                                       │
     │                                                                                                │
     │ Functionality:                                                                                 │
     │ export async function fetchAndChunkData(source, instructions, chunkSize = 5) {                 │
     │   // 1. Call external API                                                                      │
     │   const rawData = await callExternalAPI(source, instructions);                                 │
     │                                                                                                │
     │   // 2. Store raw response (existing storage function)                                         │
     │   const responseId = await storeRawResponse(source.id, rawData);                               │
     │                                                                                                │
     │   // 3. Chunk the data                                                                         │
     │   const chunks = splitIntoChunks(rawData.opportunities, chunkSize);                            │
     │                                                                                                │
     │   return {                                                                                     │
     │     rawResponseId: responseId,                                                                 │
     │     totalCount: rawData.opportunities.length,                                                  │
     │     chunks: chunks,                                                                            │
     │     metadata: { ... }                                                                          │
     │   };                                                                                           │
     │ }                                                                                              │
     │                                                                                                │
     │ Test plan:                                                                                     │
     │ - Test with mock API response                                                                  │
     │ - Verify chunking logic                                                                        │
     │ - Test different chunk sizes                                                                   │
     │                                                                                                │
     │ Phase 3: Create Job Processing Function                                                        │
     │                                                                                                │
     │ Files to create:                                                                               │
     │ - /lib/services/processChunkV2.js                                                              │
     │                                                                                                │
     │ Functionality:                                                                                 │
     │ export async function processChunkV2(job, supabase, anthropic) {                               │
     │   const { raw_data: chunk, source_id, master_run_id, processing_config } = job;                │
     │                                                                                                │
     │   // Start from DataExtractionAgent's LLM processing (skip API call)                           │
     │   // 1. Extract opportunities from chunk (LLM)                                                 │
     │   const extracted = await dataExtractionAgent.extractFromChunk(chunk, processing_config);      │
     │                                                                                                │
     │   // 2. Duplicate detection                                                                    │
     │   const duplicates = await detectDuplicates(extracted, source_id);                             │
     │                                                                                                │
     │   // 3. Analysis for NEW opportunities (LLM)                                                   │
     │   const analyzed = await analysisAgent.enhance(duplicates.new);                                │
     │                                                                                                │
     │   // 4. Filter and store                                                                       │
     │   const filtered = await filterOpportunities(analyzed);                                        │
     │   await storeOpportunities(filtered, master_run_id);                                           │
     │                                                                                                │
     │   // Update job status                                                                         │
     │   await updateJobStatus(job.id, 'completed');                                                  │
     │ }                                                                                              │
     │                                                                                                │
     │ Phase 4: Modify routeV2.js                                                                     │
     │                                                                                                │
     │ Files to modify:                                                                               │
     │ - /app/api/admin/funding-sources/[id]/process/routeV2.js                                       │
     │                                                                                                │
     │ New flow:                                                                                      │
     │ export async function POST(request, { params }) {                                              │
     │   const { id } = await params;                                                                 │
     │                                                                                                │
     │   // 1. Initialize                                                                             │
     │   const source = await getSource(id);                                                          │
     │   const instructions = await sourceOrchestrator.analyze(source);                               │
     │                                                                                                │
     │   // 2. Fetch and chunk (fast, < 10s)                                                          │
     │   const { chunks, rawResponseId, totalCount } = await apiCaller.fetchAndChunkData(             │
     │     source,                                                                                    │
     │     instructions,                                                                              │
     │     5 // Start with small chunks                                                               │
     │   );                                                                                           │
     │                                                                                                │
     │   // 3. Create master run                                                                      │
     │   const masterRun = await createMasterRun(id, { totalCount, chunkCount: chunks.length });      │
     │                                                                                                │
     │   // 4. Queue jobs                                                                             │
     │   for (const [index, chunk] of chunks.entries()) {                                             │
     │     await jobQueueManager.createJob({                                                          │
     │       source_id: id,                                                                           │
     │       master_run_id: masterRun.id,                                                             │
     │       chunk_index: index,                                                                      │
     │       total_chunks: chunks.length,                                                             │
     │       raw_data: chunk,                                                                         │
     │       processing_config: { source, instructions }                                              │
     │     });                                                                                        │
     │   }                                                                                            │
     │                                                                                                │
     │   // 5. Return immediately                                                                     │
     │   return NextResponse.json({                                                                   │
     │     success: true,                                                                             │
     │     masterRunId: masterRun.id,                                                                 │
     │     jobsCreated: chunks.length,                                                                │
     │     totalOpportunities: totalCount                                                             │
     │   });                                                                                          │
     │ }                                                                                              │
     │                                                                                                │
     │ Phase 5: Create Job Processor Endpoint                                                         │
     │                                                                                                │
     │ Files to create:                                                                               │
     │ - /app/api/cron/process-jobs/route.js                                                          │
     │                                                                                                │
     │ Functionality:                                                                                 │
     │ export async function GET() {                                                                  │
     │   // Get next pending job                                                                      │
     │   const job = await jobQueueManager.getNextPendingJob();                                       │
     │                                                                                                │
     │   if (!job) {                                                                                  │
     │     return NextResponse.json({ message: 'No pending jobs' });                                  │
     │   }                                                                                            │
     │                                                                                                │
     │   // Process the job                                                                           │
     │   try {                                                                                        │
     │     await jobQueueManager.updateJobStatus(job.id, 'processing');                               │
     │     await processChunkV2(job, supabase, anthropic);                                            │
     │     await jobQueueManager.updateJobStatus(job.id, 'completed');                                │
     │   } catch (error) {                                                                            │
     │     await jobQueueManager.updateJobStatus(job.id, 'failed', error);                            │
     │   }                                                                                            │
     │                                                                                                │
     │   return NextResponse.json({ processed: job.id });                                             │
     │ }                                                                                              │
     │                                                                                                │
     │ Phase 6: Configure Vercel Cron                                                                 │
     │                                                                                                │
     │ Files to create/modify:                                                                        │
     │ - vercel.json                                                                                  │
     │                                                                                                │
     │ {                                                                                              │
     │   "crons": [                                                                                   │
     │     {                                                                                          │
     │       "path": "/api/cron/process-jobs",                                                        │
     │       "schedule": "*/2 * * * *"                                                                │
     │     }                                                                                          │
     │   ]                                                                                            │
     │ }                                                                                              │
     │                                                                                                │
     │ Testing Strategy                                                                               │
     │                                                                                                │
     │ Stage 1: Infrastructure Testing                                                                │
     │                                                                                                │
     │ 1. Create job queue table ✓                                                                    │
     │ 2. Test job CRUD operations ✓                                                                  │
     │ 3. Test job retrieval logic ✓                                                                  │
     │                                                                                                │
     │ Stage 2: API Caller Testing                                                                    │
     │                                                                                                │
     │ 1. Test with mock API response ✓                                                               │
     │ 2. Test chunking with different sizes ✓                                                        │
     │ 3. Test error handling ✓                                                                       │
     │                                                                                                │
     │ Stage 3: Integration Testing                                                                   │
     │                                                                                                │
     │ 1. Test job creation from routeV2 ✓                                                            │
     │ 2. Test job processing with mock data ✓                                                        │
     │ 3. Test with real API data (small source) ✓                                                    │
     │                                                                                                │
     │ Stage 4: Pipeline Testing                                                                      │
     │                                                                                                │
     │ 1. Test processChunkV2 with single chunk ✓                                                     │
     │ 2. Test metrics tracking ✓                                                                     │
     │ 3. Test error recovery ✓                                                                       │
     │                                                                                                │
     │ Stage 5: End-to-End Testing                                                                    │
     │                                                                                                │
     │ 1. Process small source (10 opportunities) ✓                                                   │
     │ 2. Process medium source (100 opportunities) ✓                                                 │
     │ 3. Monitor performance and adjust chunk size ✓                                                 │
     │                                                                                                │
     │ Metrics & Monitoring                                                                           │
     │                                                                                                │
     │ Maintain all existing metrics:                                                                 │
     │ - Per-stage execution times                                                                    │
     │ - Token usage                                                                                  │
     │ - API call counts                                                                              │
     │ - Opportunity flow paths                                                                       │
     │ - Duplicate detection stats                                                                    │
     │                                                                                                │
     │ Add new metrics:                                                                               │
     │ - Jobs created/completed/failed                                                                │
     │ - Average chunk processing time                                                                │
     │ - Queue depth over time                                                                        │
     │ - Total pipeline execution time                                                                │
     │                                                                                                │
     │ Future Optimizations                                                                           │
     │                                                                                                │
     │ Once working with Node.js (60s timeout):                                                       │
     │ 1. Gradually increase chunk size                                                               │
     │ 2. Consider Edge Runtime conversion for 5-minute windows                                       │
     │ 3. Implement parallel job processing                                                           │
     │ 4. Add priority queue features                                                                 │
     │                                                                                                │
     │ Benefits                                                                                       │
     │                                                                                                │
     │ - ✅ No timeout issues                                                                          │
     │ - ✅ Incremental, testable approach                                                             │
     │ - ✅ Maintains existing metrics                                                                 │
     │ - ✅ Minimal refactoring of core logic                                                          │
     │ - ✅ Can optimize later for Edge Runtime                                                        │
     │ - ✅ Resilient to failures (job retry)                                                          │
     │                                                                                                │
     │ Ready to start with Phase 1: Creating the job queue infrastructure?                            │
     ╰────────────────────────────────────────────────────────────────────────────────────────────────╯


     ● Task Master Task Structure Plan

  Task Organization Strategy

  I'll create 6 main tasks with detailed subtasks for each phase. This structure allows for:
  - Clear progression through phases
  - Detailed implementation tracking
  - Testing at each stage
  - Natural dependencies between tasks

  Proposed Task Structure

  Task 1: Job Queue Infrastructure

  Title: Implement job queue database infrastructure
  Description: Create the database schema and basic CRUD operations for the job queue system
  Subtasks:
  1. Create job queue migration file with processing_jobs table
  2. Implement JobQueueManager class with basic CRUD operations
  3. Add job retrieval methods (getNextPending, updateStatus)
  4. Create unit tests for JobQueueManager
  5. Test job queue operations with mock data

  Task 2: Extract and Refactor API Calling

  Title: Extract API calling from V2 pipeline into standalone module
  Description: Separate the pure API calling logic from LLM processing and add chunking capability
  Subtasks:
  1. Create /lib/agents-v2/core/apiCaller directory structure
  2. Extract API calling logic from DataExtractionAgent
  3. Implement chunking logic with configurable chunk size
  4. Add raw response storage integration
  5. Create unit tests for apiCaller module
  6. Test with mock API responses

  Task 3: Create Chunk Processing Pipeline

  Title: Build processChunkV2 function for chunk-based pipeline execution
  Description: Create a modified version of processApiSourceV2 that processes pre-chunked data
  Subtasks:
  1. Create processChunkV2.js in /lib/services
  2. Modify DataExtractionAgent to accept pre-fetched chunks
  3. Integrate duplicate detection for chunk processing
  4. Connect AnalysisAgent for NEW opportunities in chunk
  5. Ensure metrics tracking per chunk
  6. Link chunk results to master run tracking
  7. Test chunk processing with small dataset

  Task 4: Modify Admin Route for Job Creation

  Title: Update routeV2.js to create jobs instead of direct processing
  Description: Refactor the admin route to fetch data, chunk it, and queue jobs for processing
  Subtasks:
  1. Import apiCaller and jobQueueManager in routeV2
  2. Replace processApiSourceV2 call with fetch-and-chunk flow
  3. Implement master run creation before job queueing
  4. Add job creation loop for all chunks
  5. Update response format to include job information
  6. Test job creation from admin interface
  7. Verify jobs are properly queued in database

  Task 5: Implement Job Processing System

  Title: Create cron-triggered job processor endpoint
  Description: Build the system that picks up and processes queued jobs
  Subtasks:
  1. Create /api/cron/process-jobs route
  2. Implement job selection logic (pending, oldest first)
  3. Add job status management (processing, completed, failed)
  4. Integrate processChunkV2 for actual processing
  5. Add error handling and retry logic
  6. Create vercel.json cron configuration
  7. Test cron endpoint manually
  8. Test with real queued jobs

  Task 6: End-to-End Testing and Optimization

  Title: Complete integration testing and performance optimization
  Description: Test the full pipeline with real data and optimize chunk sizes
  Subtasks:
  1. Test with small source (10 opportunities)
  2. Monitor and log processing times per chunk
  3. Test with medium source (100 opportunities)
  4. Analyze metrics and identify bottlenecks
  5. Optimize chunk size based on performance data
  6. Test error recovery and job retry mechanisms
  7. Document optimal configuration settings
  8. Create monitoring dashboard for job queue

  Dependencies Between Tasks

  Task 1 (Infrastructure) → Task 2 (API Extraction) → Task 3 (Chunk Processing)
                        ↓
                      Task 4 (Route Modification)
                        ↓
                      Task 5 (Job Processor)
                        ↓
                      Task 6 (Testing & Optimization)

  Implementation Details for Each Task

  When creating these tasks in Task Master, I'll include:

  1. Specific file paths for each subtask
  2. Code snippets showing key implementations
  3. Test strategies with example test cases
  4. Success criteria for each subtask
  5. Potential gotchas and error handling requirements
  6. Database queries for verification
  7. Metrics to track at each stage

  Additional Considerations

  Priority Levels

  - Tasks 1-3: High priority (core infrastructure)
  - Tasks 4-5: High priority (integration)
  - Task 6: Medium priority (optimization)

  Estimated Complexity

  - Task 1: Medium (database and class creation)
  - Task 2: High (extracting from existing code)
  - Task 3: High (pipeline modification)
  - Task 4: Medium (route refactoring)
  - Task 5: Medium (cron implementation)
  - Task 6: Low (testing and tuning)

  Risk Areas

  - Task 2: Ensuring no functionality is lost during extraction
  - Task 3: Maintaining metrics accuracy across chunks
  - Task 4: Backward compatibility considerations
  - Task 5: Handling job failures gracefully

  Ready to Create Tasks?

  Once you approve, I'll:
  1. Create each main task individually with full details
  2. Then add all subtasks with implementation specifics
  3. Include test strategies and verification steps
  4. Add clear dependencies between tasks



  > OK.. how about this. We take the purly api calling functions out of the process api source. Maybe we put it in a core function in agents v2. We call it when we
  start the processing. This funciton will incluide chuncking and return it. These chunks will be put in the jobs table. Then when the jobs are being run, It will
  run a refactored process apisourcev2 and start with extracting the oppos with the llm. We will make sure that all the metrics and run data are included. as we do
  this refactor. We can make our chunks small in the beginning just to see how much it works. Then if we want more efficiency, we can try to refactor to make the
  individual functions endge run time. Also, I want to make this in pieces and test it in pieces, so before even refactoring process api source v2, i want to set up
  the jobs and test the jobs work. Then we can run a test api and see if it's passed to the job, then we can actually put our call api function in the job and test,
  and so on and so foorth. What do you think?
# Living Implementation Roadmap (LIR) - Funding Intelligence System

This document tracks the implementation status of all features in the Funding Intelligence System. It serves as both a living requirements document and an actionable project roadmap that evolves as development progresses.

## Next Tasks Priority

This section highlights the highest priority tasks to be completed next:

### PHASE 1: Agent Architecture V2 Refactoring + Supabase Edge Functions (HIGHEST PRIORITY)

**🚨 UPDATED DEPLOYMENT STRATEGY: Supabase Edge Functions**

**Analysis Result:** Current ProcessCoordinator analysis confirms that Supabase Edge Functions is the optimal deployment strategy for V2 architecture due to:
- ✅ **No timeout constraints** (15+ minute execution vs Vercel's 60s limit)
- ✅ **Same ecosystem** (already using Supabase for database)
- ✅ **Direct port feasible** (all current dependencies work in Edge Functions)
- ✅ **Cost effective** (included in Supabase pricing)
- ✅ **Handles large datasets** (can process 1000+ opportunities without timeout)

**Critical Infrastructure (Must Complete First):**
1. **✅ Supabase Edge Function Setup** - Core infrastructure for V2 processing **COMPLETED** ✨
   - ✅ Initialize `supabase/functions/process-source/` structure
   - ✅ Configure import maps for dependencies (Anthropic SDK, Supabase client)
   - ✅ Set up local development with `supabase functions serve`
   - ✅ Configure environment variables and basic testing
   - ✅ Verified Edge Function works with test requests
2. **🔥 ProcessCoordinatorV2 (Edge Function)** - Port current coordinator to Edge Function
   - [ ] Migrate processApiSource logic to Edge Function format
   - [ ] Maintain exact same agent orchestration flow
   - [ ] Preserve all error handling and logging
   - [ ] Add Edge Function-specific monitoring
3. **🔥 RunManagerV2** - Updated run tracking compatible with Edge Functions
   - [ ] Same tracking logic as V1, updated stage names for V2 pipeline
   - [ ] Enhanced metrics collection for new agent performance
   - [ ] Real-time status updates via Supabase subscriptions
4. **✅ AnthropicClient** - Direct SDK implementation (no LangChain/Zod overhead) **COMPLETED** ✨
   - ✅ Complete schema mapping from current Zod schemas
   - ✅ sourceAnalysis schema (maps sourceProcessingSchema) 
   - ✅ opportunityExtraction schema (maps apiResponseProcessingSchema)
   - ✅ opportunityScoring schema (for micro-agents)
   - ✅ dataProcessing schema (for deduplication)
   - ✅ Performance tracking and error handling
   - ✅ Comprehensive test coverage

**🎉 MILESTONE ACHIEVED: All 5 Core V2 Agents Complete! Ready for Edge Function Integration**

**Core Agent Development (Priority Order):**
5. **✅ SourceOrchestrator** - Replaces sourceManagerAgent **COMPLETED** ✨
   - ✅ Streamlined source analysis with improved performance
   - ✅ Direct Anthropic SDK integration
   - ✅ Input validation for required fields (name, api_endpoint)
   - ✅ Proper error handling and execution time tracking
   - ✅ Comprehensive test coverage (all 7 tests passing)
   - ✅ Architecture cleanup: consolidated to `app/lib/agents-v2/core/`
   - ✅ Tests updated to import from correct location
   - ✅ Ready for Edge Function integration
6. **✅ DataExtractionAgent** - Collection + field mapping + taxonomy standardization **COMPLETED** ✨
   - ✅ Complete API handling (single and two-step workflows)
   - ✅ AI-powered data extraction and field mapping
   - ✅ Comprehensive taxonomy standardization (applicants, projects, locations)
   - ✅ Robust error handling and execution tracking
   - ✅ Architecture cleanup: moved to `app/lib/agents-v2/core/`
   - ✅ Comprehensive test coverage (all 8 tests passing)
   - ✅ Ready for Edge Function integration
7. **✅ AnalysisAgent** - Content enhancement + systematic scoring (replaces detailProcessorAgent) **COMPLETED** ✨
   - ✅ Professional content enhancement with 2-3 paragraph descriptions
   - ✅ Systematic 10-point scoring framework with objective criteria
   - ✅ Batch processing (5 opportunities per batch) for efficiency
   - ✅ Robust error handling with graceful degradation
   - ✅ Score constraint enforcement and comprehensive metrics calculation
   - ✅ Comprehensive test coverage (all 8 tests passing)
   - ✅ Ready for Edge Function integration
8. **✅ Filter Function** - Simple threshold logic (no AI needed, replaces FilteringAgent) **COMPLETED** ✨
   - ✅ Implement score-based filtering with configurable thresholds
   - ✅ Apply funding threshold requirements ($1M+ preference)
   - ✅ Grant vs loan/tax credit filtering logic with compensatory scoring
   - ✅ Performance-optimized with minimal overhead (pure JavaScript logic)
   - ✅ Comprehensive test coverage (all 13 tests passing)
   - ✅ Configurable filtering with strict/lenient/custom modes
   - ✅ Detailed exclusion reason tracking for debugging
   - ✅ Moved to `app/lib/agents-v2/core/` with other pipeline agents
   - ✅ Ready for Edge Function integration
9. **✅ StorageAgent** - Enhanced storage with deduplication (replaces dataProcessorAgent) **COMPLETED** ✨
   - ✅ Modular replacement of 553-line monolith into 7 focused components (~1200 lines total)
   - ✅ Enhanced duplicate detection (ID-based + title fallback)
   - ✅ Funding source management with normalization
   - ✅ State eligibility processing and mapping
   - ✅ Material change detection to prevent spam updates
   - ✅ Batch processing with comprehensive metrics
   - ✅ Moved to `app/lib/agents-v2/core/storageAgent/` with modular structure:
     - ✅ index.js (185 lines) - main orchestrator
     - ✅ fundingSourceManager.js (120 lines) - agency CRUD
     - ✅ duplicateDetector.js (80 lines) - find existing opportunities
     - ✅ changeDetector.js (150 lines) - material change detection
     - ✅ dataSanitizer.js (200 lines) - data cleaning
     - ✅ stateEligibilityProcessor.js (150 lines) - location parsing
     - ✅ utils/fieldMapping.js (100 lines) - field conversion
     - ✅ utils/locationParsing.js (200 lines) - location string parsing
   - ✅ Comprehensive test coverage (all 13 tests passing)
   - ✅ Ready for Edge Function integration

**Edge Function Integration:**
10. **✅ ProcessCoordinatorV2 (Service)** - Port current coordinator to services with Edge Function wrapper **COMPLETED** ✨
    - ✅ Migrated processApiSource logic to `app/lib/services/processCoordinatorV2.js`
    - ✅ Maintained exact same agent orchestration flow (all 5 V2 agents working together)
    - ✅ Preserved all error handling and logging
    - ✅ Added proper RunManagerV2 for V2 pipeline tracking
    - ✅ Import agents from `app/lib/agents-v2/core/` structure
    - ✅ Created thin Edge Function wrapper at `supabase/functions/process-source/index.js`
    - ✅ Built comprehensive test suite at `app/lib/services/tests/processCoordinatorV2.test.js` (7/7 tests passing)
    - ✅ Service-oriented architecture with proper separation of concerns
    - ✅ Full error handling including database errors and agent failures
    - ✅ V1-compatible metrics format for seamless integration
11. **✅ RunManagerV2** - Updated run tracking compatible with Edge Functions **COMPLETED** ✨
    - ✅ Same tracking logic as V1, updated stage names for V2 pipeline
    - ✅ Enhanced metrics collection for new agent performance  
    - ✅ Maps V2 stages to existing V1 database columns for compatibility
    - ✅ Track modular StorageAgent component performance
    - ✅ Integrated into ProcessCoordinatorV2 service
    - ✅ Comprehensive test coverage for initialization and error handling
12. **Vercel API Trigger** - Lightweight endpoint to trigger Edge Function processing
    - [x] Create `/api/funding/process-source-v2/` endpoint (organized under funding namespace)
    - [x] Return immediate response with job status tracking
    - [x] Preserve all existing API contracts for frontend compatibility
    - [x] Maintain consistency with existing `/api/funding/` organization pattern
13. **Real-time Status Updates** - Live progress tracking during Edge Function execution
    - [ ] Supabase real-time subscriptions for run status
    - [ ] Progress indicators for each processing stage
    - [ ] Error notifications and recovery handling

**🔥 CURRENT PRIORITY: Edge Function Testing & Issues Resolution**

**Testing & Validation:**
14. **✅ DataExtractionAgent Testing** - Comprehensive testing with real API data **COMPLETED** ✨
    - ✅ Local Edge Function testing with `supabase functions serve` - **COMPLETED**
    - ✅ Basic connectivity and error handling validation - **COMPLETED**
    - ✅ Authorization header configuration - **COMPLETED**
    - ✅ Real API source testing with California Grants Portal and Grants.gov - **COMPLETED**
    - ✅ Single API workflow validation (California: 3 opportunities extracted) - **COMPLETED**
    - ✅ Two-step API workflow validation (Grants.gov: 10 opportunities extracted) - **COMPLETED**
    - ✅ Raw data storage and comparison validation - **COMPLETED**
    - ✅ LLM funding extraction accuracy validation with response mapping - **COMPLETED**
    - ✅ Response mapping validation: LLM correctly follows JSON path guidance - **COMPLETED**
    - ✅ Historical data confusion resolution: Improved prompts handle complex nested JSON - **COMPLETED**
    - ✅ Modular architecture functionality confirmed - **COMPLETED**
    - [ ] Performance validation with large datasets (100+ opportunities)
    - [ ] Timeout stress testing (ensure no 15-minute limit issues)

**🚨 CRITICAL ISSUES DISCOVERED:**

**Database Schema Issues (RunManagerV2):**
- ❌ Missing database columns: `source_manager_data`, `api_handler_data`, `ended_at`, `final_results`
- ❌ UUID format errors: RunManagerV2 using string IDs instead of UUIDs
- ❌ Schema cache issues: Columns not found in Supabase schema

**API Data Issues:**
- ❌ California Grants Portal: `409 Conflict` error (external API rate limiting)
- ❌ Grants.gov: Returns empty array `[]` (no current opportunities or query issue)
- ❌ AI JSON parsing failures: Non-JSON responses from Anthropic

**Next Steps (Stage-by-Stage Testing):**
15. **🔄 Individual Agent Testing with Real Data** - **IN PROGRESS** 
    - ✅ Create `scripts/test/` directory structure for systematic testing - **COMPLETED**
    - ✅ Test SourceOrchestrator with real California Grants Portal & Grants.gov sources - **COMPLETED**
    - ✅ Test DataExtractionAgent with real API responses - **COMPLETED**
    - ✅ Test AnalysisAgent with extracted opportunities from previous stage - **COMPLETED**
    - 🔥 Test FilterFunction with scored opportunities - **CURRENT PRIORITY**
    - [ ] Test StorageAgent with filtered opportunities
    - [ ] Chain outputs from each stage to next stage for validation

**Agent Execution Tracking Enhancement:**
15.5. **✅ V2 Agent Execution Tracking** - Add missing execution tracking to match V1 capabilities **COMPLETED** ✨
    - ✅ Add `logAgentExecution` calls to DataExtractionAgent for token usage and execution metrics - **COMPLETED**
    - ✅ Add `logAgentExecution` calls to AnalysisAgent for LLM performance tracking - **COMPLETED**
    - ✅ Add `logAgentExecution` calls to StorageAgent for database operation metrics - **COMPLETED**
    - ✅ Verify `agent_executions` table receives records from V2 pipeline - **COMPLETED**
    - [ ] Add token usage tracking to all V2 agents using Anthropic SDK
    - [ ] Update V2 agents to match V1 tracking granularity for performance comparison

**V2 Logging Gaps Analysis & Implementation:**
15.6. **🔧 V2 API Activity Logging** - Add missing API activity logging to match V1 capabilities
    - [ ] **FINDING**: V1 agents log API activity via `logApiActivity()` but V2 agents do not
    - [ ] **ANALYSIS**: V1 logs to `api_activity_logs` table for actions: 'api_check', 'processing', 'detail_processing'
    - [ ] Add `logApiActivity` calls to DataExtractionAgent for API request tracking
    - [ ] Add `logApiActivity` calls to SourceOrchestrator for source analysis tracking  
    - [ ] Add `logApiActivity` calls to StorageAgent for database operation tracking
    - [ ] Verify `api_activity_logs` table receives records from V2 pipeline
    - [ ] Match V1 activity logging patterns: success/failure status, action types, details payload

15.7. **🔧 V2 Raw Response Storage Verification** - Ensure raw API responses are properly stored
    - [ ] **FINDING**: V2 has raw response storage implementation but test didn't create new records
    - [ ] **ANALYSIS**: Recent raw responses in database are from California Grants Portal, not Grants.gov test
    - [ ] Investigate why test didn't store raw responses (cached data vs storage failure)
    - [ ] Verify raw response deduplication logic is working correctly
    - [ ] Ensure raw responses are linked to correct source IDs
    - [ ] Test raw response storage with fresh API calls (not cached data)

15.8. **🔧 V1 vs V2 Logging Audit** - Comprehensive comparison of all logging mechanisms
    - [ ] **AUDIT V1 LOGGING**: Document all logging mechanisms used in V1 agents
      - [ ] Agent execution logging (`agent_executions` table)
      - [ ] API activity logging (`api_activity_logs` table) 
      - [ ] Raw response storage (`api_raw_responses` table)
      - [ ] Run tracking (`api_source_runs` table)
      - [ ] Any other logging mechanisms in V1 pipeline
    - [ ] **AUDIT V2 LOGGING**: Document current V2 logging implementation
      - [ ] Compare V2 logging coverage against V1 baseline
      - [ ] Identify missing logging mechanisms in V2
      - [ ] Document logging format/schema differences between V1 and V2
    - [ ] **IMPLEMENT MISSING V2 LOGGING**: Add any missing logging to achieve V1 parity
      - [ ] Ensure V2 logs same level of detail as V1 for performance comparison
      - [ ] Maintain consistent logging schemas for dashboard compatibility
      - [ ] Add any V1 logging mechanisms not yet implemented in V2

16. **🔧 Database Schema Fixes** - **HIGH PRIORITY**
    - [ ] Add missing V2 columns to `api_source_runs` table
    - [ ] Fix RunManagerV2 UUID generation and validation
    - [ ] Update Supabase schema cache for new columns

17. **🔥 Migration Comparison** - Validate V2 output matches V1 quality **AFTER FIXES**
    - [ ] Side-by-side processing comparison with working pipeline
    - [ ] Accuracy metrics and performance benchmarks
    - [ ] Token usage and cost analysis

**Database Updates:**
16. **api_source_runs_v2 Table** - Enhanced run tracking for Edge Functions
17. **New Stage Columns** - Support for V2 pipeline stages
18. **Edge Function Monitoring** - Metrics collection for Edge Function performance

**Success Criteria for Phase 1:**
- [ ] Edge Function processes sources without timeout constraints
- [ ] All V2 agents work seamlessly in Edge Function environment
- [ ] Real-time status updates work correctly
- [ ] Performance shows 60-80% improvement over V1
- [ ] Can handle large datasets (200+ opportunities) successfully
- [ ] Zero impact on production system (V1 continues running via Vercel)

### EXISTING PRIORITY TASKS (AFTER PHASE 1):

1. **Database - Opportunity Notes Field**: Add notes field to the opportunities table, mainly for explanations about min, max and total funding amounts.
2. **Backend - Amount Estimation**: Update the Zod schema for min and max amount to have the LLM estimate these values if they're not explicitly provided in the source data.
3. **Backend - Agent Schema Documentation**: Add explanatory notes to the two agent Zod schemas to improve understanding and maintainability.
4. **Backend - Opportunity Update Algorithm**: Investigate and refine the algorithm for opportunity updates to ensure funding updates can occur properly without reverting fields back to null.
5. **Database - Source Contact Information**: Ensure full contact information is added to the opportunity source table.
6. **Frontend - Contact Info Display**: Make sure source contact information appears on the opportunity details page.
7. **Database - Duplicate Type Field**: Identify which of the two "type" fields in the sources table is being used and remove the duplicate.
8. **Backend - Type Field Normalization**: Find all locations where the type field is used and normalize it so filtering by type works regardless of capitalization.
9. **Frontend - Opportunity Tracking/Bookmarking**: Implement save/bookmark functionality on the opportunity detail page, storing tracked items in local storage.
10. **Frontend - Map Module/Visualization**: Implement filtering and map visualization based on geographic eligibility.
11. **Frontend - Items Per Page Option**: Implement ability to adjust number of items per page with options for 10/25/50 funding opportunities.
12. **Frontend - Advanced Filtering**: Add support for advanced filtering with multiple criteria, including date ranges, funding amounts, and eligible applicant types.
13. **Frontend - Legislative Data Warning Labels**: Add warning labels to all legislative data views indicating that the data is for demonstration purposes only.
14. **Frontend - Map View List Size**: Fix the list in map view to show only 5 opportunities instead of 10 to improve UI balance.
15. **Frontend - Navigation State Preservation**: When navigating back from detail page to main page, preserve the user's position, filter and sort selections to maintain context.
16. **DevOps - Remote Deployment**: Migrate database to remote Supabase, connect to Vercel and deploy. Develop strategy to migrate the database structure and functions without transferring all production data.

## Recently Completed Tasks

1. **✨ V2 Agent Architecture - Edge Function Basic Testing**: Successfully validated Edge Function connectivity, error handling, and authorization in local environment. Confirmed all V2 agents load correctly in Edge Function environment and ProcessCoordinatorV2 service integration works. Identified critical database schema and API data issues requiring resolution before full validation.
2. **✨ V2 Agent Architecture - ProcessCoordinatorV2 Service Migration**: Successfully extracted ProcessCoordinatorV2 from Edge Function to `app/lib/services/` with comprehensive test suite (7/7 tests passing). Implemented service-oriented architecture with proper separation of concerns, complete error handling, and V1-compatible metrics format.
3. **✨ V2 Agent Architecture - Edge Function Simplification**: Converted `supabase/functions/process-source/index.js` to thin HTTP wrapper that delegates to ProcessCoordinatorV2 service, maintaining clean architecture and testability.
4. **✨ V2 Agent Architecture - RunManagerV2 Integration**: Fully integrated RunManagerV2 with ProcessCoordinatorV2 service, providing V2 pipeline tracking with V1 database compatibility and comprehensive error handling.
4. **Frontend - Opportunity Detail Page UI/UX Enhancements**: Implemented numerous styling and layout improvements to the opportunity detail page, including refined card designs, tab navigation, content sections, and consistent status/category visuals.
5. **Frontend - Application Resources Update**: Refined the Application Resources section on the detail page with improved icons and added a functional 'Data Source' link dynamically pulling the correct URL from the associated API Source.
6. **Frontend - Funding Opportunities Filtering Enhancements**: Replaced tag filtering with robust category filtering system, added location-based filtering using the state eligibility data, improved status filtering with better visual indicators, and added comprehensive sorting options.
7. **Frontend - Pagination Improvements**: Fixed pagination issues by moving controls to both top and bottom of results, improved search behavior, added "Showing X-Y of Z results" display, and preserved pagination state during filtering operations.
8. **Frontend - Active Filters UI**: Implemented comprehensive active filters display with pill-based indicators, consistent color coding, and easy clear functionality, improving the overall filtering UX.

## Dynamic Source Prioritization Implementation

Tasks to implement dynamic source prioritization:

1. [x] Remove unused `priority` field from `api_sources` table

   - Create migration to safely remove the field
   - Update any code references to use dynamic prioritization instead

2. [x] Implement dynamic prioritization system:

   - [x] Create `calculate_source_priority` function that calculates priority based on:
     - Update frequency (hourly, daily, weekly, monthly)
     - Time elapsed since last check
     - Whether source has been checked before
   - [x] Update `get_next_api_source_to_process` to use the new calculation
   - [ ] Add monitoring to verify prioritization is working as expected

3. [ ] Add priority score visibility to admin interface:
   - [ ] Show calculated priority score in source list
   - [ ] Add sorting by dynamic priority
   - [ ] Add filtering options for priority-related fields

## Table of Contents

- [Funding API Processing System](#funding-api-processing-system)
  - [Overview](#funding-api-overview)
  - [Notable Design Decisions](#funding-api-decisions)
  - [Agent System](#agent-system)
  - [Process Coordination](#process-coordination)
  - [Database Implementation](#funding-api-database)
  - [Error Handling & Debugging](#error-handling-debugging)
- [Frontend Implementation](#frontend-implementation)
  - [Overview](#frontend-overview)
  - [Notable Design Decisions](#frontend-decisions)
  - [Funding Opportunities Explorer](#funding-opportunities-explorer)
  - [Opportunity Detail View](#opportunity-detail-view)
- [Admin Interface](#admin-interface)
  - [Overview](#admin-overview)
  - [Notable Design Decisions](#admin-decisions)
  - [Debug Components](#debug-components)
  - [Source Management](#source-management)
- [Web Scraping System](#web-scraping-system)
  - [Overview](#web-scraping-overview)
  - [Implementation Status](#web-scraping-implementation)
- [Legislative API Processing](#legislative-api-processing)
  - [Overview](#legislative-api-overview)
  - [Implementation Status](#legislative-api-implementation)
- [Client Matching System](#client-matching-system)
  - [Overview](#client-matching-overview)
  - [Implementation Status](#client-matching-implementation)

## API Source Keywords

Production keywords for API source configurations:
`energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation, construction`

<a id="funding-api-processing-system"></a>

## Funding API Processing System

<a id="funding-api-overview"></a>

### Overview

The Funding API Processing System is designed to retrieve, filter, and store funding opportunities from external APIs. It employs a flexible approach to handle both single-API and two-step API sources, using LLM-powered analysis to identify the most relevant opportunities for clients.

**Key Features:**

- Configurable API source integration
- LLM-powered filtering of opportunities
- Two-stage processing flow for detailed opportunity analysis
- Adaptive batch processing for efficient resource management
- Structured data storage with normalization
- Detailed execution tracking and logging
- Support for multiple opportunity sources and APIs

<a id="funding-api-decisions"></a>

### Notable Design Decisions

- **Agent-Based Architecture**: System uses specialized agents (Source Manager, API Handler, Detail Processor, Data Processor) with clear separation of concerns for different stages of the processing pipeline.

- **Two-Step Processing Model**: Implemented to efficiently process large volumes of opportunities, with an initial filter to quickly eliminate irrelevant items before detailed processing.

- **Run Manager Pattern**: Dedicated RunManager class manages state throughout processing pipeline, tracking status of every stage with detailed metrics.

- **Flexible Prompt Template System**: Uses LangChain PromptTemplate objects for structured LLM interaction, allowing for clear prompt management and formatting.

- **Batch Processing Strategy**: Opportunities are processed in batches with adaptive sizing based on token limits, ensuring efficient use of LLM resources.

- **Direct Data Processing Flow**: Eliminates intermediate database storage between processing stages, maintaining data in memory until final storage decisions are made, improving efficiency and reducing overhead.

- **Selective LLM Usage**: LLMs are used for complex filtering and analysis in early stages, with simpler rule-based processing for later stages like data storage, optimizing for both quality and efficiency.

<a id="agent-system"></a>

### Agent System

**Source Manager Agent:**

- [x] Parse and validate API source configurations
- [x] Determine appropriate workflow based on API type
- [x] Generate API request configuration
- [x] Handle authentication details
- [x] Support multiple authentication methods
- [x] Provide guidance on API limitations and best practices
- [ ] Support dynamic endpoint selection based on opportunity types
- [ ] Implement self-updating configuration system

**API Handler Agent:**

- [x] Make initial API calls to retrieve opportunities
- [x] Handle pagination for large result sets
- [x] Process initial filtering of opportunities
- [x] Make detail API calls for two-step sources
- [x] Extract and normalize opportunity data
- [x] Track API response metrics and performance
- [x] Generate actionable summaries for opportunities
- [x] Implement relevance scoring with project type criteria
- [ ] Implement adaptive keyword expansion
- [ ] Support rate limiting and throttling
- [ ] Implement cache system for frequent API calls

**Detail Processor Agent:**

- [x] Process detailed opportunity information
- [x] Perform deep analysis and relevance scoring
- [x] Apply secondary filtering based on detailed data
- [x] Split opportunities into manageable chunks
- [x] Generate comprehensive opportunity summaries
- [x] Track processing metrics
- [x] Handle missing information transparently
- [x] Update relevance scoring criteria for project types
- [ ] Implement adaptive relevance threshold
- [ ] Support prioritization of opportunities
- [ ] Implement cross-reference with previous opportunities

**Data Processor Agent:**

- [x] Store filtered opportunities in the database
- [x] Handle duplicate detection and updates
- [x] Normalize data to standard schema
- [x] Track storage metrics and results
- [x] Support multiple insert/update strategies
- [x] Implement direct batch processing of opportunities
- [x] Link opportunities to their funding sources by agency name
- [x] Implement structured funding source object extraction and processing
- [x] Update the description field in the Zod schema to improve comprehensiveness with 2-4 paragraph descriptions
- [x] Implement title-based matching to prevent duplicate opportunities when IDs don't match
- [x] Implement category normalization for funding opportunities:
  - [x] Create standardized mapping for common category variations
  - [x] Add case-insensitive matching for category names
  - [ ] Handle abbreviations and alternate spellings
  - [x] Normalize "Other: [description]" categories when possible
  - [ ] Update category display in UI to use normalized values
- [ ] Replace LLM-based decision making with rule-based processing for better efficiency
- [ ] Implement versioning for opportunity updates
- [ ] Add tagging system for categorization
- [ ] Implement data quality scoring
- [ ] Verify that opportunities table is being filled with correct data without redundant or missing fields

<a id="process-coordination"></a>

### Process Coordination

**Run Manager:**

- [x] Track run status for each source
- [x] Update stage-specific status
- [x] Store metrics for each processing stage
- [x] Handle run errors and failures
- [x] Support resuming failed runs
- [ ] Implement priority-based run scheduling
- [ ] Add notification system for run status

**Process Coordinator:**

- [x] Orchestrate the complete processing pipeline
- [x] Handle source selection and processing
- [x] Manage transitions between processing stages
- [x] Support processing multiple sources in sequence
- [x] Provide comprehensive result summaries
- [x] Support conditional processing based on source type
- [x] Implement direct data flow between processing stages
- [x] Support both synchronous and asynchronous processing
- [ ] Implement parallel processing of sources
- [ ] Add resource allocation and throttling

**Geographic Eligibility Processing:**

- [x] Define state reference tables and opportunity-state junction tables
- [x] Create database view with eligible_states array field
- [x] Add is_national flag for nationwide opportunities
- [x] Implement taxonomies for state and region specification
- [x] Enhance LLM prompt to extract specific state eligibility
- [x] Update Data Processor to parse location responses
- [x] Implement logic to populate opportunity_state_eligibility table
- [x] Create function to expand regional designations to constituent states
- [ ] Add post-processing validation for geographic eligibility
- [ ] Implement filtering and map visualization based on geographic eligibility

<a id="funding-api-database"></a>

### Database Implementation

**Schema Design:**

- [x] Create API sources table
- [x] Create API source configurations table
- [x] Create API source runs table
- [x] Create funding opportunities table
- [x] Create API raw responses table
- [x] Create API extracted opportunities table
- [ ] Create opportunity categories table
- [ ] Create opportunity-client match table
- [ ] Audit opportunities table schema to ensure all fields are necessary and properly utilized

**Database Functions:**

- [x] Implement get_next_api_source_to_process function
- [ ] Create automatic duplicate detection functions
- [ ] Implement data integrity validation functions
- [ ] Add opportunity indexing for search

<a id="error-handling-debugging"></a>

### Error Handling & Debugging

**Error Handling:**

- [x] Implement comprehensive error tracking
- [x] Store detailed error information with runs
- [x] Support resuming from failures
- [x] Handle API-specific error cases
- [x] Implement null checks for all run result fields to prevent UI errors
- [ ] Implement automatic retry mechanisms
- [ ] Add alerting for critical failures

**Logging System:**

- [x] Log agent executions with input/output
- [x] Track API activities and responses
- [x] Store token usage metrics
- [x] Log processing times for performance analysis
- [ ] Implement structured logging format
- [ ] Add log level configuration

<a id="frontend-implementation"></a>

## Frontend Implementation

<a id="frontend-overview"></a>

### Overview

The Frontend Implementation provides a modern, user-friendly interface for viewing and interacting with funding opportunities and other system features. It focuses on presenting data in an accessible, visually appealing way while maintaining high performance and responsiveness.

**Key Features:**

- Responsive funding opportunities explorer
- Dynamic filtering and sorting capabilities
- Visual category representation with color coding
- Relevance scoring visualization
- Detailed opportunity view
- Dashboard for key insights

<a id="frontend-decisions"></a>

### Notable Design Decisions

- **Card-Based UI**: Standardized card design for opportunities with consistent layout and visual indicators
- **Dynamic Color Assignment**: Deterministic color generator for consistent category visualization
- **Responsive Design**: Adaptive layout that works across desktop, tablet, and mobile devices
- **Visual Status Indicators**: Clear visual representation of opportunity status and relevance
- **Progressive Disclosure**: Important information is immediately visible with details available on demand

### Funding Opportunities Explorer

**Opportunities Display:**

- [x] Design and implement standardized opportunity cards
- [x] Create multi-category color indicator bars
- [x] Implement responsive grid layout for cards
- [x] Add visual status indicators for open/upcoming/closed opportunities
- [x] Design and implement relevance score visualization
- [x] Convert relevance scores from 1-10 scale to percentage display
- [x] Implement dynamic "NEW" badge system:
  - [x] Add creation date tracking to opportunity schema
  - [x] Create logic to show "NEW" badge for opportunities added within last 6 days
  - [x] Design badge with days-ago indicator (e.g., "NEW • Today" or "NEW • 3 days ago")
  - [x] Determine optimal badge placement on opportunity cards
  - [ ] Add database query parameter to filter/sort by recently added
- [x] Refactor opportunity cards into modular components:
  - [x] Create base OpportunityCard component with shared functionality
  - [x] Implement BlueHeaderCard variant with thin blue header strip and colored status badges
  - [x] Apply status colors consistently using case-insensitive status matching
  - [x] Style NEW badge with light background and colored text to match category pills
  - [x] ~Implement MultiColorHeaderCard variant with category color bar~ **(Requirement changed - not needed)**
  - [x] ~Ensure consistent styling and behavior across variants~ **(Completed with blue header implementation)**
- [x] Implement active filters UI:
  - [x] Create pill-based display of active filters with clear indicators
  - [x] Apply consistent color coding across filter pills and opportunity cards
  - [x] Include clear buttons for individual filters and clear all option
  - [x] Handle special formatting for "Other: [description]" categories
  - [x] Position active filters for high visibility without dominating the interface
- [x] Improve pagination implementation:
  - [x] Move pagination controls to top of results and duplicate at bottom
  - [x] Fix search behavior to maintain proper pagination of results
  - [x] Update pagination display to show "Showing X-Y of Z results"
  - [x] Ensure pagination state is preserved during filtering
  - [x] Add proper disabled states for navigation buttons
  - [ ] Add ability to set items per page (10/25/50)
- [ ] Implement lazy loading for large opportunity sets
- [ ] Add animations for improved user experience
- [ ] Improve description formatting and truncation with intelligent handling of long text

**Filtering and Sorting:**

- [x] Implement basic category filtering
- [x] Add status filtering
- [x] Create tag-based filtering
- [x] Design active filters display with clear indicators
- [x] Replace tag filtering with more robust category filtering system:
  - [x] Create dropdown with checkboxes for selecting multiple categories
  - [x] Add category color indicators in filter dropdown
  - [x] Implement visual indicators for selected categories
  - [x] Ensure filtering works with partial category matches
  - [x] Combine standard taxonomy categories with dynamic categories from opportunities
  - [x] Enable search within category dropdown for easier navigation
  - [x] Add proper formatting for "Other: [description]" categories
- [x] Update status filter with improved status choices and visual indicators:
  - [x] Implement case-insensitive status handling
  - [x] Apply consistent color coding matching card status indicators
  - [x] Add visual indicators in dropdown and filter pills
  - [x] Ensure automatic closing of single-select dropdowns after selection
- [x] Add location-based filtering using state eligibility data:
  - [x] Create state selection dropdown with search and multi-select
  - [x] Add option for "National" opportunities
  - [x] Implement filter matching based on eligible_locations array
  - [x] Fix case sensitivity issues in database filtering
- [x] Enhance sorting capabilities with multiple options:
  - [x] Sort by relevance (default)
  - [x] Sort by deadline (soonest first)
  - [x] Sort by amount (highest first)
  - [x] Sort by recently added (using updated_at timestamp)
  - [x] Add ability to toggle sort direction (ascending/descending)
- [ ] Implement advanced filtering with multiple criteria
- [ ] Add saved filter preferences for returning users
- [ ] Improve UX with tooltips and filter explanations

**Search Functionality:**

- [x] Implement basic search across opportunity titles and descriptions
- [ ] Add advanced search with field-specific queries
- [ ] Implement search suggestions
- [ ] Create search result highlighting

### Opportunity Detail View

**Detail Layout:**

- [x] Design comprehensive detail layout with enhanced styling
- [x] Implement tabbed interface for different information categories
- [ ] Create visual timeline for opportunity deadlines
- [ ] Add related opportunities section

**User Interaction:**

- [ ] Implement save/bookmark functionality (using local storage)
- [ ] Add sharing options (commented out)
- [ ] Create printable view (commented out)
- [ ] Implement notes and tracking features

<a id="admin-interface"></a>

## Admin Interface

<a id="admin-overview"></a>

### Overview

The Admin Interface provides tools for managing API sources, viewing processing results, and debugging the system. It allows administrators to monitor the health of the system, add new funding sources, and troubleshoot issues.

**Key Features:**

- API source management
- Run status monitoring
- Processing result visualization
- Detailed debugging tools
- Manual trigger for opportunity processing

<a id="admin-decisions"></a>

### Notable Design Decisions

- **Component-Based Debugging**: Debug tools are organized by component (source-manager, api-handler, etc.) to isolate and test specific parts of the system.

- **Structured Debug Tests**: System supports specific test types (initial-route, process-coordinator, run-manager, etc.) for targeted testing.

- **Custom UI Components**: Admin interface uses custom UI components for consistent styling and functionality.

<a id="debug-components"></a>

### Debug Components

**Debug Controller:**

- [x] Support component-specific debugging
- [x] Allow testing individual pipeline stages
- [x] Provide detailed error information
- [x] Support various test types
- [ ] Add visual representation of processing flow
- [ ] Implement saved test configurations

**Debug UI:**

- [x] Implement debug page component
- [x] Display API sources for testing
- [x] Support running debug tests
- [x] Show test results
- [ ] Add interactive test configuration
- [ ] Implement real-time test monitoring
- [ ] Create visual debugging tools

<a id="source-management"></a>

### Source Management

**Source Configuration:**

- [x] Support viewing API sources
- [x] Implement source creation interface
- [x] Add configuration editing tools
- [ ] Create configuration validation
- [ ] Update funding source detail page with editable configuration elements (API endpoints, pagination settings, request configuration)
- [ ] Improve funding sources list page with filtering, search capabilities, and status indicators

**Processing Management:**

- [x] Implement manual trigger for processing
- [ ] Add scheduling interface for recurring processing
- [ ] Create priority management for sources
- [x] Implement processing status dashboard

**Run Management:**

- [x] Implement runs listing interface
- [x] Create detailed run view
- [x] Add visual pipeline representation
- [x] Implement real-time run status updates
- [x] Enable real-time updates for run details page by adding the `api_source_runs` table to Supabase real-time publication
- [x] Implement unified display of stored opportunities with operation type tags
- [x] Fix first stage filter processing time display in UI
- [x] Investigate and optimize second stage filter performance
- [ ] Add filtering and search for runs
- [ ] Implement run comparison tools
- [ ] Add run analytics and reporting

<a id="web-scraping-system"></a>

## Web Scraping System

<a id="web-scraping-overview"></a>

### Overview

The Web Scraping System will extend the funding opportunity collection to sources without APIs. It will use similar processing and filtering approaches to the API system but adapted for scraped content.

**Key Features:**

- Configurable web scraping for funding sources
- Content extraction and normalization
- Integration with the existing filtering pipeline
- Scheduled scraping with incremental updates

<a id="web-scraping-implementation"></a>

### Implementation Status

**Scraper Framework:**

- [ ] Design scraper architecture
- [ ] Implement base scraper class
- [ ] Create source-specific scrapers
- [ ] Add content extraction tools

**Content Processing:**

- [ ] Implement HTML content extraction
- [ ] Add text normalization tools
- [ ] Create structured data extraction
- [ ] Integrate with existing filtering pipeline

**Scheduling and Management:**

- [ ] Create scraper scheduler
- [ ] Implement change detection
- [ ] Add scraping metrics and monitoring
- [ ] Create admin interface for scrapers

<a id="legislative-api-processing"></a>

## Legislative API Processing

<a id="legislative-api-overview"></a>

### Overview

The Legislative API Processing system will track and analyze legislative information related to funding, allowing clients to stay informed about potential future funding opportunities and policy changes.

**Key Features:**

- Integration with legislative tracking APIs
- Filtering for funding-relevant legislation
- Automatic categorization and relevance scoring
- Client alerting for relevant legislative changes

<a id="legislative-api-implementation"></a>

### Implementation Status

**Legislative API Integration:**

- [ ] Identify and integrate with legislative APIs
- [ ] Implement data normalization for legislative data
- [ ] Create legislative-specific filtering criteria
- [ ] Add legislative source management

**Legislative Analysis:**

- [ ] Design legislative relevance scoring
- [ ] Implement categorization for legislation
- [ ] Create funding impact assessment tools
- [ ] Add timeline tracking for legislative process

**Client Notifications:**

- [ ] Design legislative alert system
- [ ] Implement client-specific filtering
- [ ] Create notification templates
- [ ] Add tracking for legislative outcomes

<a id="client-matching-system"></a>

## Client Matching System

<a id="client-matching-overview"></a>

### Overview

The Client Matching System will connect filtered funding opportunities with appropriate clients based on their profiles, needs, and eligibility, enabling targeted notifications and recommendations.

**Key Features:**

- Client profile management
- Opportunity-client matching algorithm
- Relevance scoring for client-opportunity pairs
- Notification system for new matches
- Match tracking and management

<a id="client-matching-implementation"></a>

### Implementation Status

**Client Profile Management:**

- [ ] Design client profile schema
- [ ] Create profile management interface
- [ ] Implement profile import tools
- [ ] Add eligibility criteria management

**Matching Algorithm:**

- [ ] Design matching algorithm architecture
- [ ] Implement basic eligibility matching
- [ ] Add relevance scoring for matches
- [ ] Create match confidence indicators

**Match Management:**

- [ ] Develop match tracking system
- [ ] Create match status workflow
- [ ] Implement match history
- [ ] Add reporting and analytics

**Notification System:**

- [ ] Design notification framework
- [ ] Implement email notification templates
- [ ] Add notification preferences
- [ ] Create notification scheduling

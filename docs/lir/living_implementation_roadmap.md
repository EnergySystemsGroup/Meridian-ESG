# Living Implementation Roadmap (LIR) - Funding Intelligence System

This document tracks the implementation status of all features in the Funding Intelligence System. It serves as both a living requirements document and an actionable project roadmap that evolves as development progresses.

## Next Tasks Priority

This section highlights the highest priority tasks to be completed next:

1. **Frontend - Funding Opportunities Dashboard Improvements**: Add additional filtering and sorting options for funding opportunities, continue improving the UI elements and functionalities.

2. **Frontend - Legislative Data Warning Labels**: Add warning labels to all legislative data views indicating that the data is for demonstration purposes only.

3. **Frontend - "Coming Soon" Pages**: Add proper "Coming Soon" messaging to incomplete views and features that are planned but not yet implemented.

4. **Frontend - Client Matching UI Design**: Start designing and implementing the client matching interface to display tailored recommendations.

5. **Backend - Audit Opportunity Fields**: Review and audit the opportunity fields to ensure all necessary data is being properly collected, processed and displayed. Improve the description field in the Zod schema to ensure it captures and validates all necessary information.

## Downgraded Priority Tasks

These tasks remain important but have been downgraded in priority as we focus on frontend improvements:

1. **Data Processor - Update Detection Improvement**: Verify and improve update detection logic to prevent false positives from minor LLM wording differences.

2. **Detail Processor - Adaptive Relevance Threshold**: Implement adaptive thresholds for relevance scores based on source quality and historical data.

3. **API Handler - Support for Rate Limiting**: Add rate limiting and throttling capabilities to prevent API usage limits from being exceeded.

4. **Error Handling - Automatic Retry Mechanisms**: Implement automatic retry logic for transient failures in API calls.

5. **Admin Interface - Run Filtering and Search**: Add filtering and search capabilities to the runs listing interface.

## Recently Completed Tasks

1. **Frontend - Funding Opportunities Explorer UI**: Implemented modern, visually appealing interface for browsing funding opportunities with dynamic category color assignments, responsive cards, and improved user experience.

2. **Frontend - Opportunity Cards Design**: Created standardized card design with multi-category indicator bar, status indicators, relevance meter, and key details display.

3. **Frontend - Relevance Score Handling**: Updated the relevance score display to correctly convert scores from 1-10 scale to percentage format, with appropriate color coding based on relevance level.

4. **Backend - Project Type Scoring Update**: Modified the scoring criteria for the "Project Type" category (formerly "Project Implementation Type") to better reflect the value of different project types, with higher scores for construction, renovations, HVAC, lighting, etc.

5. **Parallel Processing for Filters**: Implemented parallel processing for both first and second stage filters to improve performance. The second stage filter was taking significantly longer due to processing larger, detailed opportunities individually. Now both filters process multiple chunks concurrently with controlled concurrency.

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
- [ ] Enhance the description field in the Zod schema to improve validation, formatting, and handling of various text formats
- [ ] Verify and improve update detection to prevent false positives from minor LLM wording differences
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
- [ ] Implement "NEW" badge for recently added opportunities (determine optimal placement)
- [ ] Implement lazy loading for large opportunity sets
- [ ] Add animations for improved user experience
- [ ] Improve description formatting and truncation with intelligent handling of long text

**Filtering and Sorting:**

- [x] Implement basic category filtering
- [x] Add status filtering
- [x] Create tag-based filtering
- [x] Design active filters display with clear indicators
- [ ] Enhance sorting capabilities with multiple options (relevance, deadline, amount, date added)
- [ ] Implement advanced filtering with multiple criteria
- [ ] Add saved filter presets
- [ ] Create custom sorting options with intelligent defaults
- [ ] Create persistent filter preferences for returning users

**Search Functionality:**

- [x] Implement basic search across opportunity titles and descriptions
- [ ] Add advanced search with field-specific queries
- [ ] Implement search suggestions
- [ ] Create search result highlighting

### Opportunity Detail View

**Detail Layout:**

- [ ] Design comprehensive detail layout
- [ ] Implement tabbed interface for different information categories
- [ ] Create visual timeline for opportunity deadlines
- [ ] Add related opportunities section

**User Interaction:**

- [ ] Implement save/bookmark functionality
- [ ] Add sharing options
- [ ] Create printable view
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

# Funding API Processing System: Enhanced Agentic Workflow

## Overview

This document outlines the enhanced agentic workflow for processing funding opportunities from external APIs, specifically designed to efficiently handle large volumes of data while maintaining relevance and quality. The system employs a flexible filtering approach with LLM-powered analysis to identify the most relevant opportunities for our users, adapting to both single-API and two-step API sources.

## System Architecture

The workflow consists of the following key components:

1. **Source Manager Agent**: Configures and validates API sources, determines the appropriate workflow based on API type, and orchestrates the overall process
2. **API Handler Agent**: Makes API calls, retrieves opportunity data, and performs initial filtering
3. **Detail Processor Agent**: Processes detailed opportunity information and performs deep analysis for final filtering
4. **Data Processor Agent**: Stores filtered opportunities in the database and handles duplicate detection

## Detailed Workflow

### 1. Initial Configuration

The system starts with properly configured API sources, including:

- **Keywords**: `energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation`
- **Status Filters**: API-specific status parameters (e.g., `forecasted|posted` for Grants.gov)
- **Pagination Settings**: Configured for the specific API
- **API Type**: Specifies whether the source is a single-API or two-step API source

**Checkpoint 1**: Verify configuration in the database

```javascript
// Query to verify configuration
const { data, error } = await supabase
	.from('api_source_configurations')
	.select('*')
	.eq('source_id', '[SOURCE_ID]')
	.eq('config_type', 'request_body');

// Verify API type is specified
console.log('API Type:', data[0].api_type);
```

### 2. Workflow Orchestration

The Source Manager Agent determines the appropriate workflow based on the API type:

```javascript
// Example orchestration logic
if (sourceConfig.api_type === 'single') {
	// Single API flow
	const opportunities = await apiHandlerAgent.processSource(sourceId);
	await dataProcessorAgent.storeOpportunities(opportunities);
} else {
	// Two-step API flow
	const filteredList = await apiHandlerAgent.processInitialList(sourceId);
	const detailedOpportunities = await detailProcessorAgent.processDetailedInfo(
		filteredList
	);
	await dataProcessorAgent.storeOpportunities(detailedOpportunities);
}
```

### 3. Primary API Call (List 1)

The API Handler Agent makes the initial API call using the configured parameters to retrieve a list of potential opportunities (List 1).

**Checkpoint 2**: Verify API response

```javascript
// Direct API call to verify response - example for Grants.gov
curl -X POST https://api.grants.gov/v1/api/search2 -H 'Content-Type: application/json' -d '{
	"rows": 100,
	"keyword": "energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation",
	"oppStatuses": "forecasted|posted"
}' | grep -o '"hitCount":[0-9]*'

// Note: Parameters will vary by API source
```

### 4. Filtering Process

The system adapts its filtering approach based on the API source configuration:

#### 4.1 Single-API Source Flow

For APIs that provide complete information in a single call:

1. **API Handler Agent**: Retrieves opportunities and performs comprehensive filtering
2. **Data Processor Agent**: Stores filtered opportunities in the database

#### 4.2 Two-Step API Source Flow

For APIs that require separate calls for detailed information:

1. **API Handler Agent**: Retrieves initial list and performs first-stage filtering
2. **API Handler Agent**: Makes detail API calls for opportunities that pass the first filter
3. **Detail Processor Agent**: Performs second-stage filtering on detailed information
4. **Data Processor Agent**: Stores final filtered opportunities in the database

### 5. Single-API Source Filtering

When the API source provides complete information in a single call, the API Handler Agent uses a comprehensive filtering approach.

#### Single-API LLM Prompt Template:

```
You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to analyze a list of funding opportunities and identify those most relevant to our organization's focus areas.

Our organization helps the following types of entities secure funding:
- K-12 schools
- Community colleges and universities
- Municipal, county, and state governments
- Federal facilities
- Tribal governments
- Nonprofit organizations
- For-profit businesses
- Special districts
- Healthcare facilities

We focus on funding in these categories:
- Energy & Buildings (e.g., efficiency upgrades, renewable energy, building modernization)
- Transportation & Mobility (e.g., EV infrastructure, public transit, alternative transportation)
- Water & Resources (e.g., water conservation, stormwater management, resource recovery)
- Climate & Resilience (e.g., adaptation, mitigation, carbon reduction)
- Community & Economic Development (e.g., revitalization, workforce development)
- Infrastructure & Planning (e.g., sustainable infrastructure, master planning)

For each opportunity, analyze:
1. Eligibility requirements - Do they match our client types?
2. Funding purpose - Does it align with our focus areas?
3. Award amounts - Is the funding significant enough to pursue?
4. Timeline - Is the opportunity currently active or upcoming?
5. Match requirements - Are the cost-share requirements reasonable?

For each opportunity in the provided list, assign a relevance score from 1-10 based on:
1. Alignment with our focus areas (0-5 points):
   - 0 points: No alignment with any focus area
   - 1 point: Minimal alignment with one focus area
   - 2 points: Moderate alignment with one focus area
   - 3 points: Moderate alignment with multiple focus areas
   - 4 points: Strong alignment with one or more focus areas
   - 5 points: Perfect alignment with one or more focus areas

2. Applicability to our client types (0-3 points):
   - 0 points: Not applicable to any of our client types
   - 3 points: Applicable to any of our client types

3. Funding amount and accessibility (0-2 points):
   - 0 points: Insufficient funding or excessive match requirements
   - 1 point: Moderate funding with reasonable match requirements
   - 2 points: Substantial funding with minimal match requirements

Only include opportunities that score 7 or higher in your final output. In the absense of information, make assumptions to Lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID and title
2. Relevance score
3. Primary focus area(s)
4. Eligible client types
5. Key benefits (2-3 bullet points)
6. Any notable restrictions or requirements

Input:
[LIST_1_BATCH]
```

**Checkpoint 3A**: Verify single-API filtering results

```javascript
// Check agent execution output
const { data, error } = await supabase
	.from('agent_executions')
	.select('*')
	.eq('agent_type', 'api_handler')
	.order('created_at', { ascending: false })
	.limit(1);

// Verify filtered opportunities count and scoring
console.log(
	'Filtered opportunities count:',
	data[0].output.opportunities.length
);
```

### 6. Two-Step API Source - First-Stage Filtering

For APIs that require a separate call for detailed information, the API Handler Agent first filters based on limited information.

#### First-Stage LLM Prompt Template:

```
You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to analyze a list of funding opportunities and identify those most relevant to our organization's focus areas.

Our organization helps the following types of entities secure funding:
- K-12 schools
- Community colleges and universities
- Municipal, county, and state governments
- Federal facilities
- Tribal governments
- Nonprofit organizations
- For-profit businesses
- Special districts
- Healthcare facilities

We focus on funding in these categories:
- Energy & Buildings
- Transportation & Mobility
- Water & Resources
- Climate & Resilience
- Community & Economic Development
- Infrastructure & Planning

For each opportunity in the provided list, assign a relevance score from 1-10 based on:
1. Alignment with our focus areas (0-5 points)
2. Applicability to our client types (0-3 points)
3. Funding amount and accessibility (0-2 points)

If information is limited, use the title and or description, or any available information to make a determination as to how relevant the opportunity is to our organization. in the absense of information, make assumptions to Lean on the side of inclusion.

Only opportunities scoring 6 or higher should proceed to detailed analysis.

For each selected opportunity, provide:
1. Opportunity ID
2. Title
3. Relevance score
4. Brief justification (1-2 sentences)

Input:
[LIST_1_BATCH]
```

**Checkpoint 3B**: Verify first-stage filtering results

```javascript
// Check agent execution output
const { data, error } = await supabase
	.from('agent_executions')
	.select('*')
	.eq('agent_type', 'api_handler')
	.order('created_at', { ascending: false })
	.limit(1);

// Verify filtered opportunities count and scoring
console.log('First-stage filtered count:', data[0].output.opportunities.length);
```

### 7. Two-Step API Source - Detail API Calls

For opportunities that pass the first-stage filter, the API Handler Agent makes detail API calls to gather comprehensive information.

**Checkpoint 4**: Verify detail API calls

```javascript
// Check raw responses for detail calls
const { data, error } = await supabase
	.from('api_raw_responses')
	.select('*')
	.eq('source_id', '[SOURCE_ID]')
	.order('created_at', { ascending: false })
	.limit(5);
```

### 8. Two-Step API Source - Second-Stage Filtering

The Detail Processor Agent receives the detailed opportunity information (List 2) from the API Handler Agent and performs deep analysis for final filtering.

#### Second-Stage LLM Prompt Template:

```
You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to perform a detailed analysis of funding opportunities to determine their relevance and value to our clients.

Our organization helps the following types of entities secure funding:
- K-12 schools
- Community colleges and universities
- Municipal, county, and state governments
- Federal facilities
- Tribal governments
- Nonprofit organizations
- For-profit businesses
- Special districts
- Healthcare facilities

We focus on funding in these categories:
- Energy & Buildings (e.g., efficiency upgrades, renewable energy, building modernization)
- Transportation & Mobility (e.g., EV infrastructure, public transit, alternative transportation)
- Water & Resources (e.g., water conservation, stormwater management, resource recovery)
- Climate & Resilience (e.g., adaptation, mitigation, carbon reduction)
- Community & Economic Development (e.g., revitalization, workforce development)
- Infrastructure & Planning (e.g., sustainable infrastructure, master planning)

For each opportunity, analyze:
1. Eligibility requirements - Do they match our client types?
2. Funding purpose - Does it align with our focus areas?
3. Award amounts - Is the funding significant enough to pursue?
4. Timeline - Is the opportunity currently active or upcoming?
5. Match requirements - Are the cost-share requirements reasonable?

For each opportunity in the provided list, assign a relevance score from 1-10 based on:
1. Alignment with our focus areas (0-5 points):
   - 0 points: No alignment with any focus area
   - 1 point: Minimal alignment with one focus area
   - 2 points: Moderate alignment with one focus area
   - 3 points: Moderate alignment with multiple focus areas
   - 4 points: Strong alignment with one or more focus areas
   - 5 points: Perfect alignment with one or more focus areas

2. Applicability to our client types (0-3 points):
   - 0 points: Not applicable to any of our client types
   - 3 points: Applicable to any of our client types

3. Funding amount and accessibility (0-2 points):
   - 0 points: Insufficient funding or excessive match requirements
   - 1 point: Moderate funding with reasonable match requirements
   - 2 points: Substantial funding with minimal match requirements

Only include opportunities that score 7 or higher in your final output. In the absense of information, make assumptions to Lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID and title
2. Relevance score (1-10)
3. Primary focus area(s)
4. Eligible client types
5. Key benefits (2-3 bullet points)
6. Any notable restrictions or requirements

Input:
[LIST_2_BATCH]
```

**Checkpoint 5**: Verify second-stage filtering results

```javascript
// Check agent execution output for second stage
const { data, error } = await supabase
	.from('agent_executions')
	.select('*')
	.eq('agent_type', 'detail_processor')
	.order('created_at', { ascending: false })
	.limit(1);

// Verify final filtered opportunities
console.log('Final opportunities count:', data[0].output.opportunities.length);
```

#### Efficiency Strategies for Detail Processor

1. **Adaptive Batch Sizing**:

   - Start with a default batch size of 40 opportunities
   - Monitor token usage and processing time
   - Dynamically adjust batch size based on performance metrics
   - Implement a feedback loop to optimize batch size over time

2. **Parallel Processing**:

   - Process multiple batches concurrently
   - Implement a queue system to manage batch processing
   - Use worker pools to limit resource consumption
   - Balance parallelism with API rate limits

3. **Caching and Memoization**:

   - Cache analysis results for similar opportunities
   - Implement a similarity detection algorithm to identify opportunities with similar characteristics
   - Use memoization for common evaluation patterns
   - Expire cache entries based on data freshness requirements

4. **Progressive Enhancement**:

   - Start with basic analysis for all opportunities
   - Apply deeper analysis only to opportunities that meet minimum threshold
   - Use a multi-stage filtering approach within the Detail Processor
   - Prioritize high-potential opportunities for more thorough analysis

5. **Resource Optimization**:

   - Monitor token usage per opportunity
   - Implement token budget management
   - Use more efficient models for initial screening
   - Reserve high-capability models for complex analysis cases

6. **Failure Handling**:
   - Implement circuit breakers for API calls
   - Use exponential backoff for retries
   - Log detailed error information for debugging
   - Continue processing remaining opportunities when individual items fail

### 9. Data Storage

The Data Processor Agent stores the final filtered opportunities in the database, including all relevant metadata.

**Checkpoint 6**: Verify stored opportunities

```javascript
// Check stored opportunities
const { data, error } = await supabase
	.from('funding_opportunities')
	.select('*')
	.eq('source_id', '[SOURCE_ID]')
	.order('created_at', { ascending: false })
	.limit(10);
```

## API Source Configuration

### Source-Specific Parameters

Each API source requires specific configuration parameters. Examples include:

#### Grants.gov

```json
{
	"rows": 100,
	"keyword": "energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation",
	"oppStatuses": "forecasted|posted"
}
```

#### State Energy Office API (Example)

```json
{
	"limit": 100,
	"keywords": "energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation",
	"status": "active,upcoming"
}
```

#### Foundation Grant Database (Example)

```json
{
	"page_size": 100,
	"search_terms": "energy, building, mobility, solar, battery, modernization, hvac, lighting, water, climate, carbon, school, infrastructure, roof, transportation",
	"grant_status": "open"
}
```

### Configuration Schema

The system uses a flexible configuration schema that adapts to each API source:

```json
{
	"source_id": "[SOURCE_ID]",
	"config_type": "request_body",
	"configuration": {
		// Source-specific parameters
	},
	"api_type": "single" | "two_step",
	"detail_endpoint": "[DETAIL_ENDPOINT]" // Only for two_step APIs
}
```

## Agent Responsibilities

### Source Manager Agent

- Reads and validates API source configurations
- Determines the appropriate workflow based on API type
- Orchestrates the overall process flow
- Monitors and logs the process status
- Handles retry logic for failed processes

### API Handler Agent

- Makes API calls to retrieve opportunity data
- Handles pagination for large result sets
- For single-API sources: Performs comprehensive filtering
- For two-step API sources:
  - Performs initial filtering
  - Makes detail API calls for selected opportunities
  - Passes detailed information to Detail Processor Agent

### Detail Processor Agent

- Receives detailed opportunity information from API Handler Agent
- Performs deep analysis and final filtering
- Evaluates opportunities based on detailed criteria
- Prepares filtered opportunities for storage
- Provides reasoning for inclusion/exclusion decisions

### Data Processor Agent

- Receives filtered opportunities from API Handler or Detail Processor
- Checks for duplicates against existing opportunities
- Updates existing opportunities when appropriate
- Inserts new opportunities into the database
- Handles related entities (eligibility, funding categories, etc.)

## Token Management and Error Handling

### Batch Processing

To efficiently manage token usage and handle large volumes of data:

1. **Single-API Filtering**:

   - Process List 1 in batches of 50-75 opportunities
   - If token limit errors occur, split the batch in half and retry

2. **Two-Step API Filtering**:
   - **First Stage**: Process List 1 in batches of 100 opportunities
   - **Second Stage**: Process List 2 in batches of 40-50 opportunities
   - If token limit errors occur, split the batch in half and retry

### Concurrent Processing

For improved efficiency:

1. Process multiple batches concurrently during filtering stages
2. Limit concurrency to 5-10 parallel processes to avoid overwhelming systems
3. Implement proper error handling for each concurrent process
4. Consider parallel processing between API Handler and Detail Processor for two-step APIs

### Error Recovery

Implement robust error recovery mechanisms:

1. **Token Limit Errors**:

   - Split batches and retry with smaller sizes
   - Log batch sizes that succeed for future optimization

2. **API Failures**:

   - Implement exponential backoff for retries
   - Store progress to resume from last successful point

3. **Data Processing Errors**:
   - Log specific errors with opportunity IDs
   - Continue processing remaining opportunities

## Implementation Considerations

### Optimizing API Calls

1. **Throttling**:

   - Add delays between API calls (250-500ms) to avoid rate limiting
   - Adjust delay based on API response times and error rates

2. **Caching**:
   - Cache API responses to avoid redundant calls
   - Implement TTL (Time To Live) based on data freshness requirements

### Monitoring and Optimization

1. **Performance Metrics**:

   - Track processing time for each stage and agent
   - Monitor token usage per opportunity
   - Record filtering rates at each stage

2. **Quality Metrics**:
   - Track which opportunities are ultimately matched to clients
   - Use feedback to refine filtering criteria

### Scheduled Processing

1. **Incremental Updates**:

   - Process only new or updated opportunities since last run
   - Store timestamp of last successful run

2. **Priority Processing**:
   - Process high-priority sources more frequently
   - Adjust batch sizes based on source importance

## Testing Strategy

### Unit Tests

1. Test each agent's core functionality in isolation
2. Verify prompt templates produce expected outputs
3. Test batch splitting and token management logic

### Integration Tests

1. Test the full workflow with mock API responses
2. Verify data flows correctly between agents
3. Test error handling and recovery mechanisms

### End-to-End Tests

1. Test with real API endpoints using limited data
2. Verify opportunities are correctly filtered and stored
3. Test performance with various batch sizes

## Conclusion

This enhanced agentic workflow provides a robust, efficient system for processing funding opportunities at scale. By implementing a modular architecture with specialized agents for each stage of the process, we can identify the most relevant opportunities while managing computational resources effectively.

The system adapts to both single-API and two-step API sources, with appropriate filtering strategies for each. The separation of concerns between API handling, detailed analysis, and data storage ensures maintainability and flexibility as the system evolves.

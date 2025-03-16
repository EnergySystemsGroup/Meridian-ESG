# API Processing Flow Debugging Plan

## Overview

This document outlines a systematic approach to debug the API processing pipeline and identify where issues are occurring. The current flow is not working as expected, and we need to test the inputs and outputs of each major function to ensure we're getting the expected results.

## 1. Debugging Harness

### Debug Controller

Create a dedicated debugging endpoint that allows us to:

- Run individual components of the pipeline in isolation
- Capture and log inputs/outputs at each stage
- Visualize the data transformation between stages

```javascript
// app/api/admin/debug/[component]/route.js
export async function POST(request, { params }) {
	const { component } = params;
	const body = await request.json();

	switch (component) {
		case 'source-manager':
			// Test sourceManagerAgent in isolation
			break;
		case 'api-handler':
			// Test apiHandlerAgent in isolation
			break;
		// etc.
	}
}
```

### Logging Middleware

Implement a logging wrapper for each major function that:

- Logs input parameters
- Captures execution time
- Records output values
- Stores this information for analysis

## 2. Systematic Testing Plan

### Phase 0: Initial Route and Process Coordinator Testing

1. **Test the initial API route that triggers the process**

   - Input: Source ID
   - Expected Output: Run ID and initial status
   - Verification: Ensure the route correctly initiates the process and returns a valid run ID

2. **Test the `processApiSource` function in isolation**

   - Input: Source ID and optional Run ID
   - Expected Output: Complete processing results
   - Verification: Check if all stages are executed in the correct order

3. **Test the Run Manager**
   - Input: Source ID
   - Expected Output: Run status updates at each stage
   - Verification: Ensure the run manager correctly tracks the status of each stage

### Phase 1: Source Manager Testing

1. **Test the `sourceManagerAgent` function in isolation**

   - Input: Source ID
   - Expected Output: Processing details with API endpoint, request configuration, etc.
   - Verification: Ensure the output contains all required fields for the API Handler

2. **Verify source configuration retrieval**

   - Check if configurations are correctly retrieved from the database
   - Validate the formatting of configurations for the source manager

3. **Test API endpoint determination**
   - Verify the source manager correctly determines the API endpoint
   - Check if authentication details are properly included

### Phase 2: API Handler Testing

1. **Test the `apiHandlerAgent` function with known good inputs**

   - Input: Source and processing details from source manager
   - Expected Output: Initial API results, filtered opportunities
   - Verification: Check if the API call is successful and returns expected data

2. **Verify initial API call functionality**

   - Make a direct call to the API endpoint with the same parameters
   - Compare results with what the API handler receives
   - Check for any authentication or access issues

3. **Test pagination functionality**

   - Verify if pagination is correctly implemented
   - Check if all pages are being retrieved
   - Validate the total count calculation

4. **Validate first-stage filtering**
   - Test the filtering logic with sample data
   - Verify the filter criteria are being correctly applied
   - Check if the metrics are accurately calculated

### Phase 3: Detail Processor Testing

1. **Test the `processDetailedInfo` function**

   - Input: Filtered opportunities from API handler
   - Expected Output: Opportunities with detailed information
   - Verification: Check if detail API calls are successful

2. **Verify detail API calls**

   - Test individual detail API calls
   - Check for any rate limiting or authentication issues
   - Validate the response format

3. **Test second-stage filtering**
   - Verify the filtering logic with detailed opportunities
   - Check if the relevance scoring is working correctly
   - Validate the metrics calculation

### Phase 4: Data Processor Testing

1. **Test the `processUnprocessedOpportunities` function**

   - Input: Filtered opportunities with details
   - Expected Output: Storage results
   - Verification: Check if opportunities are correctly stored in the database

2. **Verify database operations**

   - Test insert and update operations
   - Check for any database schema issues
   - Validate the handling of duplicate opportunities

3. **Test error handling**
   - Simulate various error conditions
   - Verify the error handling and recovery
   - Check if errors are properly logged

## 3. Implementation Approach

### Debug UI

Create a simple admin interface to:

- Trigger test runs for specific components
- View detailed logs and execution traces
- Compare expected vs. actual outputs

### Database Schema Validation

Add validation to ensure all required fields exist in the database tables:

- `api_sources`
- `api_source_configurations`
- `api_source_runs`
- `funding_opportunities`
- `api_raw_responses`

### Logging Enhancement

Enhance the logging system to capture:

- Function entry and exit points
- Input and output parameters
- Execution time
- Error details

### Run Manager Enhancements

Improve the Run Manager to:

- Track the status of each processing stage
- Provide detailed error information
- Support debugging and monitoring
- Allow for resuming failed runs at specific stages

## 4. Specific Tests to Run

1. **Initial Route Test**

   - Test ID: `initial-route-test`
   - Description: Test the API route that triggers the process
   - Expected Result: Successful initiation of the process with a valid run ID

2. **Process Coordinator Test**

   - Test ID: `process-coordinator-test`
   - Description: Test the complete processing pipeline
   - Expected Result: Successful coordination of all processing stages

3. **Run Manager Test**

   - Test ID: `run-manager-test`
   - Description: Test the run status tracking
   - Expected Result: Accurate status updates at each stage

4. **Source Configuration Test**

   - Test ID: `source-config-test`
   - Description: Verify source configuration retrieval
   - Expected Result: Complete configuration object

5. **API Endpoint Test**

   - Test ID: `api-endpoint-test`
   - Description: Direct call to the API endpoint
   - Expected Result: Successful response with data

6. **Pagination Test**

   - Test ID: `pagination-test`
   - Description: Test pagination functionality
   - Expected Result: All pages retrieved correctly

7. **Filter Logic Test**

   - Test ID: `filter-logic-test`
   - Description: Test opportunity filtering
   - Expected Result: Correctly filtered opportunities

8. **Database Schema Test**

   - Test ID: `db-schema-test`
   - Description: Validate database schema
   - Expected Result: All required fields present

9. **End-to-End Flow Test**
   - Test ID: `e2e-flow-test`
   - Description: Complete processing pipeline
   - Expected Result: Successful processing with accurate metrics

## 5. Immediate Action Items

1. Create debug endpoints for testing individual components
2. Add comprehensive logging to the processing pipeline
3. Implement a UI for visualizing the processing stages
4. Add database schema validation
5. Create sample data fixtures for testing
6. Enhance the Run Manager to track stage statuses
7. Add detailed error handling and reporting

## 6. Expected Outcomes

By following this debugging plan, we expect to:

1. Identify exactly where the processing flow is breaking down
2. Fix each component individually
3. Ensure the entire pipeline works correctly
4. Improve error handling and logging
5. Create a more robust and maintainable system
6. Enhance the visibility of the processing stages

## 7. Timeline

1. **Day 1**: Set up debugging infrastructure and enhance Run Manager
2. **Day 2**: Test Initial Route, Process Coordinator, and Source Manager
3. **Day 3**: Test API Handler and Detail Processor
4. **Day 4**: Test Data Processor and end-to-end flow
5. **Day 5**: Documentation and final validation

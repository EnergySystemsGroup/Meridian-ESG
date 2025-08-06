# Performance Metrics Breakdown - Meridian ESG Pipeline

## Performance Metrics Displayed on Run Details Page

### Primary Metrics Row (API to Extraction)

### 1. **Total API Results**
- **Source**: Extracted from the `data_extraction` stage's `stage_results.totalApiResults` or `stage_results.totalFound`
- **Derivation**: The total count of results returned by the API (before any extraction/processing)
- **Code Location**: 
  - Collection: `processCoordinatorV2.js:245` - `extractionResult.extractionMetrics?.totalFound`
  - Display: `pageV2.jsx:206` - Parsed from stage_results JSON
- **Purpose**: Shows the raw volume of data from the API
- **Database Field**: `pipeline_stages.stage_results.totalApiResults` where `stage_name = 'data_extraction'`

### 2. **Opportunities Extracted** (formerly "Opportunity Input")
- **Source**: Extracted from the `data_extraction` stage's `output_count`
- **Derivation**: The number of opportunities successfully extracted and standardized from the API results
- **Code Location**: `pageV2.jsx:196` - Gets the count from the data extraction stage output
- **Database Field**: `pipeline_stages.output_count` where `stage_name = 'data_extraction'`
- **Purpose**: Shows how many valid opportunities were extracted from the raw API data

### 3. **Extraction Rate**
- **Source**: Calculated metric
- **Derivation**: `(Opportunities Extracted / Total API Results) * 100`
- **Code Location**: `pageV2.jsx:254` - Calculated from the two metrics above
- **Purpose**: Shows the efficiency of the extraction process (what percentage of API results became valid opportunities)
- **Format**: Percentage (0-100%)

### Processing Breakdown Row

### 4. **Opportunities Skipped**
- **Source**: Calculated from the `early_duplicate_detector` stage results
- **Derivation**: `duplicateDetection.metrics.opportunitiesToSkip` - Opportunities that already exist and haven't changed
- **Code Location**: `pageV2.jsx:212` - Extracted from duplicate detector's metrics
- **Purpose**: Shows efficiency by avoiding redundant processing

### 5. **Opportunities Updated** 
- **Source**: From the `early_duplicate_detector` stage results
- **Derivation**: `duplicateDetection.metrics.opportunitiesToUpdate` - Existing opportunities that have new data
- **Code Location**: `pageV2.jsx:213` - Extracted from duplicate detector's metrics
- **Purpose**: Tracks opportunities that needed updates

### 6. **Opportunities Stored**
- **Source**: From the `direct_update` stage's `output_count`
- **Derivation**: Count of successfully stored/updated opportunities in the database
- **Code Location**: `pageV2.jsx:221-223` - Aggregated from storage and update stages
- **Calculation**: `directUpdateStage.output_count + storageStage.output_count`

### 7. **Success Rate**
- **Source**: Calculated metric
- **Derivation**: `(successfullyProcessed / opportunityInput) * 100`
  - Where `successfullyProcessed = opportunitiesStored + opportunitiesSkipped + opportunitiesUpdated`
- **Code Location**: 
  - UI Calculation: `pageV2.jsx:237`
  - Enhanced Calculation: `metricsCalculator.js:32-75`
- **Enhanced Features**: 
  - Factors in failure tracking across categories (API errors, validation errors, processing errors, etc.)
  - Handles edge cases and invalid data gracefully
  - Returns 0-100% clamped value

### 8. **Opportunities/Min (Throughput)**
- **Source**: Stored in `pipeline_runs.opportunities_per_minute`
- **Derivation**: 
  ```javascript
  const minutes = totalExecutionTime / (1000 * 60);
  opportunities_per_minute = Math.round((totalOpportunities / minutes) * 100) / 100;
  ```
- **Code Location**: `runManagerV2.js:583-585`
- **Purpose**: Measures pipeline processing speed
- **Target**: > 10 opportunities/minute for SLA compliance
- **Display Location**: Processing breakdown row (5th metric)

### 9. **Tokens/Opportunity (Efficiency)**
- **Source**: Calculated from total tokens used
- **Derivation**: `total_tokens_used / opportunityInput`
- **Code Location**: 
  - UI: `pageV2.jsx:253-255`
  - Calculation: `runManagerV2.js:588-590`
- **Purpose**: Measures AI resource efficiency per opportunity
- **Format**: Rounded to 2 decimal places

## Additional Metrics (Calculated but not displayed on main UI)

### 8. **Cost Per Opportunity**
- **Derivation**: `(total_tokens_used * 0.00001) / totalOpportunities`
- **Code Location**: `runManagerV2.js:593-595`
- **Purpose**: Tracks economic efficiency
- **Target**: < $0.05 per opportunity for SLA compliance
- **Database Field**: `pipeline_runs.cost_per_opportunity_usd`

### 9. **SLA Compliance Score**
- **Derivation**: Weighted score based on multiple factors
- **Components**:
  - **Time Compliance** (25% weight): 
    - Target: Complete within 30 minutes
    - Penalty: 50% per 100% overrun
  - **Success Rate Compliance** (35% weight): 
    - Target: 95% success rate
    - Linear scaling to target
  - **Cost Compliance** (20% weight): 
    - Target: < $0.05/opportunity
    - Penalty: 30% per 100% overrun
  - **Throughput Compliance** (20% weight): 
    - Target: > 10 opportunities/minute
    - Linear scaling to target
- **Code Location**: `metricsCalculator.js:83-172`
- **Grading Scale**:
  - A: 90-100% compliance
  - B: 80-89% compliance
  - C: 70-79% compliance
  - D: 60-69% compliance
  - F: <60% compliance
- **Database Fields**: 
  - `pipeline_runs.sla_compliance_percentage`
  - `pipeline_runs.sla_grade`
  - `pipeline_runs.sla_breakdown`

### 10. **Optimization Impact Metrics**
- **Opportunities Bypassed LLM**: 
  - Count of opportunities that skipped AI processing due to duplicate detection
  - Database Field: `pipeline_runs.opportunities_bypassed_llm`
- **Token Savings**: 
  - Estimated tokens saved by early duplicate detection
  - Calculation: `bypassedOpportunities * averageTokensPerOpportunity`
- **API Call Reduction**: 
  - Number of API calls avoided through optimization
  - Stored in stage metrics

### 11. **Failure Breakdown**
- **Categories Tracked**:
  - API Errors
  - Validation Errors
  - Duplicate Rejections
  - Processing Errors
  - Storage Errors
  - Timeout Errors
- **Storage**: `pipeline_runs.failure_breakdown`
- **Used For**: Calculating accurate success rates and identifying problem areas

## Data Flow for Metrics Collection

### 1. **Collection Points**:
- Each pipeline stage reports:
  - `input_count`: Opportunities received
  - `output_count`: Opportunities produced
  - `execution_time_ms`: Time taken
  - `tokens_used`: AI tokens consumed
  - `api_calls_made`: Number of API calls
  - `stage_results`: Detailed results JSON

### 2. **Aggregation Process**:
- **Primary Aggregator**: `processCoordinatorV2.js`
  - Collects metrics from all stages
  - Tracks opportunity paths through pipeline
  - Calculates optimization impact
- **Metrics Calculator**: `runManagerV2.js`
  - Calculates derived metrics (rates, ratios, percentages)
  - Updates `pipeline_runs` table with final metrics
  - Handles failure tracking and SLA compliance

### 3. **Storage Structure**:
- **Main Tables**:
  - `pipeline_runs`: Overall run metrics and performance
  - `pipeline_stages`: Individual stage performance
  - `duplicate_detection_sessions`: Duplicate detection specifics
  - `opportunity_paths`: Individual opportunity journey tracking

### 4. **Display Logic**:
- **Function**: `extractOpportunityFlow()` in `pageV2.jsx`
- **Process**:
  1. Queries pipeline stages for the run
  2. Extracts counts from stage results
  3. Calculates derived metrics
  4. Handles missing data gracefully
  5. Returns formatted metrics object

## Key Performance Indicators (KPIs)

### Primary KPIs:
1. **Success Rate**: Should be > 95%
2. **Throughput**: Should be > 10 opportunities/minute
3. **Cost Efficiency**: Should be < $0.05/opportunity
4. **Processing Time**: Should be < 30 minutes

### Secondary KPIs:
1. **Token Efficiency**: Lower is better (target < 1000 tokens/opportunity)
2. **Duplicate Detection Rate**: Higher is better (reduces unnecessary processing)
3. **Error Rate**: Should be < 5%
4. **SLA Compliance**: Should be > 90% (Grade A or B)

## Optimization Strategies Based on Metrics

### If Success Rate is Low:
- Check failure breakdown for specific error categories
- Review API connection stability
- Validate data extraction schemas

### If Throughput is Low:
- Increase batch sizes in configuration
- Enable parallel processing where possible
- Review database query performance

### If Cost is High:
- Optimize prompt engineering to reduce tokens
- Increase duplicate detection effectiveness
- Use early filtering to reduce AI processing

### If Processing Time is High:
- Review stage-by-stage execution times
- Identify bottleneck stages
- Consider increasing concurrency limits

## Configuration Variables Affecting Metrics

### From `extraction.config.js`:
- `CHUNK_SIZE`: Affects batching and throughput
- `MAX_RETRIES`: Affects success rate and processing time
- `BATCH_DELAY`: Affects throughput

### From `analysis.config.js`:
- `DEFAULT_BATCH_SIZE`: Affects token usage and throughput
- `HIGH_SCORE_THRESHOLD`: Affects opportunity categorization
- `COST_PER_TOKEN`: Affects cost calculations

### From `storage.config.js`:
- `BATCH_SIZE`: Affects storage throughput
- `PARALLEL_BATCH_PROCESSING`: Affects processing speed

## Real-time Monitoring

### Subscription Channels:
- `v2_run_updates`: Updates to pipeline_runs table
- `v2_stages_updates`: Updates to pipeline_stages table

### Update Frequency:
- Stage updates: After each stage completes
- Run updates: After optimization metrics calculation
- Final updates: On run completion or failure

## Debugging Metrics Issues

### Common Issues and Solutions:

1. **Metrics showing as "N/A"**:
   - Check if run completed successfully
   - Verify token tracking is enabled
   - Ensure stages are reporting metrics

2. **Success rate unexpectedly low**:
   - Review `failure_breakdown` in database
   - Check for API rate limiting
   - Validate input data quality

3. **Throughput below target**:
   - Check batch sizes in configuration
   - Review network latency
   - Analyze stage-by-stage timings

4. **Cost per opportunity high**:
   - Review token usage per stage
   - Check for retry storms
   - Optimize prompt templates

## Notes for Developers

- All metrics calculations include defensive programming for edge cases
- Division by zero is handled throughout
- Invalid/null values default to safe values
- Metrics are designed to degrade gracefully during partial failures
- Historical metrics can be used for trend analysis and optimization
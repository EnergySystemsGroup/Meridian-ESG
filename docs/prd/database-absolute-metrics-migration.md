# Database Schema Migration: Removing V1 vs V2 Comparison Metrics

## Overview

This migration removes comparison-focused fields from the database schema and replaces them with absolute performance metrics that provide real business value without dependency on historical version comparisons.

## Migration Files

1. **20250802000001_remove_comparison_metrics_phase_1.sql** - Adds new absolute performance fields
2. **20250802000002_remove_comparison_metrics_phase_2.sql** - Removes comparison fields and recreates views
3. **20250802000003_create_performance_calculation_functions.sql** - Adds automatic calculation functions

## Fields Removed

### From `pipeline_runs` table:
- `opportunities_bypassed_llm` - V2 optimization metric
- `token_savings_percentage` - Percentage savings vs baseline
- `time_savings_percentage` - Percentage time savings vs baseline
- `efficiency_score` - Overall efficiency rating (comparative)

### From `duplicate_detection_sessions` table:
- `estimated_tokens_saved` - Tokens saved vs full processing
- `estimated_cost_saved_usd` - Cost saved vs full processing
- `efficiency_improvement_percentage` - Percentage improvement metric

### Entire tables removed:
- `pipeline_performance_baselines` - Existed solely for V1 comparison

## New Absolute Performance Fields

### `pipeline_runs` table:
- `opportunities_per_minute` - Absolute throughput metric
- `tokens_per_opportunity` - Efficiency metric (tokens/opportunity)
- `cost_per_opportunity_usd` - Cost efficiency metric
- `success_rate_percentage` - Quality metric (% successful)
- `error_rate_percentage` - Error tracking
- `sla_target_ms` - SLA target for this run type
- `sla_compliance_percentage` - SLA compliance tracking
- `throughput_target_opm` - Target opportunities per minute
- `cost_target_per_opportunity_usd` - Target cost efficiency
- `quality_target_percentage` - Target quality percentage

### `duplicate_detection_sessions` table:
- `detection_throughput_ops` - Operations per second
- `avg_detection_time_per_opportunity_ms` - Average time per detection
- `detection_precision_percentage` - Precision (true positives / all positives)
- `detection_recall_percentage` - Recall (true positives / all actual duplicates)
- `detection_f1_score` - F1 score combining precision and recall

### `pipeline_stages` table:
- `throughput_ops` - Stage operations per second
- `cost_per_operation_usd` - Cost per operation for this stage
- `success_rate_percentage` - Stage success rate
- `memory_efficiency_mb_per_op` - Memory usage per operation

## New Performance Targets Table

The `pipeline_performance_targets` table allows setting and tracking absolute performance targets:

```sql
-- Set throughput target for an API source
SELECT set_performance_target(
  '123e4567-e89b-12d3-a456-426614174000',  -- api_source_id
  'throughput',                             -- target_type
  50.0,                                     -- target_value (50 opportunities per minute)
  'opm',                                    -- target_unit
  'standard',                               -- performance_tier
  'Base throughput requirement for grants processing' -- justification
);

-- Set cost efficiency target
SELECT set_performance_target(
  '123e4567-e89b-12d3-a456-426614174000',
  'cost',
  0.25,                                     -- $0.25 per opportunity
  'usd',
  'premium',
  'Cost optimization target for high-volume processing'
);
```

## Updated Views

### `pipeline_progress` view:
- Now shows absolute performance metrics instead of comparison percentages
- Includes performance vs targets calculations
- Shows throughput and cost efficiency relative to configured targets

### `pipeline_performance_summary` view:
- Aggregates absolute performance metrics by API source and date
- Calculates target compliance percentages
- Provides totals and averages for business reporting

### `duplicate_detection_effectiveness` view:
- Shows detection quality metrics (precision, recall, F1 score)
- Absolute performance metrics (throughput, timing)
- Quality target compliance tracking

### New: `pipeline_performance_dashboard` view:
- Real-time performance monitoring
- Shows current performance vs all target types
- Boolean flags for meeting/missing targets

## Automatic Metric Calculation

The migration includes triggers and functions for automatic calculation:

```sql
-- Automatically calculates metrics when pipeline runs complete
-- Trigger: trigger_pipeline_run_metrics_update

-- Manually recalculate metrics for a specific run
SELECT calculate_pipeline_run_metrics('run-uuid-here');

-- Batch update all existing records
SELECT update_all_absolute_metrics();
```

## Performance Analysis Queries

### Check performance vs targets:
```sql
-- Get current performance vs targets for an API source
SELECT * FROM get_performance_vs_targets('api-source-uuid');

-- Performance dashboard view
SELECT * FROM pipeline_performance_dashboard 
WHERE api_source_id = 'api-source-uuid'
ORDER BY started_at DESC
LIMIT 10;
```

### Absolute performance trends:
```sql
-- Throughput trend over time
SELECT 
  DATE_TRUNC('day', started_at) as date,
  AVG(opportunities_per_minute) as avg_throughput,
  AVG(cost_per_opportunity_usd) as avg_cost_efficiency,
  AVG(success_rate_percentage) as avg_success_rate
FROM pipeline_runs 
WHERE api_source_id = 'source-uuid'
  AND completed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', started_at)
ORDER BY date;
```

### Quality metrics analysis:
```sql
-- Duplicate detection quality over time
SELECT 
  DATE_TRUNC('week', created_at) as week,
  AVG(detection_precision_percentage) as avg_precision,
  AVG(detection_recall_percentage) as avg_recall,
  AVG(detection_f1_score) as avg_f1_score,
  AVG(detection_throughput_ops) as avg_throughput
FROM duplicate_detection_sessions
WHERE api_source_id = 'source-uuid'
  AND created_at > NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week;
```

## Data Preservation

Comparison metrics are archived in `pipeline_metrics_archive` table before removal:
- Original data preserved with record references
- Queryable for historical analysis if needed
- Archive reason and timestamp tracked

## Business Benefits

1. **Absolute Performance Tracking**: Metrics independent of version comparisons
2. **Target-Based Management**: Set and track performance targets
3. **Real Business Value**: Throughput, cost efficiency, quality metrics
4. **Future-Proof**: Metrics remain relevant as system evolves
5. **SLA Monitoring**: Track compliance with service level agreements
6. **Quality Assurance**: Precision, recall, and F1 scores for detection quality

## Usage After Migration

1. **Set Performance Targets**: Use `set_performance_target()` for each API source
2. **Monitor Dashboard**: Query `pipeline_performance_dashboard` view
3. **Analyze Trends**: Use performance summary views for reporting
4. **Alert on Issues**: Monitor SLA compliance and target achievement
5. **Optimize Based on Data**: Use absolute metrics to drive improvements

This migration transforms the database from tracking "how much better V2 is than V1" to tracking "how well the system performs against business requirements."
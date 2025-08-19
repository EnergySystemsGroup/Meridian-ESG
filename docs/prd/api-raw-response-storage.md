# Product Requirements Document: API Raw Response Storage

## Executive Summary

The API Raw Response Storage feature provides a robust data ingestion and deduplication system that captures, stores, and manages raw API responses from external funding data sources. This system serves as the foundational data layer for the Meridian platform, enabling efficient processing, auditing, and performance optimization through intelligent content hashing and duplicate detection.

## Problem Statement

### Current Challenges
1. **Redundant Processing**: Without raw response storage, identical API data would be processed multiple times, consuming expensive AI resources
2. **No Audit Trail**: Inability to trace back to original source data for debugging or compliance
3. **Performance Bottlenecks**: Re-fetching data from external APIs for reprocessing causes delays and API rate limit issues
4. **Data Loss Risk**: No backup of historical API responses if external sources change or remove data
5. **Cost Inefficiency**: Processing unchanged data through expensive AI pipelines wastes computational resources

### Business Impact
- 60-80% of API responses contain unchanged data that doesn't require reprocessing
- Each unnecessary AI processing costs $0.02-0.05 in token usage
- API rate limits can delay critical funding opportunity discovery by hours or days

## Solution Overview

The API Raw Response Storage system captures and intelligently manages all external API responses, providing:
- Immediate storage of raw API data before any transformation
- Content-based deduplication to prevent redundant storage and processing
- Complete audit trail for compliance and debugging
- Foundation for the V2 pipeline's performance optimizations

## Functional Requirements

### 1. Data Capture

#### 1.1 Raw Response Storage
- **Requirement**: Store complete, unmodified API responses immediately after retrieval
- **Details**:
  - Preserve exact JSON/XML structure as received
  - No data transformation or cleaning at storage time
  - Support for responses up to 100MB in size
  - Handle various content types (JSON, XML, HTML)

#### 1.2 Metadata Collection
- **Requirement**: Capture comprehensive metadata about each API call
- **Fields**:
  - `api_source_id`: Link to the configured API source
  - `api_endpoint`: Exact URL called
  - `request_details`: Headers, parameters, authentication used
  - `execution_time_ms`: API call duration for performance monitoring
  - `call_type`: Categorization (list/detail/single)
  - `opportunity_count`: Quick count without full parsing

### 2. Deduplication System

#### 2.1 Content Hashing
- **Requirement**: Generate deterministic hashes for duplicate detection
- **Implementation**:
  - Use SHA-256 hashing algorithm
  - Extract stable fields from raw API response JSON opportunities array
  - Fields for hashing: title, description, deadline, amount, agency (using fallback field names for different APIs)
  - Store hash as indexed column for fast lookups

#### 2.2 Duplicate Handling
- **Requirement**: Intelligently handle duplicate responses
- **Behavior**:
  - Check for existing content_hash before insertion
  - If duplicate found:
    - Update `last_seen_at` timestamp
    - Increment `call_count` counter
    - Return existing record ID
  - If new:
    - Create new record with initial `call_count = 1`

### 3. Data Retrieval

#### 3.1 Query Capabilities
- **Requirement**: Efficient retrieval of stored responses
- **Access Patterns**:
  - By ID for specific response lookup
  - By api_source_id for source-specific data
  - By content_hash for deduplication checks
  - By date range for historical analysis
  - Latest response per API source

#### 3.2 Performance Requirements
- **Response Times**:
  - Single record retrieval: < 50ms
  - Deduplication check: < 100ms
  - Bulk retrieval (100 records): < 500ms

### 4. Data Management

#### 4.1 Retention Policy
- **Requirement**: Manage storage growth while preserving valuable data
- **Policy**:
  - Keep all unique responses indefinitely
  - For duplicates, maintain only the latest occurrence
  - Archive responses older than 1 year to cold storage
  - Compress responses larger than 1MB

#### 4.2 Data Integrity
- **Requirement**: Ensure stored data remains accurate and complete
- **Measures**:
  - Validate JSON/XML structure before storage
  - Verify content_hash on retrieval
  - Implement database-level constraints
  - Regular integrity checks via background jobs

## Technical Requirements

### Database Schema

```sql
CREATE TABLE api_raw_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_source_id UUID NOT NULL REFERENCES api_sources(id),
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  request_details JSONB,
  api_endpoint TEXT,
  call_type TEXT CHECK (call_type IN ('list', 'detail', 'single')),
  execution_time_ms INTEGER,
  opportunity_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  call_count INTEGER DEFAULT 1,
  
  -- Indexes for performance
  INDEX idx_content_hash (content_hash),
  INDEX idx_api_source_id (api_source_id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_last_seen_at (last_seen_at DESC)
);
```

### API Endpoints

#### Store Raw Response
```
POST /internal/api/raw-responses
Body: {
  api_source_id: UUID,
  content: JSON,
  request_details: JSON,
  api_endpoint: string,
  call_type: string,
  execution_time_ms: number
}
Response: {
  id: UUID,
  is_duplicate: boolean,
  existing_id?: UUID
}
```

#### Retrieve Raw Response
```
GET /api/funding/raw-responses/{id}
Response: {
  id: UUID,
  content: JSON,
  metadata: {...}
}
```

#### Get Latest by Source
```
GET /api/funding/raw-responses/latest?source_id={uuid}
Response: {
  id: UUID,
  content: JSON,
  created_at: timestamp
}
```

## Integration Points

### 1. Data Extraction Agent
- Stores raw responses immediately after API calls
- Checks for duplicates before processing
- Links extracted opportunities to raw response IDs

### 2. V2 Pipeline
- Uses content_hash to skip processing of unchanged data
- References raw responses for reprocessing workflows
- Tracks performance metrics against raw response metadata

### 3. Debugging Tools
- API routes for viewing raw responses
- Admin dashboard integration for data inspection
- Audit log correlation with raw response IDs

## Success Metrics

### Performance Metrics
- **Deduplication Rate**: Target 60-80% duplicate detection
- **Storage Efficiency**: < 20% storage growth month-over-month
- **Query Performance**: 99th percentile < 100ms
- **Processing Savings**: 60% reduction in AI token usage

### Business Metrics
- **Cost Reduction**: $10,000/month savings in AI processing
- **Data Freshness**: < 5 minute delay from API call to storage
- **System Reliability**: 99.9% availability for read operations
- **Audit Compliance**: 100% traceability to source data

## Security Considerations

### Data Protection
- Encrypt sensitive authentication details in request_details
- Implement row-level security for multi-tenant access
- Sanitize API responses for potential XSS/injection attacks
- Regular security audits of stored data

### Access Control
- Read-only access for most users
- Write access limited to system agents
- Audit logging for all data access
- API rate limiting to prevent abuse

## Migration Strategy

### Phase 1: Schema Creation
- Deploy database migrations
- Create necessary indexes
- Set up monitoring

### Phase 2: Data Capture
- Enable storage in DataExtractionAgent
- Monitor storage patterns
- Validate deduplication accuracy

### Phase 3: Integration
- Connect V2 pipeline to use stored responses
- Implement API endpoints
- Deploy admin tools

### Phase 4: Optimization
- Tune deduplication algorithm
- Implement compression
- Add caching layer

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Storage growth exceeds capacity | High | Implement compression and archival strategy |
| Hash collisions cause false duplicates | Medium | Use SHA-256 and validate with secondary checks |
| Performance degradation with scale | High | Add database partitioning by date |
| Data corruption | High | Regular integrity checks and backups |

## Future Enhancements

1. **Smart Compression**: Compress similar responses using delta encoding
2. **Predictive Caching**: Pre-fetch likely-to-change endpoints
3. **Change Detection**: Alert when API response structures change
4. **ML-Based Deduplication**: Use machine learning for fuzzy matching
5. **Cross-Source Deduplication**: Detect duplicates across different API sources

## Appendix

### A. Content Hash Algorithm

```javascript
// Extracts stable fields from raw API response opportunities array
function generateContentHash(opportunities) {
  const stableFields = opportunities.map(opp => ({
    title: opp.title || opp.opportunityTitle,           // Raw API field
    description: opp.description || opp.synopsis?.description,  // Raw API field
    closeDate: opp.closeDate || opp.closeDateExplanation,       // Raw API field
    awardAmount: opp.awardCeiling || opp.maximumAward,          // Raw API field
    agency: opp.agencyName || opp.agency                        // Raw API field
  }));
  
  const sortedContent = JSON.stringify(stableFields, Object.keys(stableFields).sort());
  return crypto.createHash('sha256').update(sortedContent).digest('hex');
}
```

### B. Database Indexes Rationale

- `idx_content_hash`: Enables O(1) duplicate detection
- `idx_api_source_id`: Fast retrieval by source
- `idx_created_at`: Efficient date range queries
- `idx_last_seen_at`: Quick identification of stale data

### C. Storage Calculations

- Average response size: 50KB
- Daily API calls: 10,000
- Deduplication rate: 70%
- Daily storage growth: 10,000 * 0.3 * 50KB = 150MB
- Monthly storage growth: 4.5GB
- Yearly storage requirement: 54GB (before compression)
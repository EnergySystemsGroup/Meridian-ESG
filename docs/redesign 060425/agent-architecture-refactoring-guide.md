# Agent Architecture Refactoring Guide
*Development Philosophy and Best Practices for Major System Reorganization*

## Table of Contents
1. [Development Philosophy](#development-philosophy)
2. [The Strangler Fig Pattern](#the-strangler-fig-pattern)
3. [Recommended Folder Structure](#recommended-folder-structure)
4. [Migration Strategy](#migration-strategy)
5. [Complete System Flow](#complete-system-flow)
6. [Specific Refactoring Recommendations](#specific-refactoring-recommendations)
7. [Risk Mitigation](#risk-mitigation)
8. [Implementation Timeline](#implementation-timeline)
9. [Quality Assurance](#quality-assurance)

## Code Design Philosophy

### Keep It Simple and Modular

**⚠️ Important Note on Code Examples:**
The code examples in this guide are intentionally detailed for **documentation and planning purposes**. When implementing, follow these principles:

### **Core Design Rules:**
1. **Keep functions SHORT** (20-50 lines max)
2. **Keep components FOCUSED** (single responsibility)  
3. **Keep files SMALL** (under 200 lines when possible)
4. **Build MODULARLY** (easy to test, easy to understand)

### **Example - Instead of One Large Agent File:**

❌ **Don't do this** (one 500-line file):
```javascript
// agents-v2/filtering/scoringAgent.js (500 lines)
export class ScoringAgent {
  async generateFinalScore(opportunity, relevanceScore, eligibilityScore) {
    // 200 lines of complex logic
    // Multiple responsibilities mixed together
    // Hard to test individual pieces
    // Hard to understand and maintain
  }
}
```

✅ **Do this** (multiple focused files):
```javascript
// agents-v2/filtering/scoringAgent.js (50 lines)
import { validateOpportunity } from './utils/validation.js';
import { buildScoringPrompt } from './utils/prompts.js';
import { parseScoreResponse } from './utils/parsers.js';
import { callAnthropic } from '../utils/anthropicClient.js';

export async function generateFinalScore(opportunity, relevanceScore, eligibilityScore) {
  // 1. Validate input (5 lines)
  const validation = validateOpportunity(opportunity);
  if (!validation.isValid) throw new Error(validation.error);
  
  // 2. Build prompt (5 lines)  
  const prompt = buildScoringPrompt(opportunity, relevanceScore, eligibilityScore);
  
  // 3. Call AI (5 lines)
  const response = await callAnthropic(prompt, { maxTokens: 200 });
  
  // 4. Parse and return (5 lines)
  return parseScoreResponse(response, opportunity);
}

// agents-v2/filtering/utils/prompts.js (30 lines)
export function buildScoringPrompt(opportunity, relevanceScore, eligibilityScore) {
  return `Generate final score for: ${opportunity.title}...`;
}

// agents-v2/filtering/utils/parsers.js (40 lines)  
export function parseScoreResponse(response, opportunity) {
  // Clean parsing logic
}

// agents-v2/filtering/utils/validation.js (20 lines)
export function validateOpportunity(opportunity) {
  // Simple validation logic
}
```

### **Benefits of Modular Approach:**

🎯 **Easy to Test:**
```javascript
// test/scoringAgent.test.js - can test each piece
test('validateOpportunity catches missing fields', () => { ... });
test('buildScoringPrompt formats correctly', () => { ... });  
test('parseScoreResponse handles edge cases', () => { ... });
```

🎯 **Easy to Debug:**
```javascript
// If scoring fails, you know exactly which step broke
console.log('Validation passed:', validation.isValid);
console.log('Prompt generated:', prompt.length);
console.log('AI response received:', response.data);
```

🎯 **Easy to Improve:**
```javascript
// Want better prompts? Just update prompts.js
// Want better validation? Just update validation.js
// Each piece is isolated and replaceable
```

### **File Organization Strategy:**

```
agents-v2/filtering/
├── scoringAgent.js           # Main entry point (50 lines)
├── relevanceFilter.js        # Main entry point (40 lines)  
├── eligibilityFilter.js      # Main entry point (35 lines)
└── utils/
    ├── prompts.js            # All prompt templates (60 lines)
    ├── parsers.js            # Response parsing logic (80 lines)
    ├── validation.js         # Input validation (40 lines)
    └── anthropicClient.js    # AI client wrapper (60 lines)
```

### **When Implementing This Guide:**

1. **Start with the simplest version** that works
2. **Break complex functions into smaller pieces**
3. **Extract reusable logic into utilities**
4. **Each file should have one clear purpose**
5. **If you can't explain a function in one sentence, break it down**

### **Remember:**
- **Long code examples in this guide = comprehensive documentation**
- **Your actual implementation = short, focused, modular files**
- **Favor many small files over few large files**
- **Each function should do ONE thing well**

---

## Development Philosophy

### Core Principles for Major Refactoring

When undertaking significant architectural changes in production systems, the primary concern is **business continuity**. The following principles guide our approach:

1. **Zero Downtime**: The existing system must continue operating throughout the transition
2. **Gradual Migration**: Replace components incrementally rather than all at once
3. **Reversibility**: Maintain the ability to rollback at any stage
4. **Validation**: Prove new components work before removing old ones
5. **Monitoring**: Track performance and accuracy throughout the transition

### Why Not a "Big Bang" Approach?

- **High Risk**: Complete system replacement introduces too many variables
- **Difficult Debugging**: Hard to isolate issues when everything changes at once
- **Stakeholder Anxiety**: Business teams lose confidence during extended outages
- **Recovery Complexity**: Rolling back a complete rewrite is nearly impossible

## The Strangler Fig Pattern

### Pattern Overview

The Strangler Fig pattern is named after the strangler fig tree, which gradually grows around and eventually replaces its host tree. In software architecture:

1. **New system grows alongside the old**
2. **Traffic is gradually redirected to new components**
3. **Old components are removed only after new ones are proven**
4. **The transition happens incrementally and safely**

### Implementation Stages

#### Stage 1: Coexistence
- Old system continues to handle all traffic
- New system is developed and tested in isolation
- No production impact

#### Stage 2: Gradual Adoption
- Route small percentage of traffic to new system
- Compare outputs between old and new systems
- Monitor performance and accuracy metrics

#### Stage 3: Scaling Up
- Increase traffic to new system as confidence grows
- Keep old system as fallback
- Document differences and improvements

#### Stage 4: Deprecation
- New system handles majority of traffic
- Old system remains for emergency fallback
- Plan final cutover once new system is proven

#### Stage 5: Retirement
- Remove old system components
- Archive code for reference
- Complete migration documentation

## Recommended Folder Structure

### Current vs. Proposed Structure

```
app/lib/
├── agents/                    # ✅ Current working agents (KEEP)
│   ├── sourceManagerAgent.js
│   ├── apiHandlerAgent.js
│   ├── detailProcessorAgent.js
│   └── dataProcessorAgent.js
├── agents-v2/                 # 🆕 New architecture
│   ├── core/
│   │   ├── sourceOrchestrator.js
│   │   ├── apiCollector.js
│   │   └── dataProcessor.js
│   ├── filtering/
│   │   ├── relevanceFilter.js
│   │   ├── eligibilityFilter.js
│   │   └── scoringAgent.js
│   ├── utils/
│   │   ├── anthropicClient.js
│   │   ├── apiRequestHandler.js
│   │   └── performanceMonitor.js
│   └── schemas/
│       ├── extractionSchemas.js
│       ├── scoringSchemas.js
│       └── validationSchemas.js
├── services/
│   ├── processCoordinator.js     # ✅ Current coordinator (KEEP)
│   ├── processCoordinatorV2.js   # 🆕 New coordinator
│   ├── routingService.js         # 🆕 Traffic routing logic
│   └── migrationService.js       # 🆕 Migration utilities
├── config/
│   ├── features.js               # 🆕 Feature flags
│   └── agentConfig.js           # 🆕 Agent configurations
└── tests/
    ├── agents/                   # ✅ Current agent tests (KEEP)
    ├── agents-v2/               # 🆕 New agent tests
    │   ├── unit/
    │   └── integration/
    └── migration/              # 🆕 Migration validation tests
```

### Benefits of This Structure

- **Clear Separation**: Old and new systems are isolated
- **Parallel Development**: Teams can work on both simultaneously
- **Easy Rollback**: Simply disable v2 features
- **Gradual Testing**: Test individual components independently
- **Documentation**: Clear history of architectural evolution

## Migration Strategy

### Phase 1: Foundation Building (Week 1-2)

**Objectives:**
- Build core new agents with comprehensive testing
- Establish performance benchmarks
- Create feature flag infrastructure

**Deliverables:**
```javascript
// Feature flag configuration
export const features = {
  useNewAgentArchitecture: process.env.USE_NEW_AGENTS === 'true',
  newArchitectureSourceIds: process.env.NEW_ARCH_SOURCE_IDS?.split(',') || [],
  fallbackToOldSystem: true,
  trafficPercentage: parseInt(process.env.NEW_SYSTEM_TRAFFIC) || 0
};

// Core agents built and tested
agents-v2/core/sourceOrchestrator.js     ✅
agents-v2/core/apiCollector.js           ✅
agents-v2/filtering/relevanceFilter.js   ✅
agents-v2/filtering/scoringAgent.js      ✅

// Comprehensive test suites
tests/agents-v2/unit/                    ✅
tests/agents-v2/integration/             ✅
```

**Success Criteria:**
- All new agents pass unit tests
- Integration tests with mock data successful
- Performance benchmarks established
- Zero impact on production system

### Phase 2: Parallel Processing (Week 3)

**Objectives:**
- Deploy new system alongside old system
- Route minimal traffic to new system
- Implement comparison and validation logic

**Implementation:**
```javascript
// Routing service determines which system to use
export async function routeProcessingRequest(sourceId) {
  // Start with specific sources for testing
  if (features.newArchitectureSourceIds.includes(sourceId)) {
    return 'v2';
  }
  
  // Gradually increase traffic percentage
  if (Math.random() * 100 < features.trafficPercentage) {
    return 'v2';
  }
  
  return 'v1';
}

// Comparison service validates outputs
export async function compareSystemOutputs(sourceId, v1Result, v2Result) {
  return {
    opportunityCountMatch: v1Result.opportunities.length === v2Result.opportunities.length,
    accuracyScore: calculateAccuracyScore(v1Result, v2Result),
    performanceImprovement: v1Result.processingTime - v2Result.processingTime,
    recommendations: generateRecommendations(v1Result, v2Result)
  };
}
```

**Success Criteria:**
- New system processes 5-10% of sources successfully
- Output comparison shows acceptable accuracy
- Performance improvements are measurable
- No production issues or downtime

### Phase 3: Scaling Validation (Week 4-5)

**Objectives:**
- Increase traffic to new system
- Validate performance under load
- Refine and optimize based on real data

**Traffic Scaling Plan:**
- Week 4: 10% → 25% traffic
- Week 5: 25% → 50% traffic

**Monitoring:**
```javascript
// Performance monitoring
export class MigrationMonitor {
  static async trackSystemComparison(sourceId, oldTime, newTime, oldCount, newCount) {
    await supabase.from('migration_metrics').insert({
      source_id: sourceId,
      old_system_time: oldTime,
      new_system_time: newTime,
      old_opportunity_count: oldCount,
      new_opportunity_count: newCount,
      performance_improvement: ((oldTime - newTime) / oldTime) * 100,
      accuracy_match: Math.abs(oldCount - newCount) <= 2, // Allow small variance
      timestamp: new Date().toISOString()
    });
  }
}
```

**Success Criteria:**
- 50% traffic handled successfully by new system
- Performance improvements sustained under load
- Error rates remain within acceptable bounds
- Stakeholder confidence maintained

### Phase 4: Majority Migration (Week 6)

**Objectives:**
- Route majority of traffic to new system
- Maintain old system as fallback only
- Prepare for final cutover

**Configuration:**
```javascript
// Increase confidence in new system
export const features = {
  useNewAgentArchitecture: true,
  trafficPercentage: 90, // 90% to new system
  fallbackToOldSystem: true,
  emergencyFallback: true // Quick switch if issues arise
};
```

**Success Criteria:**
- 90% traffic processed by new system
- Old system serves only as emergency fallback
- All performance targets met
- Business stakeholders approve final cutover

### Phase 5: Complete Migration (Week 7)

**Objectives:**
- Full cutover to new system
- Deprecate old system
- Archive legacy code

**Final Steps:**
1. Update all feature flags to use new system
2. Monitor closely for 48 hours
3. Document migration completion
4. Archive old system code
5. Update documentation

## Complete System Flow

### High-Level Architecture

```
Source Manager → API Collector → Filtering Pipeline → Data Processor
                                      ↓
                        [Relevance Filter → Eligibility Filter → Scoring Agent]
```

### Detailed Flow with Data Transformations

#### **Stage 1: Source Manager** 
**Purpose**: Orchestrate processing and determine API configuration

**Input**: Source from database queue
```javascript
{
  id: "source-123",
  name: "State Energy Office Grants",
  type: "government",
  api_endpoint: "https://api.energy.state.gov/grants",
  configurations: { /* various config objects */ }
}
```

**Output**: Processing instructions
```javascript
{
  apiEndpoint: "https://api.energy.state.gov/grants/search",
  requestConfig: { method: "POST" },
  queryParameters: { limit: 100, status: "active" },
  requestBody: { keywords: "energy, solar, HVAC", applicant_types: ["K-12", "municipal"] },
  paginationConfig: { enabled: true, type: "offset", pageSize: 100 },
  authMethod: "apikey",
  authDetails: { keyHeader: "X-API-Key", apiKey: "..." }
}
```

---

#### **Stage 2: API Collector**
**Purpose**: Fetch raw data and standardize format

**Input**: Source + Processing instructions (from Stage 1)

**Process**: 
1. Makes API calls (handles auth, pagination, rate limiting)
2. For two-step APIs: Gets IDs first, then fetches details for each ID
3. Standardizes data format (maps different API field names)
4. **NO FILTERING** - just clean data preparation

**Output**: Standardized opportunities (raw, unfiltered)
```javascript
[
  {
    id: "grant-123",
    title: "Energy Efficiency Grants for Schools",
    description: "Funding for K-12 schools to upgrade HVAC systems and lighting...",
    totalFunding: 5000000,
    minAward: 25000,
    maxAward: 500000,
    openDate: "2024-01-15",
    closeDate: "2024-12-31",
    eligibleApplicants: ["K-12 Schools", "Municipal Government", "State Agencies"],
    eligibleProjectTypes: ["HVAC", "Solar", "Lighting", "Building Envelope"],
    fundingType: "grant",
    url: "https://energy.state.gov/grants/efficiency-schools",
    matchingRequired: true,
    matchingPercentage: 25,
    status: "open",
    sourceFields: { /* original API field names and values */ }
  },
  {
    id: "grant-456",
    title: "Clean Water Infrastructure Fund",
    description: "Municipal water system improvements and conservation...",
    totalFunding: 2000000,
    eligibleApplicants: ["Municipal Government", "Water Districts"],
    eligibleProjectTypes: ["Water Conservation", "Infrastructure"],
    // ... more fields
  }
  // ... more opportunities
]
```

---

#### **Stage 3: Filtering Pipeline**
**Purpose**: Evaluate opportunities through focused AI filters

##### **3A. Relevance Filter**
**Input**: Raw opportunities from API Collector

**Prompt Focus**: "Is this energy-related for our business?"
```javascript
// Simple, focused prompt - reduces hallucination
const prompt = `
Assess this opportunity's relevance to energy services business:
Title: ${opportunity.title}
Description: ${opportunity.description?.substring(0, 500)}
Project Types: ${opportunity.eligibleProjectTypes?.join(', ')}

Rate as: HIGH, MEDIUM, or LOW relevance.
`;
```

**Output**: Opportunities + relevance scores
```javascript
[
  {
    ...opportunity, // all original data preserved
    relevanceScore: "high",
    relevanceReasoning: "Direct energy efficiency focus for schools - perfect fit"
  },
  {
    ...opportunity,
    relevanceScore: "low", 
    relevanceReasoning: "Water infrastructure - not energy-related"
  }
]
```

##### **3B. Eligibility Filter** 
**Input**: Opportunities + relevance scores

**Prompt Focus**: "Can our typical clients apply?"
```javascript
const prompt = `
Can our typical clients apply for this funding?
Our clients: K-12 schools, municipal/county government, state facilities
Eligible applicants: ${opportunity.eligibleApplicants?.join(', ')}

Answer: YES or NO with brief reason.
`;
```

**Output**: Opportunities + relevance + eligibility scores
```javascript
[
  {
    ...opportunity,
    relevanceScore: "high",
    relevanceReasoning: "Direct energy efficiency focus for schools - perfect fit",
    clientMatch: "excellent",
    clientReasoning: "K-12 schools explicitly listed as eligible"
  },
  {
    ...opportunity,
    relevanceScore: "low",
    relevanceReasoning: "Water infrastructure - not energy-related", 
    clientMatch: "good",
    clientReasoning: "Municipal government eligible but wrong focus area"
  }
]
```

##### **3C. Scoring Agent**
**Input**: Opportunities + relevance + eligibility scores

**Prompt Focus**: "Should we recommend this? What's the summary?"
```javascript
const prompt = `
Generate final score and actionable summary:
Title: ${opportunity.title}
Funding: $${opportunity.totalFunding || 'Unknown'}
Deadline: ${opportunity.closeDate || 'Unknown'}
Relevance: ${relevanceScore}
Client Match: ${eligibilityScore}

RED FLAGS TO CHECK:
- Unusual requirements or restrictions
- Suspicious funding amounts or terms  
- Non-government sources claiming to be official

Provide:
1. RECOMMENDED (true/false)
2. Brief summary for sales team
3. Any concerns or red flags noted
`;
```

**Output**: Final scored opportunities
```javascript
[
  {
    ...opportunity,
    relevanceScore: "high",
    clientMatch: "excellent", 
    recommended: true,
    finalScore: 9,
    actionableSummary: "State Energy Office offers $5M in grants for K-12 schools to upgrade HVAC and lighting. $25K-500K awards, 25% match required. Due Dec 31, 2024.",
    salesNotes: "Perfect fit - contact school districts immediately",
    concerns: []
  },
  {
    ...opportunity,
    relevanceScore: "low",
    clientMatch: "good",
    recommended: false,
    finalScore: 3,
    actionableSummary: "Water infrastructure fund - not energy focused",
    salesNotes: "Skip - outside our service area",
    concerns: []
  }
]
```

---

#### **Stage 4: Data Processor**
**Purpose**: Store filtered opportunities in database

**Input**: Final scored opportunities (only recommended ones)

**Process**:
1. Check for duplicates against existing opportunities
2. Update existing opportunities when appropriate  
3. Insert new opportunities into database
4. Handle related entities (eligibility, funding categories, etc.)

**Output**: Database records + processing metrics
```javascript
{
  metrics: {
    processed: 25,
    new: 12,
    updated: 3, 
    duplicates: 10,
    ignored: 0
  },
  newOpportunities: [
    {
      id: "db-789",
      external_id: "grant-123", 
      title: "Energy Efficiency Grants for Schools",
      // ... all standardized fields stored
      created_at: "2024-01-10T10:30:00Z"
    }
  ]
}
```

### Key Differences from Current System

**Current System Problems:**
```
API Handler → Big AI Filter (long prompt) → Detail Processor → Another Big AI Filter
                     ↑                                              ↑
              Prone to hallucination                    Redundant filtering
```

**New System Benefits:**
```
API Collector → Small AI Filter 1 → Small AI Filter 2 → Small AI Filter 3
                      ↓                    ↓                    ↓
               Focused prompts      Single responsibility   Clear pipeline
```

**Advantages:**
- **Focused Prompts**: Each agent has a specific, simple task (reduces hallucination)
- **Single Responsibility**: Each filter does one thing well
- **Clear Data Flow**: Easy to debug and modify individual stages
- **No Redundancy**: No duplicate filtering steps
- **Better Performance**: Smaller prompts = faster processing + lower token usage

### Error Handling in Pipeline

**Graceful Degradation**: If any filtering agent fails, the pipeline continues with default scores:

```javascript
// Fallback scoring when AI agents fail
const fallbackScoring = {
  relevanceScore: "medium",  // Conservative default
  clientMatch: "unknown", 
  recommended: false,        // Err on side of caution
  finalScore: 5,            // Neutral score for manual review
  actionableSummary: "Requires manual review - auto-scoring failed",
  requiresReview: true      // Flag for human attention
};
```

**Retry Logic**: Failed opportunities are queued for retry with exponential backoff:

```javascript
// Retry configuration
const retryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000         // 30 seconds max
};
```

This complete flow ensures that data moves smoothly through the system while maintaining quality and providing clear debugging points at each stage.

## Specific Refactoring Recommendations

### A) Eliminating Detail Processor Agent

**Current Flow:**
```
API Handler → First Stage Filter → Detail Processor → Final Filter → Database
```

**New Flow:**
```
API Collector → Immediate Detail Fetching → Scoring Agent → Database
```

**Implementation:**
```javascript
// agents-v2/core/apiCollector.js
export class ApiCollector {
  async processTwoStepApi(source, config) {
    // Step 1: Get IDs from list endpoint
    const listResponse = await this.callListApi(config.listEndpoint);
    const opportunityIds = this.extractIds(listResponse, config.idPath);
    
    // Step 2: Fetch details immediately (no intermediate filtering)
    const detailedOpportunities = [];
    for (const id of opportunityIds) {
      try {
        const detail = await this.callDetailApi(config.detailEndpoint, id);
        detailedOpportunities.push(detail);
      } catch (error) {
        console.warn(`Failed to fetch detail for ID ${id}:`, error.message);
        // Continue with other IDs rather than failing entire batch
      }
    }
    
    return detailedOpportunities;
  }
}
```

### B) Breaking Down AI Filtering

**Problem:** Long prompts causing hallucination and inefficiency

**Solution:** Specialized micro-agents with focused responsibilities

```javascript
// agents-v2/filtering/relevanceFilter.js
export class RelevanceFilter {
  async assessRelevance(opportunity) {
    const prompt = `
Assess this opportunity's relevance to energy services business:
Title: ${opportunity.title}
Description: ${opportunity.description?.substring(0, 500)}
Project Types: ${opportunity.eligibleProjectTypes?.join(', ')}

Rate as: HIGH, MEDIUM, or LOW relevance.
`;
    
    // Simple, focused prompt - less prone to hallucination
    const response = await this.callAnthropic(prompt, { maxTokens: 100 });
    return this.parseRelevanceScore(response);
  }
}

// agents-v2/filtering/eligibilityFilter.js
export class EligibilityFilter {
  async checkClientEligibility(opportunity) {
    const prompt = `
Can our typical clients apply for this funding?
Our clients: K-12 schools, municipal/county government, state facilities
Eligible applicants: ${opportunity.eligibleApplicants?.join(', ')}

Answer: YES or NO with brief reason.
`;
    
    const response = await this.callAnthropic(prompt, { maxTokens: 50 });
    return this.parseEligibility(response);
  }
}

// agents-v2/filtering/scoringAgent.js
export class ScoringAgent {
  async generateFinalScore(opportunity, relevanceScore, eligibilityScore) {
    const prompt = `
Generate final score and actionable summary:
Title: ${opportunity.title}
Funding: $${opportunity.totalFunding || 'Unknown'}
Deadline: ${opportunity.closeDate || 'Unknown'}
Relevance: ${relevanceScore}
Client Match: ${eligibilityScore}

RED FLAGS TO CHECK:
- Unusual requirements or restrictions
- Suspicious funding amounts or terms  
- Non-government sources claiming to be official

Provide:
1. RECOMMENDED (true/false)
2. Brief summary for sales team
3. Any concerns or red flags noted
`;
    
    const response = await this.callAnthropic(prompt, { maxTokens: 200 });
    return this.parseFinalScore(response);
  }
}
```

### C) Direct Anthropic SDK Implementation

**Benefits:**
- 60-80% faster execution
- 70% reduced memory usage
- 15-25% token savings
- Better error handling
- Access to latest features

**Implementation:**
```javascript
// agents-v2/utils/anthropicClient.js
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicClient {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async callWithSchema(prompt, schema, options = {}) {
    const message = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: options.maxTokens || 2000,
      tools: [{
        name: "structured_response",
        description: "Provide structured response",
        input_schema: schema
      }],
      messages: [{ role: "user", content: prompt }]
    });

    const result = message.content.find(c => c.type === 'tool_use')?.input;
    
    if (!result) {
      throw new Error('No structured response received');
    }

    return {
      data: result,
      usage: message.usage,
      performance: {
        inputTokens: message.usage?.input_tokens || 0,
        outputTokens: message.usage?.output_tokens || 0
      }
    };
  }
}
```

## Risk Mitigation

### Feature Flags for Safe Deployment

```javascript
// config/features.js
export const features = {
  // Main feature flag
  useNewAgentArchitecture: process.env.USE_NEW_AGENTS === 'true',
  
  // Granular control
  newArchitectureSourceIds: process.env.NEW_ARCH_SOURCE_IDS?.split(',') || [],
  
  // Gradual rollout
  trafficPercentage: parseInt(process.env.NEW_SYSTEM_TRAFFIC) || 0,
  
  // Safety nets
  fallbackToOldSystem: process.env.ENABLE_FALLBACK !== 'false',
  emergencyDisable: process.env.EMERGENCY_DISABLE === 'true',
  
  // Component-level flags
  useNewSourceManager: process.env.USE_NEW_SOURCE_MANAGER === 'true',
  useNewApiCollector: process.env.USE_NEW_API_COLLECTOR === 'true',
  useNewScoring: process.env.USE_NEW_SCORING === 'true',
  
  // Monitoring
  enableComparison: process.env.ENABLE_COMPARISON === 'true',
  logPerformanceMetrics: process.env.LOG_PERFORMANCE === 'true'
};
```

### A/B Testing Infrastructure

```javascript
// services/routingService.js
export class RoutingService {
  static async routeProcessingRequest(sourceId) {
    // Emergency disable - immediate fallback
    if (features.emergencyDisable) {
      return 'v1';
    }
    
    // Specific sources for testing
    if (features.newArchitectureSourceIds.includes(sourceId)) {
      return 'v2';
    }
    
    // Gradual traffic percentage
    const random = Math.random() * 100;
    if (random < features.trafficPercentage) {
      return 'v2';
    }
    
    return 'v1';
  }
  
  static async processWithFallback(sourceId, processor) {
    const version = await this.routeProcessingRequest(sourceId);
    
    try {
      if (version === 'v2') {
        const result = await processor.processV2(sourceId);
        
        // Validate result quality
        if (this.validateResult(result)) {
          return result;
        } else {
          console.warn(`V2 result quality poor for ${sourceId}, falling back to V1`);
          return await processor.processV1(sourceId);
        }
      } else {
        return await processor.processV1(sourceId);
      }
    } catch (error) {
      console.error(`Error in ${version} processing:`, error);
      
      // Automatic fallback on error
      if (version === 'v2' && features.fallbackToOldSystem) {
        console.log(`Falling back to V1 for ${sourceId}`);
        return await processor.processV1(sourceId);
      }
      
      throw error;
    }
  }
}
```

### Performance Monitoring

```javascript
// services/migrationService.js
export class MigrationService {
  static async trackMigrationMetrics(sourceId, v1Result, v2Result) {
    const metrics = {
      source_id: sourceId,
      v1_processing_time: v1Result?.processingTime || null,
      v2_processing_time: v2Result?.processingTime || null,
      v1_opportunity_count: v1Result?.opportunities?.length || 0,
      v2_opportunity_count: v2Result?.opportunities?.length || 0,
      performance_improvement: this.calculateImprovement(v1Result, v2Result),
      accuracy_score: this.calculateAccuracy(v1Result, v2Result),
      memory_usage_v1: v1Result?.memoryUsage || null,
      memory_usage_v2: v2Result?.memoryUsage || null,
      timestamp: new Date().toISOString()
    };
    
    await supabase.from('migration_metrics').insert(metrics);
    
    // Alert if performance degrades
    if (metrics.performance_improvement < -10) {
      await this.alertPerformanceDegradation(sourceId, metrics);
    }
  }
  
  static async generateMigrationReport() {
    const { data: metrics } = await supabase
      .from('migration_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    return {
      totalSources: new Set(metrics.map(m => m.source_id)).size,
      averagePerformanceImprovement: metrics.reduce((sum, m) => sum + m.performance_improvement, 0) / metrics.length,
      averageAccuracyScore: metrics.reduce((sum, m) => sum + m.accuracy_score, 0) / metrics.length,
      successRate: metrics.filter(m => m.v2_processing_time > 0).length / metrics.length,
      recommendations: this.generateRecommendations(metrics)
    };
  }
}
```

## Implementation Timeline

### Week 1-2: Foundation Phase
- [ ] Create `agents-v2/` folder structure
- [ ] **Core Agent Development:**
  - [ ] Build `sourceOrchestrator.js` (replaces sourceManagerAgent)
  - [ ] Build `apiCollector.js` (replaces apiHandlerAgent)
  - [ ] Build `relevanceFilter.js` (new micro-agent)
  - [ ] Build `eligibilityFilter.js` (new micro-agent)
  - [ ] Build `scoringAgent.js` (replaces detail processor)
  - [ ] Build `dataProcessor.js` (enhanced version)
- [ ] **Infrastructure Development:**
  - [ ] Build `processCoordinatorV2.js` ⭐ **CRITICAL - Main orchestrator**
  - [ ] Build `RunManagerV2.js` ⭐ **CRITICAL - Updated for new stage tracking**
  - [ ] Build `anthropicClient.js` (direct SDK implementation)
  - [ ] Create `features.js` configuration (feature flags)
  - [ ] Build `routingService.js` (traffic routing between v1/v2)
- [ ] **Testing Infrastructure:**
  - [ ] Unit tests for all new agents
  - [ ] Integration tests with mock data
  - [ ] Performance benchmarking tools
  - [ ] Migration comparison utilities
- [ ] **Database Updates:**
  - [ ] Create `api_source_runs_v2` table for new run tracking
  - [ ] Add new stage columns for v2 pipeline
  - [ ] Migration scripts for data structure changes

**Success Criteria:**
- All new agents pass unit tests
- ProcessCoordinatorV2 successfully orchestrates full pipeline with mock data
- RunManagerV2 tracks all new pipeline stages correctly
- Integration tests with mock data successful
- Performance benchmarks established (should show 60-80% improvement)
- Zero impact on production system

### Week 3: Integration Phase
- [ ] **Deployment Infrastructure:**
  - [ ] Deploy new system alongside old system (feature flags disabled)
  - [ ] Implement `migrationService.js` for comparison tracking
  - [ ] Set up monitoring for both systems
  - [ ] Configure environment variables for gradual rollout
- [ ] **Initial Testing:**
  - [ ] Enable ProcessCoordinatorV2 for specific test sources (feature flag)
  - [ ] Start with 5% traffic to new system
  - [ ] Implement comparison logging between v1 and v2 results
  - [ ] Monitor and compare outputs
- [ ] **Issue Resolution:**
  - [ ] Fix any critical issues discovered
  - [ ] Tune performance based on real API responses
  - [ ] Adjust prompts based on initial results
  - [ ] Validate database storage is working correctly

**Configuration Example:**
```bash
# Week 3 environment settings
USE_NEW_AGENTS=false                           # Safety off by default
NEW_ARCH_SOURCE_IDS=source-123,source-456     # Specific test sources only
NEW_SYSTEM_TRAFFIC=0                           # No random traffic yet
ENABLE_COMPARISON=true                         # Compare both systems
LOG_PERFORMANCE=true                           # Track metrics
ENABLE_FALLBACK=true                           # Auto-fallback on errors
```

**Success Criteria:**
- New system processes 5-10% of sources successfully
- Output comparison shows acceptable accuracy (90%+ match)
- Performance improvements are measurable and documented
- No production issues or downtime
- Fallback mechanisms work correctly

### Week 4: Validation Phase
- [ ] **Traffic Scaling:**
  - [ ] Increase to 25% traffic to new system
  - [ ] Add more test sources to specific source list
  - [ ] Enable random traffic routing for broader testing
- [ ] **Performance Analysis:**
  - [ ] Comprehensive performance analysis and comparison
  - [ ] Token usage optimization and cost analysis
  - [ ] Memory usage and response time validation
- [ ] **Stakeholder Review:**
  - [ ] Present results to business stakeholders
  - [ ] Demo new system capabilities and improvements
  - [ ] Get approval for further scaling
- [ ] **System Optimization:**
  - [ ] Optimize based on real-world data patterns
  - [ ] Fine-tune prompts for better accuracy
  - [ ] Adjust error handling based on discovered edge cases
  - [ ] Document lessons learned and best practices

**Configuration Update:**
```bash
# Week 4 environment settings
NEW_SYSTEM_TRAFFIC=25                          # 25% random traffic
NEW_ARCH_SOURCE_IDS=source-123,source-456,source-789  # More test sources
```

**Success Criteria:**
- 25% traffic handled successfully by new system
- Performance improvements sustained under load (60-80% faster)
- Error rates remain within acceptable bounds (< 5%)
- Stakeholder confidence maintained and approval gained
- Cost analysis shows expected savings (15-25% token reduction)

### Week 5: Scaling Phase
- [ ] **Major Traffic Increase:**
  - [ ] Increase to 50% traffic to new system
  - [ ] Monitor system under higher load
  - [ ] Validate database performance with increased writes
- [ ] **Load Testing:**
  - [ ] Test with peak traffic scenarios
  - [ ] Validate concurrent processing capabilities
  - [ ] Stress test error handling and recovery
- [ ] **System Refinement:**
  - [ ] Refine error handling based on production patterns
  - [ ] Performance tuning for high-volume scenarios
  - [ ] Optimize database queries and indexes
- [ ] **Business Stakeholder Approval:**
  - [ ] Final business review and sign-off
  - [ ] Approval for majority migration
  - [ ] Risk assessment and mitigation planning

**Configuration Update:**
```bash
# Week 5 environment settings
NEW_SYSTEM_TRAFFIC=50                          # 50% random traffic
```

**Success Criteria:**
- 50% traffic processed successfully by new system
- Performance remains optimal under higher load
- Database scaling handles increased volume
- Business stakeholders approve majority migration
- Emergency procedures tested and documented

### Week 6: Majority Phase
- [ ] **Near-Complete Migration:**
  - [ ] Increase to 90% traffic to new system
  - [ ] Old system serves only as emergency fallback
  - [ ] Monitor system stability under majority load
- [ ] **Final Validation:**
  - [ ] Final performance validation and optimization
  - [ ] Complete accuracy testing with production data
  - [ ] End-to-end system validation
- [ ] **Cutover Preparation:**
  - [ ] Prepare for complete cutover
  - [ ] Final documentation updates
  - [ ] Communication to all stakeholders
  - [ ] Rollback procedures finalized and tested

**Configuration Update:**
```bash
# Week 6 environment settings
NEW_SYSTEM_TRAFFIC=90                          # 90% traffic to new system
EMERGENCY_DISABLE=false                        # Ready for full cutover
```

**Success Criteria:**
- 90% traffic processed by new system successfully
- Old system serves only as emergency fallback
- All performance targets met consistently
- Business stakeholders approve final cutover
- Documentation complete and current

### Week 7: Migration Phase
- [ ] **Complete Cutover:**
  - [ ] Update all feature flags to use new system
  - [ ] Set `USE_NEW_AGENTS=true` globally
  - [ ] Monitor closely for 48 hours
  - [ ] Validate all functionality working correctly
- [ ] **System Cleanup:**
  - [ ] Document migration completion
  - [ ] Archive old system code safely
  - [ ] Update all documentation and README files
  - [ ] Update monitoring and alerting systems
- [ ] **Team Training:**
  - [ ] Train team on new system operations
  - [ ] Update troubleshooting procedures
  - [ ] Knowledge transfer sessions
- [ ] **Celebration:**
  - [ ] Celebrate successful migration! 🎉
  - [ ] Document success metrics and improvements achieved

**Final Configuration:**
```bash
# Week 7 environment settings
USE_NEW_AGENTS=true                            # Full cutover complete
NEW_SYSTEM_TRAFFIC=100                         # All traffic to new system
ENABLE_COMPARISON=false                        # No longer needed
ENABLE_FALLBACK=false                          # Optional - can disable
```

**Success Criteria:**
- Complete cutover successful with zero downtime
- All functionality verified and working
- Team trained on new system
- Performance improvements documented and achieved
- Old system safely archived

### Week 8: Cleanup Phase
- [ ] **Optional Optimizations:**
  - [ ] Remove feature flags (optional - can keep for future use)
  - [ ] Clean up temporary comparison code
  - [ ] Optimize database schema if needed
  - [ ] Remove old system references
- [ ] **Final Documentation:**
  - [ ] Complete final documentation review
  - [ ] Update architecture diagrams
  - [ ] Document lessons learned
  - [ ] Create maintenance procedures
- [ ] **Team Activities:**
  - [ ] Team retrospective meeting
  - [ ] Plan next iteration or improvements
  - [ ] Knowledge sharing sessions
  - [ ] Performance review and celebration

**Post-Migration Metrics to Track:**
- Processing time improvements (target: 60-80% faster)
- Token usage reduction (target: 15-25% savings)  
- Memory usage reduction (target: 70% less)
- Accuracy maintenance (target: 90%+ consistency)
- Error rate reduction
- Cost savings achieved

### Critical Dependencies and Blockers

**Week 1-2 Blockers:**
- **ProcessCoordinatorV2** must be completed before any integration testing
- **RunManagerV2** must be completed before pipeline testing
- Database schema updates must be deployed before new system testing

**Week 3+ Blockers:**
- Feature flag infrastructure must be working before any production deployment
- Monitoring and comparison systems must be operational before traffic routing
- Fallback mechanisms must be tested before increasing traffic percentages

### Rollback Plan

**At Any Stage:**
```bash
# Emergency rollback procedure
export EMERGENCY_DISABLE=true           # Immediate fallback to v1
export USE_NEW_AGENTS=false            # Disable new system  
export NEW_SYSTEM_TRAFFIC=0            # Stop all traffic to v2
```

**Recovery Steps:**
1. Execute rollback environment variables
2. Verify all traffic routing to old system  
3. Monitor system stability
4. Investigate and fix issues in v2 system
5. Plan re-migration strategy

This timeline ensures that all critical components (ProcessCoordinatorV2 and RunManagerV2) are built in the foundation phase, and provides a safe, gradual migration path with multiple validation points and easy rollback capabilities.

## Quality Assurance

### Unit Testing Strategy

```javascript
// tests/agents-v2/unit/apiCollector.test.js
describe('ApiCollector', () => {
  let apiCollector;
  
  beforeEach(() => {
    apiCollector = new ApiCollector();
  });
  
  test('should handle two-step API flow', async () => {
    const mockConfig = {
      listEndpoint: 'https://api.example.com/list',
      detailEndpoint: 'https://api.example.com/detail/{id}',
      idPath: 'data.id'
    };
    
    // Mock API responses
    fetchMock.mockResponses(
      JSON.stringify({ data: [{ id: '1' }, { id: '2' }] }),
      JSON.stringify({ id: '1', title: 'Opportunity 1' }),
      JSON.stringify({ id: '2', title: 'Opportunity 2' })
    );
    
    const result = await apiCollector.processTwoStepApi(mockSource, mockConfig);
    
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Opportunity 1');
  });
});
```

### Integration Testing Strategy

```javascript
// tests/agents-v2/integration/fullPipeline.test.js
describe('Full Pipeline Integration', () => {
  test('should process source end-to-end', async () => {
    const sourceId = 'test-source-1';
    
    // Use real API endpoints in test environment
    const result = await processCoordinatorV2.processApiSource(sourceId);
    
    expect(result.status).toBe('success');
    expect(result.opportunities).toBeDefined();
    expect(result.metrics.processingTime).toBeLessThan(30000); // 30 second max
  });
});
```

### Performance Testing

```javascript
// tests/agents-v2/performance/benchmark.test.js
describe('Performance Benchmarks', () => {
  test('new system should be faster than old system', async () => {
    const sourceId = 'benchmark-source';
    
    const v1Start = Date.now();
    const v1Result = await processCoordinatorV1.processApiSource(sourceId);
    const v1Time = Date.now() - v1Start;
    
    const v2Start = Date.now();
    const v2Result = await processCoordinatorV2.processApiSource(sourceId);
    const v2Time = Date.now() - v2Start;
    
    expect(v2Time).toBeLessThan(v1Time * 0.8); // At least 20% faster
    expect(v2Result.opportunities.length).toBeGreaterThanOrEqual(v1Result.opportunities.length * 0.9); // At least 90% accuracy
  });
});
```

---

## Conclusion

This refactoring approach prioritizes **safety, validation, and business continuity** while achieving significant architectural improvements. The Strangler Fig pattern allows us to:

- **Minimize risk** through gradual migration
- **Validate improvements** with real data
- **Maintain business operations** throughout the transition
- **Rollback quickly** if issues arise
- **Learn and adapt** based on production feedback

The key to success is **patience and thorough validation** at each phase. By following this methodology, we ensure that the new system not only performs better but also maintains the reliability and accuracy that the business depends on.

Remember: **"Make it work, make it right, make it fast"** - but in a production environment, we must also **"make it safe"**. 
# Agent Architecture V2 - Performance Optimized

This directory contains the optimized v2 agent architecture that replaces LangChain + Zod with direct Anthropic SDK integration for significant performance improvements.

## 🎯 Performance Goals

- **60-80% faster execution** vs LangChain + Zod
- **70% reduced memory usage**
- **15-25% token savings**
- **Better error handling** with built-in retries
- **Access to latest Anthropic features**

## 🏗️ Architecture Overview

```
agents-v2/
├── utils/
│   └── anthropicClient.js     # ✅ COMPLETED - Core optimized client
├── core/                      # 🔨 TODO - Main processing agents
│   ├── sourceOrchestrator.js  
│   ├── apiCollector.js
│   └── dataProcessor.js
├── filtering/                 # 🔨 TODO - Focused micro-agents
│   ├── relevanceFilter.js
│   ├── eligibilityFilter.js
│   └── scoringAgent.js
├── tests/                     # ✅ COMPLETED - Test infrastructure  
│   └── anthropicClient.test.js
└── README.md                  # ✅ COMPLETED - This file
```

## ✅ What's Been Built

### 1. AnthropicClient (`utils/anthropicClient.js`)

**Core optimized client** that replaces LangChain + Zod:

```javascript
import { getAnthropicClient, schemas } from '../utils/anthropicClient.js';

const client = getAnthropicClient();

// Structured response with native JSON Schema (no Zod conversion)
const result = await client.callWithSchema(prompt, schemas.opportunityExtraction);

// Performance data built-in
console.log(`Duration: ${result.performance.duration}ms`);
console.log(`Tokens: ${result.performance.totalTokens}`);
```

**Key Features:**
- **Direct Anthropic SDK** integration (no LangChain overhead)
- **Native JSON Schema** support (no Zod conversion)
- **Built-in performance tracking** and metrics
- **Automatic retry logic** with exponential backoff
- **Batch processing** with concurrency controls
- **Error handling** with proper fallbacks

### 2. Pre-built Schemas (`schemas` export)

Ready-to-use native JSON schemas for common tasks:

```javascript
import { schemas } from '../utils/anthropicClient.js';

// Extract opportunities from API responses
schemas.opportunityExtraction

// Score opportunities for relevance  
schemas.opportunityScoring

// Analyze API sources for configuration
schemas.sourceAnalysis
```

### 3. Performance Testing (`tests/anthropicClient.test.js`)

Comprehensive test suite that validates:
- ✅ Basic functionality works correctly
- ✅ Performance improvements vs LangChain + Zod  
- ✅ Schema validation and error handling
- ✅ Batch processing capabilities
- ✅ Individual schema validation

### 4. Test Infrastructure

Multiple ways to validate the AnthropicClient:

```bash
# Standalone script
node scripts/test-anthropic-client.js

# Debug API endpoint  
GET /api/debug/anthropic-client?test=quick
GET /api/debug/anthropic-client?test=full
GET /api/debug/anthropic-client?test=schemas
```

## 🚀 How to Test

### Quick Test
```bash
node scripts/test-anthropic-client.js
```

### Via Debug API Route
```bash
curl http://localhost:3000/api/debug/anthropic-client?test=quick
```

### In Browser
Navigate to: `http://localhost:3000/api/debug/anthropic-client?test=quick`

## 📊 Expected Performance Results

Based on the optimizations, you should see:

**Time Improvements:**
- 60-80% faster execution vs LangChain + Zod
- Reduced overhead from eliminating multiple parsing steps
- Direct tool calling vs text parsing + validation

**Memory Improvements:**
- 70% less memory usage
- No intermediate Zod object creation
- Streamlined data flow

**Token Savings:**
- 15-25% fewer tokens required
- No format instruction overhead
- More efficient prompting

## 🔨 Next Steps (TODO)

Now that the AnthropicClient foundation is complete, the next priority components are:

### Critical Infrastructure (Phase 1A)
1. **ProcessCoordinatorV2** - Main orchestrator for v2 pipeline
2. **RunManagerV2** - Updated run tracking for new pipeline stages
3. **Feature Flags** - Traffic routing between v1/v2 systems

### Core Agents (Phase 1B)
4. **SourceOrchestrator** - Replaces sourceManagerAgent
5. **ApiCollector** - Replaces apiHandlerAgent + detailProcessorAgent
6. **ScoringAgent** - Three focused micro-agents for filtering

All of these will use the AnthropicClient for consistent performance and error handling.

## 💡 Usage Examples

### Basic Structured Call
```javascript
import { getAnthropicClient, schemas } from './utils/anthropicClient.js';

const client = getAnthropicClient();

const result = await client.callWithSchema(
  'Extract opportunities from this API response: {...}',
  schemas.opportunityExtraction,
  { maxTokens: 2000 }
);

console.log(`Found ${result.data.opportunities.length} opportunities`);
console.log(`Processed in ${result.performance.duration}ms`);
```

### Performance Monitoring
```javascript
const client = getAnthropicClient();

// After several calls...
const metrics = client.getPerformanceMetrics();
console.log(`Average time: ${metrics.averageTime}ms`);
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Total tokens: ${metrics.totalTokens}`);
```

### Batch Processing
```javascript
const prompts = [
  { prompt: 'Analyze source 1...', schema: schemas.sourceAnalysis },
  { prompt: 'Extract from API 2...', schema: schemas.opportunityExtraction },
  { prompt: 'Score opportunities...', schema: schemas.opportunityScoring }
];

const results = await client.batchProcess(prompts, { 
  concurrency: 3,
  delayBetweenBatches: 500 
});
```

## 🛠️ Development Notes

### Environment Variables Required
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Dependencies
- `@anthropic-ai/sdk` - Direct SDK (already in package.json)
- `@langchain/anthropic` - Only needed for performance comparison tests
- `zod` - Only needed for performance comparison tests

### Error Handling
The client includes robust error handling:
- Automatic retries with exponential backoff
- Proper error categorization (don't retry 401/403)
- Performance tracking even for failed calls
- Detailed error messages for debugging

### Performance Monitoring
Built-in metrics tracking:
- Total calls and tokens used
- Average response times
- Success/error rates
- Token efficiency measurements

## 🎉 Success Criteria

The AnthropicClient is ready when:
- ✅ Quick test passes (basic functionality)
- ✅ Schema tests work (extraction, scoring, analysis)
- ✅ Performance improvements are measurable
- ✅ Error handling works correctly
- ✅ Batch processing completes successfully

**Status: ✅ COMPLETE** - AnthropicClient foundation is ready for building v2 agents! 
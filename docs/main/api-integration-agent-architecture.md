# API Integration Agent Architecture for Funding Intelligence System

## 1. System Overview

This document outlines the architecture for an AI agent-based system to retrieve, process, and store funding opportunity data from various API sources. The system uses a multi-agent approach to handle different aspects of the data collection pipeline, with LLMs serving as the core intelligence for adapting to different API structures.

### 1.1 System Goals

- Automate the collection of funding opportunity data from diverse API sources
- Adapt to different API structures and response formats without custom code
- Extract standardized information from varying source formats
- Ensure data quality and completeness
- Create a scalable, maintainable system that can easily incorporate new data sources

### 1.2 High-Level Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│   Source Manager    │────▶│   API Handler       │────▶│   Data Processor    │
│   Agent             │     │   Agents            │     │   Agent             │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│   Source Database   │     │   Raw Response      │     │   Funding           │
│                     │     │   Storage           │     │   Opportunity DB    │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

## 2. Agent Implementation Details

### 2.1 Source Manager Agent

#### Purpose
The Source Manager Agent orchestrates the overall data collection process by managing source information, scheduling API calls, and routing tasks to the appropriate API Handler Agents.

#### Implementation Approach
- **Framework**: LangChain Agent with Tools
- **Model**: GPT-4 or equivalent
- **Execution Environment**: NextJS API route running on schedule

#### Key Responsibilities
1. Maintain and access the source database
2. Schedule API calls based on source update frequency
3. Prepare API request parameters and authentication
4. Select appropriate API Handler Agent
5. Log activities and handle errors
6. Report on data collection metrics

#### Code Structure
```javascript
// Source Manager Agent using LangChain
import { ChatOpenAI } from "langchain/chat_models/openai";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";
import { z } from "zod";
import { createSupabaseClient } from "../lib/supabase";

// Define the output schema for the agent
const sourceProcessingSchema = z.object({
  sourceId: z.string(),
  apiEndpoint: z.string(),
  queryParameters: z.record(z.string()),
  authMethod: z.string(),
  handlerType: z.string(),
  priority: z.number(),
});

// Agent implementation
export async function sourceManagerAgent() {
  // Initialize the LLM
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4",
  });
  
  // Create the chain with structured output
  const chain = createStructuredOutputChainFromZod(
    sourceProcessingSchema,
    {
      llm: model,
      prompt: `You are the Source Manager Agent for a funding intelligence system.
      Your task is to determine how to process the next API source in the queue.
      Source: {{source}}
      
      Determine the appropriate API endpoint, query parameters, authentication method,
      handler type, and priority for this source.`,
    }
  );
  
  // Get the next source to process
  const supabase = createSupabaseClient();
  const { data: sources } = await supabase
    .from("funding_sources")
    .select("*")
    .eq("interface_type", "api")
    .eq("active", true)
    .order("last_checked", { ascending: true })
    .limit(1);
  
  if (sources && sources.length > 0) {
    const source = sources[0];
    
    // Use the LLM to determine processing details
    const result = await chain.invoke({ source: JSON.stringify(source) });
    
    // Call the appropriate API handler
    await callApiHandler(result);
    
    // Update last checked timestamp
    await supabase
      .from("funding_sources")
      .update({ last_checked: new Date().toISOString() })
      .eq("id", source.id);
    
    // Log the activity
    await supabase
      .from("source_logs")
      .insert({
        source_id: source.id,
        action: "api_check",
        details: { result },
      });
  }
  
  // Schedule the next run
  scheduleNextRun();
}
```

### 2.2 API Handler Agents

#### Purpose
API Handler Agents are specialized for interacting with specific types of APIs, handling the unique characteristics of each source while maintaining a consistent output format.

#### Implementation Approach
- **Framework**: LangChain with Structured Output
- **Model**: GPT-4 or Claude equivalent
- **Execution Environment**: Serverless function triggered by Source Manager

#### Types of API Handlers

1. **Standard Grant API Handler**
   - For well-structured funding APIs (grants.gov, DOE)
   - Handles pagination and standard response formats
   - Maps common field patterns

2. **Document API Handler**
   - For APIs that return document-style content (Federal Register)
   - Extracts structured funding data from prose
   - Uses pattern recognition for common announcement formats

3. **State Portal API Handler**
   - For state-specific grant portals
   - Handles session management and form submissions if needed
   - Adapts to varied state data models

#### Sample Implementation
```javascript
// API Handler using LangChain
import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";
import { z } from "zod";
import axios from "axios";

// Define the funding opportunity schema
const fundingOpportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  fundingType: z.string(),
  agency: z.string(),
  totalFunding: z.number().optional(),
  minAward: z.number().optional(),
  maxAward: z.number().optional(),
  openDate: z.string().optional(),
  closeDate: z.string().optional(),
  eligibility: z.array(z.string()),
  url: z.string(),
  matchingRequired: z.boolean(),
  matchingPercentage: z.number().optional(),
  categories: z.array(z.string()),
  status: z.string(),
  confidence: z.number(),
});

// API Handler implementation
export async function apiHandler(source, params, authMethod) {
  // Make the API request
  const response = await makeApiRequest(source.url, params, authMethod);
  
  // Store the raw response
  const supabase = createSupabaseClient();
  const { data: rawResponse } = await supabase
    .from("raw_responses")
    .insert({
      source_id: source.id,
      content: response.data,
      timestamp: new Date().toISOString(),
    })
    .select("id")
    .single();
  
  // Initialize the LLM
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4",
  });
  
  // Create the prompt template with source-specific instructions
  const promptTemplate = PromptTemplate.fromTemplate(
    `You are the API Handler Agent for the funding intelligence system.
    
    Source Information:
    Name: ${source.name}
    Type: ${source.type}
    
    Your task is to analyze the API response and extract funding opportunities.
    For each opportunity, extract all relevant details according to our standard schema.
    
    API Response:
    {response}
    
    Extract all funding opportunities, with confidence scores for each field.
    If a field is not present, assign it as null with a confidence of 0.
    If a field requires interpretation, explain your reasoning.`
  );
  
  // Create the chain with structured output
  const chain = createStructuredOutputChainFromZod(
    z.array(fundingOpportunitySchema),
    {
      llm: model,
      prompt: promptTemplate,
    }
  );
  
  // Extract the opportunities
  const opportunities = await chain.invoke({ 
    response: JSON.stringify(response.data)
  });
  
  // Return the extracted opportunities and raw response ID
  return {
    opportunities,
    rawResponseId: rawResponse.id
  };
}
```

### 2.3 Data Processor Agent

#### Purpose
The Data Processor Agent handles post-extraction tasks such as deduplication, data enrichment, verification, and final preparation for storage in the funding opportunity database.

#### Implementation Approach
- **Framework**: LangChain with custom tools
- **Model**: GPT-4 or equivalent
- **Execution Environment**: Triggered by API Handler completion

#### Key Responsibilities
1. Deduplicate opportunities against existing database entries
2. Enrich data with additional context or missing fields
3. Validate data for completeness and accuracy
4. Assign confidence scores and flag items for human review
5. Format data for database storage
6. Generate notifications for high-value opportunities

#### Sample Implementation
```javascript
// Data Processor Agent
import { ChatOpenAI } from "langchain/chat_models/openai";
import { createStructuredOutputChainFromZod } from "langchain/chains/openai_functions";
import { z } from "zod";
import { createSupabaseClient } from "../lib/supabase";

// Define the processing result schema
const processingResultSchema = z.object({
  opportunityId: z.string(),
  action: z.enum(["insert", "update", "ignore"]),
  confidence: z.number(),
  needsReview: z.boolean(),
  reviewReason: z.string().optional(),
  normalizedData: z.record(z.any()),
});

// Data Processor implementation
export async function dataProcessorAgent(opportunities, rawResponseId) {
  const supabase = createSupabaseClient();
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4",
  });
  
  const results = [];
  
  for (const opportunity of opportunities) {
    // Check for duplicates
    const { data: existingOpps } = await supabase
      .from("funding_opportunities")
      .select("id, title, source_id, close_date")
      .eq("source_id", opportunity.agency)
      .ilike("title", `%${opportunity.title.substring(0, 50)}%`)
      .limit(5);
    
    // Create the chain with structured output
    const chain = createStructuredOutputChainFromZod(
      processingResultSchema,
      {
        llm: model,
        prompt: `You are the Data Processor Agent for the funding intelligence system.
        
        Your task is to determine whether this opportunity is new, an update to an existing one, or a duplicate.
        
        New Opportunity:
        ${JSON.stringify(opportunity)}
        
        Potential Existing Opportunities:
        ${JSON.stringify(existingOpps)}
        
        Decide the appropriate action (insert, update, or ignore) and prepare the normalized data.
        If the opportunity needs human review, flag it and explain why.`,
      }
    );
    
    // Process the opportunity
    const result = await chain.invoke({});
    results.push(result);
    
    // Take the appropriate action
    if (result.action === "insert") {
      await supabase
        .from("funding_opportunities")
        .insert({
          ...result.normalizedData,
          raw_response_id: rawResponseId,
          confidence_score: result.confidence,
          requires_review: result.needsReview,
          review_reason: result.reviewReason,
        });
    } else if (result.action === "update") {
      await supabase
        .from("funding_opportunities")
        .update({
          ...result.normalizedData,
          raw_response_id: rawResponseId,
          confidence_score: result.confidence,
          requires_review: result.needsReview,
          review_reason: result.reviewReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.opportunityId);
    }
  }
  
  return results;
}
```

## 3. Architecture Components and Integration

### 3.1 Database Schema

#### Source Database Tables

```sql
-- API Sources Table
CREATE TABLE funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization TEXT,
  type TEXT NOT NULL, -- federal, state, local, utility, private
  url TEXT NOT NULL,
  interface_type TEXT NOT NULL, -- api, web, rss, email
  api_endpoint TEXT,
  api_documentation TEXT,
  api_auth_type TEXT, -- none, apikey, oauth, etc.
  api_key_name TEXT,
  api_key_value TEXT,
  update_frequency TEXT, -- daily, weekly, monthly
  last_checked TIMESTAMP,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Source Specific Configuration
CREATE TABLE source_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES funding_sources(id),
  config_type TEXT NOT NULL, -- query_params, headers, parser_config
  configuration JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Raw Response Storage
CREATE TABLE raw_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES funding_sources(id),
  content JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_errors TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE source_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES funding_sources(id),
  action TEXT NOT NULL, -- api_check, processing, error
  status TEXT NOT NULL, -- success, failure
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Funding Opportunity Tables

```sql
-- Main Funding Opportunities Table
CREATE TABLE funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES funding_sources(id),
  raw_response_id UUID REFERENCES raw_responses(id),
  title TEXT NOT NULL,
  description TEXT,
  funding_type TEXT, -- grant, loan, incentive, rebate, etc.
  total_funding NUMERIC,
  min_award NUMERIC,
  max_award NUMERIC,
  open_date DATE,
  close_date DATE,
  eligibility JSONB,
  url TEXT,
  matching_required BOOLEAN DEFAULT false,
  matching_percentage NUMERIC,
  status TEXT, -- open, closed, upcoming
  confidence_score NUMERIC,
  requires_review BOOLEAN DEFAULT false,
  review_reason TEXT,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories Junction Table
CREATE TABLE opportunity_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  category TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Eligibility Junction Table
CREATE TABLE opportunity_eligibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  entity_type TEXT NOT NULL, -- k12, higher_ed, municipal, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Integration with NextJS and Supabase

The agent system will be implemented as part of a NextJS application with Supabase as the backend, providing:

1. **NextJS API Routes**:
   - `/api/sources/process` - Endpoint for the Source Manager Agent
   - `/api/handlers/[type]` - Endpoints for different API Handler types
   - `/api/processor` - Endpoint for the Data Processor Agent
   - `/api/admin/review` - Interface for human review

2. **Supabase Integration**:
   - Database schema implementation
   - Row-level security for protected data
   - Real-time subscriptions for agent status updates
   - Edge Functions for specialized processing

3. **Authentication and Security**:
   - Secure storage of API keys
   - Role-based access to agent functionality
   - Audit logging of all agent actions
   - Rate limiting for API calls

### 3.3 LangChain Implementation Details

The system utilizes several key LangChain components:

1. **Chains with Structured Output**:
   - Using `createStructuredOutputChainFromZod` to ensure typed outputs
   - Defining schemas for agent responses
   - Handling validation and error cases

2. **Custom Tools**:
   - Database access tools
   - API request tools
   - Data transformation tools
   - Validation tools

3. **Agent Execution**:
   - `ReActAgent` for complex reasoning tasks
   - `StructuredChatAgent` for simpler extraction tasks
   - Custom tools for database interactions

4. **Memory and Context**:
   - Maintaining context between agent executions
   - Storing historical interactions for improvement
   - Building a knowledge base of successful patterns

## 4. Implementation Strategy and Roadmap

### 4.1 Phased Development Approach

#### Phase 1: Core Agent Framework
- Implement basic Source Manager Agent
- Create Standard Grant API Handler
- Build foundation database schema
- Set up simple extraction pipeline for grants.gov

#### Phase 2: Handler Expansion
- Develop Document API Handler
- Create State Portal API Handler
- Implement handler selection logic
- Add support for authentication methods

#### Phase 3: Data Processing Enhancements
- Build Data Processor Agent
- Implement deduplication logic
- Develop confidence scoring
- Create human review interface

#### Phase 4: System Optimization
- Improve extraction accuracy
- Enhance error handling
- Optimize scheduling
- Add performance monitoring

### 4.2 Testing and Validation Strategy

1. **Unit Testing**:
   - Individual agent function testing
   - API response parsing accuracy
   - Schema validation

2. **Integration Testing**:
   - End-to-end pipeline testing
   - Cross-agent communication
   - Database interactions

3. **Performance Testing**:
   - Response time monitoring
   - Rate limit management
   - Concurrency handling

4. **Quality Metrics**:
   - Extraction accuracy
   - Field completeness
   - Confidence score validation
   - Duplication detection rate

### 4.3 Ongoing Improvement Mechanisms

1. **Agent Learning**:
   - Build a library of successful extractions
   - Track and learn from human corrections
   - Continuously improve prompts

2. **Source Evaluation**:
   - Track success rates by source
   - Identify problematic data formats
   - Adjust polling frequencies based on update patterns

3. **System Monitoring**:
   - Agent performance dashboards
   - Error rate tracking
   - Extraction quality metrics
   - Cost optimization

## 5. Example Agent Prompts

### 5.1 Source Manager Agent Prompt

```
You are the Source Manager Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following API source and determine:
1. The optimal API endpoint to call
2. The appropriate query parameters to use
3. The authentication method required
4. The type of API Handler to use
5. The priority of this source (1-10)

SOURCE INFORMATION:
{{source_json}}

Based on this information, determine the best approach for retrieving funding opportunities from this source. Consider:
- The type of organization (federal, state, local, utility, private)
- The typical funding programs they offer
- The structure of their API (if documented)
- The frequency of updates
- The relevance to our target funding categories

Provide your response as a structured output with the fields:
- apiEndpoint: The full URL to call
- queryParameters: Key-value pairs of parameters to include
- authMethod: How to authenticate (none, apiKey, oauth, etc.)
- handlerType: The type of handler to use (standard, document, statePortal)
- priority: Numeric priority (1-10)
- reasoning: Brief explanation of your choices
```

### 5.2 API Handler Agent Prompt

```
You are the API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following API response from {{source_name}} and extract all funding opportunities that match our criteria.

For context, this source typically provides funding for:
{{source_funding_focus}}

API RESPONSE:
{{api_response_json}}

For each funding opportunity you identify, extract the following information:
1. Title
2. Description
3. Funding type (grant, loan, incentive, etc.)
4. Agency/organization providing the funding
5. Total funding amount (if available)
6. Minimum and maximum award amounts (if available)
7. Application open and close dates
8. Eligibility requirements
9. URL for more information
10. Matching fund requirements
11. Relevant categories from our taxonomy
12. Current status (open, upcoming, closed)

If information is not explicitly provided, use your judgment to infer it from context, and assign a confidence score to each field.

Provide your response as an array of structured objects, each representing a funding opportunity.
```

### 5.3 Data Processor Agent Prompt

```
You are the Data Processor Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following extracted opportunity and determine:
1. Whether it is a new opportunity or an update to an existing one
2. Whether any fields need enrichment or correction
3. If the opportunity requires human review
4. How to normalize the data for storage

EXTRACTED OPPORTUNITY:
{{opportunity_json}}

POTENTIAL MATCHING OPPORTUNITIES IN DATABASE:
{{existing_opportunities_json}}

Based on your analysis:
1. Determine if this is a new entry, an update, or a duplicate
2. Correct any inconsistencies or formatting issues
3. Flag for human review if there are significant uncertainties
4. Prepare the normalized data structure for database storage

Provide your response as a structured output with the action to take (insert, update, ignore), confidence score, review flag, and normalized data object.
```

## 6. Conclusion

This agent-based architecture provides a flexible, scalable system for gathering funding opportunity data from diverse API sources. The key advantages of this approach include:

1. **Adaptability**: The system can handle different API formats without custom code
2. **Scalability**: New sources can be added with minimal configuration
3. **Intelligence**: LLM-powered agents can extract meaning from varied data structures
4. **Quality Control**: Confidence scoring and human review ensure data accuracy
5. **Evolution**: The system learns and improves from experience

The implementation leverages modern technologies (NextJS, Supabase, LangChain) while maintaining a clean separation of concerns between different agent responsibilities. This ensures the system can grow and adapt as new funding sources are identified and requirements evolve.
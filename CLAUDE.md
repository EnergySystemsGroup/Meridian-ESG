# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Git Commit Policy

**NEVER commit changes without explicit user permission.**

- Do NOT use `git commit` unless the user explicitly asks you to commit
- Do NOT use `git commit --amend` without permission
- Always ask before committing, even if changes seem ready
- Exception: User explicitly says "commit this" or "go ahead and commit"

If you accidentally commit without permission, immediately inform the user and offer to undo it with `git reset HEAD~1`.

## Project Overview

Meridian is a Policy & Funding Intelligence Platform built with Next.js that helps organizations track funding opportunities, monitor legislation, and match clients to relevant funding sources. The platform features a comprehensive dashboard, geographic mapping, and advanced agent-based data processing.

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:run     # Run tests once
```

### Task Management
```bash
task-master          # Run task-master CLI (globally installed)
```

## Claude Code Task Management Guidelines

- Use the `task-master` CLI to manage all project tasks.
- Regularly run `task-master next` to fetch the current task, and `task-master complete <id>` when finished.
- Keep the task list accurate: update task content if new information emerges or implementation details change.
- If a task appears vague, incomplete, or inconsistent with project goals, pause and raise a concern before proceeding.
- Maintain alignment between project requirements and task execution—act as a second set of eyes.
- Log your progress explicitly within the task system; do not assume implicit understanding.
- **Use specialized sub-agents proactively when tasks warrant their expertise** (e.g., code-info-retriever for codebase analysis, database-architect-dba for schema work, supabase-query-agent for data queries).
- **For codebase research**: Always use the code-info-retriever agent when you need to understand existing functionality, locate code sections, or analyze how features are implemented.


### Data Processing Scripts
```bash
npm run add-grants-gov-source    # Add Grants.gov as a funding source
npm run test-config             # Test configuration system
```

## Architecture Overview

### Core Technology Stack
- **Frontend**: Next.js 15 with App Router, React 18, TailwindCSS
- **UI Components**: Radix UI primitives with shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **AI/ML**: Anthropic Claude SDK for agent processing
- **Testing**: Vitest
- **Deployment**: Vercel

### Key Directories Structure

```
app/
├── api/                    # Next.js API routes
├── components/            # Reusable UI components
├── lib/                   # Core business logic
│   ├── agents-v2/         # Optimized agent architecture
│   ├── services/          # Service layer coordinators
│   └── utils/             # Utility functions
├── (routes)/              # App router pages
└── globals.css           # Global styles

supabase/
├── migrations/           # Database schema changes
└── functions/           # Edge functions
```

### Agent Architecture (V2)

The application uses a sophisticated agent-based system for processing funding opportunities:

**Core Agents:**
- **Storage Agent**: Handles data persistence, duplicate detection, and state management
- **Data Extraction Agent**: Processes API responses and extracts structured data
- **Analysis Agent**: Performs content enhancement and scoring
- **Source Orchestrator**: Coordinates processing workflows

**Key Features:**
- Direct Anthropic SDK integration (no LangChain overhead)
- Native JSON Schema support
- Built-in performance tracking and retry logic
- Batch processing with concurrency controls
- Early duplicate detection to prevent redundant processing

### Database Architecture

The system uses Supabase PostgreSQL with:
- **funding_opportunities**: Core opportunity data
- **funding_sources**: API source configurations
- **runs**: Processing execution tracking
- **coverage_areas**: Geographic entities with PostGIS polygons

Key views and functions handle complex queries for the dashboard and mapping features.

### Geographic Filtering (IMPORTANT)

**Use `coverage_areas` system, NOT legacy `eligible_states`.**

| Current System | Deprecated |
|----------------|------------|
| `opportunity_coverage_areas` table | `opportunity_state_eligibility` table |
| `coverage_state_codes` view column | `eligible_states` view column |

```javascript
// Correct: filter by coverage areas
query.or(`is_national.eq.true,coverage_state_codes.cs.{${stateCode}}`);

// WRONG: don't use eligible_states
query.or(`is_national.eq.true,eligible_states.cs.{${stateCode}}`);
```

See `docs/architecture/ADR-001-geographic-filtering.md` for details.

## Development Guidelines

### Environment Setup
Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Testing
- Use Vitest for unit tests
- Agent tests are located in `app/lib/agents-v2/tests/`
- Run individual tests: `npm run test -- specific-test-file.test.js`

### Agent Development
When working with agents:
- Use `app/lib/agents-v2/utils/anthropicClient.js` for AI calls
- Follow the established schemas in the client
- Include performance tracking in agent operations
- Implement proper error handling and retries

### Database Changes
- Use Supabase migrations in `supabase/migrations/`
- Test locally with `supabase start`
- Migration naming: `YYYYMMDD_description.sql`
- **IMPORTANT**: For dev environments, always use `supabase migration up` - NEVER do database resets during migrations

### API Routes
- Follow Next.js 15 async API patterns
- Use proper error handling and status codes
- Include performance monitoring for agent operations

## Key Features to Understand

### Map Integration
- Geographic funding visualization using react-simple-maps
- State-based filtering and opportunity aggregation
- Real-time data updates

### Agent Processing Pipeline
- Multi-stage processing with Storage → Analysis → Filtering
- Optimized for performance with 60-80% faster execution
- Built-in duplicate detection and data sanitization

### Real-time Updates
- Supabase real-time subscriptions for run status
- Live dashboard updates during processing

## Performance Considerations

- Agent v2 architecture provides 60-80% faster execution vs v1
- Use batch processing for multiple operations
- Implement proper caching strategies
- Monitor token usage and API limits

## Debugging

### Agent Debugging
- Use debug API routes: `/api/debug/anthropic-client`
- Check agent test files for validation patterns
- Monitor performance metrics built into the client

### Database Debugging
- Use `/api/debug/funding-values` for data validation
- Check Supabase logs for query performance
- Verify RLS policies for data access issues

## Manual Funding Opportunities Pipeline

For funding sources without APIs (utilities, county grants, foundation programs), use the manual discovery pipeline.

**Staging Table**: `manual_funding_opportunities_staging`

### Trigger Commands

| Command | Description |
|---------|-------------|
| "Run discovery for [STATE]" | Discover programs for all utilities in a state (outputs to file for review) |
| "Run discovery for [utility]" | Discover programs for a single utility (outputs to file for review) |
| "Import discovery results" | Import discovery files to staging table |
| "Process staging pipeline" | Run extraction → analysis → storage on all pending records |
| "Run staging" | Alias for "Process staging pipeline" |
| "Extract pending" | Run extraction phase only |
| "Analyze pending" | Run analysis phase only |
| "Store pending" | Run storage phase only |
| "Check staging status" | Show counts of records at each pipeline stage |

**CRITICAL**: All pipeline commands MUST spawn agents via Task tool - no inline processing allowed.

---

### Command: Run Discovery

**Trigger**: "Run discovery for California" or "Run discovery for PG&E"

**Coordinator Actions**:
1. Parse input (state code or utility name)
2. If state: Query `coverage_areas` for utilities WHERE `state_code = 'XX'` AND `kind = 'utility'`
3. Spawn `discovery-agent` with FILE MODE (default)
4. Agent outputs to `temp/utility-discovery/discovery-batch-{N}.json`
5. Report summary: utilities processed, programs found
6. Tell user: "Review the discovery file, then say 'Import discovery results' to add to staging"

---

### Command: Import Discovery Results

**Trigger**: "Import discovery results"

**Coordinator Actions**:
1. Read all `temp/utility-discovery/discovery-batch-*.json` files
2. For each program:
   - Lookup/create funding_source in `funding_sources` table (strip parenthetical suffix from utility name)
   - Get source_id UUID
3. INSERT to `manual_funding_opportunities_staging`:
   ```sql
   INSERT INTO manual_funding_opportunities_staging (
     source_id, title, url, content_type,
     discovery_method, discovered_by,
     extraction_status, analysis_status, storage_status
   ) VALUES (
     'source-uuid', 'Program Title', 'https://...', 'html',
     'cc_agent', 'discovery_agent',
     'pending', 'pending', 'pending'
   ) ON CONFLICT (url) DO NOTHING;
   ```
4. Report: X programs imported, Y duplicates skipped

---

### Command: Process Staging Pipeline

**Trigger**: "Process staging pipeline"

**Coordinator Actions** (auto-spawns all phases, no confirmation needed):

1. **Check staging counts**:
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE extraction_status = 'pending') as pending_extraction,
     COUNT(*) FILTER (WHERE extraction_status = 'complete' AND analysis_status = 'pending') as pending_analysis,
     COUNT(*) FILTER (WHERE analysis_status = 'complete' AND storage_status = 'pending') as pending_storage
   FROM manual_funding_opportunities_staging;
   ```

2. **Phase 1: Extraction** (if pending > 0)
   - Spawn agent using Task tool:
     ```
     Task(
       description="Extract pending records from staging. Query WHERE extraction_status = 'pending'. Update extraction_data and raw_content.",
       subagent_type="extraction-agent"
     )
     ```
   - Report progress after completion

3. **Phase 2: Analysis** (if pending > 0)
   - Spawn agent using Task tool:
     ```
     Task(
       description="Analyze extracted records. Query WHERE extraction_status = 'complete' AND analysis_status = 'pending'. Run content enhancement and V2 scoring.",
       subagent_type="analysis-agent"
     )
     ```
   - Report progress after completion

4. **Phase 3: Storage** (if pending > 0)
   - Spawn agent using Task tool:
     ```
     Task(
       description="Store analyzed records. Query WHERE analysis_status = 'complete' AND storage_status = 'pending'. UPSERT to funding_opportunities, link coverage areas.",
       subagent_type="storage-agent"
     )
     ```
   - Report final summary

5. **Final Report**:
   ```
   PIPELINE COMPLETE
   Extraction: 47 programs processed
   Analysis: 45 programs scored (avg score: 6.8)
   Storage: 45 opportunities added to database
   Coverage areas linked: 127
   Failed: 2 (see staging table for errors)
   ```

---

### Command: Check Staging Status

**Trigger**: "Check staging status"

**Coordinator Actions**:
1. Query staging table for counts
2. Display:
   ```
   STAGING PIPELINE STATUS
   Pending extraction: 47 records
   Pending analysis: 12 records
   Pending storage: 8 records
   Completed: 190 records
   Failed: 3 records
   ```

---

### Coordinator Behavior

- **Auto-spawn**: Sub-agents launch automatically without asking for confirmation
- **Progress reporting**: Status updates after each batch
- **Error handling**: Failed records logged in staging table, pipeline continues
- **Batch sizes**: Discovery (10 utilities), Extraction/Analysis (20 programs), Storage (all pending)

---

### Agent Invocation (Task Tool)

**CRITICAL**: To spawn pipeline agents, use the **Task tool** with the `subagent_type` parameter. NEVER do inline processing for staging pipeline work - always spawn agents, even for 1 record.

#### Syntax
```
Task(
  description="[What the agent should do - include SQL query hints]",
  subagent_type="[agent-name]"
)
```

#### Available Pipeline Agents

| Agent | subagent_type | Purpose |
|-------|---------------|---------|
| Discovery | `discovery-agent` | Web search for utility program URLs |
| Extraction | `extraction-agent` | Fetch URLs, extract structured data to staging |
| Analysis | `analysis-agent` | Content enhancement + V2 scoring |
| Storage | `storage-agent` | UPSERT to funding_opportunities + coverage linking |

#### Example Invocations

**Extraction Agent**:
```
Task(
  description="Extract pending records from staging table. Query WHERE extraction_status = 'pending'. Fetch each URL, update extraction_data and raw_content.",
  subagent_type="extraction-agent"
)
```

**Analysis Agent**:
```
Task(
  description="Analyze extracted records. Query WHERE extraction_status = 'complete' AND analysis_status = 'pending'. Run content enhancement (6 fields) and deterministic V2 scoring.",
  subagent_type="analysis-agent"
)
```

**Storage Agent**:
```
Task(
  description="Store analyzed records to production. Query WHERE analysis_status = 'complete' AND storage_status = 'pending'. Apply dataSanitizer, UPSERT to funding_opportunities, link coverage areas.",
  subagent_type="storage-agent"
)
```

**Discovery Agent**:
```
Task(
  description="Discover programs for utilities in California. Query coverage_areas WHERE state_code = 'CA' AND kind = 'utility'. Execute searches, apply filtering, output to temp/utility-discovery/.",
  subagent_type="discovery-agent"
)
```

---

### Database Write Access

**CRITICAL**: MCP postgres (`mcp__postgres__query`) is READ-ONLY.

For all INSERT/UPDATE operations, use psql:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SQL"
```

### Full Documentation

See: `docs/prd/opp_staging/manual-funding-opportunities-pipeline.md`

---

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

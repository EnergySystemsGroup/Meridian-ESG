# Architecture

## Core Technology Stack

- **Frontend**: Next.js 15 with App Router, React 18, TailwindCSS
- **UI Components**: Radix UI primitives with shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **AI/ML**: Anthropic Claude SDK for agent processing
- **Testing**: Vitest
- **Deployment**: Vercel

## Key Directories

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

## Agent Architecture (V2)

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

## Database Architecture

The system uses Supabase PostgreSQL with:
- **funding_opportunities**: Core opportunity data
- **funding_sources**: API source configurations
- **runs**: Processing execution tracking
- **coverage_areas**: Geographic entities with PostGIS polygons

Key views and functions handle complex queries for the dashboard and mapping features.

### Geographic Filtering (CRITICAL)

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

## Key Features

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

For funding sources without APIs (utilities, county grants, foundation programs), use the **pipeline orchestrator skill**.

**Entry point**: `/pipeline-orchestrator` or any natural language pipeline request.

The orchestrator parses your request, checks database state, determines the correct starting phase, and chains agents automatically. It uses Agent Teams for discovery (cross-checking for thoroughness) and Task tool agents for processing (deterministic batch work).

### Pipeline Commands

| Command | What Happens |
|---------|-------------|
| "Run pipeline for [STATE] [TYPE]" | Full pipeline: sources → programs → opportunities → extract → analyze → store |
| "Register sources: [STATE] [TYPE]" | Phase 1 only: find and register funding sources |
| "Discover programs for [X]" | Phase 2: crawl source catalogs for programs |
| "Find opportunities for [X]" | Phase 3→6: discover opportunities, then process through staging |
| "Process staging" / "Run staging" | Phase 4→6: extraction → analysis → storage |
| "Extract pending" | Phase 4 only |
| "Analyze pending" | Phase 5 only |
| "Store pending" | Phase 6 only |
| "Review pending" / "Publish approved" | Phase 7: reports counts, directs to `/admin/review` UI |
| "Check staging status" | Read-only report of pipeline counts |

**Intelligent prerequisites**: If you request Phase 3 but no sources exist, the orchestrator reports what's missing and offers to chain from the right starting point.

### Admin Review UI

- **Review queue**: `/admin/review` — filter, sort, bulk approve/reject pending_review records
- **Detail page admin tab**: `/funding/opportunities/[id]` → Admin tab — approve, reject, or downgrade individual records
- **API routes**: `GET /api/admin/review`, `POST /api/admin/review/approve`, `POST /api/admin/review/reject`, `POST /api/admin/review/demote`

### Key Rules

- **All pipeline work** goes through the orchestrator skill — no inline processing
- **Agent Teams** for discovery phases (1-3): parallel search with cross-checking
- **Task tool** for processing phases (4-6): deterministic batch work via extraction-agent, analysis-agent, storage-agent
- **Phase 7** (Review & Publish) is NEVER auto-triggered — requires explicit admin action via `/admin/review`
- **Database reads**: `mcp__postgres__query` (read-only MCP)
- **Database writes**: `psql "$PROD_CLAUDE_URL"` via Bash tool (or `$STAGING_CLAUDE_URL` / `$DEV_CLAUDE_URL`)
- **Content retrieval**: Each skill file contains inline content retrieval instructions. HTML → WebFetch (fallback: Playwright). PDFs → `curl | python3 PyMuPDF` (never WebFetch). Login-gated → skip and flag. See Section 0a in each skill's SKILL.md.

### Full Documentation

- **Orchestrator skill**: `.claude/skills/pipeline-orchestrator/SKILL.md`
- **Architecture proposal**: `docs/prd/opp_staging/manual-claude-code-pipeline-architecture-proposal.md`
- **DB security**: `docs/prd/db-security/production-database-configuration.md`

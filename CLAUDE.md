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
- **states**: Geographic eligibility data

Key views and functions handle complex queries for the dashboard and mapping features.

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

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

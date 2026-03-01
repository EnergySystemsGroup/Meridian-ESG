# Development Guidelines

## Environment Setup

Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Agent Development

When working with agents:
- Use `app/lib/agents-v2/utils/anthropicClient.js` for AI calls
- Follow the established schemas in the client
- Include performance tracking in agent operations
- Implement proper error handling and retries

## Database Changes

- Use Supabase migrations in `supabase/migrations/`
- Test locally with `supabase start`
- Migration naming: `YYYYMMDD_description.sql`
- **CRITICAL: Migration Workflow**:
  - **Local dev**: Always use `supabase migration up` to apply migrations. This runs the SQL AND records it in the tracking table.
  - **NEVER use `psql -f migration.sql`** — this applies schema changes but skips tracking, causing `supabase migration list` to show migrations as unapplied.
  - **Staging/Production**: Automatic via GitHub Actions (`supabase db push`) when the branch merges.
  - **NEVER do database resets** during migrations — use `supabase migration up` only.

## API Routes

- Follow Next.js 15 async API patterns
- Use proper error handling and status codes
- Include performance monitoring for agent operations

## Data Processing Scripts

```bash
npm run add-grants-gov-source    # Add Grants.gov as a funding source
npm run test-config             # Test configuration system
```

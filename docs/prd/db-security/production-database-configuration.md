# Production Database Configuration & Security

This document outlines the database configuration, security measures, and access patterns for the Meridian ESG production environment.

---

## Part 1: Claude Code Database Access

### Overview

Claude Code needs to manipulate production data for:
- **Bulk transfers** - Copying curated data from staging/local to production
- **One-off edits** - Fixing incorrect dates, amounts, or other data issues
- **Search and insert** - Discovering new opportunities and adding them to the database

However, we must protect against accidental destructive operations (DELETE, TRUNCATE, DROP).

### The Solution: Limited PostgreSQL Role

Instead of giving Claude Code full database access (the `postgres` superuser), we create a restricted role that can only perform specific operations.

---

### Access Modes Explained

There are three ways to access a Supabase database:

| Mode | Connection | Use Case |
|------|------------|----------|
| **Supabase API** | `https://xxx.supabase.co` + API key | App client code, browser requests |
| **Direct PostgreSQL** | `postgresql://user:pass@db.xxx:5432/postgres` | Database administration (IPv6 only) |
| **Connection Pooler** | `postgresql://user.xxx:pass@aws-0-region.pooler.supabase.com:6543/postgres` | Bulk operations, scripts (IPv4 available) |

**For Claude Code, we use the Connection Pooler** because:
- Bulk import/export is efficient (single commands vs. hundreds of API calls)
- Permissions are enforced at the database level (not bypassable)
- **IPv4 connectivity** - Direct connections only support IPv6, which doesn't work from WSL2 or many networks
- Simple - just swap the connection string

> **⚠️ WSL2 Note**: If running Claude Code from WSL2 (Windows Subsystem for Linux), you MUST use the pooler URL. Direct database connections (`db.xxx.supabase.co:5432`) only have IPv6 addresses, which WSL2 cannot reach.

---

### The Limited Role: `claude_writer`

A PostgreSQL role with restricted permissions:

```sql
-- Create the role with BYPASSRLS (needed since RLS policies only cover authenticated/service_role)
CREATE ROLE claude_writer WITH LOGIN PASSWORD 'secure-password-here' BYPASSRLS;

-- Grant read access to all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_writer;

-- Grant SELECT on future tables (so new tables are automatically readable)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_writer;

-- Grant write access only to specific tables
GRANT INSERT, UPDATE ON funding_opportunities TO claude_writer;
GRANT INSERT, UPDATE ON funding_sources TO claude_writer;
GRANT INSERT, UPDATE ON coverage_areas TO claude_writer;
GRANT INSERT, UPDATE ON opportunity_coverage_areas TO claude_writer;
GRANT INSERT, UPDATE ON funding_programs TO claude_writer;

-- Grant USAGE on sequences (needed for INSERTs with auto-generated IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO claude_writer;

-- Grant execute on functions (for RPC calls if needed)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO claude_writer;

-- Audit logging table (insert only)
GRANT INSERT ON claude_change_log TO claude_writer;

-- Explicitly NO DELETE granted on any table
-- Attempting DELETE will result in: ERROR: permission denied
```

> **Note on BYPASSRLS**: The `claude_writer` role needs `BYPASSRLS` because Supabase's default RLS policies only grant access to `authenticated` and `service_role`. Without this, INSERT/UPDATE operations would fail with "row-level security policy" errors.

### What Claude Code Can and Cannot Do

| Operation | Allowed? | Enforcement |
|-----------|----------|-------------|
| SELECT any table | Yes | Granted |
| INSERT opportunities | Yes | Granted |
| UPDATE opportunities | Yes | Granted |
| DELETE anything | **No** | Not granted = blocked |
| TRUNCATE any table | **No** | Not granted = blocked |
| DROP any object | **No** | Not granted = blocked |
| Access other schemas | **No** | Not granted = blocked |

---

### Environment Configuration

#### `.env.local` Structure

```bash
# =============================================================================
# LOCAL DATABASE (for development)
# =============================================================================
LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# =============================================================================
# PRODUCTION DATABASE - LIMITED ACCESS FOR CLAUDE CODE (via Pooler)
# =============================================================================
# This role can SELECT, INSERT, UPDATE but NOT DELETE
# IMPORTANT: Use the pooler URL (port 6543), not direct connection (port 5432)
# Format: postgresql://claude_writer.<project-ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres
PROD_DB_URL=postgresql://claude_writer.<project-ref>:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres

# =============================================================================
# SUPABASE API (for app usage, not Claude Code writes)
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>

# NOTE: Service role key is NOT stored here
# It lives only in Vercel environment variables for production deployments
```

#### Finding the Pooler URL in Supabase Dashboard

1. Go to **Project Settings** → **Database**
2. Look for the **Connection Pooling** section
3. The pooler hostname follows this pattern: `aws-0-<region>.pooler.supabase.com`
4. Combine with your project ref: `claude_writer.<project-ref>:password@<pooler-host>:6543/postgres`

> **Port numbers**: Direct = 5432 (IPv6 only), Pooler = 6543 (IPv4 available)

#### What's NOT in `.env.local`

- `SUPABASE_SERVICE_ROLE_KEY` - Kept in Vercel only
- `postgres` superuser connection string - Not needed for Claude Code

This ensures Claude Code physically cannot access credentials that bypass restrictions.

---

### Workflow: Bulk Data Transfer

**Scenario:** Copy the `funding_opportunities` table from local to production, excluding test records.

#### Step 1: Export from Local

```bash
# Claude runs this against LOCAL database (full access is fine)
pg_dump "$LOCAL_DB_URL" \
  --data-only \
  --table=funding_opportunities \
  --column-inserts \
  -f /tmp/opportunities_export.sql

# Or with filtering (exclude test data):
psql "$LOCAL_DB_URL" -c "\COPY (SELECT * FROM funding_opportunities WHERE title NOT LIKE '%TEST%') TO '/tmp/opportunities.csv' CSV HEADER"
```

#### Step 2: Review (Optional)

```bash
# Claude can show a summary
wc -l /tmp/opportunities_export.sql  # Count rows
head -20 /tmp/opportunities_export.sql  # Preview
```

User reviews and approves.

#### Step 3: Import to Production

```bash
# Claude runs this against PRODUCTION database (limited role)
psql "$PROD_DB_URL" -f /tmp/opportunities_export.sql

# Or for CSV:
psql "$PROD_DB_URL" -c "\COPY funding_opportunities FROM '/tmp/opportunities.csv' CSV HEADER"
```

If Claude tried to run a DELETE statement, PostgreSQL would block it:
```
ERROR: permission denied for table funding_opportunities
```

---

### Workflow: One-Off Edits

**Scenario:** Fix incorrect close dates for opportunities from a specific source.

#### Step 1: Claude Identifies Issues

```bash
psql "$PROD_DB_URL" -c "
  SELECT id, title, close_date
  FROM funding_opportunities
  WHERE source_name = 'Example Source'
    AND (close_date IS NULL OR close_date < NOW())
"
```

Claude finds 15 opportunities with problems.

#### Step 2: Claude Researches Correct Values

Claude visits source websites, PDFs, etc. and compiles corrections:
- Opportunity abc123: close_date should be 2025-06-30
- Opportunity def456: close_date should be 2025-12-31
- etc.

#### Step 3: Claude Presents for Confirmation

Claude shows the proposed changes in chat or writes to a temp file:

```
Proposed Updates:
| ID      | Current Close Date | New Close Date |
|---------|-------------------|----------------|
| abc123  | NULL              | 2025-06-30     |
| def456  | 2024-01-15        | 2025-12-31     |
```

User reviews and says "go ahead" (or "skip the second one").

#### Step 4: Claude Executes Updates

```bash
psql "$PROD_DB_URL" -c "
  UPDATE funding_opportunities SET close_date = '2025-06-30' WHERE id = 'abc123';
  UPDATE funding_opportunities SET close_date = '2025-12-31' WHERE id = 'def456';
"
```

---

### Workflow: Search and Insert

**Scenario:** Claude discovers new utility rebate programs and adds them to the database.

#### Step 1: Claude Searches and Compiles Data

Claude researches programs, extracts details, and writes to a temp file:

```bash
# Claude creates a SQL file with INSERT statements
cat > /tmp/new_opportunities.sql << 'EOF'
INSERT INTO funding_opportunities (title, description, url, funding_source_id, ...)
VALUES ('PG&E EV Charger Rebate', 'Up to $4000 for...', 'https://...', 'source-uuid', ...);

INSERT INTO funding_opportunities (title, description, url, funding_source_id, ...)
VALUES ('SCE Commercial Lighting', 'Rebates for...', 'https://...', 'source-uuid', ...);
EOF
```

#### Step 2: User Reviews

User can inspect `/tmp/new_opportunities.sql` or Claude provides a summary.

#### Step 3: Claude Imports

```bash
psql "$PROD_DB_URL" -f /tmp/new_opportunities.sql
```

---

### Audit Trail (Optional Enhancement)

For tracking what Claude Code changes, we can create an audit table:

```sql
CREATE TABLE claude_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  operation TEXT NOT NULL,  -- 'INSERT', 'UPDATE'
  change_details JSONB,
  change_reason TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

Claude logs changes after executing them:

```sql
INSERT INTO claude_change_log (table_name, record_id, operation, change_details, change_reason)
VALUES ('funding_opportunities', 'abc123', 'UPDATE',
        '{"close_date": {"old": null, "new": "2025-06-30"}}',
        'Corrected close date from source website');
```

---

### Security Summary

| Threat | Mitigation |
|--------|------------|
| Accidental DELETE | `claude_writer` role has no DELETE permission |
| Bulk destructive operation | TRUNCATE, DROP not granted |
| Accessing secrets | Service role key not in `.env.local` |
| Unauthorized table access | Only granted tables are accessible |
| Untracked changes | Audit log captures all modifications |

---

## Part 2: Row Level Security (RLS) Policies

*To be documented after discussion...*

---

## Part 3: Application Security Configuration

*To be documented after discussion...*

---

## Part 4: Environment Separation

*To be documented - covers local/staging/production separation...*

---

## Appendix: Quick Reference

### Connection Strings

| Environment | Connection Type | Purpose | Who Uses It |
|-------------|-----------------|---------|-------------|
| `LOCAL_DB_URL` | Direct (localhost) | Local development | Developers, Claude Code (exports) |
| `PROD_DB_URL` | Pooler (IPv4) | Production (limited) | Claude Code (imports, edits) |
| Vercel `SUPABASE_SERVICE_ROLE_KEY` | API | Production (full) | App backend only |

### Commands Cheat Sheet

```bash
# Query production (read)
psql "$PROD_DB_URL" -c "SELECT COUNT(*) FROM funding_opportunities"

# Export from local
pg_dump "$LOCAL_DB_URL" --data-only --table=tablename -f export.sql

# Import to production
psql "$PROD_DB_URL" -f export.sql

# Single update
psql "$PROD_DB_URL" -c "UPDATE funding_opportunities SET field='value' WHERE id='uuid'"
```

### Verified Test Results (Staging)

The `claude_writer` role was tested on staging with these results:

| Operation | Command | Result |
|-----------|---------|--------|
| SELECT | `SELECT COUNT(*) FROM funding_opportunities` | ✅ Works (92 rows) |
| INSERT | `INSERT INTO funding_opportunities (title, status) VALUES ('TEST', 'Closed')` | ✅ Works |
| UPDATE | `UPDATE funding_opportunities SET title = 'UPDATED' WHERE ...` | ✅ Works |
| DELETE | `DELETE FROM funding_opportunities WHERE ...` | ❌ Permission denied |
| TRUNCATE | `TRUNCATE funding_opportunities` | ❌ Permission denied |
| DROP | `DROP TABLE funding_opportunities` | ❌ Must be owner |

### Troubleshooting

**"Network is unreachable" error with psql**
- This means you're using the direct connection URL (port 5432) which only has IPv6
- Switch to the pooler URL (port 6543) which has IPv4

**"Row-level security policy" error**
- The `claude_writer` role needs `BYPASSRLS` privilege
- Run: `ALTER ROLE claude_writer BYPASSRLS;`

**"Permission denied to set role" error**
- Only relevant if using SET ROLE for testing
- Grant membership: `GRANT claude_writer TO postgres;`

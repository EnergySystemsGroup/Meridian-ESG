# ADR-001: Geographic Filtering via Coverage Areas

## Status
**Active** (December 2025)

## Context
The application evolved from simple state-based eligibility to polygon-based coverage areas to support more precise geographic targeting (utilities, counties, cities).

## Decision
All geographic filtering MUST use the coverage areas system:

### Tables (Current System)
- `coverage_areas` - Geographic entities with polygons (`kind`: national, state, county, utility, city)
- `opportunity_coverage_areas` - Junction table linking opportunities to coverage areas

### View Column (Current System)
- `coverage_state_codes` - Array of state codes derived from `coverage_areas.state_code`
- `coverage_area_types` - Array of coverage kinds (national, state, county, utility)

### Deprecated (Do Not Use)
- `opportunity_state_eligibility` table
- `eligible_states` view column

## Correct Usage

```sql
-- Filter opportunities for California
WHERE is_national = TRUE OR 'CA' = ANY(coverage_state_codes)

-- Filter by scope type
WHERE 'county' = ANY(coverage_area_types)
```

```javascript
// Supabase JS
query.or(`is_national.eq.true,coverage_state_codes.cs.{${stateCode}}`);
```

## Incorrect Usage (Legacy)

```sql
-- DON'T use eligible_states
WHERE 'CA' = ANY(eligible_states)  -- WRONG: uses deprecated table
```

## Consequences
- All map and explorer APIs must use `coverage_state_codes` for state filtering
- Scope breakdown RPCs already use `opportunity_coverage_areas` correctly
- The `eligible_states` column remains for backward compatibility but should not be used for new code

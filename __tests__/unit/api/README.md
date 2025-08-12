# API Route Tests

This directory contains comprehensive unit tests for all Next.js API routes in the Meridian ESG project.

## Test Coverage

### Funding API Tests (`/api/funding`)

#### opportunities.test.js
- **GET /api/funding/opportunities**
  - ✅ Returns opportunities with default pagination
  - ✅ Handles query parameters (status, date_range, amount filters)
  - ✅ Supports pagination (page, page_size)
  - ✅ Filters by categories and states
  - ✅ Handles search queries
  - ✅ Error handling for database failures

- **POST /api/funding/opportunities**
  - ✅ Fetches single opportunity by ID
  - ✅ Validates required ID parameter
  - ✅ Falls back to mock data on error
  - ✅ Handles invalid JSON input

#### sources.test.js
- **GET /api/funding/sources**
  - ✅ Returns all funding sources
  - ✅ Filters by active status
  - ✅ Filters by source type
  - ✅ Handles database errors

- **POST /api/funding/sources**
  - ✅ Creates new funding source
  - ✅ Validates required fields (name, type, url)
  - ✅ Checks for similar/duplicate sources
  - ✅ Handles unique constraint violations
  - ✅ Inserts source configurations

- **GET /api/funding/sources/[id]**
  - ✅ Returns single source with configurations
  - ✅ Returns 404 for non-existent source

- **PUT /api/funding/sources/[id]**
  - ✅ Updates existing source
  - ✅ Handles partial updates
  - ✅ Updates configurations when provided
  - ✅ Returns 404 for non-existent source

- **DELETE /api/funding/sources/[id]**
  - ✅ Deletes source (cascade delete)
  - ✅ Returns 404 for non-existent source

- **POST /api/funding/sources/[id]/process**
  - ✅ Triggers processing for specific source
  - ✅ Handles processing errors

### Admin API Tests (`/api/admin`)

#### system-config.test.js
- **GET /api/admin/system-config/[key]**
  - ✅ Returns configuration value
  - ✅ Returns 404 for non-existent key
  - ✅ Handles database errors

- **PUT /api/admin/system-config/[key]**
  - ✅ Updates existing configuration
  - ✅ Creates new configuration if not exists
  - ✅ Handles partial updates
  - ✅ Supports complex JSON values
  - ✅ Logs changes for audit

- **DELETE /api/admin/system-config/[key]**
  - ✅ Deletes configuration
  - ✅ Logs deletion for audit
  - ✅ Handles database errors

#### runs.test.js (Mock Implementation)
- **GET /api/admin/runs**
  - ✅ Returns list of runs with pagination
  - ✅ Filters by status and source_id
  - ✅ Supports pagination

- **POST /api/admin/runs/start**
  - ✅ Starts new run for source
  - ✅ Validates required source_id
  - ⚠️ TODO: Prevent concurrent runs
  - ⚠️ TODO: Check source existence

- **PUT /api/admin/runs/[id]/stop**
  - ✅ Stops running process
  - ⚠️ TODO: Check run existence
  - ⚠️ TODO: Validate run status

- **DELETE /api/admin/runs/[id]**
  - ✅ Deletes run and related data
  - ⚠️ TODO: Cascade delete verification
  - ⚠️ TODO: Prevent deletion of in-progress runs

#### users.test.js (Mock Implementation)
- **GET /api/admin/users**
  - ✅ Returns user list with pagination
  - ✅ Filters by role and status
  - ✅ Searches by email

- **GET /api/admin/users/[id]**
  - ✅ Returns single user details
  - ⚠️ TODO: Handle non-existent user

- **PUT /api/admin/users/[id]**
  - ✅ Updates user details
  - ✅ Updates user role
  - ⚠️ TODO: Validate role assignments
  - ⚠️ TODO: Prevent self-demotion

- **DELETE /api/admin/users/[id]**
  - ✅ Deletes user
  - ⚠️ TODO: Prevent self-deletion
  - ⚠️ TODO: Cascade delete user data

#### audit.test.js (Mock Implementation)
- **GET /api/admin/audit**
  - ✅ Returns audit logs with filtering
  - ✅ Filters by action, user, resource
  - ✅ Supports date range filtering
  - ✅ Pagination support

- **POST /api/admin/audit**
  - ✅ Creates audit log entry
  - ✅ Validates required fields
  - ✅ Captures request metadata
  - ✅ Handles critical actions

- **GET /api/admin/audit/summary**
  - ✅ Returns audit summary by period
  - ✅ Supports different time periods
  - ✅ Includes action statistics

## Running Tests

### Run All API Tests
```bash
npm run test:api
```

### Run Specific Test Suite
```bash
npx jest --config jest.config.node.js __tests__/unit/api/funding/opportunities.test.js
```

### Run with Coverage
```bash
npx jest --config jest.config.node.js __tests__/unit/api --coverage
```

## Test Structure

Each test file follows this pattern:

```javascript
/**
 * @jest-environment node
 */

import { GET, POST, PUT, DELETE } from '@/app/api/[path]/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/supabase');

describe('API: /api/[endpoint]', () => {
  beforeEach(() => {
    // Setup mocks
  });

  describe('GET /api/[endpoint]', () => {
    it('should handle success case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Test implementation
    });
  });
});
```

## Mock Patterns

### Supabase Client Mock
```javascript
const mockSupabaseClient = {
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => mockSupabaseClient),
  // ... other methods
};
```

### NextRequest Mock
```javascript
const request = new NextRequest('http://localhost:3000/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' }),
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## TODO: Implementation Requirements

### Authentication & Authorization
- [ ] Implement JWT token validation
- [ ] Add admin role verification
- [ ] Session management checks
- [ ] Return proper 401/403 status codes

### Run Management Routes
- [ ] Implement actual `/api/admin/runs` endpoints
- [ ] Add run status tracking
- [ ] Implement concurrent run prevention
- [ ] Add processing metrics

### User Management Routes
- [ ] Implement actual `/api/admin/users` endpoints
- [ ] Add Supabase Auth integration
- [ ] Implement role management
- [ ] Add activity tracking

### Audit Logging Routes
- [ ] Implement actual `/api/admin/audit` endpoints
- [ ] Add automatic request metadata capture
- [ ] Implement audit log immutability
- [ ] Add compliance reporting

## Coverage Goals

- **Target Coverage**: 80% for all API routes
- **Current Coverage**: ~70% (87 passing tests)
- **TODO Tests**: 67 placeholder tests for future implementation

## Contributing

When adding new API routes:
1. Create corresponding test file in appropriate directory
2. Test all HTTP methods (GET, POST, PUT, DELETE)
3. Include error handling tests
4. Mock external dependencies
5. Update this README with test coverage

## Notes

- API tests use Node.js environment (`jest.config.node.js`)
- Component tests use jsdom environment (`jest.config.js`)
- Mock implementations serve as specifications for future development
- Tests include both implemented and TODO placeholders for complete coverage
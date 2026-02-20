# E2E Test Coverage Matrix

Living document tracking which endpoints and user flows have E2E test coverage.
Update the **Status** column as tests are written.

Status values: `needs-test` | `in-progress` | `covered` | `deferred`

---

## Tier 5: API E2E Tests (Vitest + fetch against localhost)

### Core User-Facing Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/funding` | GET | 200, paginated array, field types correct | | needs-test |
| `/api/funding` | GET+filters | status/state/projectType filters narrow results | | needs-test |
| `/api/counts` | GET | 200, has total/open/closing_soon as integers | | needs-test |
| `/api/deadlines` | GET | 200, sorted by date, days_left present | | needs-test |
| `/api/client-matching` | GET | 200, match objects with score field | | needs-test |
| `/api/client-matching/summary` | GET | 200, summary shape with counts | | needs-test |
| `/api/client-matching/top-matches` | GET | 200, ranked matches array | | needs-test |
| `/api/clients` | GET | 200, paginated client array | | needs-test |
| `/api/clients` | POST | 201, created client returned with id | | needs-test |
| `/api/clients/[id]` | GET | 200, single client object | | needs-test |
| `/api/clients/[id]` | PUT | 200, updated fields reflected | | needs-test |
| `/api/clients/[id]` | DELETE | 200/204, client removed | | needs-test |
| `/api/categories` | GET | 200, string array | | needs-test |
| `/api/project-types` | GET | 200, type objects array | | needs-test |
| `/api/funding/coverage-counts` | GET | 200, state count data | | needs-test |
| `/api/funding/total-available` | GET | 200, numeric total | | needs-test |
| `/api/export/client-matches-pdf` | GET | 200, application/pdf content-type | | needs-test |

### Map Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/map/funding-by-state` | GET | 200, state aggregation objects | | needs-test |
| `/api/map/scope-breakdown/[stateCode]` | GET | 200, scope counts (national/state/local) | | needs-test |
| `/api/map/opportunities/[stateCode]` | GET | 200, filtered opportunities array | | needs-test |
| `/api/map/opportunities` | GET | 200, all map opportunities | | needs-test |
| `/api/map/national` | GET | 200, national scope data | | needs-test |
| `/api/map/coverage-areas/[stateCode]` | GET | 200, coverage area objects | | needs-test |

### Admin Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/admin/review` | GET | 200, pending_review records array | | needs-test |
| `/api/admin/review/approve` | POST | 200, status updated to promoted | | needs-test |
| `/api/admin/review/reject` | POST | 200, status updated to rejected | | needs-test |
| `/api/admin/review/demote` | POST | 200, status downgraded | | needs-test |

### Error Handling

| Scenario | Assertions | Test File | Status |
|----------|------------|-----------|--------|
| GET invalid endpoint | 404 response | | needs-test |
| GET /api/clients/nonexistent-id | 404 or empty result | | needs-test |
| POST /api/clients with missing fields | 400 with error message | | needs-test |

---

## Tier 6: Browser E2E Tests (Playwright)

### Critical User Flows

| Flow | Steps | Assertions | Test File | Status | Priority |
|------|-------|------------|-----------|--------|----------|
| Dashboard loads | Navigate to `/` | Summary cards visible, numbers present | | needs-test | P0 |
| Explorer browse | Go to `/funding/opportunities`, see list | Opportunity cards rendered, count shown | | needs-test | P0 |
| Explorer filter | Apply status filter, apply state filter | Results narrow, count updates | | needs-test | P0 |
| Explorer paginate | Click next page | New results loaded, page indicator updates | | needs-test | P1 |
| Explorer search | Type in search box | Filtered results appear | | needs-test | P1 |
| Opportunity detail | Click opportunity from explorer | Detail page loads, tabs work | | needs-test | P1 |
| Map view | Navigate to `/map` | Map renders, states visible | | needs-test | P1 |
| Map drill-down | Click a state on map | Side panel shows state opportunities | | needs-test | P1 |
| Client list | Navigate to `/clients` | Client cards appear with match counts | | needs-test | P1 |
| Admin review | Navigate to `/admin/review` | Pending items listed | | needs-test | P1 |
| Admin approve | Click approve on pending item | Item removed from queue | | needs-test | P2 |
| Timeline view | Navigate to `/timeline` | Timeline events grouped by month | | needs-test | P2 |

### Smoke Tests (Highest Priority)

These are the minimum browser tests that should pass before any deploy:

| Page | What to verify | Priority |
|------|---------------|----------|
| `/` (Dashboard) | Page loads without JS errors, summary cards visible | P0 |
| `/funding/opportunities` (Explorer) | Page loads, at least one opportunity card rendered | P0 |
| `/map` | Page loads, map SVG rendered | P0 |
| `/clients` | Page loads, client cards or empty state shown | P0 |
| `/admin/review` | Page loads, table or empty state shown | P1 |

---

## Notes

- **Dev server required**: All e2e tests require `npm run dev` running on localhost:3000
- **Auth**: Automatically bypassed in development mode (middleware.js line 6)
- **API E2E tests** use Vitest + native `fetch` — files named `*.e2e.test.js`
- **Browser E2E tests** use Playwright (Chromium headless) — files named `*.spec.js`
- **Taskmaster**: Test writing tasks tracked under the `e2e` tag

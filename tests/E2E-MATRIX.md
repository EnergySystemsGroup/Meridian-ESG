# E2E Test Coverage Matrix

Living document tracking which endpoints and user flows have E2E test coverage.
Update the **Status** column as tests are written.

Status values: `needs-test` | `in-progress` | `covered` | `deferred`

---

## Tier 5: API E2E Tests (Vitest + fetch against localhost)

### Core User-Facing Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/funding` | GET | 200, paginated array, field types correct | `core.e2e.test.js` | covered |
| `/api/funding` | GET+filters | status/state/projectType filters narrow results | `core.e2e.test.js` | covered |
| `/api/counts` | GET | 200, has total/open/closing_soon as integers | `core.e2e.test.js` | covered |
| `/api/deadlines` | GET | 200, sorted by date, days_left present | `core.e2e.test.js` | covered |
| `/api/client-matching` | GET | 200, match objects with score field | `client-matching.e2e.test.js` | covered |
| `/api/client-matching/summary` | GET | 200, summary shape with counts | `client-matching.e2e.test.js` | covered |
| `/api/client-matching/top-matches` | GET | 200, ranked matches array | `client-matching.e2e.test.js` | covered |
| `/api/clients` | GET | 200, paginated client array | `clients.e2e.test.js` | covered |
| `/api/clients` | POST | 201, created client returned with id | `clients.e2e.test.js` | covered |
| `/api/clients/[id]` | GET | 200, single client object | `clients.e2e.test.js` | covered |
| `/api/clients/[id]` | PUT | 200, updated fields reflected | `clients.e2e.test.js` | covered |
| `/api/clients/[id]` | DELETE | 200/204, client removed | `clients.e2e.test.js` | covered |
| `/api/categories` | GET | 200, string array | `core.e2e.test.js` | covered |
| `/api/project-types` | GET | 200, type objects array | `core.e2e.test.js` | covered |
| `/api/funding/coverage-counts` | GET | 200, state count data | `core.e2e.test.js` | covered |
| `/api/funding/total-available` | GET | 200, numeric total | `core.e2e.test.js` | covered |
| `/api/export/client-matches-pdf` | POST | 400/404 validation, PDF content-type | `export.e2e.test.js` | covered |

### Map Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/map/funding-by-state` | GET | 200, state aggregation objects | `map.e2e.test.js` | covered |
| `/api/map/scope-breakdown/[stateCode]` | GET | 200, scope counts (national/state/local) | `map.e2e.test.js` | covered |
| `/api/map/opportunities/[stateCode]` | GET | 200, filtered opportunities array | `map.e2e.test.js` | covered |
| `/api/map/opportunities` | GET | 200, all map opportunities | `map.e2e.test.js` | covered |
| `/api/map/national` | GET | 200, national scope data | `map.e2e.test.js` | covered |
| `/api/map/coverage-areas/[stateCode]` | GET | 200, coverage area objects | `map.e2e.test.js` | covered |

### Admin Endpoints

| Endpoint | Method | Assertions | Test File | Status |
|----------|--------|------------|-----------|--------|
| `/api/admin/review` | GET | 200, pending_review records array | `admin-review.e2e.test.js` | covered |
| `/api/admin/review/approve` | POST | 200, status updated to promoted | `admin-review.e2e.test.js` | covered |
| `/api/admin/review/reject` | POST | 200, status updated to rejected | `admin-review.e2e.test.js` | covered |
| `/api/admin/review/demote` | POST | 200, status downgraded | `admin-review.e2e.test.js` | covered |

### Error Handling

| Scenario | Assertions | Test File | Status |
|----------|------------|-----------|--------|
| GET invalid endpoint | 404 response | `core.e2e.test.js` | covered |
| GET /api/clients/nonexistent-id | 404 or empty result | `clients.e2e.test.js` | covered |
| POST /api/clients with missing fields | 400 with error message | `clients.e2e.test.js` | covered |

---

## Tier 6: Browser E2E Tests (Playwright)

### Critical User Flows

| Flow | Steps | Assertions | Test File | Status | Priority |
|------|-------|------------|-----------|--------|----------|
| Dashboard loads | Navigate to `/` | Summary cards visible, numbers present | `smoke.spec.js` | covered | P0 |
| Explorer browse | Go to `/funding/opportunities`, see list | Opportunity cards rendered, count shown | `smoke.spec.js` | covered | P0 |
| Explorer filter | Apply status filter, apply state filter | Results narrow, count updates | `explorer.spec.js` | covered | P0 |
| Explorer paginate | Click next page | New results loaded, page indicator updates | `explorer.spec.js` | covered | P1 |
| Explorer search | Type in search box | Filtered results appear | `explorer.spec.js` | covered | P1 |
| Opportunity detail | Click opportunity from explorer | Detail page loads, tabs work | `opportunity-detail.spec.js` | covered | P1 |
| Map view | Navigate to `/map` | Map renders, states visible | `smoke.spec.js` | covered | P1 |
| Map drill-down | Click a state on map | Side panel shows state opportunities | `map-drilldown.spec.js` | covered | P1 |
| Client list | Navigate to `/clients` | Client cards appear with match counts | `client-matching.spec.js` | covered | P1 |
| Admin review | Navigate to `/admin/review` | Pending items listed | `smoke.spec.js` | covered | P1 |
| Admin approve | Click approve on pending item | Item removed from queue | `admin-review.spec.js` | covered | P2 |
| Timeline view | Navigate to `/timeline` | Timeline events grouped by month | `timeline.spec.js` | covered | P2 |

### Smoke Tests (Highest Priority)

These are the minimum browser tests that should pass before any deploy:

| Page | What to verify | Test File | Priority |
|------|---------------|-----------|----------|
| `/` (Dashboard) | Page loads without JS errors, summary cards visible | `smoke.spec.js` | P0 |
| `/funding/opportunities` (Explorer) | Page loads, at least one opportunity card rendered | `smoke.spec.js` | P0 |
| `/map` | Page loads, map SVG rendered | `smoke.spec.js` | P0 |
| `/clients` | Page loads, client cards or empty state shown | `smoke.spec.js` | P0 |
| `/admin/review` | Page loads, table or empty state shown | `smoke.spec.js` | P1 |

---

## Notes

- **Dev server required**: All e2e tests require `npm run dev` running on localhost:3000
- **Auth**: Automatically bypassed in development mode (middleware.js line 6)
- **API E2E tests** use Vitest + native `fetch` — files named `*.e2e.test.js`
- **Browser E2E tests** use Playwright (Chromium headless) — files named `*.spec.js`
- **Taskmaster**: Test writing tasks tracked under the `e2e` tag

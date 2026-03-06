/**
 * Shared fetch functions for all API routes.
 * Each function wraps an endpoint and returns parsed JSON.
 * Used with TanStack Query's queryFn and mutationFn options.
 */

function toParams(obj) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(obj)) {
		if (value == null || value === '') continue;
		if (Array.isArray(value)) {
			params.set(key, value.join(','));
		} else {
			params.set(key, String(value));
		}
	}
	return params;
}

async function get(url) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`${res.status} ${res.statusText}: ${url}`);
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

export async function fetchFunding(filters = {}) {
	const params = toParams(filters);
	return get(`/api/funding?${params}`);
}

export async function fetchFundingDetail(id) {
	const res = await fetch('/api/funding', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id }),
	});
	if (!res.ok) throw new Error(`Failed to fetch funding detail: ${id}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error || 'Failed to fetch funding detail');
	return json.data;
}

export async function fetchFundingSources(filters = {}) {
	const params = toParams(filters);
	return get(`/api/funding/sources?${params}`);
}

export async function fetchFundingSourceDetail(id) {
	return get(`/api/funding/sources/${id}`);
}

export async function fetchFundingProjectTypeSummary(filters = {}) {
	const params = toParams(filters);
	return get(`/api/funding/project-type-summary?${params}`);
}

export async function fetchFundingCoverageCounts(filters = {}) {
	const params = toParams(filters);
	return get(`/api/funding/coverage-counts?${params}`);
}

export async function fetchFundingTotalAvailable() {
	return get('/api/funding/total-available');
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function fetchCategories() {
	return get('/api/categories');
}

// ---------------------------------------------------------------------------
// Project Types
// ---------------------------------------------------------------------------

export async function fetchProjectTypes(filters = {}) {
	const params = toParams(filters);
	return get(`/api/project-types?${params}`);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function fetchCounts(type) {
	const params = toParams({ type });
	return get(`/api/counts?${params}`);
}

export async function fetchDeadlines({ type = 'upcoming', limit } = {}) {
	const params = toParams({ type, limit });
	return get(`/api/deadlines?${params}`);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function fetchClients() {
	return get('/api/clients');
}

export async function fetchClientDetail(id) {
	return get(`/api/clients/${id}`);
}

export async function fetchClientHiddenMatches(id) {
	return get(`/api/clients/${id}/hidden-matches`);
}

// ---------------------------------------------------------------------------
// Client Matching
// ---------------------------------------------------------------------------

export async function fetchClientMatching(clientId) {
	const params = clientId ? toParams({ clientId }) : new URLSearchParams();
	return get(`/api/client-matching?${params}`);
}

export async function fetchClientMatchingSummary() {
	return get('/api/client-matching/summary');
}

export async function fetchClientMatchingTopMatches() {
	return get('/api/client-matching/top-matches');
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

export async function fetchMapFundingByState(filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/funding-by-state?${params}`);
}

export async function fetchMapNational(filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/national?${params}`);
}

export async function fetchMapOpportunities(filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/opportunities?${params}`);
}

export async function fetchMapOpportunitiesByState(stateCode, filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/opportunities/${stateCode}?${params}`);
}

export async function fetchMapCoverageAreas(stateCode, filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/coverage-areas/${stateCode}?${params}`);
}

export async function fetchMapOpportunitiesByArea(areaId, filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/opportunities-by-area/${areaId}?${params}`);
}

export async function fetchMapScopeBreakdown(stateCode, filters = {}) {
	const params = toParams(filters);
	return get(`/api/map/scope-breakdown/${stateCode}?${params}`);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function fetchAdminReview(filters = {}) {
	const params = toParams(filters);
	return get(`/api/admin/review?${params}`);
}

export async function fetchAdminSystemConfig(key) {
	return get(`/api/admin/system-config/${key}`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchUsers() {
	return get('/api/users');
}

async function post(url, body) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`${res.status} ${res.statusText}: ${url}`);
	}
	return res.json();
}

export async function postAdminApprove({ ids, reviewed_by }) {
	return post('/api/admin/review/approve', { ids, reviewed_by });
}

export async function postAdminReject({ ids, reviewed_by, review_notes }) {
	return post('/api/admin/review/reject', { ids, reviewed_by, review_notes });
}

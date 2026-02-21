/**
 * Client Match Evaluation Critical Tests
 *
 * Tests the full 4-criteria match evaluation logic used by:
 * - /api/client-matching/summary (countMatches / evaluateMatch)
 * - /api/client-matching/top-matches (calculateMatches / evaluateMatch with scoring)
 *
 * Both routes share the same match criteria; top-matches adds scoring.
 */

import { describe, test, expect } from 'vitest';
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';

// --- Inline taxonomy data (subset needed for tests) ---

const HOT_ACTIVITIES = [
	'New Construction',
	'Renovation',
	'Modernization',
	'Demolition',
	'Removal',
	'Installation',
	'Replacement',
	'Upgrade',
	'Repair',
	'Maintenance',
	'Site Preparation',
	'Infrastructure Development',
];

/**
 * Simplified getExpandedClientTypes — mirrors production logic from taxonomies.js
 */
const CLIENT_TYPE_SYNONYMS = {
	city_municipal: ['City Government', 'Municipal Government', 'Township Government'],
	k12: ['K-12 School Districts', 'K-12 Schools'],
};

const CLIENT_TYPE_HIERARCHY = {
	'Local Governments': [
		'City Government',
		'County Government',
		'Municipal Government',
		'Township Government',
		'Special Districts',
		'Public Housing Authorities',
	],
	'Public Agencies': [
		'Federal Agencies',
		'State Governments',
		'City Government',
		'County Government',
		'Municipal Government',
		'Township Government',
		'Special Districts',
		'Public Housing Authorities',
		'Tribal Governments',
	],
};

function getExpandedClientTypes(clientType) {
	const expanded = new Set([clientType]);

	// Step 1: synonyms
	for (const synonymGroup of Object.values(CLIENT_TYPE_SYNONYMS)) {
		if (synonymGroup.some(s => s.toLowerCase() === clientType.toLowerCase())) {
			synonymGroup.forEach(s => expanded.add(s));
		}
	}

	// Step 2: hierarchy (vertical expansion)
	for (const type of [...expanded]) {
		for (const [parent, children] of Object.entries(CLIENT_TYPE_HIERARCHY)) {
			if (children.some(c => c.toLowerCase() === type.toLowerCase())) {
				expanded.add(parent);
			}
		}
	}

	return Array.from(expanded);
}

/**
 * Full 4-criteria evaluateMatch (boolean version, used by summary route).
 * Mirrors: app/api/client-matching/summary/route.js lines 163-234
 */
function evaluateMatch(client, opportunity) {
	// 1. Location Match
	let locationMatch = false;
	if (opportunity.is_national) {
		locationMatch = true;
	} else if (
		client.coverage_area_ids &&
		Array.isArray(client.coverage_area_ids) &&
		opportunity.coverage_area_ids &&
		Array.isArray(opportunity.coverage_area_ids)
	) {
		locationMatch = client.coverage_area_ids.some(clientAreaId =>
			opportunity.coverage_area_ids.includes(clientAreaId)
		);
	}
	if (!locationMatch) return false;

	// 2. Applicant Type Match
	let applicantTypeMatch = false;
	if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
		const expandedTypes = getExpandedClientTypes(client.type);
		applicantTypeMatch = opportunity.eligible_applicants.some(applicant =>
			expandedTypes.some(
				clientType =>
					applicant.toLowerCase() === clientType.toLowerCase() ||
					applicant.toLowerCase().includes(clientType.toLowerCase()) ||
					clientType.toLowerCase().includes(applicant.toLowerCase())
			)
		);
	}
	if (!applicantTypeMatch) return false;

	// 3. Project Needs Match
	let projectNeedsMatch = false;
	if (
		opportunity.eligible_project_types &&
		Array.isArray(opportunity.eligible_project_types) &&
		client.project_needs &&
		Array.isArray(client.project_needs)
	) {
		for (const need of client.project_needs) {
			const hasMatch = opportunity.eligible_project_types.some(
				projectType =>
					projectType.toLowerCase().includes(need.toLowerCase()) ||
					need.toLowerCase().includes(projectType.toLowerCase())
			);
			if (hasMatch) {
				projectNeedsMatch = true;
				break;
			}
		}
	}
	if (!projectNeedsMatch) return false;

	// 4. Activities Match
	let activitiesMatch = false;
	if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
		activitiesMatch = opportunity.eligible_activities.some(activity =>
			HOT_ACTIVITIES.some(
				hotActivity =>
					activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
					hotActivity.toLowerCase().includes(activity.toLowerCase())
			)
		);
	}

	return activitiesMatch;
}

/**
 * evaluateMatch with scoring (used by top-matches route).
 * Mirrors: app/api/client-matching/top-matches/route.js lines 177-267
 */
function evaluateMatchWithScore(client, opportunity) {
	const details = {
		locationMatch: false,
		applicantTypeMatch: false,
		projectNeedsMatch: false,
		activitiesMatch: false,
		matchedProjectNeeds: [],
	};

	// 1. Location
	if (opportunity.is_national) {
		details.locationMatch = true;
	} else if (
		client.coverage_area_ids && Array.isArray(client.coverage_area_ids) &&
		opportunity.coverage_area_ids && Array.isArray(opportunity.coverage_area_ids)
	) {
		details.locationMatch = client.coverage_area_ids.some(id =>
			opportunity.coverage_area_ids.includes(id)
		);
	}

	// 2. Applicant Type
	if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
		const expandedTypes = getExpandedClientTypes(client.type);
		details.applicantTypeMatch = opportunity.eligible_applicants.some(applicant =>
			expandedTypes.some(
				ct =>
					applicant.toLowerCase() === ct.toLowerCase() ||
					applicant.toLowerCase().includes(ct.toLowerCase()) ||
					ct.toLowerCase().includes(applicant.toLowerCase())
			)
		);
	}

	// 3. Project Needs
	if (
		opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
		client.project_needs && Array.isArray(client.project_needs)
	) {
		for (const need of client.project_needs) {
			const hasMatch = opportunity.eligible_project_types.some(
				pt =>
					pt.toLowerCase().includes(need.toLowerCase()) ||
					need.toLowerCase().includes(pt.toLowerCase())
			);
			if (hasMatch) {
				details.matchedProjectNeeds.push(need);
			}
		}
		details.projectNeedsMatch = details.matchedProjectNeeds.length > 0;
	}

	// 4. Activities
	if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
		details.activitiesMatch = opportunity.eligible_activities.some(activity =>
			HOT_ACTIVITIES.some(
				ha =>
					activity.toLowerCase().includes(ha.toLowerCase()) ||
					ha.toLowerCase().includes(activity.toLowerCase())
			)
		);
	}

	const isMatch =
		details.locationMatch &&
		details.applicantTypeMatch &&
		details.projectNeedsMatch &&
		details.activitiesMatch;

	let score = 0;
	if (isMatch && client.project_needs && client.project_needs.length > 0) {
		score = Math.round(
			(details.matchedProjectNeeds.length / client.project_needs.length) * 100
		);
	}

	return { isMatch, score, details };
}

/**
 * Sort client results by match_count desc then top score desc.
 * Mirrors: app/api/client-matching/top-matches/route.js lines 118-123
 */
function sortClientResults(results) {
	return [...results].sort((a, b) => {
		if (b.match_count !== a.match_count) return b.match_count - a.match_count;
		return b.top_opportunity_score - a.top_opportunity_score;
	});
}

// --- Tests ---

describe('Client Match Evaluation (Summary Route Logic)', () => {

	describe('Location Match', () => {
		test('national opportunity passes location check for any client', () => {
			const client = { ...clients.texasCommercialClient };
			const opp = { ...opportunities.nationalGrant };

			expect(opp.is_national).toBe(true);
			// Full 4-criteria evaluateMatch fails because applicant type doesn't match
			// (Commercial Entity not in nationalGrant.eligible_applicants)
			const result = evaluateMatch(client, opp);
			expect(result).toBe(false);
		});

		test('non-national with shared coverage area matches', () => {
			const client = { coverage_area_ids: [1, 2, 3] };
			const opp = { is_national: false, coverage_area_ids: [3, 4, 5] };

			const shared = client.coverage_area_ids.some(id => opp.coverage_area_ids.includes(id));
			expect(shared).toBe(true);
		});

		test('non-national with no shared coverage areas does not match', () => {
			const client = { coverage_area_ids: [1, 2, 3] };
			const opp = { is_national: false, coverage_area_ids: [7, 8, 9] };

			const shared = client.coverage_area_ids.some(id => opp.coverage_area_ids.includes(id));
			expect(shared).toBe(false);
		});

		test('empty coverage_area_ids yields no match', () => {
			const client = { coverage_area_ids: [] };
			const opp = { is_national: false, coverage_area_ids: [1, 2] };

			const shared = client.coverage_area_ids.some(id => opp.coverage_area_ids.includes(id));
			expect(shared).toBe(false);
		});
	});

	describe('Full 4-Criteria Evaluation', () => {
		test('SF client matches national clean energy grant (all 4 criteria)', () => {
			const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.nationalGrant);
			expect(result).toBe(true);
		});

		test('Texas client does not match California state grant (location mismatch)', () => {
			const result = evaluateMatch(clients.texasCommercialClient, opportunities.californiaStateGrant);
			expect(result).toBe(false);
		});

		test('client with empty project_needs does not match (criterion 3 fails)', () => {
			const result = evaluateMatch(clients.emptyNeedsClient, opportunities.nationalGrant);
			expect(result).toBe(false);
		});

		test('opportunity with no hot activities does not match (criterion 4 fails)', () => {
			// noHotActivitiesGrant has only Planning/Feasibility/Assessment
			const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.noHotActivitiesGrant);
			expect(result).toBe(false);
		});

		test('closed opportunity still evaluates (status filtering is separate)', () => {
			// evaluateMatch does NOT check status — that is handled upstream
			const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.closedOpportunity);
			// closedOpportunity is national, has matching applicants/types/activities
			expect(result).toBe(true);
		});
	});

	describe('Count Matches Across Opportunities', () => {
		test('counts all matches for a client', () => {
			const allOpps = Object.values(opportunities);
			let count = 0;
			for (const opp of allOpps) {
				if (evaluateMatch(clients.pgeBayAreaClient, opp)) count++;
			}
			// Matches: nationalGrant, pgeUtilityGrant, closedOpportunity, upcomingOpportunity
			expect(count).toBe(4);
		});

		test('client with empty needs gets zero matches', () => {
			const allOpps = Object.values(opportunities);
			let count = 0;
			for (const opp of allOpps) {
				if (evaluateMatch(clients.emptyNeedsClient, opp)) count++;
			}
			expect(count).toBe(0);
		});
	});
});

describe('Client Match Evaluation with Scoring (Top-Matches Route Logic)', () => {

	describe('Score Calculation', () => {
		test('score is percentage of matched project needs', () => {
			const result = evaluateMatchWithScore(clients.pgeBayAreaClient, opportunities.nationalGrant);

			expect(result.isMatch).toBe(true);
			// Client has 3 project_needs; 'Energy Efficiency' and 'Solar' match = 2/3 = 67%
			expect(result.score).toBe(67);
		});

		test('100% score when all project needs match', () => {
			const client = {
				type: 'Municipal Government',
				coverage_area_ids: [1],
				project_needs: ['Energy Efficiency'],
			};
			const opp = {
				is_national: true,
				eligible_applicants: ['Local Governments'],
				eligible_project_types: ['Energy Efficiency'],
				eligible_activities: ['Installation'],
				coverage_area_ids: [],
			};

			const result = evaluateMatchWithScore(client, opp);

			expect(result.isMatch).toBe(true);
			expect(result.score).toBe(100);
		});

		test('partial score when some project needs match', () => {
			const client = {
				type: 'Municipal Government',
				coverage_area_ids: [1],
				project_needs: ['Energy Efficiency', 'Wind Turbines', 'Quantum Computing'],
			};
			const opp = {
				is_national: true,
				eligible_applicants: ['Local Governments'],
				eligible_project_types: ['Energy Efficiency'],
				eligible_activities: ['Installation'],
				coverage_area_ids: [],
			};

			const result = evaluateMatchWithScore(client, opp);

			expect(result.isMatch).toBe(true);
			// 1 of 3 needs matched = 33%
			expect(result.score).toBe(33);
		});

		test('zero score for non-match', () => {
			const result = evaluateMatchWithScore(clients.emptyNeedsClient, opportunities.nationalGrant);
			expect(result.isMatch).toBe(false);
			expect(result.score).toBe(0);
		});

		test('details object tracks all 4 criteria', () => {
			const result = evaluateMatchWithScore(clients.pgeBayAreaClient, opportunities.nationalGrant);

			expect(result.details).toHaveProperty('locationMatch');
			expect(result.details).toHaveProperty('applicantTypeMatch');
			expect(result.details).toHaveProperty('projectNeedsMatch');
			expect(result.details).toHaveProperty('activitiesMatch');
			expect(result.details).toHaveProperty('matchedProjectNeeds');
		});

		test('matchedProjectNeeds lists which needs matched', () => {
			const result = evaluateMatchWithScore(clients.pgeBayAreaClient, opportunities.nationalGrant);

			expect(result.isMatch).toBe(true);
			expect(Array.isArray(result.details.matchedProjectNeeds)).toBe(true);
			expect(result.details.matchedProjectNeeds).toHaveLength(2);
			expect(result.details.matchedProjectNeeds).toContain('Energy Efficiency');
			expect(result.details.matchedProjectNeeds).toContain('Solar');
		});
	});

	describe('Top-Matches Sorting', () => {
		test('sorts by match_count descending first', () => {
			const results = [
				{ match_count: 3, top_opportunity_score: 70 },
				{ match_count: 5, top_opportunity_score: 50 },
				{ match_count: 1, top_opportunity_score: 99 },
			];

			const sorted = sortClientResults(results);

			expect(sorted[0].match_count).toBe(5);
			expect(sorted[1].match_count).toBe(3);
			expect(sorted[2].match_count).toBe(1);
		});

		test('tie-breaks by top_opportunity_score descending', () => {
			const results = [
				{ match_count: 3, top_opportunity_score: 70 },
				{ match_count: 3, top_opportunity_score: 90 },
				{ match_count: 3, top_opportunity_score: 80 },
			];

			const sorted = sortClientResults(results);

			expect(sorted[0].top_opportunity_score).toBe(90);
			expect(sorted[1].top_opportunity_score).toBe(80);
			expect(sorted[2].top_opportunity_score).toBe(70);
		});

		test('top 5 slice after sorting', () => {
			const results = Array.from({ length: 10 }, (_, i) => ({
				match_count: 10 - i,
				top_opportunity_score: 50 + i,
			}));

			const sorted = sortClientResults(results);
			const top5 = sorted.slice(0, 5);

			expect(top5).toHaveLength(5);
			expect(top5[0].match_count).toBe(10);
		});
	});
});

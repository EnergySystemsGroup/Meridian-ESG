/**
 * fetchFundingDetail — Envelope Unwrapping Tests
 *
 * Tests the response-handling logic using an inline replica per project test standards.
 * Validates: HTTP error throws, success-flag checking, data unwrapping.
 */

import { describe, test, expect } from 'vitest';

// --- Inline replica of fetchFundingDetail response handling ---
// Mirrors lib/queries/api.js — the fetch/network layer is not testable inline,
// so we test the response-processing logic that runs after fetch returns.

/**
 * Processes a fetch Response the same way fetchFundingDetail does.
 * @param {{ ok: boolean, status: number, statusText: string, json: () => Promise<any> }} res
 * @param {string} id - opportunity ID (for error messages)
 * @returns {Promise<any>} unwrapped opportunity data
 */
async function processFundingDetailResponse(res, id) {
	if (!res.ok) throw new Error(`Failed to fetch funding detail: ${id}`);
	const json = await res.json();
	if (!json.success)
		throw new Error(json.error || 'Failed to fetch funding detail');
	return json.data;
}

// --- Helper to create mock Response objects ---

function mockResponse(status, body, statusText = 'OK') {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		json: async () => body,
	};
}

// ---------------------------------------------------------------------------

describe('fetchFundingDetail response processing', () => {
	const TEST_ID = '87480c18-2fcf-4530-a669-5e2afcf9622a';

	describe('HTTP error handling', () => {
		test('throws on 404 response', async () => {
			const res = mockResponse(404, null, 'Not Found');
			await expect(
				processFundingDetailResponse(res, TEST_ID)
			).rejects.toThrow(`Failed to fetch funding detail: ${TEST_ID}`);
		});

		test('throws on 500 response', async () => {
			const res = mockResponse(500, null, 'Internal Server Error');
			await expect(
				processFundingDetailResponse(res, TEST_ID)
			).rejects.toThrow(`Failed to fetch funding detail: ${TEST_ID}`);
		});
	});

	describe('success flag checking', () => {
		test('throws with server error message when success is false', async () => {
			const res = mockResponse(200, {
				success: false,
				error: 'Opportunity not found in database',
			});
			await expect(
				processFundingDetailResponse(res, TEST_ID)
			).rejects.toThrow('Opportunity not found in database');
		});

		test('throws with fallback message when success is false and no error field', async () => {
			const res = mockResponse(200, { success: false });
			await expect(
				processFundingDetailResponse(res, TEST_ID)
			).rejects.toThrow('Failed to fetch funding detail');
		});
	});

	describe('data unwrapping', () => {
		test('returns data field from successful response', async () => {
			const opportunity = {
				id: TEST_ID,
				title: 'Test Opportunity',
				close_date: '2026-12-31',
			};
			const res = mockResponse(200, { success: true, data: opportunity });
			const result = await processFundingDetailResponse(res, TEST_ID);
			expect(result).toEqual(opportunity);
		});

		test('returns null when success is true but data is null', async () => {
			const res = mockResponse(200, { success: true, data: null });
			const result = await processFundingDetailResponse(res, TEST_ID);
			expect(result).toBeNull();
		});
	});
});

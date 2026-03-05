import { describe, test, expect } from 'vitest';

/**
 * Inline function replicating the tab filtering logic from
 * app/funding/opportunities/[id]/page.jsx.
 * Must be kept in sync with the production ternary.
 */
function getVisibleTabs(isAdmin) {
	return isAdmin
		? ['overview', 'eligibility', 'relevance', 'admin']
		: ['overview', 'eligibility'];
}

describe('Opportunity detail tab gating', () => {
	test('admin users see all 4 tabs', () => {
		const tabs = getVisibleTabs(true);
		expect(tabs).toEqual(['overview', 'eligibility', 'relevance', 'admin']);
		expect(tabs).toHaveLength(4);
	});

	test('non-admin users see only Overview and Eligibility', () => {
		const tabs = getVisibleTabs(false);
		expect(tabs).toEqual(['overview', 'eligibility']);
		expect(tabs).toHaveLength(2);
	});

	test('non-admin tabs do not include relevance', () => {
		const tabs = getVisibleTabs(false);
		expect(tabs).not.toContain('relevance');
	});

	test('non-admin tabs do not include admin', () => {
		const tabs = getVisibleTabs(false);
		expect(tabs).not.toContain('admin');
	});
});

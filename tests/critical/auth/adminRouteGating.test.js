import { describe, test, expect } from 'vitest';

/**
 * Inline function replicating middleware admin route gating logic from middleware.js.
 * Returns true if the request should be blocked (non-admin accessing /admin/* path).
 * Must be kept in sync with the middleware admin check.
 */
function shouldBlockAdminRoute(pathname, userRole) {
	if (!pathname.startsWith('/admin')) {
		return false;
	}
	return userRole !== 'admin';
}

/**
 * Inline function replicating nav visibility logic from components/layout/main-layout.jsx.
 * Returns true if admin nav items should be shown.
 */
function shouldShowAdminNav(isAdmin) {
	return !!isAdmin;
}

describe('admin route gating (middleware)', () => {
	describe('admin paths', () => {
		test('blocks non-admin on /admin', () => {
			expect(shouldBlockAdminRoute('/admin', undefined)).toBe(true);
			expect(shouldBlockAdminRoute('/admin', null)).toBe(true);
			expect(shouldBlockAdminRoute('/admin', 'viewer')).toBe(true);
		});

		test('blocks non-admin on /admin/review', () => {
			expect(shouldBlockAdminRoute('/admin/review', 'viewer')).toBe(true);
		});

		test('blocks non-admin on nested admin paths', () => {
			expect(shouldBlockAdminRoute('/admin/funding-sources', undefined)).toBe(true);
			expect(shouldBlockAdminRoute('/admin/funding-sources/123', 'viewer')).toBe(true);
			expect(shouldBlockAdminRoute('/admin/funding/verify', null)).toBe(true);
			expect(shouldBlockAdminRoute('/admin/debug', 'authenticated')).toBe(true);
		});

		test('allows admin on all admin paths', () => {
			expect(shouldBlockAdminRoute('/admin', 'admin')).toBe(false);
			expect(shouldBlockAdminRoute('/admin/review', 'admin')).toBe(false);
			expect(shouldBlockAdminRoute('/admin/funding-sources', 'admin')).toBe(false);
			expect(shouldBlockAdminRoute('/admin/funding-sources/123/edit', 'admin')).toBe(false);
			expect(shouldBlockAdminRoute('/admin/debug', 'admin')).toBe(false);
		});
	});

	describe('non-admin paths are unaffected', () => {
		test('does not block any role on regular paths', () => {
			expect(shouldBlockAdminRoute('/', undefined)).toBe(false);
			expect(shouldBlockAdminRoute('/dashboard', 'viewer')).toBe(false);
			expect(shouldBlockAdminRoute('/funding/opportunities', null)).toBe(false);
			expect(shouldBlockAdminRoute('/clients', 'admin')).toBe(false);
			expect(shouldBlockAdminRoute('/map', 'authenticated')).toBe(false);
		});

		test('does not block non-admin paths with "admin" elsewhere in URL', () => {
			expect(shouldBlockAdminRoute('/settings/admin-panel', undefined)).toBe(false);
			expect(shouldBlockAdminRoute('/users/admin-config', 'viewer')).toBe(false);
		});
	});
});

describe('admin nav visibility', () => {
	test('shows admin nav for admin users', () => {
		expect(shouldShowAdminNav(true)).toBe(true);
	});

	test('hides admin nav for non-admin users', () => {
		expect(shouldShowAdminNav(false)).toBe(false);
	});

	test('hides admin nav for undefined/null', () => {
		expect(shouldShowAdminNav(undefined)).toBe(false);
		expect(shouldShowAdminNav(null)).toBe(false);
	});
});

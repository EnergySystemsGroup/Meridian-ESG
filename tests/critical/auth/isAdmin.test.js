import { describe, test, expect } from 'vitest';

/**
 * Inline function replicating isAdmin logic from contexts/AuthContext.js.
 * Must be kept in sync with the production derivation.
 */
function getIsAdmin(user, isDev = false, devAdminEnv = '') {
	if (isDev && devAdminEnv === 'true') {
		return true;
	}
	return user?.app_metadata?.role === 'admin';
}

/**
 * Inline function replicating role extraction from:
 * - utils/supabase/api.js requireRole()
 * - utils/supabase/middleware.js enforceRBAC()
 * Must be kept in sync with both files.
 */
function extractUserRole(user) {
	return (
		user?.app_metadata?.role ||
		user?.user_metadata?.role ||
		user?.role ||
		null
	);
}

describe('isAdmin derivation', () => {
	describe('production mode (isDev=false)', () => {
		test('returns true when app_metadata.role is admin', () => {
			const user = { app_metadata: { role: 'admin' } };
			expect(getIsAdmin(user, false)).toBe(true);
		});

		test('returns false when app_metadata.role is missing', () => {
			const user = { app_metadata: {} };
			expect(getIsAdmin(user, false)).toBe(false);
		});

		test('returns false when app_metadata is missing entirely', () => {
			const user = {};
			expect(getIsAdmin(user, false)).toBe(false);
		});

		test('returns false when user is null', () => {
			expect(getIsAdmin(null, false)).toBe(false);
		});

		test('returns false when user is undefined', () => {
			expect(getIsAdmin(undefined, false)).toBe(false);
		});

		test('returns false for non-admin role', () => {
			const user = { app_metadata: { role: 'viewer' } };
			expect(getIsAdmin(user, false)).toBe(false);
		});

		test('ignores NEXT_PUBLIC_DEV_ADMIN in production', () => {
			const user = { app_metadata: {} };
			expect(getIsAdmin(user, false, 'true')).toBe(false);
		});
	});

	describe('development mode (isDev=true)', () => {
		test('returns true when DEV_ADMIN is "true" regardless of user', () => {
			expect(getIsAdmin(null, true, 'true')).toBe(true);
			expect(getIsAdmin({}, true, 'true')).toBe(true);
			expect(getIsAdmin({ app_metadata: {} }, true, 'true')).toBe(true);
		});

		test('falls back to app_metadata when DEV_ADMIN is not "true"', () => {
			const adminUser = { app_metadata: { role: 'admin' } };
			const normalUser = { app_metadata: {} };
			expect(getIsAdmin(adminUser, true, 'false')).toBe(true);
			expect(getIsAdmin(normalUser, true, 'false')).toBe(false);
			expect(getIsAdmin(normalUser, true, '')).toBe(false);
			expect(getIsAdmin(normalUser, true, undefined)).toBe(false);
		});
	});
});

describe('extractUserRole (requireRole / enforceRBAC)', () => {
	test('prefers app_metadata.role', () => {
		const user = {
			app_metadata: { role: 'admin' },
			user_metadata: { role: 'viewer' },
			role: 'anon',
		};
		expect(extractUserRole(user)).toBe('admin');
	});

	test('falls back to user_metadata.role when app_metadata has no role', () => {
		const user = {
			app_metadata: {},
			user_metadata: { role: 'viewer' },
			role: 'anon',
		};
		expect(extractUserRole(user)).toBe('viewer');
	});

	test('falls back to user.role when no metadata has role', () => {
		const user = {
			app_metadata: {},
			user_metadata: {},
			role: 'authenticated',
		};
		expect(extractUserRole(user)).toBe('authenticated');
	});

	test('returns null when no role anywhere', () => {
		const user = { app_metadata: {}, user_metadata: {} };
		expect(extractUserRole(user)).toBeNull();
	});

	test('returns null for null user', () => {
		expect(extractUserRole(null)).toBeNull();
	});
});

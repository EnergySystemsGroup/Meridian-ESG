/**
 * E2E Auth Helpers
 *
 * Authentication is automatically bypassed in development mode.
 * See middleware.js line 6:
 *
 *   if (process.env.NODE_ENV === 'development') return NextResponse.next()
 *
 * This means:
 * - API e2e tests: No auth headers/cookies needed when hitting localhost via npm run dev
 * - Browser e2e tests: Playwright hits localhost directly, no login flow required
 *
 * If auth bypass needs to change in the future (e.g., testing authenticated vs.
 * unauthenticated behavior), add a NEXT_PUBLIC_TEST_MODE env var here.
 */

/**
 * Returns default headers for API e2e fetch calls.
 * Currently minimal since auth is bypassed in dev mode.
 */
export function getHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

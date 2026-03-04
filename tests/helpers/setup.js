/**
 * Vitest Global Setup
 *
 * This file runs before all tests to set up the testing environment.
 */

import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

// Global test utilities
global.testUtils = {
  /**
   * Freeze time for deterministic date testing
   * @param {string|Date} date - Date to freeze to
   */
  freezeTime: (date) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(date));
  },

  /**
   * Restore real time
   */
  restoreTime: () => {
    vi.useRealTimers();
  },

  /**
   * Create a date relative to "now" for testing
   * @param {number} daysOffset - Days from frozen "now"
   */
  daysFromNow: (daysOffset) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString();
  },
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

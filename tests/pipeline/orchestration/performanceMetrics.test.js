/**
 * Pipeline: Performance Metrics Tests
 *
 * Tests token usage tracking and timing metrics:
 * - Token counting
 * - Cost estimation
 * - Timing aggregation
 * - Rate limit tracking
 */

import { describe, test, expect } from 'vitest';

/**
 * Track token usage across API calls
 */
class TokenTracker {
  constructor() {
    this.calls = [];
  }

  recordCall(inputTokens, outputTokens, model = 'claude-sonnet') {
    this.calls.push({
      inputTokens,
      outputTokens,
      model,
      timestamp: Date.now(),
    });
  }

  getTotalTokens() {
    return this.calls.reduce((sum, call) =>
      sum + call.inputTokens + call.outputTokens, 0
    );
  }

  getInputTokens() {
    return this.calls.reduce((sum, call) => sum + call.inputTokens, 0);
  }

  getOutputTokens() {
    return this.calls.reduce((sum, call) => sum + call.outputTokens, 0);
  }

  getCallCount() {
    return this.calls.length;
  }

  getAverageTokensPerCall() {
    if (this.calls.length === 0) return 0;
    return Math.round(this.getTotalTokens() / this.calls.length);
  }
}

/**
 * Estimate cost based on token usage
 * Rates per 1M tokens (approximate)
 */
function estimateCost(inputTokens, outputTokens, model = 'claude-sonnet') {
  const rates = {
    'claude-sonnet': { input: 3.0, output: 15.0 },
    'claude-haiku': { input: 0.25, output: 1.25 },
    'claude-opus': { input: 15.0, output: 75.0 },
  };

  const rate = rates[model] || rates['claude-sonnet'];

  const inputCost = (inputTokens / 1000000) * rate.input;
  const outputCost = (outputTokens / 1000000) * rate.output;

  return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
}

/**
 * Track timing for pipeline stages
 */
class TimingTracker {
  constructor() {
    this.timings = {};
  }

  start(label) {
    this.timings[label] = { start: Date.now(), end: null, duration: null };
  }

  end(label) {
    if (this.timings[label]) {
      this.timings[label].end = Date.now();
      this.timings[label].duration = this.timings[label].end - this.timings[label].start;
    }
  }

  getDuration(label) {
    return this.timings[label]?.duration || null;
  }

  getTotalDuration() {
    return Object.values(this.timings)
      .reduce((sum, t) => sum + (t.duration || 0), 0);
  }

  getSummary() {
    const summary = {};
    for (const [label, timing] of Object.entries(this.timings)) {
      summary[label] = timing.duration;
    }
    return summary;
  }
}

describe('Performance Metrics', () => {

  describe('Token Tracking', () => {
    test('tracks cumulative tokens', () => {
      const tracker = new TokenTracker();
      tracker.recordCall(1000, 500);
      tracker.recordCall(800, 400);

      expect(tracker.getTotalTokens()).toBe(2700);
      expect(tracker.getInputTokens()).toBe(1800);
      expect(tracker.getOutputTokens()).toBe(900);
    });

    test('tracks call count', () => {
      const tracker = new TokenTracker();
      tracker.recordCall(100, 50);
      tracker.recordCall(100, 50);
      tracker.recordCall(100, 50);

      expect(tracker.getCallCount()).toBe(3);
    });

    test('calculates average tokens per call', () => {
      const tracker = new TokenTracker();
      tracker.recordCall(1000, 500); // 1500
      tracker.recordCall(500, 250);  // 750

      expect(tracker.getAverageTokensPerCall()).toBe(1125);
    });

    test('returns 0 for empty tracker', () => {
      const tracker = new TokenTracker();
      expect(tracker.getTotalTokens()).toBe(0);
      expect(tracker.getCallCount()).toBe(0);
      expect(tracker.getAverageTokensPerCall()).toBe(0);
    });
  });

  describe('Cost Estimation', () => {
    test('estimates Sonnet cost correctly', () => {
      // 1M input at $3, 1M output at $15 = $18
      const cost = estimateCost(1000000, 1000000, 'claude-sonnet');
      expect(cost).toBe(18.0);
    });

    test('estimates Haiku cost correctly', () => {
      // 1M input at $0.25, 1M output at $1.25 = $1.50
      const cost = estimateCost(1000000, 1000000, 'claude-haiku');
      expect(cost).toBe(1.5);
    });

    test('small token counts produce small costs', () => {
      // 1000 input + 500 output on Sonnet
      const cost = estimateCost(1000, 500, 'claude-sonnet');
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.02);
    });

    test('zero tokens = zero cost', () => {
      expect(estimateCost(0, 0)).toBe(0);
    });

    test('unknown model falls back to Sonnet rates', () => {
      const costUnknown = estimateCost(1000000, 1000000, 'gpt-4');
      const costSonnet = estimateCost(1000000, 1000000, 'claude-sonnet');
      expect(costUnknown).toBe(costSonnet);
    });
  });

  describe('Timing Tracking', () => {
    test('tracks start and end', () => {
      const tracker = new TimingTracker();
      tracker.timings.test = { start: 1000, end: null, duration: null };
      tracker.timings.test.end = 2000;
      tracker.timings.test.duration = 1000;

      expect(tracker.getDuration('test')).toBe(1000);
    });

    test('total duration sums all stages', () => {
      const tracker = new TimingTracker();
      tracker.timings.extraction = { start: 0, end: 1000, duration: 1000 };
      tracker.timings.analysis = { start: 1000, end: 3000, duration: 2000 };
      tracker.timings.storage = { start: 3000, end: 3500, duration: 500 };

      expect(tracker.getTotalDuration()).toBe(3500);
    });

    test('summary returns all durations', () => {
      const tracker = new TimingTracker();
      tracker.timings.a = { start: 0, end: 100, duration: 100 };
      tracker.timings.b = { start: 100, end: 300, duration: 200 };

      const summary = tracker.getSummary();
      expect(summary).toEqual({ a: 100, b: 200 });
    });

    test('returns null for untracked label', () => {
      const tracker = new TimingTracker();
      expect(tracker.getDuration('nonexistent')).toBeNull();
    });

    test('handles incomplete tracking (no end)', () => {
      const tracker = new TimingTracker();
      tracker.timings.incomplete = { start: 1000, end: null, duration: null };
      expect(tracker.getDuration('incomplete')).toBeNull();
    });
  });
});

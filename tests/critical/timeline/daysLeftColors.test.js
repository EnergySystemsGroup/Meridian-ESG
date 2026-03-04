/**
 * Timeline Days-Left Color Coding Tests
 *
 * Tests the color thresholds for deadline urgency:
 * - Red: 0-3 days (urgent)
 * - Orange: 4-7 days (warning)
 * - Yellow: 8-14 days (attention)
 * - Green: 15+ days (normal)
 * - Gray: past or null
 */

import { describe, test, expect } from 'vitest';
import { getExpectedColor, colorThresholds } from '../../fixtures/deadlines.js';

describe('Timeline Days-Left Color Coding', () => {

  describe('Red Zone (0-3 days)', () => {
    test.each([0, 1, 2, 3])('daysLeft=%d returns red', (days) => {
      expect(getExpectedColor(days)).toBe('red');
    });

    test('boundary: 3 days is last red day', () => {
      expect(getExpectedColor(3)).toBe('red');
    });
  });

  describe('Orange Zone (4-7 days)', () => {
    test.each([4, 5, 6, 7])('daysLeft=%d returns orange', (days) => {
      expect(getExpectedColor(days)).toBe('orange');
    });

    test('boundary: 4 days is first orange day', () => {
      expect(getExpectedColor(4)).toBe('orange');
    });

    test('boundary: 7 days is last orange day', () => {
      expect(getExpectedColor(7)).toBe('orange');
    });
  });

  describe('Yellow Zone (8-14 days)', () => {
    test.each([8, 9, 10, 11, 12, 13, 14])('daysLeft=%d returns yellow', (days) => {
      expect(getExpectedColor(days)).toBe('yellow');
    });

    test('boundary: 8 days is first yellow day', () => {
      expect(getExpectedColor(8)).toBe('yellow');
    });

    test('boundary: 14 days is last yellow day', () => {
      expect(getExpectedColor(14)).toBe('yellow');
    });
  });

  describe('Green Zone (15+ days)', () => {
    test.each([15, 16, 30, 60, 90, 180, 365])('daysLeft=%d returns green', (days) => {
      expect(getExpectedColor(days)).toBe('green');
    });

    test('boundary: 15 days is first green day', () => {
      expect(getExpectedColor(15)).toBe('green');
    });

    test('large values still return green', () => {
      expect(getExpectedColor(1000)).toBe('green');
      expect(getExpectedColor(9999)).toBe('green');
    });
  });

  describe('Gray Zone (past or null)', () => {
    test('null returns gray', () => {
      expect(getExpectedColor(null)).toBe('gray');
    });

    test('undefined returns gray', () => {
      expect(getExpectedColor(undefined)).toBe('gray');
    });

    test.each([-1, -7, -30, -365])('negative daysLeft=%d returns gray', (days) => {
      expect(getExpectedColor(days)).toBe('gray');
    });
  });

  describe('Color Thresholds Constants', () => {
    test('red threshold is 0-3', () => {
      expect(colorThresholds.red.max).toBe(3);
    });

    test('orange threshold is 4-7', () => {
      expect(colorThresholds.orange.min).toBe(4);
      expect(colorThresholds.orange.max).toBe(7);
    });

    test('yellow threshold is 8-14', () => {
      expect(colorThresholds.yellow.min).toBe(8);
      expect(colorThresholds.yellow.max).toBe(14);
    });

    test('green threshold is 15+', () => {
      expect(colorThresholds.green.min).toBe(15);
    });
  });

  describe('Edge Cases', () => {
    test('exactly 0 is red (same day)', () => {
      expect(getExpectedColor(0)).toBe('red');
    });

    test('floating point numbers handled', () => {
      // getExpectedColor uses <= comparisons, so:
      // 3.5 > 3, so not red
      // 3.5 <= 7, so orange
      // Current implementation doesn't floor/ceil
      expect(getExpectedColor(3.5)).toBe('orange'); // 3.5 > 3, falls through to orange check
      expect(getExpectedColor(3.9)).toBe('orange'); // 3.9 > 3
      expect(getExpectedColor(4.0)).toBe('orange');
      expect(getExpectedColor(4.1)).toBe('orange');
    });
  });

  describe('Comprehensive Boundary Tests', () => {
    const boundaryTests = [
      // Red/Orange boundary
      { days: 3, expected: 'red' },
      { days: 4, expected: 'orange' },
      // Orange/Yellow boundary
      { days: 7, expected: 'orange' },
      { days: 8, expected: 'yellow' },
      // Yellow/Green boundary
      { days: 14, expected: 'yellow' },
      { days: 15, expected: 'green' },
      // Past boundary
      { days: 0, expected: 'red' },
      { days: -1, expected: 'gray' },
    ];

    test.each(boundaryTests)('daysLeft=$days returns $expected', ({ days, expected }) => {
      expect(getExpectedColor(days)).toBe(expected);
    });
  });

  describe('UI Display Mapping', () => {
    const colorToCSS = {
      red: 'text-red-500',
      orange: 'text-orange-500',
      yellow: 'text-yellow-500',
      green: 'text-green-500',
      gray: 'text-gray-400',
    };

    test('all color values map to valid CSS classes', () => {
      const allColors = ['red', 'orange', 'yellow', 'green', 'gray'];

      allColors.forEach(color => {
        expect(colorToCSS[color]).toBeDefined();
      });
    });
  });
});

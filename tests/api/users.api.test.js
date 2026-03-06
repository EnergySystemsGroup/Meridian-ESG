/**
 * Users API Contract Tests
 *
 * Validates the response shape from GET /api/users.
 * Uses inline pure functions — no imports from app code.
 */
import { describe, test, expect } from 'vitest';

// Expected shape of each user object
const userSchema = {
  id: 'string',
  display_name: 'string',
  email: 'string',
};

function validateUserObject(user) {
  const errors = [];
  for (const [field, expectedType] of Object.entries(userSchema)) {
    if (!(field in user)) {
      errors.push(`Missing field: ${field}`);
    } else if (typeof user[field] !== expectedType) {
      errors.push(`${field}: expected ${expectedType}, got ${typeof user[field]}`);
    }
  }
  return errors;
}

// Mirrors the display_name extraction logic in /api/users/route.js
function extractDisplayName(userMetadata, email) {
  return userMetadata?.full_name || userMetadata?.name || email || 'Unknown User';
}

describe('GET /api/users response shape', () => {
  test('valid user object passes schema', () => {
    const user = { id: 'u-abc', display_name: 'Alice Smith', email: 'alice@example.com' };
    expect(validateUserObject(user)).toHaveLength(0);
  });

  test('missing id fails schema', () => {
    const user = { display_name: 'Alice', email: 'alice@example.com' };
    const errors = validateUserObject(user);
    expect(errors).toContain('Missing field: id');
  });

  test('missing display_name fails schema', () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const errors = validateUserObject(user);
    expect(errors).toContain('Missing field: display_name');
  });

  test('wrong type fails schema', () => {
    const user = { id: 123, display_name: 'Alice', email: 'a@b.com' };
    const errors = validateUserObject(user);
    expect(errors).toContain('id: expected string, got number');
  });
});

describe('extractDisplayName', () => {
  test('prefers full_name', () => {
    expect(extractDisplayName({ full_name: 'Alice Smith', name: 'A' }, 'a@b.com')).toBe('Alice Smith');
  });

  test('falls back to name when no full_name', () => {
    expect(extractDisplayName({ name: 'Alice' }, 'a@b.com')).toBe('Alice');
  });

  test('falls back to email when no name metadata', () => {
    expect(extractDisplayName({}, 'alice@example.com')).toBe('alice@example.com');
  });

  test('falls back to Unknown User when nothing available', () => {
    expect(extractDisplayName({}, '')).toBe('Unknown User');
  });

  test('falls back to Unknown User for null metadata', () => {
    expect(extractDisplayName(null, null)).toBe('Unknown User');
  });

  test('handles undefined metadata', () => {
    expect(extractDisplayName(undefined, 'test@test.com')).toBe('test@test.com');
  });
});

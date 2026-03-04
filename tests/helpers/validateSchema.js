/**
 * Schema validation helpers for API contract tests.
 *
 * Supports union types via pipe syntax, e.g. 'string|null'.
 */

export function validateFieldType(value, expectedType) {
  const types = expectedType.split('|');
  for (const type of types) {
    if (type === 'null' && value === null) return true;
    if (type === 'undefined' && value === undefined) return true;
    if (type === 'string' && typeof value === 'string') return true;
    if (type === 'number' && typeof value === 'number') return true;
    if (type === 'boolean' && typeof value === 'boolean') return true;
    if (type === 'array' && Array.isArray(value)) return true;
    if (type === 'object' && typeof value === 'object' && !Array.isArray(value) && value !== null) return true;
  }
  return false;
}

export function validateSchema(obj, schema) {
  const errors = [];
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing field: ${key}`);
    } else if (!validateFieldType(obj[key], expectedType)) {
      errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${typeof obj[key]}`);
    }
  }
  return errors;
}

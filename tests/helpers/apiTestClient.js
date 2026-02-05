/**
 * API Test Client
 *
 * Simulates API request/response cycle for testing API route handlers.
 * Provides a fetch-like interface that validates request structure,
 * checks response shapes, and verifies HTTP status codes.
 */

/**
 * Create a mock request object mimicking Next.js Request
 */
export function createMockRequest(options = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body = null,
    searchParams = {},
  } = options;

  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach(v => urlObj.searchParams.append(key, v));
    } else if (value !== undefined && value !== null) {
      urlObj.searchParams.set(key, String(value));
    }
  }

  return {
    method,
    url: urlObj.toString(),
    headers: new Map(Object.entries(headers)),
    nextUrl: urlObj,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/**
 * Create a mock response builder mimicking NextResponse
 */
export function createMockResponse() {
  let statusCode = 200;
  let responseBody = null;
  let responseHeaders = {};

  return {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          responseBody = data;
          return { status: statusCode, body: responseBody, headers: responseHeaders };
        },
      };
    },
    json: (data, options = {}) => {
      responseBody = data;
      statusCode = options.status || 200;
      return { status: statusCode, body: responseBody, headers: responseHeaders };
    },
    getResult: () => ({
      status: statusCode,
      body: responseBody,
      headers: responseHeaders,
    }),
  };
}

/**
 * Validate that a response matches expected API contract
 */
export function validateResponseContract(response, contract) {
  const errors = [];

  if (contract.status && response.status !== contract.status) {
    errors.push(`Expected status ${contract.status}, got ${response.status}`);
  }

  if (contract.requiredFields && response.body) {
    for (const field of contract.requiredFields) {
      if (!(field in response.body)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (contract.bodyType === 'array' && !Array.isArray(response.body)) {
    errors.push('Expected body to be an array');
  }

  if (contract.bodyType === 'object' && (typeof response.body !== 'object' || Array.isArray(response.body))) {
    errors.push('Expected body to be an object');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper to build common API test scenarios
 */
export function apiScenarios() {
  return {
    // GET with query params
    getWithParams: (path, params) => createMockRequest({
      method: 'GET',
      url: `http://localhost:3000${path}`,
      searchParams: params,
    }),

    // POST with JSON body
    postJson: (path, body) => createMockRequest({
      method: 'POST',
      url: `http://localhost:3000${path}`,
      headers: { 'content-type': 'application/json' },
      body,
    }),

    // PUT with JSON body
    putJson: (path, body) => createMockRequest({
      method: 'PUT',
      url: `http://localhost:3000${path}`,
      headers: { 'content-type': 'application/json' },
      body,
    }),

    // DELETE
    deleteRequest: (path) => createMockRequest({
      method: 'DELETE',
      url: `http://localhost:3000${path}`,
    }),

    // Authenticated request
    authenticated: (method, path, token = 'test-token') => createMockRequest({
      method,
      url: `http://localhost:3000${path}`,
      headers: { authorization: `Bearer ${token}` },
    }),
  };
}

import axios from 'axios';

/**
 * Makes an API request with the appropriate authentication method
 * @param {string} url - The API endpoint URL
 * @param {Object} params - Query parameters for the request
 * @param {string} authType - Authentication type (none, apikey, oauth, basic)
 * @param {Object} authDetails - Authentication details (keys, tokens, etc.)
 * @param {Object} headers - Additional headers to include
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} data - Request body for POST/PUT requests
 * @returns {Promise<Object>} - The API response
 */
export async function makeApiRequest(
	url,
	params = {},
	authType = 'none',
	authDetails = {},
	headers = {},
	method = 'GET',
	data = null
) {
	const requestConfig = {
		method,
		url,
		params,
		headers: { ...headers },
		timeout: 30000, // 30 second timeout
	};

	if (data) {
		requestConfig.data = data;
	}

	// Apply authentication based on the type
	switch (authType) {
		case 'apikey':
			// API Key can be in headers, query params, or other locations
			if (authDetails.in === 'header' && authDetails.key && authDetails.value) {
				requestConfig.headers[authDetails.key] = authDetails.value;
			} else if (
				authDetails.in === 'query' &&
				authDetails.key &&
				authDetails.value
			) {
				requestConfig.params[authDetails.key] = authDetails.value;
			}
			break;

		case 'oauth':
			if (authDetails.token) {
				requestConfig.headers['Authorization'] = `Bearer ${authDetails.token}`;
			}
			break;

		case 'basic':
			if (authDetails.username && authDetails.password) {
				const credentials = Buffer.from(
					`${authDetails.username}:${authDetails.password}`
				).toString('base64');
				requestConfig.headers['Authorization'] = `Basic ${credentials}`;
			}
			break;

		case 'none':
		default:
			// No authentication needed
			break;
	}

	try {
		const response = await axios(requestConfig);
		return {
			data: response.data,
			status: response.status,
			headers: response.headers,
			requestDetails: {
				url,
				method,
				params,
				headers: requestConfig.headers,
			},
		};
	} catch (error) {
		// Capture error details for logging
		const errorDetails = {
			message: error.message,
			status: error.response?.status,
			data: error.response?.data,
			requestDetails: {
				url,
				method,
				params,
				headers: requestConfig.headers,
			},
		};

		throw {
			...errorDetails,
			originalError: error,
		};
	}
}

/**
 * Makes a paginated API request, handling multiple pages of results
 * @param {Object} config - Configuration for the paginated request
 * @returns {Promise<Array>} - Combined results from all pages
 */
export async function makePaginatedApiRequest(config) {
	const {
		url,
		params = {},
		authType = 'none',
		authDetails = {},
		headers = {},
		method = 'GET',
		data = null,
		paginationConfig = {
			enabled: false,
			type: 'offset', // offset, page, cursor
			limitParam: 'limit',
			offsetParam: 'offset',
			pageParam: 'page',
			cursorParam: 'cursor',
			pageSize: 100,
			maxPages: 10,
			responseDataPath: 'data',
			hasMorePath: 'hasMore',
			nextCursorPath: 'nextCursor',
			totalCountPath: 'totalCount',
		},
	} = config;

	// If pagination is not enabled, make a single request
	if (!paginationConfig.enabled) {
		return makeApiRequest(
			url,
			params,
			authType,
			authDetails,
			headers,
			method,
			data
		);
	}

	let allResults = [];
	let currentPage = 1;
	let hasMore = true;
	let nextCursor = null;
	let currentOffset = 0;
	const pageSize = paginationConfig.pageSize;

	// Clone the params to avoid modifying the original
	let currentParams = { ...params };

	while (hasMore && currentPage <= paginationConfig.maxPages) {
		// Set pagination parameters based on the pagination type
		switch (paginationConfig.type) {
			case 'offset':
				currentParams[paginationConfig.limitParam] = pageSize;
				currentParams[paginationConfig.offsetParam] = currentOffset;
				break;
			case 'page':
				currentParams[paginationConfig.limitParam] = pageSize;
				currentParams[paginationConfig.pageParam] = currentPage;
				break;
			case 'cursor':
				currentParams[paginationConfig.limitParam] = pageSize;
				if (nextCursor) {
					currentParams[paginationConfig.cursorParam] = nextCursor;
				}
				break;
		}

		// Make the request for this page
		const response = await makeApiRequest(
			url,
			currentParams,
			authType,
			authDetails,
			headers,
			method,
			data
		);

		// Extract the data from the response using the configured path
		const responseData =
			getNestedValue(response.data, paginationConfig.responseDataPath) || [];

		// Add the results from this page
		allResults = allResults.concat(responseData);

		// Determine if there are more pages
		if (paginationConfig.type === 'cursor') {
			// For cursor-based pagination, check if there's a next cursor
			nextCursor = getNestedValue(
				response.data,
				paginationConfig.nextCursorPath
			);
			hasMore = !!nextCursor;
		} else if (paginationConfig.hasMorePath) {
			// If there's a specific path that indicates if there are more results
			hasMore = getNestedValue(response.data, paginationConfig.hasMorePath);
		} else {
			// Otherwise, check if we got a full page of results
			hasMore = responseData.length === pageSize;
		}

		// Update for the next page
		currentPage++;
		currentOffset += pageSize;

		// If we didn't get any results, stop paginating
		if (responseData.length === 0) {
			hasMore = false;
		}
	}

	// Return the combined results and the last response details
	return {
		data: allResults,
		paginationDetails: {
			totalPages: currentPage - 1,
			totalResults: allResults.length,
			hasMore,
		},
	};
}

/**
 * Helper function to get a nested value from an object using a dot-notation path
 * @param {Object} obj - The object to extract from
 * @param {string} path - Dot-notation path to the desired value
 * @returns {*} - The value at the path, or undefined if not found
 */
export function getNestedValue(obj, path) {
	if (!path) return obj;

	const keys = path.split('.');
	let current = obj;

	for (const key of keys) {
		if (
			current === null ||
			current === undefined ||
			typeof current !== 'object'
		) {
			return undefined;
		}
		current = current[key];
	}

	return current;
}

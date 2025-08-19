'use client';

import { supabase } from './supabase';

/**
 * Call a Supabase Edge Function
 * @param {string} functionName - The name of the function to call
 * @param {Object} payload - The payload to send to the function
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The response from the function
 */
export async function callEdgeFunction(
	functionName,
	payload = {},
	options = {}
) {
	try {
		// Get the current session for authentication
		const {
			data: { session },
		} = await supabase.auth.getSession();

		// Prepare headers
		const headers = {
			'Content-Type': 'application/json',
			...(session?.access_token && {
				Authorization: `Bearer ${session.access_token}`,
			}),
			...options.headers,
		};

		// Determine the method
		const method = options.method || 'POST';

		// Build the URL - use the local Edge Functions server when in development
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

		// For local development, use the Edge Functions server running on port 8000
		// This is the default port when running `supabase functions serve`
		const url =
			process.env.NODE_ENV === 'development'
				? `http://localhost:8000/${functionName}`
				: `${supabaseUrl}/functions/v1/${functionName}`;

		console.log(`Calling Edge Function at: ${url}`);

		// Make the request
		const response = await fetch(url, {
			method,
			headers,
			...(method !== 'GET' && { body: JSON.stringify(payload) }),
		});

		// Parse the response
		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Error calling Edge Function');
		}

		return { data, error: null };
	} catch (error) {
		console.error(`Error calling Edge Function ${functionName}:`, error);
		return { data: null, error: error.message };
	}
}

/**
 * Example usage of the hello-world Edge Function
 * @returns {Promise<Object>} - The response from the function
 */
export async function sayHello(message = '') {
	return callEdgeFunction('hello-world', { message });
}

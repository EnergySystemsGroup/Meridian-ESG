'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

/**
 * Custom hook for fetching data from Supabase
 * @param {string} tableName - The name of the table to query
 * @param {Object} options - Query options
 * @param {Object} options.filters - Key-value pairs for filtering (column: value)
 * @param {Object} options.orderBy - Ordering configuration { column, ascending }
 * @param {number} options.limit - Maximum number of rows to return
 * @param {number} options.page - Page number for pagination
 * @param {number} options.pageSize - Number of items per page
 * @param {Array} options.columns - Specific columns to select
 * @param {boolean} options.count - Whether to include count of total rows
 * @param {Array} dependencies - Array of dependencies to trigger refetch
 * @returns {Object} { data, count, error, loading, refetch }
 */
export function useSupabaseQuery(tableName, options = {}, dependencies = []) {
	const [data, setData] = useState([]);
	const [count, setCount] = useState(0);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);

	const fetchData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Start building the query
			let query = supabase.from(tableName);

			// Select specific columns or all columns
			if (options.columns && options.columns.length > 0) {
				query = query.select(options.columns.join(','));
			} else {
				query = query.select('*');
			}

			// Add count if requested
			if (options.count) {
				query = query.select('*', { count: 'exact' });
			}

			// Apply filters
			if (options.filters) {
				Object.entries(options.filters).forEach(([column, value]) => {
					if (value !== undefined && value !== null) {
						query = query.eq(column, value);
					}
				});
			}

			// Apply ordering
			if (options.orderBy) {
				query = query.order(options.orderBy.column, {
					ascending: options.orderBy.ascending !== false,
				});
			}

			// Apply pagination
			if (options.page && options.pageSize) {
				const from = (options.page - 1) * options.pageSize;
				const to = from + options.pageSize - 1;
				query = query.range(from, to);
			} else if (options.limit) {
				query = query.limit(options.limit);
			}

			// Execute the query
			const {
				data: result,
				error: queryError,
				count: totalCount,
			} = await query;

			if (queryError) {
				throw queryError;
			}

			setData(result || []);
			if (options.count) {
				setCount(totalCount);
			}
		} catch (err) {
			console.error('Error fetching data from Supabase:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	// Fetch data when dependencies change
	useEffect(() => {
		fetchData();
	}, [...dependencies]);

	return { data, count, error, loading, refetch: fetchData };
}

/**
 * Custom hook for Supabase realtime subscriptions
 * @param {string} tableName - The name of the table to subscribe to
 * @param {Object} options - Subscription options
 * @param {string} options.event - Event to listen for ('INSERT', 'UPDATE', 'DELETE', '*')
 * @param {Object} options.filter - Filter condition for the subscription
 * @returns {Object} { data, error }
 */
export function useSupabaseSubscription(tableName, options = {}) {
	const [data, setData] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		// Set up the subscription
		const event = options.event || '*';

		let subscription = supabase
			.channel(`table:${tableName}`)
			.on(
				'postgres_changes',
				{
					event,
					schema: 'public',
					table: tableName,
					...(options.filter && { filter: options.filter }),
				},
				(payload) => {
					setData(payload.new);
				}
			)
			.subscribe((status) => {
				if (status !== 'SUBSCRIBED') {
					setError(`Failed to subscribe: ${status}`);
				}
			});

		// Clean up the subscription when the component unmounts
		return () => {
			supabase.removeChannel(subscription);
		};
	}, [tableName, options.event, JSON.stringify(options.filter)]);

	return { data, error };
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds

export default function FundingSourcesPage() {
	const [sources, setSources] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [notifications, setNotifications] = useState([]);
	const [processingStates, setProcessingStates] = useState({});
	
	// Global FFR is now computed from sources, not stored
	const globalForceReprocessing = sources.length > 0 && sources.every(s => s.force_full_reprocessing === true);

	// Add notification helper
	const addNotification = (message, type = 'info') => {
		const id = Date.now();
		setNotifications(prev => [...prev, { id, message, type }]);
		// Auto-remove after 5 seconds
		setTimeout(() => {
			setNotifications(prev => prev.filter(n => n.id !== id));
		}, 5000);
	};

	// Fetch sources and global config
	const fetchData = async (showLoading = true) => {
		try {
			if (showLoading) {
				setLoading(true);
			}
			
			// Fetch sources
			const sourcesResponse = await fetch('/api/funding/sources');
			if (!sourcesResponse.ok) {
				throw new Error('Failed to fetch sources');
			}
			const sourcesData = await sourcesResponse.json();
			setSources(sourcesData.sources || []);
			
			// Global state is now derived from sources, no need to fetch separately
		} catch (err) {
			console.error('Error fetching data:', err);
			setError(err.message);
		} finally {
			if (showLoading) {
				setLoading(false);
			}
		}
	};

	// Fetch on mount
	useEffect(() => {
		fetchData();
	}, []);

	// Refresh when page becomes visible (in case processing happened elsewhere)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				// Refresh data when tab becomes visible (no loading spinner)
				fetchData(false);
			}
		};
		
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		// Also refresh periodically if page is visible
		const interval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				fetchData(false);
			}
		}, REFRESH_INTERVAL);
		
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			clearInterval(interval);
		};
	}, []);

	// Process a source
	async function processSource(id) {
		setProcessingStates(prev => ({ ...prev, [id]: true }));
		try {
			const response = await fetch(`/api/admin/funding-sources/${id}/process`, {
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error('Failed to process source');
			}

			const result = await response.json();
			addNotification(
				`Successfully processed source. Found ${
					result.handlerResult?.opportunitiesCount || 0
				} opportunities.`,
				'success'
			);
		} catch (err) {
			console.error('Error processing source:', err);
			addNotification(`Error processing source: ${err.message}`, 'error');
		} finally {
			setProcessingStates(prev => ({ ...prev, [id]: false }));
		}
	}

	// Toggle source active status
	async function toggleSourceActive(id, currentActive) {
		try {
			const response = await fetch(`/api/funding/sources/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ active: !currentActive }),
			});

			if (!response.ok) {
				throw new Error('Failed to update source');
			}

			// Update the sources list
			setSources(
				sources.map((source) =>
					source.id === id ? { ...source, active: !currentActive } : source
				)
			);
			addNotification(
				`Source ${!currentActive ? 'activated' : 'deactivated'} successfully`,
				'success'
			);
		} catch (err) {
			console.error('Error updating source:', err);
			addNotification(`Error updating source: ${err.message}`, 'error');
		}
	}

	// Toggle force full reprocessing flag
	async function toggleForceReprocessing(id, currentValue) {
		try {
			const response = await fetch(`/api/funding/sources/${id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ force_full_reprocessing: !currentValue }),
			});

			if (!response.ok) {
				throw new Error('Failed to update force reprocessing flag');
			}

			// Update the sources list
			const updatedSources = sources.map((source) =>
				source.id === id ? { ...source, force_full_reprocessing: !currentValue } : source
			);
			setSources(updatedSources);
			
			// Global state automatically updates since it's derived from sources

			// Clear notifications - the UI already shows the state
			if (!currentValue) {
				addNotification('Force Full Reprocessing enabled', 'warning');
			} else {
				addNotification('Force Full Reprocessing disabled', 'success');
			}
		} catch (err) {
			console.error('Error updating force reprocessing flag:', err);
			addNotification(`Error updating force reprocessing flag: ${err.message}`, 'error');
		}
	}

	// Toggle global force full reprocessing flag - now a batch operation with proper error handling
	async function toggleGlobalForceReprocessing() {
		// Determine the new value based on current state
		// If any source is OFF, turn all ON. If all are ON, turn all OFF.
		const newValue = !globalForceReprocessing;
		const originalSources = [...sources]; // Backup for rollback

		try {
			// Update all sources in parallel
			const updatePromises = sources.map(source => 
				fetch(`/api/funding/sources/${source.id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ force_full_reprocessing: newValue }),
				})
			);

			// Use allSettled to handle partial failures
			const results = await Promise.allSettled(updatePromises);
			
			// Check for failures
			const failures = results.filter(r => 
				r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.ok)
			);
			
			if (failures.length > 0) {
				// Partial failure - rollback UI state
				setSources(originalSources);
				const successCount = sources.length - failures.length;
				throw new Error(`Updated ${successCount} of ${sources.length} sources. Some failed to update.`);
			}

			// All succeeded - update local state for all sources
			const updatedSources = sources.map(source => ({
				...source,
				force_full_reprocessing: newValue
			}));
			setSources(updatedSources);
			
			// User-friendly notifications
			if (newValue) {
				addNotification('Force Full Reprocessing enabled for all sources', 'warning');
			} else {
				addNotification('Force Full Reprocessing disabled for all sources', 'success');
			}
		} catch (err) {
			console.error('Error updating global force reprocessing flag:', err);
			addNotification(`Error: ${err.message}`, 'error');
			// Refresh data from server to ensure consistency
			fetchData(false);
		}
	}

	// Delete a source
	async function deleteSource(id) {
		if (!confirm('Are you sure you want to delete this source?')) {
			return;
		}

		try {
			const response = await fetch(`/api/funding/sources/${id}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				throw new Error('Failed to delete source');
			}

			// Remove the source from the list
			setSources(sources.filter((source) => source.id !== id));
			addNotification('Source deleted successfully', 'success');
		} catch (err) {
			console.error('Error deleting source:', err);
			addNotification(`Error deleting source: ${err.message}`, 'error');
		}
	}

	if (loading) {
		return <div className='p-4'>Loading...</div>;
	}

	if (error) {
		return <div className='p-4 text-red-500'>Error: {error}</div>;
	}

	return (
		<div className='p-4'>
			{/* Notification Container */}
			<div className='fixed top-4 right-4 z-50 space-y-2'>
				{notifications.map((notification) => (
					<div
						key={notification.id}
						className={`px-4 py-2 rounded shadow-lg transition-all transform translate-x-0 ${
							notification.type === 'error'
								? 'bg-red-500 text-white'
								: notification.type === 'success'
								? 'bg-green-500 text-white'
								: notification.type === 'warning'
								? 'bg-yellow-500 text-white'
								: 'bg-blue-500 text-white'
						}`}>
						{notification.message}
					</div>
				))}
			</div>

			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold'>API Funding Sources</h1>
				<Link
					href='/admin/funding-sources/new'
					className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded'>
					Add New Source
				</Link>
			</div>

			{/* Global Force Reprocessing Control */}
			<div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded'>
				<div className='flex items-center justify-between'>
					<div>
						<h3 className='text-lg font-semibold text-yellow-800'>Global Force Full Reprocessing</h3>
						<p className='text-sm text-yellow-700 mt-1'>
							When enabled, ALL sources will bypass duplicate detection on their next run.
							Use this when schema changes require reprocessing all data.
						</p>
					</div>
					<div className='flex items-center'>
						<label className='inline-flex items-center cursor-pointer'>
							<input
								type='checkbox'
								checked={globalForceReprocessing}
								onChange={toggleGlobalForceReprocessing}
								className='sr-only peer'
							/>
							<div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
							<span className='ml-3 text-sm font-medium text-gray-900'>
								{globalForceReprocessing ? 'Enabled' : 'Disabled'}
							</span>
						</label>
					</div>
				</div>
				{globalForceReprocessing && (
					<div className='mt-2 text-sm text-yellow-600 font-medium'>
						⚠️ Global reprocessing is active - all sources will skip duplicate detection
					</div>
				)}
			</div>

			<div className='overflow-x-auto'>
				<table className='min-w-full bg-white border border-gray-200'>
					<thead>
						<tr className='bg-gray-100'>
							<th className='py-2 px-4 border-b text-left'>Name</th>
							<th className='py-2 px-4 border-b text-left'>Organization</th>
							<th className='py-2 px-4 border-b text-left'>Type</th>
							<th className='py-2 px-4 border-b text-left'>Last Checked</th>
							<th className='py-2 px-4 border-b text-left'>Status</th>
							<th className='py-2 px-4 border-b text-left'>Force Reprocess</th>
							<th className='py-2 px-4 border-b text-left'>Actions</th>
						</tr>
					</thead>
					<tbody>
						{sources.length === 0 ? (
							<tr>
								<td colSpan='7' className='py-4 px-4 text-center'>
									No sources found. Add a new source to get started.
								</td>
							</tr>
						) : (
							sources.map((source) => (
								<tr key={source.id} className='hover:bg-gray-50'>
									<td className='py-2 px-4 border-b'>
										<Link
											href={`/admin/funding-sources/${source.id}`}
											className='text-blue-500 hover:underline'>
											{source.name}
										</Link>
									</td>
									<td className='py-2 px-4 border-b'>
										{source.organization || '-'}
									</td>
									<td className='py-2 px-4 border-b'>{source.type}</td>
									<td className='py-2 px-4 border-b'>
										{source.last_checked
											? new Date(source.last_checked).toLocaleString()
											: 'Never'}
									</td>
									<td className='py-2 px-4 border-b'>
										<span
											className={`inline-block px-2 py-1 rounded text-xs ${
												source.active
													? 'bg-green-100 text-green-800'
													: 'bg-red-100 text-red-800'
											}`}>
											{source.active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td className='py-2 px-4 border-b'>
										<div className='flex items-center'>
											<input
												type='checkbox'
												checked={source.force_full_reprocessing || false}
												onChange={() => toggleForceReprocessing(source.id, source.force_full_reprocessing || false)}
												className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
												title='When checked, bypasses duplicate detection on next run'
											/>
											{source.force_full_reprocessing && (
												<span className='ml-2 text-yellow-600 text-xs' title='Will bypass duplicate detection on next run'>
													⚠️
												</span>
											)}
										</div>
									</td>
									<td className='py-2 px-4 border-b'>
										<div className='flex space-x-2'>
											<button
												onClick={() => processSource(source.id)}
												className='bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs disabled:opacity-50'
												disabled={processingStates[source.id]}>
												{processingStates[source.id] ? 'Processing...' : 'Process'}
											</button>
											<button
												onClick={() =>
													toggleSourceActive(source.id, source.active)
												}
												className={`px-2 py-1 rounded text-xs ${
													source.active
														? 'bg-yellow-500 hover:bg-yellow-600 text-white'
														: 'bg-blue-500 hover:bg-blue-600 text-white'
												}`}>
												{source.active ? 'Deactivate' : 'Activate'}
											</button>
											<button
												onClick={() => deleteSource(source.id)}
												className='bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs'>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<div className='mt-6'>
				<button
					onClick={async () => {
						try {
							const response = await fetch('/api/funding/process', {
								method: 'POST',
							});

							if (!response.ok) {
								throw new Error('Failed to process next source');
							}

							const result = await response.json();

							if (result.message) {
								alert(result.message);
							} else {
								alert(`Successfully processed source: ${result.source}`);
							}

							// Refresh the sources list
							window.location.reload();
						} catch (err) {
							console.error('Error processing next source:', err);
							alert(`Error processing next source: ${err.message}`);
						}
					}}
					className='bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded'>
					Process Next Source in Queue
				</button>
			</div>
		</div>
	);
}

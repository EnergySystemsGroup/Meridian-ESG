'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function FundingSourcesPage() {
	const [sources, setSources] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// Fetch sources on component mount
	useEffect(() => {
		async function fetchSources() {
			try {
				setLoading(true);
				const response = await fetch('/api/funding/sources');

				if (!response.ok) {
					throw new Error('Failed to fetch sources');
				}

				const data = await response.json();
				setSources(data.sources || []);
			} catch (err) {
				console.error('Error fetching sources:', err);
				setError(err.message);
			} finally {
				setLoading(false);
			}
		}

		fetchSources();
	}, []);

	// Process a source
	async function processSource(id) {
		try {
			const response = await fetch(`/api/funding/sources/${id}/process`, {
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error('Failed to process source');
			}

			const result = await response.json();
			alert(
				`Successfully processed source. Found ${
					result.handlerResult?.opportunitiesCount || 0
				} opportunities.`
			);
		} catch (err) {
			console.error('Error processing source:', err);
			alert(`Error processing source: ${err.message}`);
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
		} catch (err) {
			console.error('Error updating source:', err);
			alert(`Error updating source: ${err.message}`);
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
		} catch (err) {
			console.error('Error deleting source:', err);
			alert(`Error deleting source: ${err.message}`);
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
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold'>API Funding Sources</h1>
				<Link
					href='/admin/funding-sources/new'
					className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded'>
					Add New Source
				</Link>
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
							<th className='py-2 px-4 border-b text-left'>Actions</th>
						</tr>
					</thead>
					<tbody>
						{sources.length === 0 ? (
							<tr>
								<td colSpan='6' className='py-4 px-4 text-center'>
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
										<div className='flex space-x-2'>
											<button
												onClick={() => processSource(source.id)}
												className='bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs'>
												Process
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

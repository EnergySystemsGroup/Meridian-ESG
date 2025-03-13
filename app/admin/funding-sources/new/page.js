'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewSourcePage() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: '',
		organization: '',
		type: 'federal',
		url: '',
		api_endpoint: '',
		api_documentation_url: '',
		auth_type: 'none',
		auth_details: {},
		update_frequency: 'daily',
		notes: '',
		active: true,
		configurations: {
			query_params: {},
			pagination_config: {
				enabled: false,
				type: 'offset',
				limitParam: 'limit',
				offsetParam: 'offset',
				pageSize: 100,
				maxPages: 5,
				responseDataPath: '',
			},
		},
	});
	const [similarSources, setSimilarSources] = useState(null);
	const [error, setError] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	// Handle form input changes
	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
		}));
	};

	// Handle auth details changes
	const handleAuthDetailsChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			auth_details: {
				...prev.auth_details,
				[name]: value,
			},
		}));
	};

	// Handle query params changes
	const handleQueryParamsChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				query_params: {
					...prev.configurations.query_params,
					[name]: value,
				},
			},
		}));
	};

	// Handle pagination config changes
	const handlePaginationConfigChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				pagination_config: {
					...prev.configurations.pagination_config,
					[name]:
						type === 'checkbox'
							? checked
							: type === 'number'
							? Number(value)
							: value,
				},
			},
		}));
	};

	// Add a new query parameter
	const addQueryParam = () => {
		const key = prompt('Enter query parameter name:');
		if (!key) return;

		const value = prompt('Enter query parameter value:');
		if (value === null) return;

		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				query_params: {
					...prev.configurations.query_params,
					[key]: value,
				},
			},
		}));
	};

	// Remove a query parameter
	const removeQueryParam = (key) => {
		setFormData((prev) => {
			const newQueryParams = { ...prev.configurations.query_params };
			delete newQueryParams[key];

			return {
				...prev,
				configurations: {
					...prev.configurations,
					query_params: newQueryParams,
				},
			};
		});
	};

	// Handle form submission
	const handleSubmit = async (e) => {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		setSimilarSources(null);

		try {
			setLoading(true);

			const response = await fetch('/api/funding/sources', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				// Check if this is a duplicate/similar source error
				if (response.status === 409 && data.similarSources) {
					setSimilarSources(data.similarSources);
					setError(
						'Similar sources already exist. Please review before proceeding.'
					);
				} else {
					setError(data.error || 'Failed to create source');
				}
				return;
			}

			// Redirect to the sources list page
			router.push('/admin/funding-sources');
		} catch (err) {
			console.error('Error creating source:', err);
			setError('An unexpected error occurred');
		} finally {
			setLoading(false);
			setSubmitting(false);
		}
	};

	return (
		<div className='p-4 max-w-4xl mx-auto'>
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold'>Add New API Source</h1>
				<Link
					href='/admin/funding-sources'
					className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded'>
					Back to Sources
				</Link>
			</div>

			{similarSources && (
				<div className='mb-6 p-4 border border-yellow-400 bg-yellow-50 rounded'>
					<h3 className='text-lg font-semibold text-yellow-800 mb-2'>
						Similar Sources Found
					</h3>
					<p className='mb-2'>
						The following similar sources already exist in the database:
					</p>
					<ul className='list-disc pl-5 mb-4'>
						{similarSources.map((source) => (
							<li key={source.id} className='mb-1'>
								<strong>{source.name}</strong>
								{source.organization && ` (${source.organization})`} -
								<span className='text-sm text-gray-600'>
									{Math.round(source.similarity * 100)}% similar
								</span>
							</li>
						))}
					</ul>
					<div className='flex space-x-4'>
						<button
							type='button'
							className='bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded'
							onClick={() => {
								// Force create anyway
								setSimilarSources(null);
								handleSubmit({ preventDefault: () => {} });
							}}>
							Create Anyway
						</button>
						<button
							type='button'
							className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded'
							onClick={() => setSimilarSources(null)}>
							Cancel
						</button>
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit} className='space-y-6'>
				{/* Basic Information */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>Basic Information</h2>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Name *
							</label>
							<input
								type='text'
								name='name'
								value={formData.name}
								onChange={handleChange}
								required
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Organization
							</label>
							<input
								type='text'
								name='organization'
								value={formData.organization}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Type *
							</label>
							<select
								name='type'
								value={formData.type}
								onChange={handleChange}
								required
								className='w-full px-3 py-2 border border-gray-300 rounded-md'>
								<option value='federal'>Federal</option>
								<option value='state'>State</option>
								<option value='local'>Local</option>
								<option value='utility'>Utility</option>
								<option value='private'>Private</option>
							</select>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Update Frequency
							</label>
							<select
								name='update_frequency'
								value={formData.update_frequency}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'>
								<option value='daily'>Daily</option>
								<option value='weekly'>Weekly</option>
								<option value='monthly'>Monthly</option>
								<option value='quarterly'>Quarterly</option>
							</select>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Active
							</label>
							<div className='mt-2'>
								<input
									type='checkbox'
									name='active'
									checked={formData.active}
									onChange={handleChange}
									className='mr-2'
								/>
								<span>Source is active and will be processed</span>
							</div>
						</div>
					</div>

					<div className='mt-4'>
						<label className='block text-sm font-medium text-gray-700 mb-1'>
							Notes
						</label>
						<textarea
							name='notes'
							value={formData.notes}
							onChange={handleChange}
							rows='3'
							className='w-full px-3 py-2 border border-gray-300 rounded-md'></textarea>
					</div>
				</div>

				{/* API Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>API Configuration</h2>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Website URL *
							</label>
							<input
								type='url'
								name='url'
								value={formData.url}
								onChange={handleChange}
								required
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								API Endpoint
							</label>
							<input
								type='url'
								name='api_endpoint'
								value={formData.api_endpoint}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								API Documentation URL
							</label>
							<input
								type='url'
								name='api_documentation_url'
								value={formData.api_documentation_url}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Authentication Type
							</label>
							<select
								name='auth_type'
								value={formData.auth_type}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'>
								<option value='none'>None</option>
								<option value='apikey'>API Key</option>
								<option value='oauth'>OAuth</option>
								<option value='basic'>Basic Auth</option>
							</select>
						</div>
					</div>

					{/* Authentication Details */}
					{formData.auth_type === 'apikey' && (
						<div className='mt-4 p-4 border border-gray-200 rounded-md'>
							<h3 className='text-lg font-medium mb-2'>API Key Details</h3>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Key Name
									</label>
									<input
										type='text'
										name='key'
										value={formData.auth_details.key || ''}
										onChange={handleAuthDetailsChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Key Value
									</label>
									<input
										type='text'
										name='value'
										value={formData.auth_details.value || ''}
										onChange={handleAuthDetailsChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Location
									</label>
									<select
										name='in'
										value={formData.auth_details.in || 'header'}
										onChange={handleAuthDetailsChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'>
										<option value='header'>Header</option>
										<option value='query'>Query Parameter</option>
									</select>
								</div>
							</div>
						</div>
					)}

					{formData.auth_type === 'basic' && (
						<div className='mt-4 p-4 border border-gray-200 rounded-md'>
							<h3 className='text-lg font-medium mb-2'>Basic Auth Details</h3>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Username
									</label>
									<input
										type='text'
										name='username'
										value={formData.auth_details.username || ''}
										onChange={handleAuthDetailsChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Password
									</label>
									<input
										type='password'
										name='password'
										value={formData.auth_details.password || ''}
										onChange={handleAuthDetailsChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
								</div>
							</div>
						</div>
					)}

					{formData.auth_type === 'oauth' && (
						<div className='mt-4 p-4 border border-gray-200 rounded-md'>
							<h3 className='text-lg font-medium mb-2'>OAuth Details</h3>
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Token
								</label>
								<input
									type='text'
									name='token'
									value={formData.auth_details.token || ''}
									onChange={handleAuthDetailsChange}
									className='w-full px-3 py-2 border border-gray-300 rounded-md'
								/>
							</div>
						</div>
					)}
				</div>

				{/* Query Parameters */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>Query Parameters</h2>
						<button
							type='button'
							onClick={addQueryParam}
							className='bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm'>
							Add Parameter
						</button>
					</div>

					{Object.keys(formData.configurations.query_params).length === 0 ? (
						<p className='text-gray-500 italic'>No query parameters defined.</p>
					) : (
						<div className='overflow-x-auto'>
							<table className='min-w-full border border-gray-200'>
								<thead>
									<tr className='bg-gray-100'>
										<th className='py-2 px-4 border-b text-left'>Parameter</th>
										<th className='py-2 px-4 border-b text-left'>Value</th>
										<th className='py-2 px-4 border-b text-left'>Actions</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(formData.configurations.query_params).map(
										([key, value]) => (
											<tr key={key} className='hover:bg-gray-50'>
												<td className='py-2 px-4 border-b'>{key}</td>
												<td className='py-2 px-4 border-b'>{value}</td>
												<td className='py-2 px-4 border-b'>
													<button
														type='button'
														onClick={() => removeQueryParam(key)}
														className='bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs'>
														Remove
													</button>
												</td>
											</tr>
										)
									)}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Pagination Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>
						Pagination Configuration
					</h2>

					<div className='mb-4'>
						<label className='inline-flex items-center'>
							<input
								type='checkbox'
								name='enabled'
								checked={formData.configurations.pagination_config.enabled}
								onChange={handlePaginationConfigChange}
								className='mr-2'
							/>
							<span className='text-sm font-medium text-gray-700'>
								Enable Pagination
							</span>
						</label>
					</div>

					{formData.configurations.pagination_config.enabled && (
						<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Pagination Type
								</label>
								<select
									name='type'
									value={formData.configurations.pagination_config.type}
									onChange={handlePaginationConfigChange}
									className='w-full px-3 py-2 border border-gray-300 rounded-md'>
									<option value='offset'>Offset-based</option>
									<option value='page'>Page-based</option>
									<option value='cursor'>Cursor-based</option>
								</select>
							</div>

							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Page Size
								</label>
								<input
									type='number'
									name='pageSize'
									value={formData.configurations.pagination_config.pageSize}
									onChange={handlePaginationConfigChange}
									min='1'
									className='w-full px-3 py-2 border border-gray-300 rounded-md'
								/>
							</div>

							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Max Pages
								</label>
								<input
									type='number'
									name='maxPages'
									value={formData.configurations.pagination_config.maxPages}
									onChange={handlePaginationConfigChange}
									min='1'
									className='w-full px-3 py-2 border border-gray-300 rounded-md'
								/>
							</div>

							<div>
								<label className='block text-sm font-medium text-gray-700 mb-1'>
									Response Data Path
								</label>
								<input
									type='text'
									name='responseDataPath'
									value={
										formData.configurations.pagination_config.responseDataPath
									}
									onChange={handlePaginationConfigChange}
									placeholder='e.g., data.items'
									className='w-full px-3 py-2 border border-gray-300 rounded-md'
								/>
							</div>

							{formData.configurations.pagination_config.type === 'offset' && (
								<>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Limit Parameter Name
										</label>
										<input
											type='text'
											name='limitParam'
											value={
												formData.configurations.pagination_config.limitParam
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>

									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Offset Parameter Name
										</label>
										<input
											type='text'
											name='offsetParam'
											value={
												formData.configurations.pagination_config.offsetParam
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>
								</>
							)}

							{formData.configurations.pagination_config.type === 'page' && (
								<>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Limit Parameter Name
										</label>
										<input
											type='text'
											name='limitParam'
											value={
												formData.configurations.pagination_config.limitParam
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>

									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Page Parameter Name
										</label>
										<input
											type='text'
											name='pageParam'
											value={
												formData.configurations.pagination_config.pageParam ||
												'page'
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>
								</>
							)}

							{formData.configurations.pagination_config.type === 'cursor' && (
								<>
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Limit Parameter Name
										</label>
										<input
											type='text'
											name='limitParam'
											value={
												formData.configurations.pagination_config.limitParam
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>

									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Cursor Parameter Name
										</label>
										<input
											type='text'
											name='cursorParam'
											value={
												formData.configurations.pagination_config.cursorParam ||
												'cursor'
											}
											onChange={handlePaginationConfigChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>

									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Next Cursor Path
										</label>
										<input
											type='text'
											name='nextCursorPath'
											value={
												formData.configurations.pagination_config
													.nextCursorPath || ''
											}
											onChange={handlePaginationConfigChange}
											placeholder='e.g., meta.nextCursor'
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>
								</>
							)}
						</div>
					)}
				</div>

				{/* Submit Button */}
				<div className='flex justify-end'>
					<button
						type='submit'
						disabled={loading}
						className={`px-6 py-2 rounded-md text-white font-medium ${
							loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
						}`}>
						{loading ? 'Creating...' : 'Create Source'}
					</button>
				</div>
			</form>
		</div>
	);
}

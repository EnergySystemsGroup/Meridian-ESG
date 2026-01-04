'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function EditFundingSource() {
	const params = useParams();
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
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
		handler_type: 'standard',
		notes: '',
		active: true,
		configurations: {
			query_params: {},
			request_body: {},
			request_config: {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
			response_config: {
				responseDataPath: '',
				totalCountPath: '',
			},
			pagination_config: {
				enabled: false,
				type: 'offset',
				limitParam: 'limit',
				offsetParam: 'offset',
				pageSize: 100,
				maxPages: 5,
				inBody: false,
				startOffset: 0,
			},
			detail_config: {
				enabled: false,
				endpoint: '',
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				idField: '',
				idParam: '',
				detailResponseDataPath: '',
			},
			response_mapping: {
				title: '',
				description: '',
				fundingType: '',
				agency: '',
				totalFunding: '',
				minAward: '',
				maxAward: '',
				openDate: '',
				closeDate: '',
				eligibility: '',
				url: '',
			},
		},
	});

	useEffect(() => {
		async function fetchSource() {
			try {
				setLoading(true);
				const response = await fetch(`/api/funding/sources/${params.id}`);
				
				if (!response.ok) {
					throw new Error('Failed to fetch source');
				}
				
				const data = await response.json();
				setFormData(data.source);
			} catch (error) {
				console.error('Error fetching API source:', error);
				toast.error('Failed to load API source');
			} finally {
				setLoading(false);
			}
		}

		fetchSource();
	}, [params.id]);

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

	// Handle request config changes
	const handleRequestConfigChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				request_config: {
					...prev.configurations.request_config,
					[name]: value,
				},
			},
		}));
	};

	// Handle request config header changes
	const handleRequestHeaderChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				request_config: {
					...prev.configurations.request_config,
					headers: {
						...prev.configurations.request_config.headers,
						[name]: value,
					},
				},
			},
		}));
	};

	// Add a new request header
	const addRequestHeader = () => {
		const key = prompt('Enter header name:');
		if (!key) return;

		const value = prompt('Enter header value:');
		if (value === null) return;

		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				request_config: {
					...prev.configurations.request_config,
					headers: {
						...prev.configurations.request_config.headers,
						[key]: value,
					},
				},
			},
		}));
	};

	// Remove a request header
	const removeRequestHeader = (key) => {
		setFormData((prev) => {
			const newHeaders = { ...prev.configurations.request_config.headers };
			delete newHeaders[key];

			return {
				...prev,
				configurations: {
					...prev.configurations,
					request_config: {
						...prev.configurations.request_config,
						headers: newHeaders,
					},
				},
			};
		});
	};

	// Handle request body changes
	const handleRequestBodyChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				request_body: {
					...prev.configurations.request_body,
					[name]: value,
				},
			},
		}));
	};

	// Add a new request body parameter
	const addRequestBodyParam = () => {
		const key = prompt('Enter request body parameter name:');
		if (!key) return;

		const value = prompt('Enter request body parameter value:');
		if (value === null) return;

		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				request_body: {
					...prev.configurations.request_body,
					[key]: value,
				},
			},
		}));
	};

	// Remove a request body parameter
	const removeRequestBodyParam = (key) => {
		setFormData((prev) => {
			const newRequestBody = { ...prev.configurations.request_body };
			delete newRequestBody[key];

			return {
				...prev,
				configurations: {
					...prev.configurations,
					request_body: newRequestBody,
				},
			};
		});
	};

	// Handle detail config changes
	const handleDetailConfigChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				detail_config: {
					...prev.configurations.detail_config,
					[name]: type === 'checkbox' ? checked : value,
				},
			},
		}));
	};

	// Handle detail config header changes
	const handleDetailHeaderChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				detail_config: {
					...prev.configurations.detail_config,
					headers: {
						...prev.configurations.detail_config.headers,
						[name]: value,
					},
				},
			},
		}));
	};

	// Add a new detail header
	const addDetailHeader = () => {
		const key = prompt('Enter header name:');
		if (!key) return;

		const value = prompt('Enter header value:');
		if (value === null) return;

		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				detail_config: {
					...prev.configurations.detail_config,
					headers: {
						...prev.configurations.detail_config.headers,
						[key]: value,
					},
				},
			},
		}));
	};

	// Remove a detail header
	const removeDetailHeader = (key) => {
		setFormData((prev) => {
			const newHeaders = { ...prev.configurations.detail_config.headers };
			delete newHeaders[key];

			return {
				...prev,
				configurations: {
					...prev.configurations,
					detail_config: {
						...prev.configurations.detail_config,
						headers: newHeaders,
					},
				},
			};
		});
	};

	// Handle response mapping changes
	const handleResponseMappingChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				response_mapping: {
					...prev.configurations.response_mapping,
					[name]: value,
				},
			},
		}));
	};

	// Handle response config changes
	const handleResponseConfigChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			configurations: {
				...prev.configurations,
				response_config: {
					...prev.configurations.response_config,
					[name]: value,
				},
			},
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		try {
			const response = await fetch(`/api/funding/sources/${params.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update source');
			}

			toast.success('API source updated successfully');
			router.push(`/admin/funding-sources/${params.id}`);
		} catch (error) {
			console.error('Error updating API source:', error);
			toast.error('Failed to update API source');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='p-4 max-w-4xl mx-auto'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-2xl font-bold'>Edit API Source</h1>
					<Link
						href={`/admin/funding-sources/${params.id}`}
						className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center'>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Source
					</Link>
				</div>
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<p>Loading API source data...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='p-4 max-w-4xl mx-auto'>
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold'>Edit API Source</h1>
				<Link
					href={`/admin/funding-sources/${params.id}`}
					className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded flex items-center'>
					<ArrowLeft className='mr-2 h-4 w-4' />
					Back to Source
				</Link>
			</div>

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
								<option value='nonprofit'>Nonprofit</option>
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
								Handler Type
							</label>
							<select
								name='handler_type'
								value={formData.handler_type}
								onChange={handleChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'>
								<option value='standard'>Standard API</option>
								<option value='document'>Document API</option>
								<option value='statePortal'>State Portal</option>
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
							rows={3}
							className='w-full px-3 py-2 border border-gray-300 rounded-md'
						/>
					</div>
				</div>

				{/* API Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>API Configuration</h2>

					<div className='grid grid-cols-1 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Base URL *
							</label>
							<input
								type='url'
								name='url'
								value={formData.url}
								onChange={handleChange}
								required
								placeholder='https://api.example.com'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								API Endpoint
							</label>
							<input
								type='text'
								name='api_endpoint'
								value={formData.api_endpoint}
								onChange={handleChange}
								placeholder='/api/v1/funding-opportunities'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Documentation URL
							</label>
							<input
								type='url'
								name='api_documentation_url'
								value={formData.api_documentation_url}
								onChange={handleChange}
								placeholder='https://docs.example.com'
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
								<option value='api_key'>API Key</option>
								<option value='bearer'>Bearer Token</option>
								<option value='basic'>Basic Auth</option>
							</select>
						</div>

						{formData.auth_type !== 'none' && (
							<div className='space-y-4 p-4 bg-gray-50 rounded'>
								<h4 className='font-medium'>Authentication Details</h4>
								{formData.auth_type === 'api_key' && (
									<>
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												API Key
											</label>
											<input
												type='password'
												name='api_key'
												value={formData.auth_details.api_key || ''}
												onChange={handleAuthDetailsChange}
												className='w-full px-3 py-2 border border-gray-300 rounded-md'
											/>
										</div>
										<div>
											<label className='block text-sm font-medium text-gray-700 mb-1'>
												Header Name (optional)
											</label>
											<input
												type='text'
												name='header_name'
												value={formData.auth_details.header_name || ''}
												onChange={handleAuthDetailsChange}
												placeholder='X-API-Key'
												className='w-full px-3 py-2 border border-gray-300 rounded-md'
											/>
										</div>
									</>
								)}
								{formData.auth_type === 'bearer' && (
									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Bearer Token
										</label>
										<input
											type='password'
											name='token'
											value={formData.auth_details.token || ''}
											onChange={handleAuthDetailsChange}
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
									</div>
								)}
								{formData.auth_type === 'basic' && (
									<>
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
									</>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Query Parameters */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<div className='flex justify-between items-center mb-4'>
						<h2 className='text-xl font-semibold'>Query Parameters</h2>
						<button
							type='button'
							onClick={addQueryParam}
							className='bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm'>
							Add Parameter
						</button>
					</div>

					{Object.keys(formData.configurations.query_params).length > 0 ? (
						<div className='overflow-x-auto'>
							<table className='min-w-full border-collapse border border-gray-300'>
								<thead>
									<tr className='bg-gray-100'>
										<th className='border border-gray-300 px-4 py-2 text-left'>
											Parameter
										</th>
										<th className='border border-gray-300 px-4 py-2 text-left'>
											Value
										</th>
										<th className='border border-gray-300 px-4 py-2 text-left'>
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(formData.configurations.query_params).map(
										([key, value]) => (
											<tr key={key}>
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
					) : (
						<p className='text-gray-500 italic'>No query parameters configured</p>
					)}
				</div>

				{/* Request Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>Request Configuration</h2>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								HTTP Method
							</label>
							<select
								name='method'
								value={formData.configurations.request_config.method}
								onChange={handleRequestConfigChange}
								className='w-full px-3 py-2 border border-gray-300 rounded-md'>
								<option value='GET'>GET</option>
								<option value='POST'>POST</option>
								<option value='PUT'>PUT</option>
								<option value='DELETE'>DELETE</option>
							</select>
						</div>
					</div>

					<h3 className='text-lg font-medium mb-2'>Request Headers</h3>
					<div className='mb-4'>
						<button
							type='button'
							onClick={addRequestHeader}
							className='bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm'>
							Add Header
						</button>
					</div>

					{Object.keys(formData.configurations.request_config.headers)
						.length === 0 ? (
						<p className='text-gray-500 italic mb-4'>No headers configured</p>
					) : (
						<div className='overflow-x-auto mb-4'>
							<table className='min-w-full border border-gray-200'>
								<thead>
									<tr className='bg-gray-100'>
										<th className='py-2 px-4 border-b text-left'>Header</th>
										<th className='py-2 px-4 border-b text-left'>Value</th>
										<th className='py-2 px-4 border-b text-left'>Actions</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(
										formData.configurations.request_config.headers
									).map(([key, value]) => (
										<tr key={key} className='hover:bg-gray-50'>
											<td className='py-2 px-4 border-b'>{key}</td>
											<td className='py-2 px-4 border-b'>{value}</td>
											<td className='py-2 px-4 border-b'>
												<button
													type='button'
													onClick={() => removeRequestHeader(key)}
													className='bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs'>
													Remove
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Request Body Parameters (for POST/PUT) */}
				{(formData.configurations.request_config.method === 'POST' ||
					formData.configurations.request_config.method === 'PUT') && (
					<div className='bg-white p-6 rounded-lg shadow-md'>
						<h2 className='text-xl font-semibold mb-4'>
							Request Body Parameters
						</h2>
						<div className='mb-4'>
							<button
								type='button'
								onClick={addRequestBodyParam}
								className='bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm'>
								Add Parameter
							</button>
						</div>

						{Object.keys(formData.configurations.request_body).length === 0 ? (
							<p className='text-gray-500 italic mb-4'>
								No body parameters configured
							</p>
						) : (
							<div className='overflow-x-auto'>
								<table className='min-w-full border border-gray-200'>
									<thead>
										<tr className='bg-gray-100'>
											<th className='py-2 px-4 border-b text-left'>
												Parameter
											</th>
											<th className='py-2 px-4 border-b text-left'>Value</th>
											<th className='py-2 px-4 border-b text-left'>Actions</th>
										</tr>
									</thead>
									<tbody>
										{Object.entries(formData.configurations.request_body).map(
											([key, value]) => (
												<tr key={key} className='hover:bg-gray-50'>
													<td className='py-2 px-4 border-b'>{key}</td>
													<td className='py-2 px-4 border-b'>{value}</td>
													<td className='py-2 px-4 border-b'>
														<button
															type='button'
															onClick={() => removeRequestBodyParam(key)}
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
				)}

				{/* Response Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>Response Configuration</h2>
					<p className='text-sm text-gray-600 mb-4'>
						Configure how to extract data from the API response. These settings
						apply to both paginated and non-paginated responses.
					</p>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Response Data Path
							</label>
							<input
								type='text'
								name='responseDataPath'
								value={formData.configurations.response_config.responseDataPath}
								onChange={handleResponseConfigChange}
								placeholder='e.g., data.items'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
							<p className='text-xs text-gray-500 mt-1'>
								Path to the data array in the response. Use dot notation for
								nested fields.
							</p>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Total Count Path
							</label>
							<input
								type='text'
								name='totalCountPath'
								value={formData.configurations.response_config.totalCountPath}
								onChange={handleResponseConfigChange}
								placeholder='e.g., data.total'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
							<p className='text-xs text-gray-500 mt-1'>
								Path to the total count in the response. Use dot notation for
								nested fields.
							</p>
						</div>
					</div>
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

							<div className='col-span-2'>
								<label className='inline-flex items-center'>
									<input
										type='checkbox'
										name='inBody'
										checked={formData.configurations.pagination_config.inBody}
										onChange={handlePaginationConfigChange}
										className='mr-2'
									/>
									<span className='text-sm font-medium text-gray-700'>
										Place pagination parameters in request body (for POST
										requests)
									</span>
								</label>
								<p className='text-xs text-gray-500 mt-1 ml-6'>
									When enabled, pagination parameters will be included in the
									request body instead of query parameters. This is typically
									used with POST requests.
								</p>
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

									<div>
										<label className='block text-sm font-medium text-gray-700 mb-1'>
											Start Offset
										</label>
										<input
											type='number'
											name='startOffset'
											value={
												formData.configurations.pagination_config.startOffset || 0
											}
											onChange={handlePaginationConfigChange}
											min='0'
											className='w-full px-3 py-2 border border-gray-300 rounded-md'
										/>
										<p className='text-xs text-gray-500 mt-1'>
											Starting record number (0 = start from beginning)
										</p>
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

				{/* Detail Configuration */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>Detail Configuration</h2>
					<p className='text-sm text-gray-600 mb-4'>
						Configure a second API call to fetch detailed information for each
						item returned by the main API.
					</p>

					<div className='mb-4'>
						<label className='inline-flex items-center'>
							<input
								type='checkbox'
								name='enabled'
								checked={formData.configurations.detail_config.enabled}
								onChange={handleDetailConfigChange}
								className='mr-2'
							/>
							<span className='text-sm font-medium text-gray-700'>
								Enable Detail API Calls
							</span>
						</label>
					</div>

					{formData.configurations.detail_config.enabled && (
						<>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'>
								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Detail Endpoint
									</label>
									<input
										type='text'
										name='endpoint'
										value={formData.configurations.detail_config.endpoint}
										onChange={handleDetailConfigChange}
										placeholder='/api/v1/opportunities/{id}'
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
									<p className='text-xs text-gray-500 mt-1'>
										Use {'{id}'} as placeholder for the ID field value
									</p>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										HTTP Method
									</label>
									<select
										name='method'
										value={formData.configurations.detail_config.method}
										onChange={handleDetailConfigChange}
										className='w-full px-3 py-2 border border-gray-300 rounded-md'>
										<option value='GET'>GET</option>
										<option value='POST'>POST</option>
									</select>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										ID Field in Response
									</label>
									<input
										type='text'
										name='idField'
										value={formData.configurations.detail_config.idField}
										onChange={handleDetailConfigChange}
										placeholder='e.g., id'
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
									<p className='text-xs text-gray-500 mt-1'>
										Field name that contains the ID for detail calls
									</p>
								</div>

								<div>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										ID Parameter Name
									</label>
									<input
										type='text'
										name='idParam'
										value={formData.configurations.detail_config.idParam}
										onChange={handleDetailConfigChange}
										placeholder='e.g., id'
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
									<p className='text-xs text-gray-500 mt-1'>
										Parameter name for the ID in the detail API call
									</p>
								</div>

								<div className='col-span-2'>
									<label className='block text-sm font-medium text-gray-700 mb-1'>
										Detail Response Data Path
									</label>
									<input
										type='text'
										name='detailResponseDataPath'
										value={formData.configurations.detail_config.detailResponseDataPath}
										onChange={handleDetailConfigChange}
										placeholder='e.g., data'
										className='w-full px-3 py-2 border border-gray-300 rounded-md'
									/>
									<p className='text-xs text-gray-500 mt-1'>
										Path to extract the opportunity data from each detail API response. Use dot notation for nested fields (e.g., "data.opportunity"). Leave empty if the response root contains the opportunity data directly.
									</p>
								</div>
							</div>

							<h3 className='text-lg font-medium mb-2'>Detail Request Headers</h3>
							<div className='mb-4'>
								<button
									type='button'
									onClick={addDetailHeader}
									className='bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm'>
									Add Header
								</button>
							</div>

							{Object.keys(formData.configurations.detail_config.headers || {})
								.length === 0 ? (
								<p className='text-gray-500 italic mb-4'>
									No detail headers configured
								</p>
							) : (
								<div className='overflow-x-auto'>
									<table className='min-w-full border border-gray-200'>
										<thead>
											<tr className='bg-gray-100'>
												<th className='py-2 px-4 border-b text-left'>Header</th>
												<th className='py-2 px-4 border-b text-left'>Value</th>
												<th className='py-2 px-4 border-b text-left'>Actions</th>
											</tr>
										</thead>
										<tbody>
											{Object.entries(
												formData.configurations.detail_config.headers || {}
											).map(([key, value]) => (
												<tr key={key} className='hover:bg-gray-50'>
													<td className='py-2 px-4 border-b'>{key}</td>
													<td className='py-2 px-4 border-b'>{value}</td>
													<td className='py-2 px-4 border-b'>
														<button
															type='button'
															onClick={() => removeDetailHeader(key)}
															className='bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs'>
															Remove
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</>
					)}
				</div>

				{/* Response Mapping */}
				<div className='bg-white p-6 rounded-lg shadow-md'>
					<h2 className='text-xl font-semibold mb-4'>Response Mapping</h2>
					<p className='text-sm text-gray-600 mb-4'>
						Map API response fields to standard funding opportunity fields. Use
						dot notation for nested fields (e.g., "data.title").
					</p>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Title Field
							</label>
							<input
								type='text'
								name='title'
								value={formData.configurations.response_mapping.title}
								onChange={handleResponseMappingChange}
								placeholder='e.g., title'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Description Field
							</label>
							<input
								type='text'
								name='description'
								value={formData.configurations.response_mapping.description}
								onChange={handleResponseMappingChange}
								placeholder='e.g., description'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Funding Type Field
							</label>
							<input
								type='text'
								name='fundingType'
								value={formData.configurations.response_mapping.fundingType}
								onChange={handleResponseMappingChange}
								placeholder='e.g., type'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Agency Field
							</label>
							<input
								type='text'
								name='agency'
								value={formData.configurations.response_mapping.agency}
								onChange={handleResponseMappingChange}
								placeholder='e.g., agency.name'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Total Funding Field
							</label>
							<input
								type='text'
								name='totalFunding'
								value={formData.configurations.response_mapping.totalFunding}
								onChange={handleResponseMappingChange}
								placeholder='e.g., totalFunding'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Min Award Field
							</label>
							<input
								type='text'
								name='minAward'
								value={formData.configurations.response_mapping.minAward}
								onChange={handleResponseMappingChange}
								placeholder='e.g., minAward'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Max Award Field
							</label>
							<input
								type='text'
								name='maxAward'
								value={formData.configurations.response_mapping.maxAward}
								onChange={handleResponseMappingChange}
								placeholder='e.g., maxAward'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Open Date Field
							</label>
							<input
								type='text'
								name='openDate'
								value={formData.configurations.response_mapping.openDate}
								onChange={handleResponseMappingChange}
								placeholder='e.g., startDate'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Close Date Field
							</label>
							<input
								type='text'
								name='closeDate'
								value={formData.configurations.response_mapping.closeDate}
								onChange={handleResponseMappingChange}
								placeholder='e.g., endDate'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								Eligibility Field
							</label>
							<input
								type='text'
								name='eligibility'
								value={formData.configurations.response_mapping.eligibility}
								onChange={handleResponseMappingChange}
								placeholder='e.g., eligibility'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>

						<div>
							<label className='block text-sm font-medium text-gray-700 mb-1'>
								URL Field
							</label>
							<input
								type='text'
								name='url'
								value={formData.configurations.response_mapping.url}
								onChange={handleResponseMappingChange}
								placeholder='e.g., url'
								className='w-full px-3 py-2 border border-gray-300 rounded-md'
							/>
						</div>
					</div>
				</div>

				{/* Submit Button */}
				<div className='flex justify-end'>
					<button
						type='submit'
						disabled={saving}
						className={`px-6 py-2 rounded-md text-white font-medium flex items-center ${
							saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
						}`}>
						<Save className='mr-2 h-4 w-4' />
						{saving ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	);
}

'use client';

import { useState } from 'react';
import { sayHello } from '../utils/edge-functions';

export default function EdgeFunctionExample() {
	const [message, setMessage] = useState('');
	const [response, setResponse] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const handleSubmit = async (e) => {
		e.preventDefault();

		try {
			setLoading(true);
			setError(null);

			const { data, error } = await sayHello(message);

			if (error) {
				throw new Error(error);
			}

			setResponse(data);
		} catch (err) {
			console.error('Error calling Edge Function:', err);
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='p-6 max-w-md mx-auto bg-white rounded-xl shadow-md'>
			<h2 className='text-xl font-bold mb-4'>Edge Function Example</h2>

			<form onSubmit={handleSubmit} className='mb-4'>
				<div className='mb-4'>
					<label
						className='block text-gray-700 text-sm font-bold mb-2'
						htmlFor='message'>
						Message
					</label>
					<input
						id='message'
						type='text'
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						placeholder='Enter a message to send to the Edge Function'
						className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
					/>
				</div>

				<button
					type='submit'
					disabled={loading}
					className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50'>
					{loading ? 'Calling...' : 'Call Edge Function'}
				</button>
			</form>

			{error && (
				<div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
					<p className='font-bold'>Error</p>
					<p>{error}</p>
				</div>
			)}

			{response && (
				<div className='mt-4'>
					<h3 className='text-lg font-semibold mb-2'>Response:</h3>
					<pre className='bg-gray-100 p-4 rounded overflow-x-auto'>
						{JSON.stringify(response, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}

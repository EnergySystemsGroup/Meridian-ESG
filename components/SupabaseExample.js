'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function SupabaseExample() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const { user, signInWithEmail, signUpWithEmail, signOut, isAuthenticated } =
		useAuth();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	// Example function to fetch data from Supabase
	const fetchData = async () => {
		try {
			setLoading(true);
			// Replace 'your_table_name' with an actual table in your Supabase project
			const { data, error } = await supabase
				.from('your_table_name')
				.select('*');

			if (error) {
				throw error;
			}

			setData(data || []);
		} catch (error) {
			console.error('Error fetching data:', error);
			setError(error.message);
		} finally {
			setLoading(false);
		}
	};

	// Handle sign in
	const handleSignIn = async (e) => {
		e.preventDefault();
		const { error } = await signInWithEmail(email, password);
		if (error) {
			alert(error.message);
		} else {
			setEmail('');
			setPassword('');
		}
	};

	// Handle sign up
	const handleSignUp = async (e) => {
		e.preventDefault();
		const { error } = await signUpWithEmail(email, password);
		if (error) {
			alert(error.message);
		} else {
			alert('Check your email for the confirmation link!');
			setEmail('');
			setPassword('');
		}
	};

	// Handle sign out
	const handleSignOut = async () => {
		await signOut();
	};

	// Fetch data when the component mounts
	useEffect(() => {
		if (isAuthenticated) {
			fetchData();
		}
	}, [isAuthenticated]);

	return (
		<div className='p-6 max-w-md mx-auto bg-white rounded-xl shadow-md'>
			<h2 className='text-xl font-bold mb-4'>Supabase Example</h2>

			{isAuthenticated ? (
				<div>
					<p className='mb-4'>Welcome, {user.email}!</p>
					<button
						onClick={handleSignOut}
						className='px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600'>
						Sign Out
					</button>

					<div className='mt-6'>
						<h3 className='text-lg font-semibold mb-2'>Your Data:</h3>
						{loading ? (
							<p>Loading data...</p>
						) : error ? (
							<p className='text-red-500'>Error: {error}</p>
						) : data.length === 0 ? (
							<p>
								No data found. You might need to create a table in Supabase.
							</p>
						) : (
							<ul className='list-disc pl-5'>
								{data.map((item) => (
									<li key={item.id}>{JSON.stringify(item)}</li>
								))}
							</ul>
						)}

						<button
							onClick={fetchData}
							className='mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>
							Refresh Data
						</button>
					</div>
				</div>
			) : (
				<div>
					<form onSubmit={handleSignIn} className='mb-4'>
						<div className='mb-4'>
							<label
								className='block text-gray-700 text-sm font-bold mb-2'
								htmlFor='email'>
								Email
							</label>
							<input
								id='email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
								required
							/>
						</div>
						<div className='mb-6'>
							<label
								className='block text-gray-700 text-sm font-bold mb-2'
								htmlFor='password'>
								Password
							</label>
							<input
								id='password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className='shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
								required
							/>
						</div>
						<div className='flex items-center justify-between'>
							<button
								type='submit'
								className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline'>
								Sign In
							</button>
							<button
								type='button'
								onClick={handleSignUp}
								className='bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline'>
								Sign Up
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}

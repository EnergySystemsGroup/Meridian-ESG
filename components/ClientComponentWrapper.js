'use client';

import dynamic from 'next/dynamic';

// Use dynamic import with SSR disabled for the client components
const SupabaseExample = dynamic(() => import('./SupabaseExample'), {
	ssr: false,
});

const EdgeFunctionExample = dynamic(() => import('./EdgeFunctionExample'), {
	ssr: false,
});

export default function ClientComponentWrapper() {
	return (
		<>
			<div className='w-full max-w-md'>
				<SupabaseExample />
			</div>

			<div className='w-full max-w-md mt-8'>
				<EdgeFunctionExample />
			</div>
		</>
	);
}

'use client';

import React from 'react';
import FundingCategoryChart from '@/app/components/dashboard/FundingCategoryChart';
import { Container } from '@radix-ui/themes';

export default function FundingCategoryPage() {
	return (
		<Container>
			<div className='py-6'>
				<h2 className='text-3xl font-bold mb-6'>
					Funding by Category Analysis
				</h2>
				<p className='mb-8 text-gray-600'>
					This chart shows the distribution of funding opportunities across
					categories, helping identify which areas have the most financial
					resources available.
				</p>

				<div className='mb-6'>
					<FundingCategoryChart />
				</div>

				<div className='mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200'>
					<h3 className='text-xl font-semibold mb-2'>Insights</h3>
					<ul className='list-disc pl-5 space-y-2'>
						<li>
							Energy Efficiency and Renewable Energy consistently receive the
							highest funding allocations
						</li>
						<li>
							Environmental and Water Conservation categories show significant
							funding availability
						</li>
						<li>
							Categories are normalized to group similar funding types together
							for better analysis
						</li>
						<li>
							Data reflects current active funding opportunities across all
							available sources
						</li>
					</ul>
				</div>
			</div>
		</Container>
	);
}

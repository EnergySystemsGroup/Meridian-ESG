'use client';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function getStatusBadgeColor(status) {
	switch (status) {
		case 'started':
			return 'bg-blue-100 text-blue-800';
		case 'processing':
			return 'bg-yellow-100 text-yellow-800';
		case 'completed':
			return 'bg-green-100 text-green-800';
		case 'failed':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

export function RunStageCard({ title, description, status, metrics, loading }) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className='h-6 w-1/3 mb-2' />
					<Skeleton className='h-4 w-1/2' />
				</CardHeader>
				<CardContent>
					<div className='space-y-4'>
						<Skeleton className='h-4 w-full' />
						<Skeleton className='h-4 w-full' />
						<Skeleton className='h-4 w-2/3' />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className='flex justify-between items-start'>
					<div>
						<CardTitle>{title}</CardTitle>
						<CardDescription>{description}</CardDescription>
					</div>
					{status && (
						<Badge className={getStatusBadgeColor(status)}>{status}</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{metrics ? (
					<div className='space-y-4'>
						{Object.entries(metrics).map(([key, value]) => {
							// Skip null or undefined values
							if (value == null) return null;

							// Format the key for display
							const displayKey = key
								.split(/(?=[A-Z])|_/)
								.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
								.join(' ');

							// Format the value based on its type
							let displayValue = value;
							if (typeof value === 'number') {
								if (key.includes('time')) {
									displayValue = `${value.toFixed(2)}s`;
								} else if (Number.isInteger(value)) {
									displayValue = value.toLocaleString();
								} else {
									displayValue = value.toFixed(2);
								}
							} else if (Array.isArray(value)) {
								displayValue = value.join(', ');
							} else if (typeof value === 'object') {
								return (
									<div key={key}>
										<h4 className='text-sm font-medium'>{displayKey}</h4>
										<div className='text-sm text-muted-foreground pl-4'>
											{Object.entries(value).map(([subKey, subValue]) => (
												<div key={subKey}>
													{subKey}: {subValue}
												</div>
											))}
										</div>
									</div>
								);
							}

							return (
								<div key={key}>
									<h4 className='text-sm font-medium'>{displayKey}</h4>
									<p className='text-sm text-muted-foreground'>
										{displayValue}
									</p>
								</div>
							);
						})}
					</div>
				) : (
					<p className='text-sm text-muted-foreground'>No metrics available</p>
				)}
			</CardContent>
		</Card>
	);
}

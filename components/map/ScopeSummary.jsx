'use client';

import { Globe, Building2, MapPin, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Compact scope display configuration
const SCOPES = [
	{ key: 'national', label: 'National', icon: Globe, color: 'text-blue-600' },
	{ key: 'state_wide', label: 'State', icon: Building2, color: 'text-green-600' },
	{ key: 'county', label: 'County', icon: MapPin, color: 'text-orange-600' },
	{ key: 'utility', label: 'Utility', icon: Zap, color: 'text-purple-600' },
];

/**
 * ScopeSummary - Minimal read-only scope counts display
 * Shows compact breakdown of opportunities by coverage area
 */
export default function ScopeSummary({
	breakdown = {},
	selectedScopes = ['national', 'state_wide', 'county', 'utility'],
	className,
}) {
	// Calculate total based on selected scopes
	const total = SCOPES
		.filter((s) => selectedScopes.includes(s.key))
		.reduce((sum, s) => sum + (breakdown[s.key] || 0), 0);

	return (
		<div className={cn('py-2 px-3 bg-muted/30 rounded-lg', className)}>
			{/* Compact 2x2 grid of counts */}
			<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
				{SCOPES.map((scope) => {
					const Icon = scope.icon;
					const count = breakdown[scope.key] || 0;
					const isActive = selectedScopes.includes(scope.key);

					return (
						<div
							key={scope.key}
							className={cn(
								'flex items-center justify-between',
								!isActive && 'opacity-40'
							)}
						>
							<div className="flex items-center gap-1.5">
								<Icon className={cn('h-3.5 w-3.5', scope.color)} />
								<span className="text-muted-foreground">{scope.label}</span>
							</div>
							<span className={cn('font-medium', isActive ? scope.color : 'text-muted-foreground')}>
								{count}
							</span>
						</div>
					);
				})}
			</div>

			{/* Total row */}
			<div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-sm">
				<span className="text-muted-foreground">Total</span>
				<span className="font-semibold">{total.toLocaleString()} opportunities</span>
			</div>
		</div>
	);
}

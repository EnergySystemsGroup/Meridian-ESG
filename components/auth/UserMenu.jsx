'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { LogOut } from 'lucide-react';

export function UserMenu() {
	const { user, displayName, email, avatarUrl, signOut, loading } = useAuth();

	if (!user) {
		return null;
	}

	// Get initials for avatar fallback
	const initials = displayName
		? displayName
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: email?.charAt(0).toUpperCase() || 'U';

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant='ghost' className='relative h-9 w-9 rounded-full p-0'>
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={displayName || 'User avatar'}
							className='h-9 w-9 rounded-full object-cover'
						/>
					) : (
						<div className='h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium'>
							{initials}
						</div>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className='w-64' align='end'>
				<div className='space-y-4'>
					<div className='flex items-center gap-3'>
						{avatarUrl ? (
							<img
								src={avatarUrl}
								alt={displayName || 'User avatar'}
								className='h-10 w-10 rounded-full object-cover'
							/>
						) : (
							<div className='h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium'>
								{initials}
							</div>
						)}
						<div className='flex-1 min-w-0'>
							<p className='text-sm font-medium truncate'>
								{displayName || 'User'}
							</p>
							<p className='text-xs text-neutral-500 dark:text-neutral-400 truncate'>
								{email}
							</p>
						</div>
					</div>

					<div className='border-t border-neutral-200 dark:border-neutral-800 pt-3'>
						<Button
							variant='ghost'
							className='w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20'
							onClick={signOut}
							disabled={loading}>
							<LogOut className='h-4 w-4 mr-2' />
							Sign out
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

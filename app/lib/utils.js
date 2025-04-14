import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

// Add classNames utility function for conditional class joining
export function classNames(...classes) {
	return classes.filter(Boolean).join(' ');
}

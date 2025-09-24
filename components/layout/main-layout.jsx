'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuList,
	NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { HelpCircle, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

const ClientSideActiveLink = ({ href, children, className, ...props }) => {
	const pathname = usePathname();
	const isActive = pathname === href || pathname.startsWith(href + '/');

	// Calculate the active class name once
	const activeClassName = isActive
		? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
		: '';

	const combinedClassName = useMemo(() => {
		return cn(className, activeClassName);
	}, [className, activeClassName]);

	return (
		<Link href={href} prefetch={true} className={combinedClassName} {...props}>
			{children}
		</Link>
	);
};

const MainLayout = ({ children }) => {
	const { theme, setTheme } = useTheme();

	const toggleTheme = () => {
		setTheme(theme === 'dark' ? 'light' : 'dark');
	};

	return (
		<div className='flex min-h-screen flex-col'>
			<header className='sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-md'>
				<div className='max-w-[1400px] mx-auto w-full px-4 sm:px-6 md:px-8'>
					<div className='flex h-16 items-center justify-between'>
						{/* Logo and Brand Section */}
						<div className='flex items-center'>
							<Link href='/' prefetch={true} className='flex items-center group'>
								<div className='flex flex-col'>
									<span className='font-extrabold text-2xl md:text-3xl tracking-tight text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors'>
										Meridian
									</span>
									<span className='text-xs text-neutral-500 dark:text-neutral-400 tracking-wide'>
										Policy & Funding Intelligence
									</span>
								</div>
							</Link>
						</div>

						{/* Navigation Section - Centered */}
						<div className='hidden md:flex flex-1 justify-center ml-8'>
							<MainNav />
						</div>

						{/* Actions Section */}
						<div className='flex items-center gap-3'>
							<button
								onClick={toggleTheme}
								className='text-sm font-medium px-3 py-2 md:px-4 md:py-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-md transition-colors flex items-center gap-1.5'>
								{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
								<span className='hidden sm:inline'>
									{theme === 'dark' ? 'Light' : 'Dark'}
								</span>
							</button>
							<button className='text-sm font-medium px-3 py-2 md:px-4 md:py-2 text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-md transition-colors flex items-center gap-1.5'>
								<HelpCircle size={16} />
								<span className='hidden sm:inline'>Help</span>
							</button>
							<button className='text-sm font-medium px-3 py-2 md:px-4 md:py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5'>
								<Settings size={16} />
								<span className='hidden sm:inline'>Settings</span>
							</button>
						</div>
					</div>
				</div>
			</header>

			<main className='max-w-[1400px] mx-auto w-full px-4 sm:px-6 md:px-8 py-6 md:py-8 flex-1'>
				{children}
			</main>
		</div>
	);
};

const MainNav = () => {
	// Memoize common navigation class styles
	const navLinkClasses = cn(
		'inline-flex h-9 md:h-10 items-center justify-center rounded-md px-3 md:px-4 py-2 text-sm font-medium transition-all duration-200',
		'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400',
		'focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-900/20 dark:focus:text-blue-400 focus:outline-none',
		'text-neutral-700 dark:text-neutral-200'
	);

	return (
		<NavigationMenu>
			<NavigationMenuList className='gap-2 md:gap-4'>
				<NavigationMenuItem>
					<ClientSideActiveLink href='/' className={navLinkClasses}>
						Dashboard
					</ClientSideActiveLink>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger className={cn(navLinkClasses, 'group')}>
						Funding
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className='grid w-[400px] gap-4 p-6 md:w-[500px] md:grid-cols-2 lg:w-[600px] animate-in fade-in-50 zoom-in-95 duration-200'>
							{fundingNavItems.map((item) => (
								<ListItem
									key={item.title}
									title={item.title}
									href={item.href}
									comingSoon={item.comingSoon}>
									{item.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger className={cn(navLinkClasses, 'group')}>
						Legislation
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className='grid w-[400px] gap-4 p-6 md:w-[500px] md:grid-cols-2 lg:w-[600px] animate-in fade-in-50 zoom-in-95 duration-200'>
							{legislationNavItems.map((item) => (
								<ListItem
									key={item.title}
									title={item.title}
									href={item.href}
									comingSoon={item.comingSoon}>
									{item.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<ClientSideActiveLink href='/clients' className={navLinkClasses}>
						Clients
					</ClientSideActiveLink>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<ClientSideActiveLink href='/timeline' className={navLinkClasses}>
						Timeline
					</ClientSideActiveLink>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	);
};

const MobileNav = () => {
	const [isOpen, setIsOpen] = React.useState(false);

	return (
		<div className='md:hidden'>
			{/* Mobile menu button and implementation would go here */}
		</div>
	);
};

const ListItem = React.forwardRef(
	({ className, title, children, href, comingSoon, ...props }, ref) => {
		return (
			<li>
				<Link
					ref={ref}
					href={href}
					prefetch={true}
					className={cn(
						'block select-none space-y-1 rounded-md p-4 leading-none no-underline outline-none transition-all duration-200',
						'hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400',
						'focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-900/20 dark:focus:text-blue-400',
						className
					)}
					{...props}>
					<div className='flex items-center justify-between'>
						<div className='text-sm font-medium leading-none'>{title}</div>
						{comingSoon && (
							<span className='ml-2 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full'>
								Coming Soon
							</span>
						)}
					</div>
					<p className='line-clamp-2 text-sm leading-snug text-neutral-500 dark:text-neutral-400 mt-2'>
						{children}
					</p>
				</Link>
			</li>
		);
	}
);
ListItem.displayName = 'ListItem';

const fundingNavItems = [
	{
		title: 'Opportunity Explorer',
		href: '/funding/opportunities',
		description: 'Browse and filter all available funding opportunities.',
	},
	{
		title: 'Map View',
		href: '/map',
		description: 'Visualize funding opportunities by geographic region.',
	},
	{
		title: 'Funding Sources',
		href: '/funding/sources',
		description: 'Explore agencies and organizations that provide funding.',
	},
	{
		title: 'Application Tracker',
		href: '/funding/applications',
		description: 'Track the status of funding applications.',
	},
];

const legislationNavItems = [
	{
		title: 'Bill Tracker',
		href: '/legislation/bills',
		description: 'Monitor relevant legislation and policy changes.',
		comingSoon: true,
	},
	{
		title: 'Status Board',
		href: '/legislation/status-board',
		description: 'View legislation by stage in the approval process.',
		comingSoon: true,
	},
	{
		title: 'Impact Analysis',
		href: '/legislation/impact-analysis',
		description: 'Analyze how legislation affects funding opportunities.',
		comingSoon: true,
	},
	{
		title: 'Policy Trends',
		href: '/legislation/policy-trends',
		description: 'Identify emerging trends in policy and legislation.',
		comingSoon: true,
	},
];

export default MainLayout;

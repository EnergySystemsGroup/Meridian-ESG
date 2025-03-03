import React from 'react';
import Link from 'next/link';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
	navigationMenuTriggerStyle,
} from '@/app/components/ui/navigation-menu';
import { cn } from '@/app/utils/cn';

const MainLayout = ({ children }) => {
	return (
		<div className='flex min-h-screen flex-col'>
			<header className='sticky top-0 z-40 border-b bg-white dark:bg-neutral-900 shadow-sm'>
				<div className='container flex h-16 items-center justify-between py-3'>
					<div className='flex items-center gap-8'>
						<Link href='/' className='flex items-center space-x-2'>
							<span className='font-bold text-2xl tracking-tight text-blue-600 dark:text-blue-400'>
								Meridian
							</span>
							<span className='text-sm text-neutral-500 dark:text-neutral-400 hidden md:inline-block'>
								Policy & Funding Intelligence
							</span>
						</Link>
						<MainNav />
					</div>
					<div className='flex items-center gap-4'>
						<button className='text-sm text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
							Help
						</button>
						<button className='text-sm text-neutral-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'>
							Settings
						</button>
					</div>
				</div>
			</header>
			<main className='flex-1'>{children}</main>
		</div>
	);
};

const MainNav = () => {
	return (
		<NavigationMenu>
			<NavigationMenuList className='gap-1'>
				<NavigationMenuItem>
					<Link href='/' legacyBehavior passHref>
						<NavigationMenuLink
							className={cn(
								navigationMenuTriggerStyle(),
								'font-medium text-sm px-3'
							)}>
							Dashboard
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger className='font-medium text-sm px-3'>
						Funding
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className='grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]'>
							{fundingNavItems.map((item) => (
								<ListItem key={item.title} title={item.title} href={item.href}>
									{item.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger className='font-medium text-sm px-3'>
						Legislation
					</NavigationMenuTrigger>
					<NavigationMenuContent>
						<ul className='grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]'>
							{legislationNavItems.map((item) => (
								<ListItem key={item.title} title={item.title} href={item.href}>
									{item.description}
								</ListItem>
							))}
						</ul>
					</NavigationMenuContent>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link href='/clients' legacyBehavior passHref>
						<NavigationMenuLink
							className={cn(
								navigationMenuTriggerStyle(),
								'font-medium text-sm px-3'
							)}>
							Clients
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link href='/timeline' legacyBehavior passHref>
						<NavigationMenuLink
							className={cn(
								navigationMenuTriggerStyle(),
								'font-medium text-sm px-3'
							)}>
							Timeline
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
			</NavigationMenuList>
		</NavigationMenu>
	);
};

const ListItem = React.forwardRef(
	({ className, title, children, href, ...props }, ref) => {
		return (
			<li>
				<NavigationMenuLink asChild>
					<Link
						ref={ref}
						href={href}
						className={cn(
							'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-900/20 dark:focus:text-blue-400',
							className
						)}
						{...props}>
						<div className='text-sm font-medium leading-none'>{title}</div>
						<p className='line-clamp-2 text-sm leading-snug text-neutral-500 dark:text-neutral-400 mt-1'>
							{children}
						</p>
					</Link>
				</NavigationMenuLink>
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
		href: '/funding/map',
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
	},
	{
		title: 'Status Board',
		href: '/legislation/status',
		description: 'View legislation by stage in the approval process.',
	},
	{
		title: 'Impact Analysis',
		href: '/legislation/impact',
		description: 'Analyze how legislation affects funding opportunities.',
	},
	{
		title: 'Policy Trends',
		href: '/legislation/trends',
		description: 'Identify emerging trends in policy and legislation.',
	},
];

export default MainLayout;

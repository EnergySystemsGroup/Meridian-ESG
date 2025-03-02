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
			<header className='sticky top-0 z-40 border-b bg-background'>
				<div className='container flex h-16 items-center justify-between py-4'>
					<div className='flex items-center gap-6 md:gap-10'>
						<Link href='/' className='flex items-center space-x-2'>
							<span className='font-bold text-xl'>
								Policy & Funding Intelligence
							</span>
						</Link>
						<MainNav />
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
			<NavigationMenuList>
				<NavigationMenuItem>
					<Link href='/' legacyBehavior passHref>
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							Dashboard
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<NavigationMenuTrigger>Funding</NavigationMenuTrigger>
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
					<NavigationMenuTrigger>Legislation</NavigationMenuTrigger>
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
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
							Clients
						</NavigationMenuLink>
					</Link>
				</NavigationMenuItem>
				<NavigationMenuItem>
					<Link href='/timeline' legacyBehavior passHref>
						<NavigationMenuLink className={navigationMenuTriggerStyle()}>
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
							'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
							className
						)}
						{...props}>
						<div className='text-sm font-medium leading-none'>{title}</div>
						<p className='line-clamp-2 text-sm leading-snug text-muted-foreground'>
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

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

const NavigationMenu = React.forwardRef(
	({ className, children, ...props }, ref) => (
		<NavigationMenuPrimitive.Root
			ref={ref}
			className={cn(
				'relative z-10 flex max-w-max flex-1 items-center justify-center',
				className
			)}
			{...props}>
			{children}
			<NavigationMenuViewport />
		</NavigationMenuPrimitive.Root>
	)
);
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef(({ className, ...props }, ref) => (
	<NavigationMenuPrimitive.List
		ref={ref}
		className={cn(
			'group flex flex-1 list-none items-center justify-center',
			className
		)}
		{...props}
	/>
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
	'group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-900/20 dark:focus:text-blue-400 focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-blue-50/80 data-[active]:text-blue-600 dark:data-[active]:bg-blue-900/30 dark:data-[active]:text-blue-400 data-[state=open]:bg-blue-50 data-[state=open]:text-blue-600 dark:data-[state=open]:bg-blue-900/30 dark:data-[state=open]:text-blue-400'
);

const NavigationMenuTrigger = React.forwardRef(
	({ className, children, ...props }, ref) => (
		<NavigationMenuPrimitive.Trigger
			ref={ref}
			className={cn(navigationMenuTriggerStyle(), 'group', className)}
			{...props}>
			{children}{' '}
			<ChevronDown
				className='relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180'
				aria-hidden='true'
			/>
		</NavigationMenuPrimitive.Trigger>
	)
);
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef(
	({ className, ...props }, ref) => (
		<NavigationMenuPrimitive.Content
			ref={ref}
			className={cn(
				'left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto',
				className
			)}
			{...props}
		/>
	)
);
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef(
	({ className, ...props }, ref) => (
		<div className={cn('absolute left-0 top-full flex justify-center')}>
			<NavigationMenuPrimitive.Viewport
				className={cn(
					'origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]',
					className
				)}
				ref={ref}
				{...props}
			/>
		</div>
	)
);
NavigationMenuViewport.displayName =
	NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef(
	({ className, ...props }, ref) => (
		<NavigationMenuPrimitive.Indicator
			ref={ref}
			className={cn(
				'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
				className
			)}
			{...props}>
			<div className='relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-neutral-200 dark:bg-neutral-800 shadow-md' />
		</NavigationMenuPrimitive.Indicator>
	)
);
NavigationMenuIndicator.displayName =
	NavigationMenuPrimitive.Indicator.displayName;

export {
	navigationMenuTriggerStyle,
	NavigationMenu,
	NavigationMenuList,
	NavigationMenuItem,
	NavigationMenuContent,
	NavigationMenuTrigger,
	NavigationMenuLink,
	NavigationMenuIndicator,
	NavigationMenuViewport,
};

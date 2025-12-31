'use client';

import { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import legislationData from '@/data/legislation.json';

export default function LegislationPage() {
	const [statusFilter, setStatusFilter] = useState('All');
	const [jurisdictionFilter, setJurisdictionFilter] = useState('All');

	// Filter and sort bills based on current filters
	const filteredBills = useMemo(() => {
		return legislationData.bills
			.filter((bill) => {
				const matchesStatus = statusFilter === 'All' ||
					(statusFilter === 'Active' && (bill.status === 'active' || bill.status === 'passed-house')) ||
					(statusFilter === 'Enacted' && bill.status === 'enacted') ||
					bill.status === statusFilter.toLowerCase();
				const matchesJurisdiction = jurisdictionFilter === 'All' ||
					bill.jurisdiction === jurisdictionFilter.toLowerCase();
				return matchesStatus && matchesJurisdiction;
			})
			.sort((a, b) => {
				// Sort by last action date, most recent first
				const dateA = new Date(a.lastAction.date);
				const dateB = new Date(b.lastAction.date);
				return dateB - dateA;
			});
	}, [statusFilter, jurisdictionFilter]);

	return (
		<MainLayout>
			<div className='container py-10'>
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-bold'>Legislation Tracker</h1>
					<div className='flex gap-2'>
						<Button variant='outline'>Sort</Button>
						<Button>Export</Button>
					</div>
				</div>

				{/* Filter Controls */}
				<div className='flex gap-4 mb-6'>
					<div className='flex gap-2'>
						<Button
							variant={statusFilter === 'All' ? 'default' : 'outline'}
							onClick={() => setStatusFilter('All')}
							className='rounded-full'>
							All
						</Button>
						<Button
							variant={statusFilter === 'Active' ? 'default' : 'outline'}
							onClick={() => setStatusFilter('Active')}
							className='rounded-full'>
							Active
						</Button>
						<Button
							variant={statusFilter === 'Enacted' ? 'default' : 'outline'}
							onClick={() => setStatusFilter('Enacted')}
							className='rounded-full'>
							Enacted
						</Button>
					</div>
					<div className='flex gap-2 border-l pl-4'>
						<Button
							variant={jurisdictionFilter === 'All' ? 'default' : 'outline'}
							onClick={() => setJurisdictionFilter('All')}
							className='rounded-full'>
							All
						</Button>
						<Button
							variant={jurisdictionFilter === 'Federal' ? 'default' : 'outline'}
							onClick={() => setJurisdictionFilter('Federal')}
							className='rounded-full'>
							Federal
						</Button>
						<Button
							variant={jurisdictionFilter === 'California' ? 'default' : 'outline'}
							onClick={() => setJurisdictionFilter('California')}
							className='rounded-full'>
							California
						</Button>
					</div>
				</div>

				{/* Results summary */}
				<div className='text-sm text-muted-foreground mb-4'>
					Showing {filteredBills.length} of {legislationData.bills.length} bills
				</div>

				<div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8'>
					{filteredBills.map((bill) => (
						<BillCard key={bill.id} bill={bill} />
					))}
				</div>
			</div>
		</MainLayout>
	);
}

function BillCard({ bill }) {
	const {
		title,
		billNumber,
		jurisdiction,
		status,
		lastAction,
		summary,
		tags,
		sponsor,
		chamber,
		cosponsors,
		externalUrl,
	} = bill;

	return (
		<Card className='h-full flex flex-col'>
			<CardHeader className='pb-3'>
				<div className='flex justify-between items-start'>
					<CardTitle className='text-lg'>{title}</CardTitle>
					<span
						className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
							status
						)}`}>
						{formatStatus(status)}
					</span>
				</div>
				<CardDescription>
					{billNumber} | {formatJurisdiction(jurisdiction)} | {formatChamber(chamber)}
				</CardDescription>
			</CardHeader>
			<CardContent className='flex-1 flex flex-col'>
				<div className='space-y-4 flex-1'>
					<p className='text-sm text-muted-foreground line-clamp-2'>
						{summary}
					</p>

					<div className='flex flex-wrap gap-1'>
						{tags.slice(0, 3).map((tag) => (
							<span
								key={`${billNumber}-${tag}`}
								className='text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full'>
								{tag}
							</span>
						))}
						{tags.length > 3 && (
							<span className='text-xs text-muted-foreground px-2 py-1'>
								+{tags.length - 3} more
							</span>
						)}
					</div>

					<div className='grid grid-cols-2 gap-2 text-sm'>
						<div>
							<div className='text-muted-foreground'>Sponsor</div>
							<div className='font-medium truncate'>{sponsor}</div>
						</div>
						<div>
							<div className='text-muted-foreground'>Cosponsors</div>
							<div className='font-medium'>{cosponsors}</div>
						</div>
					</div>

					<div className='text-sm'>
						<div className='text-muted-foreground mb-1'>Last Action</div>
						<div className='font-medium'>{lastAction.date}</div>
						<div className='text-xs text-muted-foreground line-clamp-2'>
							{lastAction.description}
						</div>
					</div>
				</div>

				<div className='flex gap-2 mt-4'>
					{externalUrl && (
						<Button size='sm' className='flex-1 bg-blue-600 hover:bg-blue-700' asChild>
							<Link href={externalUrl} target='_blank' rel='noopener noreferrer'>
								<ExternalLink className='w-4 h-4 mr-1' />
								View Bill
							</Link>
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function getStatusColor(status) {
	switch (status) {
		case 'active':
			return 'bg-blue-100 text-blue-800';
		case 'passed-house':
			return 'bg-purple-100 text-purple-800';
		case 'enacted':
			return 'bg-green-100 text-green-800';
		case 'failed':
			return 'bg-red-100 text-red-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

function formatStatus(status) {
	switch (status) {
		case 'active':
			return 'Active';
		case 'passed-house':
			return 'Passed House';
		case 'enacted':
			return 'Enacted';
		case 'failed':
			return 'Failed';
		default:
			return status.charAt(0).toUpperCase() + status.slice(1);
	}
}

function formatJurisdiction(jurisdiction) {
	return jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1);
}

function formatChamber(chamber) {
	switch (chamber) {
		case 'house':
			return 'House';
		case 'senate':
			return 'Senate';
		case 'assembly':
			return 'Assembly';
		default:
			return chamber ? chamber.charAt(0).toUpperCase() + chamber.slice(1) : '';
	}
}

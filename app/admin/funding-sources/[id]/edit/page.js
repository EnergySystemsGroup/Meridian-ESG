'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function EditFundingSource() {
	const params = useParams();
	const router = useRouter();
	const supabase = createClientComponentClient();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState({
		name: '',
		type: '',
		agency_type: '',
		description: '',
		website: '',
		contact_email: '',
		contact_phone: '',
	});

	useEffect(() => {
		async function fetchSource() {
			try {
				setLoading(true);
				const { data, error } = await supabase
					.from('funding_sources')
					.select('*')
					.eq('id', params.id)
					.single();

				if (error) throw error;
				setFormData({
					name: data.name || '',
					type: data.type || '',
					agency_type: data.agency_type || '',
					description: data.description || '',
					website: data.website || '',
					contact_email: data.contact_email || '',
					contact_phone: data.contact_phone || '',
				});
			} catch (error) {
				console.error('Error fetching funding source:', error);
				toast.error('Failed to load funding source');
			} finally {
				setLoading(false);
			}
		}

		fetchSource();
	}, [params.id, supabase]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSelectChange = (name, value) => {
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		try {
			setSaving(true);
			const { error } = await supabase
				.from('funding_sources')
				.update(formData)
				.eq('id', params.id);

			if (error) throw error;
			toast.success('Funding source updated successfully');
			router.push(`/admin/funding-sources/${params.id}`);
		} catch (error) {
			console.error('Error updating funding source:', error);
			toast.error('Failed to update funding source');
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='container py-8'>
				<div className='flex items-center mb-6'>
					<Button variant='ghost' size='sm' asChild>
						<Link href={`/admin/funding-sources/${params.id}`}>
							<ArrowLeft className='mr-2 h-4 w-4' />
							Back to Funding Source
						</Link>
					</Button>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Edit Funding Source</CardTitle>
						<CardDescription>Loading funding source data...</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='space-y-4'>{/* Loading skeleton */}</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className='container py-8'>
			<div className='flex items-center mb-6'>
				<Button variant='ghost' size='sm' asChild>
					<Link href={`/admin/funding-sources/${params.id}`}>
						<ArrowLeft className='mr-2 h-4 w-4' />
						Back to Funding Source
					</Link>
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Edit Funding Source</CardTitle>
					<CardDescription>
						Update the details of this funding source
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit}>
					<CardContent>
						<div className='space-y-4'>
							<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
								<div className='space-y-2'>
									<Label htmlFor='name'>Name</Label>
									<Input
										id='name'
										name='name'
										value={formData.name}
										onChange={handleChange}
										required
									/>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='type'>Type</Label>
									<Select
										value={formData.type}
										onValueChange={(value) =>
											handleSelectChange('type', value)
										}>
										<SelectTrigger>
											<SelectValue placeholder='Select type' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='federal'>Federal</SelectItem>
											<SelectItem value='state'>State</SelectItem>
											<SelectItem value='local'>Local</SelectItem>
											<SelectItem value='private'>Private</SelectItem>
											<SelectItem value='nonprofit'>Nonprofit</SelectItem>
											<SelectItem value='utility'>Utility</SelectItem>
											<SelectItem value='other'>Other</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='agency_type'>Agency Type</Label>
									<Select
										value={formData.agency_type}
										onValueChange={(value) =>
											handleSelectChange('agency_type', value)
										}>
										<SelectTrigger>
											<SelectValue placeholder='Select agency type' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='federal'>Federal</SelectItem>
											<SelectItem value='state'>State</SelectItem>
											<SelectItem value='local'>Local</SelectItem>
											<SelectItem value='private'>Private</SelectItem>
											<SelectItem value='nonprofit'>Nonprofit</SelectItem>
											<SelectItem value='utility'>Utility</SelectItem>
											<SelectItem value='other'>Other</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='website'>Website</Label>
									<Input
										id='website'
										name='website'
										type='url'
										value={formData.website}
										onChange={handleChange}
										placeholder='https://example.com'
									/>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='contact_email'>Contact Email</Label>
									<Input
										id='contact_email'
										name='contact_email'
										type='email'
										value={formData.contact_email}
										onChange={handleChange}
										placeholder='contact@example.com'
									/>
								</div>

								<div className='space-y-2'>
									<Label htmlFor='contact_phone'>Contact Phone</Label>
									<Input
										id='contact_phone'
										name='contact_phone'
										value={formData.contact_phone}
										onChange={handleChange}
										placeholder='(123) 456-7890'
									/>
								</div>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='description'>Description</Label>
								<Textarea
									id='description'
									name='description'
									value={formData.description}
									onChange={handleChange}
									rows={4}
								/>
							</div>
						</div>
					</CardContent>
					<CardFooter className='flex justify-end'>
						<Button type='submit' disabled={saving}>
							<Save className='mr-2 h-4 w-4' />
							{saving ? 'Saving...' : 'Save Changes'}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}

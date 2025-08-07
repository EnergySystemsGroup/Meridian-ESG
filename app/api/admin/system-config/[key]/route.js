import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Create Supabase client with service role for admin operations
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/admin/system-config/[key] - Get a system config value
export async function GET(request, { params }) {
	try {
		const { key } = params;

		// Fetch the config value
		const { data, error } = await supabase
			.from('system_config')
			.select('value, description')
			.eq('key', key)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// Not found - return default value for known keys
				if (key === 'global_force_full_reprocessing') {
					return NextResponse.json({ value: false, description: 'Global force full reprocessing flag' });
				}
				return NextResponse.json({ error: 'Configuration key not found' }, { status: 404 });
			}
			throw error;
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error('Error fetching system config:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch system configuration' },
			{ status: 500 }
		);
	}
}

// PUT /api/admin/system-config/[key] - Update a system config value
export async function PUT(request, { params }) {
	try {
		const { key } = params;
		const body = await request.json();
		const { value } = body;

		// Validate the key
		const allowedKeys = ['global_force_full_reprocessing'];
		if (!allowedKeys.includes(key)) {
			return NextResponse.json(
				{ error: 'Invalid configuration key' },
				{ status: 400 }
			);
		}

		// Check if the config exists
		const { data: existing } = await supabase
			.from('system_config')
			.select('id')
			.eq('key', key)
			.single();

		let result;
		if (existing) {
			// Update existing config
			result = await supabase
				.from('system_config')
				.update({ 
					value: JSON.stringify(value),
					updated_at: new Date().toISOString()
				})
				.eq('key', key)
				.select()
				.single();
		} else {
			// Insert new config
			result = await supabase
				.from('system_config')
				.insert({
					key,
					value: JSON.stringify(value),
					description: key === 'global_force_full_reprocessing' 
						? 'When true, forces all sources to do full reprocessing on next run'
						: `Configuration for ${key}`
				})
				.select()
				.single();
		}

		if (result.error) {
			throw result.error;
		}

		// Log the change for audit purposes
		console.log(`[SystemConfig] Updated ${key} to ${JSON.stringify(value)}`);

		return NextResponse.json({ 
			success: true, 
			key, 
			value,
			message: `Configuration ${key} updated successfully`
		});
	} catch (error) {
		console.error('Error updating system config:', error);
		return NextResponse.json(
			{ error: 'Failed to update system configuration' },
			{ status: 500 }
		);
	}
}
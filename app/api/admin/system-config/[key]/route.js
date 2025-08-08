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
		const { key } = await params;

		// Fetch the config value
		const { data, error } = await supabase
			.from('system_config')
			.select('value, description')
			.eq('key', key)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// Not found
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
		const { key } = await params;
		const body = await request.json();
		const { value, description } = body;

		// Check if the config exists
		const { data: existing } = await supabase
			.from('system_config')
			.select('id')
			.eq('key', key)
			.single();

		let result;
		if (existing) {
			// Update existing config
			const updateData = { 
				value: JSON.stringify(value),
				updated_at: new Date().toISOString()
			};
			
			// Only update description if provided
			if (description !== undefined) {
				updateData.description = description;
			}
			
			result = await supabase
				.from('system_config')
				.update(updateData)
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
					description: description || `Configuration for ${key}`
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
			data: result.data
		});
	} catch (error) {
		console.error('Error updating system config:', error);
		return NextResponse.json(
			{ error: 'Failed to update system configuration' },
			{ status: 500 }
		);
	}
}

// DELETE /api/admin/system-config/[key] - Delete a system config value
export async function DELETE(request, { params }) {
	try {
		const { key } = await params;

		const { error } = await supabase
			.from('system_config')
			.delete()
			.eq('key', key);

		if (error) {
			throw error;
		}

		// Log the deletion for audit purposes
		console.log(`[SystemConfig] Deleted config key: ${key}`);

		return NextResponse.json({
			success: true,
			message: `Configuration key '${key}' deleted successfully`
		});
	} catch (error) {
		console.error('Error deleting system config:', error);
		return NextResponse.json(
			{ error: 'Failed to delete system configuration' },
			{ status: 500 }
		);
	}
}
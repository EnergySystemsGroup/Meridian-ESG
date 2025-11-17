/**
 * Individual Client API Routes
 *
 * GET /api/clients/[id] - Get single client
 * PUT /api/clients/[id] - Update client
 * DELETE /api/clients/[id] - Delete client
 */

import { createClient } from '@supabase/supabase-js';
import { geocodeAddress } from '@/lib/services/geocoder';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/clients/[id]
 * Get single client by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Client not found'
          },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      client
    });

  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]
 * Update client (re-geocodes if address changed)
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Get existing client to compare address
    const { data: existingClient, error: fetchError } = await supabase
      .from('clients')
      .select('address')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Client not found'
          },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Parse budget as numeric value (or null if not provided)
    let budget = null;
    if (body.budget !== null && body.budget !== undefined && body.budget !== '') {
      budget = typeof body.budget === 'number' ? body.budget : parseFloat(body.budget);
      if (isNaN(budget)) {
        budget = null;
      }
    }

    let updateData = {
      name: body.name,
      type: body.type,
      project_needs: body.project_needs || [],
      budget,
      contact: body.contact || null,
      description: body.description || null,
      dac: body.dac || false,
      updated_at: new Date().toISOString()
    };

    // Check if address changed - if so, re-geocode
    const addressChanged = body.address && body.address !== existingClient.address;

    if (addressChanged) {
      console.log(`[API] Address changed, re-geocoding: ${body.address}`);

      const geocodeResult = await geocodeAddress(body.address);

      if (!geocodeResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: `Geocoding failed: ${geocodeResult.error}`,
            geocodeError: true
          },
          { status: 400 }
        );
      }

      const { lat, lng } = geocodeResult.coordinates;
      const { city, county, state, stateCode, zipcode } = geocodeResult.location;

      // Find coverage areas for new location
      const { data: coverageAreas, error: coverageError } = await supabase
        .rpc('find_coverage_areas_for_point', {
          lng_param: lng,
          lat_param: lat
        });

      if (coverageError) {
        console.error('[API] Coverage area lookup error:', coverageError);
        throw coverageError;
      }

      const coverageAreaIds = coverageAreas?.map(ca => ca.id) || [];

      // Update with new geocoded data
      updateData = {
        ...updateData,
        address: geocodeResult.formattedAddress,
        location_point: `POINT(${lng} ${lat})`,
        coverage_area_ids: coverageAreaIds,
        state_code: stateCode,
        county_name: county,
        city,
        zipcode
      };

      console.log(`[API] Re-geocoded to: ${lat}, ${lng}`);
      console.log(`[API] Found ${coverageAreaIds.length} coverage areas`);
    }

    // Update client
    const { data: client, error: updateError } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Client update error:', updateError);
      throw updateError;
    }

    console.log(`[API] ✅ Updated client: ${client.id}`);

    return NextResponse.json({
      success: true,
      client,
      addressChanged
    });

  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete client
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API] Client delete error:', error);
      throw error;
    }

    console.log(`[API] ✅ Deleted client: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Client API Routes
 *
 * GET /api/clients - List all clients
 * POST /api/clients - Create new client
 */

import { createClient } from '@supabase/supabase-js';
import { geocodeAddress } from '@/lib/services/geocoder';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/clients
 * List all clients with their coverage areas
 */
export async function GET(request) {
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      clients: clients || [],
      count: clients?.length || 0
    });

  } catch (error) {
    console.error('Error fetching clients:', error);
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
 * POST /api/clients
 * Create new client with automatic geocoding and coverage area detection
 */
export async function POST(request) {
  try {
    const body = await request.json();

    // Comprehensive request logging
    console.log('[API] ==================== NEW CLIENT REQUEST ====================');
    console.log('[API] Request body:', JSON.stringify(body, null, 2));
    console.log('[API] Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasMapboxKey: !!process.env.MAPBOX_API_KEY
    });

    // Validate required fields
    const { name, type, address, project_needs } = body;

    if (!name || !type || !address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, type, address'
        },
        { status: 400 }
      );
    }

    // Step 1: Get coordinates and location data
    // Check if client-side autocomplete already provided this data
    let lat, lng, city, county, state, stateCode, zipcode;
    let geocodeResult;

    if (body._autofilledLocation && body._autofilledLocation.coordinates) {
      // Use autofilled data from Mapbox client-side autocomplete
      console.log(`[API] Using autofilled location data from client`);
      const autoData = body._autofilledLocation;
      lat = autoData.coordinates.lat;
      lng = autoData.coordinates.lng;
      city = autoData.location.city;
      county = autoData.location.county;
      state = autoData.location.state;
      stateCode = autoData.location.stateCode;
      zipcode = autoData.location.zipcode;

      geocodeResult = {
        success: true,
        coordinates: { lat, lng },
        location: { city, county, state, stateCode, zipcode },
        formattedAddress: autoData.address,
        source: 'client-autocomplete'
      };

      console.log(`[API] Client-provided coordinates: ${lat}, ${lng}`);
      console.log(`[API] Client-provided location: ${city}, ${county}, ${state} ${zipcode}`);
    } else {
      // Fall back to server-side geocoding
      console.log(`[API] Geocoding address: ${address}`);
      geocodeResult = await geocodeAddress(address);

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

      ({ lat, lng } = geocodeResult.coordinates);
      ({ city, county, state, stateCode, zipcode } = geocodeResult.location);

      console.log(`[API] Geocoded to: ${lat}, ${lng}`);
      console.log(`[API] Location: ${city}, ${county}, ${state} ${zipcode}`);
    }

    // Step 2: Find coverage areas for this point
    console.log(`[API] Finding coverage areas for point: lng=${lng}, lat=${lat}`);
    const { data: coverageAreas, error: coverageError } = await supabase
      .rpc('find_coverage_areas_for_point', {
        lng: lng,
        lat: lat
      });

    if (coverageError) {
      console.error('[API] Coverage area lookup error:', coverageError);
      throw coverageError;
    }

    const coverageAreaIds = coverageAreas?.map(ca => ca.id) || [];
    console.log(`[API] Found ${coverageAreaIds.length} coverage areas`);

    // Step 3: Insert client into database
    // Parse budget as numeric value (or null if not provided)
    let budget = null;
    if (body.budget !== null && body.budget !== undefined && body.budget !== '') {
      budget = typeof body.budget === 'number' ? body.budget : parseFloat(body.budget);
      if (isNaN(budget)) {
        console.error('[API] Invalid budget value:', body.budget);
        return NextResponse.json(
          {
            success: false,
            error: `Invalid budget value: ${body.budget}. Please enter a valid number.`
          },
          { status: 400 }
        );
      }
      if (budget < 0) {
        console.error('[API] Negative budget value:', budget);
        return NextResponse.json(
          {
            success: false,
            error: 'Budget cannot be negative'
          },
          { status: 400 }
        );
      }
    }

    // Validate coordinates
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('[API] Invalid coordinates:', { lat, lng });
      return NextResponse.json(
        {
          success: false,
          error: `Invalid coordinates obtained from geocoding: lat=${lat}, lng=${lng}`
        },
        { status: 400 }
      );
    }

    const clientData = {
      name,
      type,
      address: geocodeResult.formattedAddress,
      location_point: `POINT(${lng} ${lat})`,
      coverage_area_ids: coverageAreaIds,
      state_code: stateCode,
      county_name: county,
      city,
      zipcode,
      project_needs: project_needs || [],
      budget,
      contact: body.contact || null,
      description: body.description || null,
      dac: body.dac || false
    };

    // Log the data being inserted
    console.log('[API] Inserting client data:', {
      ...clientData,
      location_point: clientData.location_point // Show the WKT string
    });

    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (insertError) {
      console.error('[API] Client insert error:', insertError);
      console.error('[API] Error code:', insertError.code);
      console.error('[API] Error details:', insertError.details);

      // Provide more specific error messages based on error codes
      let userMessage = insertError.message;

      // Check for common database errors
      if (insertError.code === '23505') {
        userMessage = 'A client with this information already exists';
      } else if (insertError.code === '23503') {
        userMessage = 'Invalid reference data (foreign key constraint)';
      } else if (insertError.code === '42501') {
        userMessage = 'Permission denied - check database policies';
      } else if (insertError.message?.includes('coverage_area_ids')) {
        userMessage = 'Invalid coverage area data';
      } else if (insertError.message?.includes('location_point')) {
        userMessage = 'Invalid location point format';
      }

      return NextResponse.json(
        {
          success: false,
          error: userMessage,
          details: process.env.NODE_ENV === 'development' ? {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details
          } : undefined
        },
        { status: 500 }
      );
    }

    console.log(`[API] ✅ Created client: ${client.id}`);

    return NextResponse.json({
      success: true,
      client,
      geocode: {
        coordinates: { lat, lng },
        location: { city, county, state, stateCode, zipcode }
      },
      coverageAreas: coverageAreas || []
    });

  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

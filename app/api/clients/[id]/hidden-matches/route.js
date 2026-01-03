/**
 * Hidden Matches API Routes
 *
 * GET /api/clients/[id]/hidden-matches - List hidden matches
 * POST /api/clients/[id]/hidden-matches - Hide a match
 * DELETE /api/clients/[id]/hidden-matches - Unhide a match
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/**
 * GET /api/clients/[id]/hidden-matches
 * List all hidden matches for a client with opportunity details
 */
export async function GET(request, { params }) {
  try {
    const { id: clientId } = params;

    const { data: hiddenMatches, error } = await supabase
      .from('hidden_matches')
      .select(`
        id,
        opportunity_id,
        hidden_at,
        hidden_by,
        reason,
        funding_opportunities (
          id, title, agency_name, maximum_award, close_date, status
        )
      `)
      .eq('client_id', clientId)
      .order('hidden_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      hiddenMatches: hiddenMatches || [],
      count: hiddenMatches?.length || 0
    });

  } catch (error) {
    console.error('Error fetching hidden matches:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/hidden-matches
 * Hide a match (add to hidden_matches)
 */
export async function POST(request, { params }) {
  try {
    const { id: clientId } = params;
    const body = await request.json();
    const { opportunityId, reason, hiddenBy } = body;

    if (!opportunityId) {
      return NextResponse.json(
        { success: false, error: 'opportunityId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('hidden_matches')
      .insert({
        client_id: clientId,
        opportunity_id: opportunityId,
        reason: reason || null,
        hidden_by: hiddenBy || 'user'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This match is already hidden' },
          { status: 409 }
        );
      }
      throw error;
    }

    console.log(`[HiddenMatches] ✅ Hidden match: client=${clientId}, opportunity=${opportunityId}`);

    return NextResponse.json({
      success: true,
      hiddenMatch: data,
      message: 'Match hidden successfully'
    });

  } catch (error) {
    console.error('Error hiding match:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/hidden-matches
 * Unhide a match (remove from hidden_matches)
 */
export async function DELETE(request, { params }) {
  try {
    const { id: clientId } = params;
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get('opportunityId');

    if (!opportunityId) {
      return NextResponse.json(
        { success: false, error: 'opportunityId query parameter is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('hidden_matches')
      .delete()
      .eq('client_id', clientId)
      .eq('opportunity_id', opportunityId);

    if (error) throw error;

    console.log(`[HiddenMatches] ✅ Restored match: client=${clientId}, opportunity=${opportunityId}`);

    return NextResponse.json({
      success: true,
      message: 'Match restored successfully'
    });

  } catch (error) {
    console.error('Error restoring match:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

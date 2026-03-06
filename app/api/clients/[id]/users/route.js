/**
 * Client Users API Route
 *
 * GET /api/clients/[id]/users - Get assigned user IDs for a client
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { data: rows, error } = await supabase
      .from('client_users')
      .select('user_id')
      .eq('client_id', id);

    if (error) throw error;

    const userIds = (rows || []).map((r) => r.user_id);

    return NextResponse.json({ success: true, user_ids: userIds });
  } catch (error) {
    console.error('[API] Error fetching client users:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

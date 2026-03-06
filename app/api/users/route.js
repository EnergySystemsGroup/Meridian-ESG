/**
 * Users API Route
 *
 * GET /api/users - List all workspace users for client assignment
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/**
 * GET /api/users
 * Returns all auth users with id, display_name, email.
 */
export async function GET() {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) throw error;

    const mapped = (users || [])
      .map((u) => ({
        id: u.id,
        display_name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email ||
          'Unknown User',
        email: u.email || '',
      }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    return NextResponse.json({ success: true, users: mapped });
  } catch (error) {
    console.error('[API /users] Error listing users:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

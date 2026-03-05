import { NextResponse } from 'next/server';
import { createAdminClient, requireRole } from '@/utils/supabase/api';

// POST /api/admin/review/approve - Bulk approve pending_review or rejected records
export async function POST(request) {
	try {
		const { authorized } = await requireRole(request, ['admin']);
		if (!authorized) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { supabase } = createAdminClient(request);
		const { ids, reviewed_by } = await request.json();

		if (!ids || !Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json(
				{ error: 'ids array is required and must not be empty' },
				{ status: 400 }
			);
		}

		if (!reviewed_by) {
			return NextResponse.json(
				{ error: 'reviewed_by is required' },
				{ status: 400 }
			);
		}

		const { data, error } = await supabase
			.from('funding_opportunities')
			.update({
				promotion_status: 'promoted',
				reviewed_by,
				reviewed_at: new Date().toISOString(),
			})
			.in('id', ids)
			.in('promotion_status', ['pending_review', 'rejected'])
			.select('id');

		if (error) throw error;

		console.log(`[AdminReview] Approved ${data.length} records by ${reviewed_by}`);

		return NextResponse.json({
			success: true,
			updated_count: data.length,
			ids: data.map(d => d.id),
		});
	} catch (error) {
		console.error('[AdminReview] Error approving records:', error);
		return NextResponse.json(
			{ error: 'Failed to approve records' },
			{ status: 500 }
		);
	}
}

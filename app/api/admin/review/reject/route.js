import { NextResponse } from 'next/server';
import { createAdminClient, requireRole } from '@/utils/supabase/api';

// POST /api/admin/review/reject - Bulk reject pending_review records
export async function POST(request) {
	try {
		const { authorized } = await requireRole(request, ['admin']);
		if (!authorized) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { supabase } = createAdminClient(request);
		const { ids, reviewed_by, review_notes } = await request.json();

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
				promotion_status: 'rejected',
				reviewed_by,
				reviewed_at: new Date().toISOString(),
				review_notes: review_notes || null,
			})
			.in('id', ids)
			.eq('promotion_status', 'pending_review')
			.select('id');

		if (error) throw error;

		console.log(`[AdminReview] Rejected ${data.length} records by ${reviewed_by}: ${review_notes || '(no notes)'}`);

		return NextResponse.json({
			success: true,
			updated_count: data.length,
			ids: data.map(d => d.id),
		});
	} catch (error) {
		console.error('[AdminReview] Error rejecting records:', error);
		return NextResponse.json(
			{ error: 'Failed to reject records' },
			{ status: 500 }
		);
	}
}

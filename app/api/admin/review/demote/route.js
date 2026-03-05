import { NextResponse } from 'next/server';
import { createAdminClient, requireRole } from '@/utils/supabase/api';

// POST /api/admin/review/demote - Demote a promoted/null record to rejected
export async function POST(request) {
	try {
		const { authorized } = await requireRole(request, ['admin']);
		if (!authorized) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { supabase } = createAdminClient(request);
		const { id, reviewed_by, review_notes } = await request.json();

		if (!id) {
			return NextResponse.json(
				{ error: 'id is required' },
				{ status: 400 }
			);
		}

		if (!reviewed_by) {
			return NextResponse.json(
				{ error: 'reviewed_by is required' },
				{ status: 400 }
			);
		}

		// Fetch current record to check eligibility
		const { data: current, error: fetchError } = await supabase
			.from('funding_opportunities')
			.select('id, promotion_status')
			.eq('id', id)
			.single();

		if (fetchError) {
			if (fetchError.code === 'PGRST116') {
				return NextResponse.json({ error: 'Record not found' }, { status: 404 });
			}
			throw fetchError;
		}

		// Guard: only promoted or null can be demoted
		if (current.promotion_status !== 'promoted' && current.promotion_status !== null) {
			return NextResponse.json(
				{ error: `Cannot demote record with status '${current.promotion_status}'. Only promoted or null records can be demoted.` },
				{ status: 400 }
			);
		}

		const previousStatus = current.promotion_status;

		const { error: updateError } = await supabase
			.from('funding_opportunities')
			.update({
				promotion_status: 'rejected',
				reviewed_by,
				reviewed_at: new Date().toISOString(),
				review_notes: review_notes || null,
			})
			.eq('id', id);

		if (updateError) throw updateError;

		console.log(`[AdminReview] Demoted record ${id} from '${previousStatus}' to 'rejected' by ${reviewed_by}`);

		return NextResponse.json({
			success: true,
			id,
			previous_status: previousStatus,
			new_status: 'rejected',
		});
	} catch (error) {
		console.error('[AdminReview] Error demoting record:', error);
		return NextResponse.json(
			{ error: 'Failed to demote record' },
			{ status: 500 }
		);
	}
}

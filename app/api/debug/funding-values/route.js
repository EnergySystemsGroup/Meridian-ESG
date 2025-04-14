import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function GET() {
	try {
		// Call our debug function
		const { data, error } = await supabase.rpc('debug_funding_values');

		if (error) {
			console.error('Error fetching debug data:', error);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		// Get California funding from both functions
		const v1Result = await supabase.rpc('get_funding_by_state');
		const v3Result = await supabase.rpc('get_funding_by_state_v3');

		// Log the full results for debugging
		console.log('V1 data first 5 states:', v1Result.data?.slice(0, 5));
		console.log('V3 data first 5 states:', v3Result.data?.slice(0, 5));

		// Extract California data
		const caliDataV1 = v1Result.data?.find((d) => d.state === 'California');
		const caliDataV3 = v3Result.data?.find((d) => d.state === 'California');

		// Calculate the multiplier difference between v1 and v3 values
		const multiplier =
			caliDataV3 && caliDataV1
				? Math.round((caliDataV3.value / caliDataV1.value) * 100) / 100
				: 'unknown';

		return NextResponse.json({
			success: true,
			debug_data: data,
			california_v1: caliDataV1,
			california_v3: caliDataV3,
			cali_comparison: {
				v1_value: caliDataV1?.value,
				v3_value: caliDataV3?.value,
				difference: caliDataV3?.value - caliDataV1?.value,
				multiplier: multiplier,
				matching: caliDataV1?.value === caliDataV3?.value,
			},
			v1_error: v1Result.error,
			v3_error: v3Result.error,
		});
	} catch (error) {
		console.error('API Debug Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}

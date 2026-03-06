import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import React from 'react';

// Import PDF components
import { ClientMatchesPDF } from '@/lib/pdf';

// Initialize Supabase client with secret key (server-side, bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/**
 * POST /api/export/client-matches-pdf
 *
 * Server-side PDF generation for larger exports.
 * Reads from persisted client_matches table instead of making
 * a nested HTTP call to /api/client-matching.
 *
 * Body: {
 *   clientId: string,
 *   options: {
 *     viewMode: 'summary' | 'detailed',
 *     includeCover: boolean,
 *     sortBy: 'deadline' | 'score' | 'amount'
 *   }
 * }
 */
export async function POST(request) {
  try {
    const { clientId, options = {} } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // 1. Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // 2. Fetch persisted matches with opportunity details
    const { data: matchRows, error: matchError } = await supabase
      .from('client_matches')
      .select(`
        score, match_details,
        opportunity:funding_opportunities!inner(*)
      `)
      .eq('client_id', clientId)
      .eq('is_stale', false)
      .order('score', { ascending: false })
      .limit(10000);

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to fetch client matches' },
        { status: 500 }
      );
    }

    // 3. Exclude hidden matches
    const { data: hiddenRows } = await supabase
      .from('hidden_matches')
      .select('opportunity_id')
      .eq('client_id', clientId)
      .limit(10000);

    const hiddenIds = new Set((hiddenRows || []).map(h => h.opportunity_id));

    // 4. Transform to shape expected by PDF component
    const matches = (matchRows || [])
      .filter(row => !hiddenIds.has(row.opportunity.id))
      .map(row => ({
        ...row.opportunity,
        score: row.score,
        matchDetails: row.match_details
      }));

    // 5. Generate PDF
    const pdfDoc = React.createElement(ClientMatchesPDF, {
      client,
      matches,
      options,
    });

    const pdfBuffer = await renderToBuffer(pdfDoc);

    // Generate filename
    const clientName = client.name
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const filename = `${clientName}-funding-matches-${date}.pdf`;

    // Return PDF with appropriate headers
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: `Failed to generate PDF: ${error.message}` },
      { status: 500 }
    );
  }
}

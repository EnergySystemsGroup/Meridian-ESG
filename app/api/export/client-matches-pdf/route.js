import { NextResponse } from 'next/server';
import ReactPDF from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import React from 'react';

// Import PDF components
import { ClientMatchesPDF } from '@/lib/pdf';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * POST /api/export/client-matches-pdf
 *
 * Server-side PDF generation for larger exports
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

    // Fetch client data
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

    // Fetch matches using the existing matching API logic
    const matchesResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/client-matching?clientId=${clientId}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!matchesResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch client matches' },
        { status: 500 }
      );
    }

    const matchesData = await matchesResponse.json();

    if (!matchesData.success) {
      return NextResponse.json(
        { error: matchesData.error || 'Failed to fetch matches' },
        { status: 500 }
      );
    }

    const matches = matchesData.results?.matches || [];

    // Generate PDF
    const pdfDoc = React.createElement(ClientMatchesPDF, {
      client: matchesData.results?.client || client,
      matches,
      options,
    });

    const pdfBuffer = await ReactPDF.renderToBuffer(pdfDoc);

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

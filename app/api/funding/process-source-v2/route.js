import { NextResponse } from 'next/server';

/**
 * V2 Process Source API Route
 * 
 * Lightweight Vercel endpoint that triggers Supabase Edge Function
 * for long-running AI processing without timeout constraints.
 * 
 * Flow:
 * 1. Receive request from frontend
 * 2. Trigger Supabase Edge Function (async)
 * 3. Return immediate response with job tracking
 * 4. Edge Function handles actual processing
 */
export async function POST(request) {
  try {
    const { sourceId, runId } = await request.json();
    
    if (!sourceId) {
      return NextResponse.json(
        { error: 'sourceId is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 V2 API: Triggering Edge Function for source: ${sourceId}`);

    // Determine Edge Function URL based on environment
    const functionsUrl = process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:54321/functions/v1'
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

    // Trigger Supabase Edge Function
    const edgeResponse = await fetch(`${functionsUrl}/process-source`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sourceId, runId })
    });

    if (!edgeResponse.ok) {
      const errorText = await edgeResponse.text();
      throw new Error(`Edge Function failed: ${errorText}`);
    }

    const result = await edgeResponse.json();
    
    console.log(`✅ V2 API: Edge Function triggered successfully for ${sourceId}`);

    // Return immediate response to user
    return NextResponse.json({
      status: 'triggered',
      message: 'V2 processing started in Edge Function',
      sourceId,
      runId,
      edgeFunction: {
        environment: result.environment,
        version: result.version,
        processingTime: result.processingTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ V2 API Error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to trigger V2 processing',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 
// Test imports disabled for production builds

/**
 * Debug API route to test AnthropicClient performance
 * 
 * Usage:
 * GET /api/debug/anthropic-client?test=quick
 * GET /api/debug/anthropic-client?test=full
 * GET /api/debug/anthropic-client?test=schemas
 */
export async function GET(request) {
  // Tests disabled in production builds
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ 
      message: 'Debug tests are disabled in production',
      environment: process.env.NODE_ENV 
    });
  }

  const { searchParams } = new URL(request.url);
  const test = searchParams.get('test') || 'quick';

  console.log(`🧪 Running AnthropicClient test: ${test}`);

  try {
    // Dynamic imports for development only, using the CORRECT path
    const { testAnthropicClient, quickTest, testSchemas } = await import('../../../../lib/agents-v2/tests/anthropicClient.test.js');
    
    let result;

    switch (test) {
      case 'quick':
        result = await quickTest();
        break;
        
      case 'full':
        result = await testAnthropicClient();
        break;
        
      case 'schemas':
        result = await testSchemas();
        break;
        
      default:
        return Response.json({ 
          error: 'Invalid test type. Use: quick, full, or schemas' 
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      testType: test,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ AnthropicClient test failed:', error);
    
    return Response.json({
      success: false,
      testType: test,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 
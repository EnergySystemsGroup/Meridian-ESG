// MSW Request Handlers for All API Endpoints
const { http, HttpResponse, delay, passthrough } = require('msw')

// Mock data fixtures
const mockFundingOpportunity = {
  id: '1',
  title: 'Clean Energy Innovation Grant',
  description: 'Funding for renewable energy projects',
  total_funding_available_usd: 5000000,
  max_award_usd: 500000,
  min_award_usd: 50000,
  estimated_funding_usd: 250000,
  cost_sharing_requirement: 'Yes',
  funding_type: 'Grant',
  eligibility_criteria: 'Non-profits and small businesses',
  eligible_locations: ['California', 'New York', 'Texas'],
  application_deadline: '2024-12-31T23:59:59Z',
  posted_date: '2024-01-01T00:00:00Z',
  source_id: 'grants-gov',
  external_id: 'GRANT-2024-001',
  source_url: 'https://www.grants.gov/example',
  agency_name: 'Department of Energy',
  status: 'active',
  match_score: 85,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockFundingSource = {
  id: 'grants-gov',
  name: 'Grants.gov',
  api_endpoint: 'https://api.grants.gov/v2/opportunities',
  api_key: 'test-api-key',
  is_active: true,
  last_fetched_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  config: {
    rate_limit: 100,
    batch_size: 50,
  },
}

const mockRun = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  source_id: 'grants-gov',
  status: 'completed',
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  opportunities_found: 150,
  opportunities_processed: 145,
  opportunities_failed: 5,
  error_message: null,
  metadata: {
    duration_ms: 45000,
    average_processing_time_ms: 300,
  },
}

const mockSystemConfig = {
  id: 1,
  key: 'processing_batch_size',
  value: '50',
  description: 'Number of opportunities to process in each batch',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  role: 'admin',
  created_at: new Date().toISOString(),
}

// API Route Handlers
const handlers = [
  // Funding Opportunities Endpoints
  http.get('/api/funding-opportunities', async ({ request }) => {
    await delay(100) // Simulate network delay
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    
    const opportunities = Array.from({ length: limit }, (_, i) => ({
      ...mockFundingOpportunity,
      id: `${page}-${i}`,
      title: `${mockFundingOpportunity.title} ${page}-${i}`,
    }))

    return HttpResponse.json({
      data: opportunities,
      total: 150,
      page,
      limit,
      totalPages: Math.ceil(150 / limit),
    })
  }),

  http.get('/api/funding-opportunities/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({
      ...mockFundingOpportunity,
      id: params.id,
    })
  }),

  http.post('/api/funding-opportunities', async ({ request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockFundingOpportunity,
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.put('/api/funding-opportunities/:id', async ({ params, request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockFundingOpportunity,
      ...body,
      id: params.id,
      updated_at: new Date().toISOString(),
    })
  }),

  http.delete('/api/funding-opportunities/:id', async () => {
    await delay(50)
    return new HttpResponse(null, { status: 204 })
  }),

  // Funding Sources CRUD Operations
  http.get('/api/funding-sources', async () => {
    await delay(100)
    return HttpResponse.json({
      data: [mockFundingSource],
      total: 1,
    })
  }),

  http.get('/api/funding-sources/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({
      ...mockFundingSource,
      id: params.id,
    })
  }),

  http.post('/api/funding-sources', async ({ request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockFundingSource,
      ...body,
      id: body.id || Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.put('/api/funding-sources/:id', async ({ params, request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockFundingSource,
      ...body,
      id: params.id,
      updated_at: new Date().toISOString(),
    })
  }),

  http.delete('/api/funding-sources/:id', async () => {
    await delay(50)
    return new HttpResponse(null, { status: 204 })
  }),

  // Admin System Configuration
  http.get('/api/admin/config', async () => {
    await delay(100)
    return HttpResponse.json({
      data: [mockSystemConfig],
    })
  }),

  http.get('/api/admin/config/:key', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({
      ...mockSystemConfig,
      key: params.key,
    })
  }),

  http.put('/api/admin/config/:key', async ({ params, request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockSystemConfig,
      key: params.key,
      value: body.value,
      updated_at: new Date().toISOString(),
    })
  }),

  // Run Management Endpoints
  http.get('/api/runs', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    const runs = Array.from({ length: 5 }, (_, i) => ({
      ...mockRun,
      id: `run-${i}`,
      status: status || ['pending', 'processing', 'completed', 'failed'][i % 4],
    }))

    return HttpResponse.json({
      data: runs,
      total: 5,
    })
  }),

  http.get('/api/runs/:id', async ({ params }) => {
    await delay(50)
    return HttpResponse.json({
      ...mockRun,
      id: params.id,
    })
  }),

  http.post('/api/runs', async ({ request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockRun,
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      started_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.put('/api/runs/:id/status', async ({ params, request }) => {
    await delay(100)
    const body = await request.json()
    return HttpResponse.json({
      ...mockRun,
      id: params.id,
      status: body.status,
      updated_at: new Date().toISOString(),
    })
  }),

  // Authentication Endpoints
  http.post('/api/auth/login', async ({ request }) => {
    await delay(200)
    const body = await request.json()
    
    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        user: mockUser,
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
      })
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post('/api/auth/logout', async () => {
    await delay(50)
    return new HttpResponse(null, { status: 200 })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    await delay(100)
    const body = await request.json()
    
    if (body.refreshToken === 'mock-refresh-token') {
      return HttpResponse.json({
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token',
      })
    }
    
    return HttpResponse.json(
      { error: 'Invalid refresh token' },
      { status: 401 }
    )
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(50)
    const authHeader = request.headers.get('Authorization')
    
    if (authHeader?.includes('mock-jwt-token')) {
      return HttpResponse.json({ user: mockUser })
    }
    
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }),

  // Processing Pipeline Endpoints
  http.post('/api/pipeline/process', async ({ request }) => {
    await delay(500) // Simulate longer processing
    const body = await request.json()
    
    return HttpResponse.json({
      runId: Math.random().toString(36).substr(2, 9),
      status: 'processing',
      sourceId: body.sourceId,
      startedAt: new Date().toISOString(),
    }, { status: 202 })
  }),

  http.get('/api/pipeline/status/:runId', async ({ params }) => {
    await delay(100)
    return HttpResponse.json({
      runId: params.runId,
      status: 'processing',
      progress: 65,
      processed: 65,
      total: 100,
      errors: [],
    })
  }),

  // WebSocket-like polling endpoint for real-time updates
  http.get('/api/updates/subscribe', async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const channel = url.searchParams.get('channel')
    
    return HttpResponse.json({
      channel,
      updates: [
        {
          type: 'opportunity_created',
          data: mockFundingOpportunity,
          timestamp: new Date().toISOString(),
        },
      ],
    })
  }),

  // Health check endpoint
  http.get('/api/health', async () => {
    await delay(10)
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        cache: 'connected',
        queue: 'connected',
      },
    })
  }),

  // Metrics endpoint
  http.get('/api/metrics', async () => {
    await delay(100)
    return HttpResponse.json({
      totalOpportunities: 1250,
      activeOpportunities: 875,
      totalFunding: 125000000,
      averageMatchScore: 72.5,
      processingStats: {
        totalRuns: 45,
        successfulRuns: 42,
        failedRuns: 3,
        averageProcessingTime: 32000,
      },
    })
  }),

  // Catch-all for unhandled API routes (for testing 404s)
  http.all('/api/*', () => {
    return HttpResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }),
]

// Error scenario handlers for testing
const errorHandlers = {
  networkError: http.all('*', () => HttpResponse.error()),
  
  serverError: http.all('*', () => 
    HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  ),
  
  serviceUnavailable: http.all('*', () => 
    HttpResponse.json(
      { error: 'Service Unavailable' },
      { status: 503 }
    )
  ),
  
  unauthorized: http.all('*', () => 
    HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  ),
  
  forbidden: http.all('*', () => 
    HttpResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  ),
  
  rateLimited: http.all('*', () => 
    HttpResponse.json(
      { error: 'Too Many Requests', retryAfter: 60 },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  ),
  
  timeout: http.all('*', async () => {
    await delay(30000) // 30 second delay to trigger timeouts
    return HttpResponse.json({ data: 'Should timeout' })
  }),
}

// Helper to create custom error responses
const createErrorHandler = (endpoint, status, message) => {
  return http.get(endpoint, () => 
    HttpResponse.json(
      { error: message },
      { status }
    )
  )
}

// Helper to create delayed responses
const createDelayedHandler = (endpoint, delayMs, response) => {
  return http.get(endpoint, async () => {
    await delay(delayMs)
    return HttpResponse.json(response)
  })
}

module.exports = {
  handlers,
  errorHandlers,
  createErrorHandler,
  createDelayedHandler
}
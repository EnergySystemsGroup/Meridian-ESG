// Test Funding Source Data Generators

export function generateFundingSource(overrides = {}) {
  return {
    id: 'source-test-1',
    name: 'Test Funding Source',
    type: 'api',
    enabled: true,
    force_full_reprocessing: false,
    config: {
      api_key: 'test-api-key',
      base_url: 'https://api.example.com/test',
      page_size: 25,
      timeout: 30000
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

export function generateFFRSource(overrides = {}) {
  return generateFundingSource({
    id: 'source-ffr-1',
    name: 'FFR Test Source',
    force_full_reprocessing: true,
    ...overrides
  })
}

export function generateDisabledSource(overrides = {}) {
  return generateFundingSource({
    id: 'source-disabled-1',
    name: 'Disabled Test Source',
    enabled: false,
    ...overrides
  })
}

export function generateMultipleSources() {
  return [
    generateFundingSource({ id: 'source-1', name: 'Primary Funding API' }),
    generateFundingSource({ id: 'source-2', name: 'Secondary Funding API', type: 'api_v2' }),
    generateFundingSource({ id: 'source-3', name: 'Federal Funding Portal', type: 'federal_api' }),
    generateDisabledSource({ id: 'source-4', name: 'Inactive Source' })
  ]
}
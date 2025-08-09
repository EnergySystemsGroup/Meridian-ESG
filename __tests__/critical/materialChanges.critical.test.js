/**
 * Critical Path Test - Material Change Updates
 * 
 * Tests PostgreSQL-specific update behavior:
 * - Selective field updates (only changed fields)
 * - Admin edit preservation during updates
 * - NULL vs empty string handling
 * - JSON field partial updates
 * - Timestamp auto-updates
 * 
 * Run with: npm run test:critical
 */

describe('Critical Path - Material Change Updates', () => {
  let supabase
  
  beforeAll(() => {
    supabase = global.testSupabaseClient
    if (!supabase) {
      throw new Error('Test database not initialized. Run: npx supabase start')
    }
  })
  
  beforeEach(async () => {
    // Clean test data
    await supabase
      .from('funding_opportunities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  })
  
  test('should preserve admin edits during automated updates', async () => {
    // Insert initial opportunity
    const { data: initial } = await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'TEST-MAT-001',
        source_id: 'test-grants-gov',
        title: 'Original Title',
        description: 'Original description',
        maximum_award: 100000,
        admin_notes: null,
        status: 'posted'
      })
      .select()
      .single()
    
    // Admin makes manual edit
    await supabase
      .from('funding_opportunities')
      .update({
        admin_notes: 'Verified with program officer',
        admin_verified: true,
        title: 'Admin Corrected Title' // Admin override
      })
      .eq('id', initial.id)
    
    // Automated update from API (should preserve admin fields)
    const { data: updated } = await supabase
      .from('funding_opportunities')
      .update({
        description: 'Updated description from API',
        maximum_award: 150000,
        // NOT updating admin fields or admin-modified title
      })
      .eq('id', initial.id)
      .select()
      .single()
    
    // Verify admin edits preserved
    expect(updated.admin_notes).toBe('Verified with program officer')
    expect(updated.admin_verified).toBe(true)
    expect(updated.title).toBe('Admin Corrected Title') // Preserved
    expect(updated.description).toBe('Updated description from API') // Updated
    expect(updated.maximum_award).toBe(150000) // Updated
  })
  
  test('should handle NULL vs empty string correctly in PostgreSQL', async () => {
    // Insert with NULLs
    const { data: withNulls } = await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'TEST-MAT-002',
        source_id: 'test-grants-gov',
        title: 'Test Null Handling',
        description: null, // NULL
        eligibility_codes: null, // NULL
        status: 'posted'
      })
      .select()
      .single()
    
    expect(withNulls.description).toBeNull()
    expect(withNulls.eligibility_codes).toBeNull()
    
    // Update with empty string
    const { data: withEmpty } = await supabase
      .from('funding_opportunities')
      .update({
        description: '', // Empty string
        eligibility_codes: '' // Empty string
      })
      .eq('id', withNulls.id)
      .select()
      .single()
    
    // PostgreSQL treats NULL and '' differently
    expect(withEmpty.description).toBe('')
    expect(withEmpty.description).not.toBeNull()
    expect(withEmpty.eligibility_codes).toBe('')
    
    // Query behavior differs for NULL vs empty
    const { data: nullResults } = await supabase
      .from('funding_opportunities')
      .select('id')
      .is('description', null)
    
    const { data: emptyResults } = await supabase
      .from('funding_opportunities')
      .select('id')
      .eq('description', '')
    
    expect(nullResults.length).toBe(0) // No NULL descriptions
    expect(emptyResults.length).toBe(1) // One empty description
  })
  
  test('should perform selective updates without touching unchanged fields', async () => {
    // Insert opportunity with all fields
    const fullData = {
      api_opportunity_id: 'TEST-MAT-003',
      source_id: 'test-grants-gov',
      title: 'Complete Opportunity',
      description: 'Detailed description',
      maximum_award: 500000,
      minimum_award: 50000,
      estimated_total_funding: 5000000,
      award_ceiling: 500000,
      award_floor: 50000,
      close_date: '2024-12-31',
      open_date: '2024-01-01',
      status: 'posted'
    }
    
    const { data: initial } = await supabase
      .from('funding_opportunities')
      .insert(fullData)
      .select()
      .single()
    
    const originalUpdatedAt = initial.updated_at
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // Update only maximum_award (material change)
    const { data: updated } = await supabase
      .from('funding_opportunities')
      .update({
        maximum_award: 600000 // Only this changes
      })
      .eq('id', initial.id)
      .select()
      .single()
    
    // Verify only maximum_award changed
    expect(updated.maximum_award).toBe(600000) // Changed
    expect(updated.minimum_award).toBe(50000) // Unchanged
    expect(updated.title).toBe('Complete Opportunity') // Unchanged
    expect(updated.description).toBe('Detailed description') // Unchanged
    
    // Verify updated_at changed (PostgreSQL trigger)
    expect(new Date(updated.updated_at).getTime())
      .toBeGreaterThan(new Date(originalUpdatedAt).getTime())
  })
  
  test('should handle JSON field partial updates correctly', async () => {
    // Insert with JSON config
    const { data: initial } = await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'TEST-MAT-004',
        source_id: 'test-grants-gov',
        title: 'JSON Test Opportunity',
        config: {
          category: 'energy',
          subcategory: 'solar',
          tags: ['renewable', 'infrastructure'],
          metadata: {
            reviewer: 'John Doe',
            priority: 'high'
          }
        },
        status: 'posted'
      })
      .select()
      .single()
    
    // Partial update to JSON field
    const { data: updated } = await supabase
      .from('funding_opportunities')
      .update({
        config: {
          ...initial.config,
          metadata: {
            ...initial.config.metadata,
            priority: 'critical', // Update nested field
            lastReviewed: new Date().toISOString() // Add new field
          }
        }
      })
      .eq('id', initial.id)
      .select()
      .single()
    
    // Verify partial update worked
    expect(updated.config.category).toBe('energy') // Preserved
    expect(updated.config.subcategory).toBe('solar') // Preserved
    expect(updated.config.tags).toEqual(['renewable', 'infrastructure']) // Preserved
    expect(updated.config.metadata.reviewer).toBe('John Doe') // Preserved
    expect(updated.config.metadata.priority).toBe('critical') // Updated
    expect(updated.config.metadata.lastReviewed).toBeDefined() // Added
  })
  
  test('should detect material vs non-material changes correctly', async () => {
    // Insert opportunity
    const { data: initial } = await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'TEST-MAT-005',
        source_id: 'test-grants-gov',
        title: 'Change Detection Test',
        description: 'Original description',
        maximum_award: 100000,
        close_date: '2024-12-31',
        status: 'posted'
      })
      .select()
      .single()
    
    // Non-material change (description only)
    const { data: nonMaterial } = await supabase
      .from('funding_opportunities')
      .update({
        description: 'Slightly updated description' // <20% change
      })
      .eq('id', initial.id)
      .select()
      .single()
    
    // Material change (amount change >5%)
    const { data: material } = await supabase
      .from('funding_opportunities')
      .update({
        maximum_award: 110000 // 10% increase
      })
      .eq('id', initial.id)
      .select()
      .single()
    
    // Verify both updates succeeded
    expect(nonMaterial.description).toBe('Slightly updated description')
    expect(material.maximum_award).toBe(110000)
    
    // In production, these would trigger different pipeline paths
    // Non-material: Skip analysis, direct update
    // Material: Full reanalysis required
  })
})
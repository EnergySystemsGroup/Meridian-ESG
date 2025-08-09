/**
 * Critical Path Test - Duplicate Constraints
 * 
 * Tests that require real database to verify PostgreSQL-specific behavior:
 * - Composite unique constraints (api_opportunity_id + source_id)
 * - Proper error codes and messages
 * - Transaction rollback on constraint violations
 * 
 * Run with: npm run test:critical
 */

describe('Critical Path - Duplicate Constraints', () => {
  let supabase
  
  beforeAll(() => {
    // Use real test database client set up in jest.setup.js
    supabase = global.testSupabaseClient
    if (!supabase) {
      throw new Error('Test database not initialized. Run: npx supabase start')
    }
  })
  
  beforeEach(async () => {
    // Clean up test data before each test
    await supabase
      .from('funding_opportunities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  })
  
  test('should enforce composite unique constraint on api_opportunity_id + source_id', async () => {
    // Insert first opportunity
    const opportunity1 = {
      api_opportunity_id: 'TEST-OPP-001',
      source_id: 'test-grants-gov',
      title: 'First Insert',
      description: 'Original opportunity',
      status: 'posted'
    }
    
    const { data: first, error: firstError } = await supabase
      .from('funding_opportunities')
      .insert(opportunity1)
      .select()
      .single()
    
    expect(firstError).toBeNull()
    expect(first).toMatchObject({
      api_opportunity_id: 'TEST-OPP-001',
      source_id: 'test-grants-gov'
    })
    
    // Attempt to insert duplicate (same api_opportunity_id + source_id)
    const opportunity2 = {
      api_opportunity_id: 'TEST-OPP-001', // Same ID
      source_id: 'test-grants-gov',       // Same source
      title: 'Second Insert',
      description: 'Duplicate attempt',
      status: 'posted'
    }
    
    const { data: second, error: secondError } = await supabase
      .from('funding_opportunities')
      .insert(opportunity2)
      .select()
      .single()
    
    // Verify PostgreSQL constraint violation
    expect(second).toBeNull()
    expect(secondError).toBeDefined()
    expect(secondError.code).toBe('23505') // Unique violation
    expect(secondError.message).toContain('duplicate key value violates unique constraint')
    expect(secondError.details).toContain('api_opportunity_id')
    expect(secondError.details).toContain('source_id')
  })
  
  test('should allow same api_opportunity_id with different source_id', async () => {
    // Insert opportunity for first source
    const opportunity1 = {
      api_opportunity_id: 'TEST-OPP-002',
      source_id: 'test-grants-gov',
      title: 'Multi-source Opportunity',
      description: 'Available from multiple sources',
      status: 'posted'
    }
    
    const { error: firstError } = await supabase
      .from('funding_opportunities')
      .insert(opportunity1)
      .select()
      .single()
    
    expect(firstError).toBeNull()
    
    // Insert same opportunity ID but different source
    const opportunity2 = {
      api_opportunity_id: 'TEST-OPP-002', // Same ID
      source_id: 'test-sam-gov',          // Different source
      title: 'Multi-source Opportunity',
      description: 'Same opportunity from different API',
      status: 'posted'
    }
    
    const { data: second, error: secondError } = await supabase
      .from('funding_opportunities')
      .insert(opportunity2)
      .select()
      .single()
    
    // Should succeed - different composite key
    expect(secondError).toBeNull()
    expect(second).toMatchObject({
      api_opportunity_id: 'TEST-OPP-002',
      source_id: 'test-sam-gov'
    })
  })
  
  test('should rollback entire batch on constraint violation', async () => {
    // Insert valid opportunity first
    await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'TEST-OPP-003',
        source_id: 'test-grants-gov',
        title: 'Existing Opportunity',
        status: 'posted'
      })
    
    // Attempt batch insert with duplicate
    const batch = [
      {
        api_opportunity_id: 'TEST-OPP-004',
        source_id: 'test-grants-gov',
        title: 'Valid New Opportunity',
        status: 'posted'
      },
      {
        api_opportunity_id: 'TEST-OPP-003', // Duplicate!
        source_id: 'test-grants-gov',
        title: 'Duplicate in Batch',
        status: 'posted'
      },
      {
        api_opportunity_id: 'TEST-OPP-005',
        source_id: 'test-grants-gov',
        title: 'Another Valid Opportunity',
        status: 'posted'
      }
    ]
    
    const { data, error } = await supabase
      .from('funding_opportunities')
      .insert(batch)
      .select()
    
    // Entire batch should fail
    expect(error).toBeDefined()
    expect(error.code).toBe('23505')
    expect(data).toBeNull()
    
    // Verify none of the batch was inserted
    const { data: checkData } = await supabase
      .from('funding_opportunities')
      .select('api_opportunity_id')
      .in('api_opportunity_id', ['TEST-OPP-004', 'TEST-OPP-005'])
    
    expect(checkData).toHaveLength(0) // No records inserted
  })
  
  test('should handle upsert with ON CONFLICT properly', async () => {
    // Insert initial opportunity
    const initial = {
      api_opportunity_id: 'TEST-OPP-006',
      source_id: 'test-grants-gov',
      title: 'Initial Title',
      description: 'Initial description',
      maximum_award: 100000,
      status: 'posted'
    }
    
    await supabase
      .from('funding_opportunities')
      .insert(initial)
      .select()
      .single()
    
    // Upsert with updated data
    const updated = {
      api_opportunity_id: 'TEST-OPP-006',
      source_id: 'test-grants-gov',
      title: 'Updated Title',
      description: 'Updated description',
      maximum_award: 200000,
      status: 'forecasted'
    }
    
    const { data, error } = await supabase
      .from('funding_opportunities')
      .upsert(updated, {
        onConflict: 'api_opportunity_id,source_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    // Should update existing record
    expect(error).toBeNull()
    expect(data).toMatchObject({
      api_opportunity_id: 'TEST-OPP-006',
      title: 'Updated Title',
      maximum_award: 200000,
      status: 'forecasted'
    })
    
    // Verify only one record exists
    const { data: count } = await supabase
      .from('funding_opportunities')
      .select('id', { count: 'exact' })
      .eq('api_opportunity_id', 'TEST-OPP-006')
    
    expect(count).toHaveLength(1)
  })
})
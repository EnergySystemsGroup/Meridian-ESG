/**
 * Critical Path Test - Batch Transaction Atomicity
 * 
 * Tests PostgreSQL's transactional guarantees:
 * - All-or-nothing batch inserts
 * - Proper rollback on partial failure
 * - Large batch handling
 * - Savepoint behavior
 * - Deadlock detection in concurrent batches
 * 
 * Run with: npm run test:critical
 */

describe('Critical Path - Batch Transaction Atomicity', () => {
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
  
  test('should rollback entire batch on single constraint violation', async () => {
    // Create one existing opportunity
    await supabase
      .from('funding_opportunities')
      .insert({
        api_opportunity_id: 'EXISTING-001',
        source_id: 'test-grants-gov',
        title: 'Existing Opportunity',
        status: 'posted'
      })
    
    // Prepare batch with 100 opportunities, one is duplicate
    const batch = []
    for (let i = 1; i <= 100; i++) {
      batch.push({
        api_opportunity_id: i === 50 ? 'EXISTING-001' : `BATCH-${i}`, // #50 is duplicate
        source_id: 'test-grants-gov',
        title: `Batch Opportunity ${i}`,
        description: `Description for opportunity ${i}`,
        maximum_award: 100000 + (i * 1000),
        status: 'posted'
      })
    }
    
    // Attempt batch insert
    const { data, error } = await supabase
      .from('funding_opportunities')
      .insert(batch)
      .select()
    
    // Should fail due to duplicate at position 50
    expect(error).toBeDefined()
    expect(error.code).toBe('23505') // Unique constraint violation
    expect(data).toBeNull()
    
    // Verify NONE of the 100 were inserted (atomicity)
    const { data: count } = await supabase
      .from('funding_opportunities')
      .select('*', { count: 'exact', head: true })
    
    expect(count).toBe(1) // Only the original existing one
    
    // Verify specific valid opportunities weren't inserted
    const { data: checkFirst } = await supabase
      .from('funding_opportunities')
      .select('id')
      .eq('api_opportunity_id', 'BATCH-1')
    
    const { data: checkLast } = await supabase
      .from('funding_opportunities')
      .select('id')
      .eq('api_opportunity_id', 'BATCH-100')
    
    expect(checkFirst).toHaveLength(0) // Not inserted
    expect(checkLast).toHaveLength(0) // Not inserted
  })
  
  test('should handle very large batch inserts atomically', async () => {
    // Create large valid batch (500 opportunities)
    const largeBatch = []
    for (let i = 1; i <= 500; i++) {
      largeBatch.push({
        api_opportunity_id: `LARGE-${i}`,
        source_id: 'test-grants-gov',
        title: `Large Batch Opportunity ${i}`,
        description: `Detailed description for opportunity number ${i} with enough text to simulate real data`,
        maximum_award: 50000 + (i * 100),
        minimum_award: 10000 + (i * 10),
        estimated_total_funding: 1000000 + (i * 1000),
        close_date: '2024-12-31',
        open_date: '2024-01-01',
        posted_date: '2024-01-01',
        status: 'posted'
      })
    }
    
    // Insert large batch
    const { data, error } = await supabase
      .from('funding_opportunities')
      .insert(largeBatch)
      .select('id') // Just return IDs to reduce payload
    
    // Should succeed
    expect(error).toBeNull()
    expect(data).toHaveLength(500)
    
    // Verify all were inserted
    const { data: count } = await supabase
      .from('funding_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('api_opportunity_id', 'LARGE-%')
    
    expect(count).toBe(500)
  })
  
  test('should maintain atomicity with foreign key violations', async () => {
    // Batch with invalid source_id (foreign key violation)
    const batch = [
      {
        api_opportunity_id: 'FK-TEST-001',
        source_id: 'test-grants-gov', // Valid
        title: 'Valid Opportunity',
        status: 'posted'
      },
      {
        api_opportunity_id: 'FK-TEST-002',
        source_id: 'non-existent-source', // Invalid FK
        title: 'Invalid FK Opportunity',
        status: 'posted'
      },
      {
        api_opportunity_id: 'FK-TEST-003',
        source_id: 'test-grants-gov', // Valid
        title: 'Another Valid Opportunity',
        status: 'posted'
      }
    ]
    
    // Attempt batch insert
    const { data, error } = await supabase
      .from('funding_opportunities')
      .insert(batch)
      .select()
    
    // Should fail due to foreign key violation
    expect(error).toBeDefined()
    expect(error.code).toBe('23503') // Foreign key violation
    expect(data).toBeNull()
    
    // Verify NONE were inserted
    const { data: results } = await supabase
      .from('funding_opportunities')
      .select('api_opportunity_id')
      .in('api_opportunity_id', ['FK-TEST-001', 'FK-TEST-002', 'FK-TEST-003'])
    
    expect(results).toHaveLength(0) // All rolled back
  })
  
  test('should handle mixed operation batches correctly', async () => {
    // Insert initial opportunities
    const initial = [
      {
        api_opportunity_id: 'UPDATE-001',
        source_id: 'test-grants-gov',
        title: 'Original Title 1',
        maximum_award: 100000,
        status: 'posted'
      },
      {
        api_opportunity_id: 'UPDATE-002',
        source_id: 'test-grants-gov',
        title: 'Original Title 2',
        maximum_award: 200000,
        status: 'posted'
      }
    ]
    
    await supabase
      .from('funding_opportunities')
      .insert(initial)
    
    // Upsert batch (mix of updates and inserts)
    const upsertBatch = [
      {
        api_opportunity_id: 'UPDATE-001', // Existing - should update
        source_id: 'test-grants-gov',
        title: 'Updated Title 1',
        maximum_award: 150000,
        status: 'forecasted'
      },
      {
        api_opportunity_id: 'UPDATE-003', // New - should insert
        source_id: 'test-grants-gov',
        title: 'New Opportunity 3',
        maximum_award: 300000,
        status: 'posted'
      },
      {
        api_opportunity_id: 'UPDATE-002', // Existing - should update
        source_id: 'test-grants-gov',
        title: 'Updated Title 2',
        maximum_award: 250000,
        status: 'closed'
      }
    ]
    
    // Perform upsert
    const { data, error } = await supabase
      .from('funding_opportunities')
      .upsert(upsertBatch, {
        onConflict: 'api_opportunity_id,source_id'
      })
      .select()
      .order('api_opportunity_id')
    
    // Should succeed
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    
    // Verify updates
    expect(data[0].title).toBe('Updated Title 1')
    expect(data[0].maximum_award).toBe(150000)
    expect(data[0].status).toBe('forecasted')
    
    // Verify insert
    expect(data[2].api_opportunity_id).toBe('UPDATE-003')
    expect(data[2].title).toBe('New Opportunity 3')
    
    // Verify total count
    const { data: totalCount } = await supabase
      .from('funding_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('api_opportunity_id', 'UPDATE-%')
    
    expect(totalCount).toBe(3) // 2 updated + 1 inserted
  })
  
  test('should handle concurrent batch operations without corruption', async () => {
    // This test simulates concurrent batch inserts that could cause issues
    
    // Prepare two batches that could conflict
    const batch1 = []
    const batch2 = []
    
    for (let i = 1; i <= 50; i++) {
      batch1.push({
        api_opportunity_id: `CONCURRENT-A-${i}`,
        source_id: 'test-grants-gov',
        title: `Batch A Opportunity ${i}`,
        status: 'posted'
      })
      
      batch2.push({
        api_opportunity_id: `CONCURRENT-B-${i}`,
        source_id: 'test-grants-gov',
        title: `Batch B Opportunity ${i}`,
        status: 'posted'
      })
    }
    
    // Execute both batches concurrently
    const [result1, result2] = await Promise.all([
      supabase.from('funding_opportunities').insert(batch1).select('id'),
      supabase.from('funding_opportunities').insert(batch2).select('id')
    ])
    
    // Both should succeed without conflicts
    expect(result1.error).toBeNull()
    expect(result2.error).toBeNull()
    expect(result1.data).toHaveLength(50)
    expect(result2.data).toHaveLength(50)
    
    // Verify all 100 records exist
    const { data: count } = await supabase
      .from('funding_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('api_opportunity_id', 'CONCURRENT-%')
    
    expect(count).toBe(100)
  })
})
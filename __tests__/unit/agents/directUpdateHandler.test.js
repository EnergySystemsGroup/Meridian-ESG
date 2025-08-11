import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { 
  updateDuplicateOpportunities,
  directUpdateHandler 
} from '../../../lib/agents-v2/optimization/directUpdateHandler.js'

// Mock console methods to suppress warnings in tests
const originalWarn = console.warn
const originalError = console.error
const originalLog = console.log

beforeAll(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
  console.log = jest.fn()
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
  console.log = originalLog
})

describe('Direct Update Handler Unit Tests', () => {
  let mockSupabaseClient
  let mockUpdateBatch
  let mockDbRecord
  let mockApiRecord

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn()
    }
    
    // Setup test data
    mockDbRecord = {
      id: 'db-id-123',
      title: 'Original Title',
      minimum_award: 10000,
      maximum_award: 100000,
      total_funding_available: 1000000,
      close_date: '2025-12-31T00:00:00Z',
      open_date: '2025-01-01T00:00:00Z',
      enhanced_content: 'Admin enhanced content',
      admin_notes: 'Important admin notes',
      updated_at: '2025-01-15T10:00:00Z'
    }
    
    mockApiRecord = {
      id: 'api-id-123',
      title: 'Updated Title',
      minimum_award: 15000,
      maximum_award: 150000,
      total_funding_available: 1500000,
      close_date: '2025-12-15T00:00:00Z',
      open_date: '2025-01-15T00:00:00Z',
      api_updated_at: '2025-01-20T12:00:00Z'
    }
    
    mockUpdateBatch = [
      {
        apiRecord: mockApiRecord,
        dbRecord: mockDbRecord,
        reason: 'title_changed',
        rawResponseId: 'raw-response-123'
      }
    ]
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Field-Level Update Logic', () => {
    test('should update only changed fields', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [{ ...mockDbRecord, ...mockApiRecord }],
        error: null
      })
      
      const result = await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          minimum_award: 15000,
          maximum_award: 150000,
          total_funding_available: 1500000,
          close_date: '2025-12-15T00:00:00Z',
          open_date: '2025-01-15T00:00:00Z',
          updated_at: expect.any(String),
          api_updated_at: '2025-01-20T12:00:00Z',
          raw_response_id: 'raw-response-123'
        })
      )
      
      expect(result.metrics.successful).toBe(1)
      expect(result.successful).toHaveLength(1)
    })

    test('should not update unchanged fields', async () => {
      const sameValueApiRecord = {
        ...mockApiRecord,
        title: mockDbRecord.title, // Same title
        minimum_award: mockDbRecord.minimum_award // Same minimum_award
      }
      
      const updateBatch = [{
        apiRecord: sameValueApiRecord,
        dbRecord: mockDbRecord,
        reason: 'other_fields_changed'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateCall = mockSupabaseClient.update.mock.calls[0][0]
      
      // Should not include unchanged fields
      expect(updateCall.title).toBeUndefined()
      expect(updateCall.minimum_award).toBeUndefined()
      
      // Should include changed fields
      expect(updateCall.maximum_award).toBe(150000)
      expect(updateCall.total_funding_available).toBe(1500000)
    })

    test('should handle multiple field updates in single operation', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [{ ...mockDbRecord }],
        error: null
      })
      
      await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      expect(mockSupabaseClient.update).toHaveBeenCalledTimes(1)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      const changedFields = Object.keys(updateData).filter(
        key => !['updated_at', 'api_updated_at', 'raw_response_id'].includes(key)
      )
      
      expect(changedFields).toHaveLength(6) // All 6 critical fields changed
    })
  })

  describe('Unchanged Field Preservation', () => {
    test('should preserve existing data when API returns null', async () => {
      const apiRecordWithNulls = {
        ...mockApiRecord,
        minimum_award: null,
        maximum_award: null,
        total_funding_available: null
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithNulls,
        dbRecord: mockDbRecord,
        reason: 'title_changed'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      // Should not overwrite with null
      expect(updateData.minimum_award).toBeUndefined()
      expect(updateData.maximum_award).toBeUndefined()
      expect(updateData.total_funding_available).toBeUndefined()
      
      // Should still update non-null fields
      expect(updateData.title).toBe('Updated Title')
    })

    test('should preserve admin-edited fields', async () => {
      // API record should not contain admin fields
      const apiRecordWithAdminFields = {
        ...mockApiRecord,
        enhanced_content: 'Should not overwrite',
        admin_notes: 'Should not overwrite'
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithAdminFields,
        dbRecord: mockDbRecord,
        reason: 'title_changed'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      // Admin fields should never be in update data
      expect(updateData.enhanced_content).toBeUndefined()
      expect(updateData.admin_notes).toBeUndefined()
    })
  })

  describe('Atomic Update Operations', () => {
    test('should update each opportunity atomically', async () => {
      const batch = [
        {
          apiRecord: { ...mockApiRecord, id: 'api-1' },
          dbRecord: { ...mockDbRecord, id: 'db-1' },
          reason: 'update_1'
        },
        {
          apiRecord: { ...mockApiRecord, id: 'api-2', title: 'Another Title' },
          dbRecord: { ...mockDbRecord, id: 'db-2' },
          reason: 'update_2'
        }
      ]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [{}],
        error: null
      })
      
      await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      expect(mockSupabaseClient.update).toHaveBeenCalledTimes(2)
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'db-1')
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'db-2')
    })

    test('should maintain operation isolation on partial failures', async () => {
      const batch = [
        {
          apiRecord: mockApiRecord,
          dbRecord: mockDbRecord,
          reason: 'update_1'
        },
        {
          apiRecord: { ...mockApiRecord, id: 'api-2' },
          dbRecord: { ...mockDbRecord, id: 'db-2' },
          reason: 'update_2'
        }
      ]
      
      // First succeeds, second fails
      mockSupabaseClient.select
        .mockResolvedValueOnce({ data: [{}], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Update failed' } })
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      expect(result.metrics.successful).toBe(1)
      expect(result.metrics.failed).toBe(1)
      expect(result.successful).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
    })
  })

  describe('Rollback on Failure', () => {
    test('should handle database update failures gracefully', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })
      
      const result = await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      expect(result.metrics.failed).toBe(1)
      expect(result.failed[0].error).toBe('Database error')
      expect(result.failed[0].status).toBe('failed')
    })

    test('should continue processing after individual failures', async () => {
      const batch = [
        { apiRecord: mockApiRecord, dbRecord: mockDbRecord, reason: 'update_1' },
        { apiRecord: { ...mockApiRecord, id: 'api-2' }, dbRecord: { ...mockDbRecord, id: 'db-2' }, reason: 'update_2' },
        { apiRecord: { ...mockApiRecord, id: 'api-3' }, dbRecord: { ...mockDbRecord, id: 'db-3' }, reason: 'update_3' }
      ]
      
      // First fails, second succeeds, third succeeds
      mockSupabaseClient.select
        .mockResolvedValueOnce({ data: null, error: { message: 'Error 1' } })
        .mockResolvedValueOnce({ data: [{}], error: null })
        .mockResolvedValueOnce({ data: [{}], error: null })
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      expect(result.metrics.totalProcessed).toBe(3)
      expect(result.metrics.successful).toBe(2)
      expect(result.metrics.failed).toBe(1)
    })

    test('should not throw when items are categorized as failed due to DB errors', async () => {
      // Test that even when all items fail, integrity is maintained (no throw)
      const batch = [
        { apiRecord: mockApiRecord, dbRecord: mockDbRecord, reason: 'update_1' },
        { apiRecord: { ...mockApiRecord, id: 'api-2' }, dbRecord: { ...mockDbRecord, id: 'db-2' }, reason: 'update_2' }
      ]
      
      // Cause both to fail with DB errors
      mockSupabaseClient.select
        .mockResolvedValueOnce({ data: null, error: { message: 'Database error 1' } })
        .mockResolvedValueOnce({ data: null, error: { message: 'Database error 2' } })
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      // Should not throw - all items are properly categorized as failed
      expect(result.metrics.totalProcessed).toBe(2)
      expect(result.metrics.failed).toBe(2)
      expect(result.metrics.successful).toBe(0)
      expect(result.metrics.skipped).toBe(0)
    })
    
    test('should throw on processing integrity violation', async () => {
      // Now we can properly test the integrity violation with dependency injection
      const batch = [
        { apiRecord: mockApiRecord, dbRecord: mockDbRecord, reason: 'update_1' },
        { apiRecord: { ...mockApiRecord, id: 'api-2' }, dbRecord: { ...mockDbRecord, id: 'db-2' }, reason: 'update_2' }
      ]
      
      // Mock implementation that returns unknown status to trigger integrity violation
      const impl = { 
        updateSingleOpportunity: jest.fn().mockResolvedValue({ status: 'unknown' }) 
      }
      
      await expect(updateDuplicateOpportunities(batch, mockSupabaseClient, impl))
        .rejects.toThrow('DirectUpdate failed to process all opportunities: 2 in, 0 processed')
    })
    
    test('should propagate critical errors from updateSingleOpportunity', async () => {
      // Test the outer catch block (lines 82-83)
      const batch = [
        { apiRecord: mockApiRecord, dbRecord: mockDbRecord, reason: 'update_1' }
      ]
      
      // Mock implementation that throws an error
      const impl = { 
        updateSingleOpportunity: jest.fn().mockRejectedValue(new Error('Database connection lost')) 
      }
      
      await expect(updateDuplicateOpportunities(batch, mockSupabaseClient, impl))
        .rejects.toThrow('Database connection lost')
    })
  })

  describe('Admin Edit Preservation', () => {
    test('should never overwrite enhanced_content field', async () => {
      const apiRecordWithEnhancedContent = {
        ...mockApiRecord,
        enhanced_content: 'New enhanced content from API'
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithEnhancedContent,
        dbRecord: mockDbRecord,
        reason: 'content_update'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.enhanced_content).toBeUndefined()
    })

    test('should never overwrite admin_notes field', async () => {
      const apiRecordWithAdminNotes = {
        ...mockApiRecord,
        admin_notes: 'New admin notes from API'
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithAdminNotes,
        dbRecord: mockDbRecord,
        reason: 'notes_update'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.admin_notes).toBeUndefined()
    })

    test('should preserve all non-critical fields', async () => {
      const dbRecordWithCustomFields = {
        ...mockDbRecord,
        custom_field_1: 'Custom value 1',
        custom_field_2: 'Custom value 2',
        user_rating: 5
      }
      
      const updateBatch = [{
        apiRecord: mockApiRecord,
        dbRecord: dbRecordWithCustomFields,
        reason: 'title_changed'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [dbRecordWithCustomFields],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      // Should not include custom fields in update
      expect(updateData.custom_field_1).toBeUndefined()
      expect(updateData.custom_field_2).toBeUndefined()
      expect(updateData.user_rating).toBeUndefined()
    })
  })

  describe('Update Timestamp Tracking', () => {
    test('should always update the updated_at timestamp', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      const beforeUpdate = new Date()
      await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      const afterUpdate = new Date()
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      const updatedAt = new Date(updateData.updated_at)
      
      expect(updatedAt >= beforeUpdate).toBe(true)
      expect(updatedAt <= afterUpdate).toBe(true)
    })

    test('should include api_updated_at when provided', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.api_updated_at).toBe('2025-01-20T12:00:00Z')
    })

    test('should include raw_response_id when provided', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.raw_response_id).toBe('raw-response-123')
    })
  })

  describe('Handling of Null Values and Edge Cases', () => {
    test('should handle empty string values', async () => {
      const apiRecordWithEmptyStrings = {
        ...mockApiRecord,
        title: '',
        close_date: ''
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithEmptyStrings,
        dbRecord: mockDbRecord,
        reason: 'empty_values'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      // Should not update with empty strings
      expect(updateData.title).toBeUndefined()
      expect(updateData.close_date).toBeUndefined()
    })

    test('should handle undefined values properly', async () => {
      const apiRecordWithUndefined = {
        ...mockApiRecord,
        minimum_award: undefined,
        maximum_award: undefined
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithUndefined,
        dbRecord: mockDbRecord,
        reason: 'undefined_values'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      // Should not include undefined values
      expect(updateData.minimum_award).toBeUndefined()
      expect(updateData.maximum_award).toBeUndefined()
    })

    test('should handle date format conversions', async () => {
      const apiRecordWithDifferentDateFormat = {
        ...mockApiRecord,
        close_date: '2025-12-15', // Without time
        open_date: '2025-01-15T00:00:00.000Z' // With milliseconds
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithDifferentDateFormat,
        dbRecord: mockDbRecord,
        reason: 'date_format'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.close_date).toBe('2025-12-15')
      expect(updateData.open_date).toBe('2025-01-15T00:00:00.000Z')
    })

    test('should handle numeric string conversions', async () => {
      const apiRecordWithStringNumbers = {
        ...mockApiRecord,
        minimum_award: '15000.00',
        maximum_award: '150000.50',
        total_funding_available: '1500000'
      }
      
      const updateBatch = [{
        apiRecord: apiRecordWithStringNumbers,
        dbRecord: mockDbRecord,
        reason: 'string_numbers'
      }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      
      expect(updateData.minimum_award).toBe('15000.00')
      expect(updateData.maximum_award).toBe('150000.50')
      expect(updateData.total_funding_available).toBe('1500000')
    })

    test('should skip update when no valid changes exist', async () => {
      const apiRecordNoChanges = {
        ...mockApiRecord,
        title: mockDbRecord.title,
        minimum_award: mockDbRecord.minimum_award,
        maximum_award: mockDbRecord.maximum_award,
        total_funding_available: mockDbRecord.total_funding_available,
        close_date: mockDbRecord.close_date,
        open_date: mockDbRecord.open_date
      }
      
      const updateBatch = [{
        apiRecord: apiRecordNoChanges,
        dbRecord: mockDbRecord,
        reason: 'no_actual_changes'
      }]
      
      const result = await updateDuplicateOpportunities(updateBatch, mockSupabaseClient)
      
      expect(mockSupabaseClient.update).not.toHaveBeenCalled()
      expect(result.metrics.skipped).toBe(1)
      expect(result.skipped[0].reason).toBe('no_valid_updates')
    })

    test('should handle empty update batch', async () => {
      const result = await updateDuplicateOpportunities([], mockSupabaseClient)
      
      expect(result.metrics.totalProcessed).toBe(0)
      expect(result.metrics.successful).toBe(0)
      expect(result.metrics.failed).toBe(0)
      expect(result.metrics.skipped).toBe(0)
      expect(mockSupabaseClient.update).not.toHaveBeenCalled()
    })
    
    test('should handle identical date values without skipping update when other fields differ', async () => {
      // Test for line 205 coverage - identical dates but other fields differ
      const apiRecordSameDates = {
        ...mockApiRecord,
        close_date: mockDbRecord.close_date, // Same date
        open_date: mockDbRecord.open_date,   // Same date
        // But other fields still differ (title, amounts)
      }
      
      const batch = [{ apiRecord: apiRecordSameDates, dbRecord: mockDbRecord, reason: 'test' }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      // Should still update because title and amounts differ
      expect(result.metrics.successful).toBe(1)
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      
      // Verify that identical date fields are not included in the update
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      expect(updateData).not.toHaveProperty('close_date')
      expect(updateData).not.toHaveProperty('open_date')
    })
    
    test('should handle identical numeric values without skipping update when other fields differ', async () => {
      // Test for line 215 coverage - identical amounts but other fields differ
      const apiRecordSameAmounts = {
        ...mockApiRecord,
        minimum_award: mockDbRecord.minimum_award,               // Same amount
        maximum_award: mockDbRecord.maximum_award,               // Same amount
        total_funding_available: mockDbRecord.total_funding_available, // Same amount
        // But title and dates still differ
      }
      
      const batch = [{ apiRecord: apiRecordSameAmounts, dbRecord: mockDbRecord, reason: 'test' }]
      
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      // Should still update because title and dates differ
      expect(result.metrics.successful).toBe(1)
      expect(mockSupabaseClient.update).toHaveBeenCalled()
      
      // Verify that identical numeric fields are not included in the update
      const updateData = mockSupabaseClient.update.mock.calls[0][0]
      expect(updateData).not.toHaveProperty('minimum_award')
      expect(updateData).not.toHaveProperty('maximum_award')
      expect(updateData).not.toHaveProperty('total_funding_available')
    })
  })

  describe('Metrics Collection for Update Operations', () => {
    test('should collect comprehensive metrics', async () => {
      // Create an unchanged record that matches ALL six critical fields
      const unchangedApiRecord = {
        id: 'api-3',
        title: mockDbRecord.title,
        minimum_award: mockDbRecord.minimum_award,
        maximum_award: mockDbRecord.maximum_award,
        total_funding_available: mockDbRecord.total_funding_available,
        close_date: mockDbRecord.close_date,
        open_date: mockDbRecord.open_date,
        // Non-critical fields can be different
        description: 'Different description',
        other_field: 'Different value'
      }
      
      const batch = [
        { apiRecord: mockApiRecord, dbRecord: mockDbRecord, reason: 'update_1' },
        { apiRecord: { ...mockApiRecord, id: 'api-2' }, dbRecord: { ...mockDbRecord, id: 'db-2' }, reason: 'update_2' },
        { 
          apiRecord: unchangedApiRecord,
          dbRecord: { ...mockDbRecord, id: 'db-3' }, 
          reason: 'update_3' 
        }
      ]
      
      // First succeeds, second fails, third is skipped (no database call needed)
      mockSupabaseClient.select
        .mockResolvedValueOnce({ data: [{}], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Error' } })
      // No third mock needed - skipped items don't hit the database
      
      const result = await updateDuplicateOpportunities(batch, mockSupabaseClient)
      
      expect(result.metrics).toMatchObject({
        totalProcessed: 3,
        successful: 1,
        failed: 1,
        skipped: 1,
        executionTime: expect.any(Number)
      })
    })

    test('should track execution time', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      const startTime = Date.now()
      const result = await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      const endTime = Date.now()
      
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.metrics.executionTime).toBeLessThanOrEqual(endTime - startTime + 100)
    })

    test('should maintain result structure consistency', async () => {
      mockSupabaseClient.select.mockResolvedValue({
        data: [mockDbRecord],
        error: null
      })
      
      const result = await updateDuplicateOpportunities(mockUpdateBatch, mockSupabaseClient)
      
      expect(result).toHaveProperty('successful')
      expect(result).toHaveProperty('failed')
      expect(result).toHaveProperty('skipped')
      expect(result).toHaveProperty('metrics')
      
      expect(Array.isArray(result.successful)).toBe(true)
      expect(Array.isArray(result.failed)).toBe(true)
      expect(Array.isArray(result.skipped)).toBe(true)
      
      expect(result.successful[0]).toMatchObject({
        status: 'success',
        originalReason: 'title_changed',
        opportunity: expect.any(Object),
        updateData: expect.any(Object)
      })
    })
  })

  describe('Critical Field Updates Only', () => {
    test('should only update the 6 critical fields', () => {
      const updateData = directUpdateHandler.prepareCriticalFieldUpdate(
        mockDbRecord,
        mockApiRecord
      )
      
      const allowedFields = [
        'title',
        'minimum_award',
        'maximum_award',
        'total_funding_available',
        'close_date',
        'open_date'
      ]
      
      const updateFields = Object.keys(updateData)
      
      updateFields.forEach(field => {
        expect(allowedFields).toContain(field)
      })
    })

    test('should not include non-critical fields in update', () => {
      const apiRecordWithExtraFields = {
        ...mockApiRecord,
        description: 'New description',
        eligibility: 'New eligibility',
        contact_info: 'New contact',
        application_url: 'https://new.url'
      }
      
      const updateData = directUpdateHandler.prepareCriticalFieldUpdate(
        mockDbRecord,
        apiRecordWithExtraFields
      )
      
      expect(updateData.description).toBeUndefined()
      expect(updateData.eligibility).toBeUndefined()
      expect(updateData.contact_info).toBeUndefined()
      expect(updateData.application_url).toBeUndefined()
    })
  })
})
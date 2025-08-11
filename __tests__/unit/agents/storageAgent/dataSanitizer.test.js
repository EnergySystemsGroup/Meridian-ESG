import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { dataSanitizer } from '../../../../lib/agents-v2/core/storageAgent/dataSanitizer.js'

// Mock the fieldMapping utility
jest.mock('../../../../lib/agents-v2/core/storageAgent/utils/fieldMapping.js', () => ({
  fieldMapping: {
    getFieldMappings: jest.fn(() => ({
      minimumAward: 'minimum_award',
      maximumAward: 'maximum_award',
      totalFundingAvailable: 'total_funding_available',
      openDate: 'open_date',
      closeDate: 'close_date',
      postedDate: 'posted_date',
      eligibleApplicants: 'eligible_applicants',
      eligibleProjectTypes: 'eligible_project_types',
      eligibleLocations: 'eligible_locations',
      eligibleActivities: 'eligible_activities',
      categories: 'categories',
      tags: 'tags',
      matchingRequired: 'cost_share_required',
      matchingPercentage: 'cost_share_percentage',
      isNational: 'is_national',
      disbursementType: 'disbursement_type',
      awardProcess: 'award_process',
      notes: 'notes',
      agencyName: 'agency_name',
      fundingAgency: 'funding_agency',
      actionableSummary: 'actionable_summary',
      enhancedDescription: 'enhanced_description',
      relevanceReasoning: 'relevance_reasoning'
    }))
  }
}))

describe('Data Sanitizer Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('prepareForInsert', () => {
    test('should prepare opportunity data for insertion with all required fields', () => {
      const opportunity = {
        id: '12345',
        title: 'Test Grant Opportunity',
        description: 'This is a test description',
        url: 'https://example.com/grant',
        status: 'open',
        minimumAward: 10000,
        maximumAward: 100000,
        openDate: '2025-01-01',
        closeDate: '2025-12-31'
      }
      
      const sourceId = 'source-123'
      const fundingSourceId = 'funding-456'
      
      const result = dataSanitizer.prepareForInsert(opportunity, sourceId, fundingSourceId)
      
      expect(result).toMatchObject({
        api_opportunity_id: '12345',
        title: 'Test Grant Opportunity',
        description: 'This is a test description',
        url: 'https://example.com/grant',
        status: 'open',
        minimum_award: 10000,
        maximum_award: 100000,
        api_source_id: sourceId,
        funding_source_id: fundingSourceId
      })
      
      expect(result.created_at).toBeDefined()
      expect(result.updated_at).toBeDefined()
      expect(new Date(result.created_at).toISOString()).toBe(result.created_at)
      expect(new Date(result.updated_at).toISOString()).toBe(result.updated_at)
    })

    test('should handle null funding source ID', () => {
      const opportunity = { id: '123', title: 'Test' }
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', null)
      
      expect(result.funding_source_id).toBeNull()
      expect(result.api_source_id).toBe('source-1')
    })
  })

  describe('prepareForUpdate', () => {
    test('should prepare opportunity data for update without created_at', () => {
      const opportunity = {
        id: '12345',
        title: 'Updated Title',
        status: 'closed',
        created_at: '2024-01-01' // Should be removed
      }
      
      const fundingSourceId = 'funding-789'
      
      const result = dataSanitizer.prepareForUpdate(opportunity, fundingSourceId)
      
      expect(result.created_at).toBeUndefined()
      expect(result.updated_at).toBeDefined()
      expect(result.funding_source_id).toBe(fundingSourceId)
      expect(result.title).toBe('Updated Title')
      expect(result.status).toBe('closed')
    })
  })

  describe('sanitizeOpportunityId', () => {
    test('should sanitize valid opportunity IDs', () => {
      expect(dataSanitizer.sanitizeOpportunityId('12345')).toBe('12345')
      expect(dataSanitizer.sanitizeOpportunityId('  ABC-123  ')).toBe('ABC-123')
      expect(dataSanitizer.sanitizeOpportunityId(789)).toBe('789')
    })

    test('should return null for invalid IDs', () => {
      expect(dataSanitizer.sanitizeOpportunityId(null)).toBeNull()
      expect(dataSanitizer.sanitizeOpportunityId(undefined)).toBeNull()
      expect(dataSanitizer.sanitizeOpportunityId('')).toBeNull()
      expect(dataSanitizer.sanitizeOpportunityId('   ')).toBeNull()
    })
  })

  describe('sanitizeTitle', () => {
    test('should sanitize valid titles', () => {
      expect(dataSanitizer.sanitizeTitle('Test Title')).toBe('Test Title')
      expect(dataSanitizer.sanitizeTitle('  Trimmed Title  ')).toBe('Trimmed Title')
    })

    test('should truncate long titles to 500 characters', () => {
      const longTitle = 'A'.repeat(600)
      const result = dataSanitizer.sanitizeTitle(longTitle)
      
      expect(result.length).toBe(500)
      expect(result).toBe('A'.repeat(500))
    })

    test('should return null for invalid titles', () => {
      expect(dataSanitizer.sanitizeTitle(null)).toBeNull()
      expect(dataSanitizer.sanitizeTitle('')).toBeNull()
      expect(dataSanitizer.sanitizeTitle('   ')).toBeNull()
    })
  })

  describe('sanitizeUrl', () => {
    test('should sanitize valid URLs', () => {
      expect(dataSanitizer.sanitizeUrl('https://example.com')).toBe('https://example.com')
      expect(dataSanitizer.sanitizeUrl('http://test.org/path')).toBe('http://test.org/path')
      expect(dataSanitizer.sanitizeUrl('  https://example.com  ')).toBe('https://example.com')
    })

    test('should add https:// to URLs missing protocol', () => {
      expect(dataSanitizer.sanitizeUrl('example.com')).toBe('https://example.com')
      expect(dataSanitizer.sanitizeUrl('www.test.org')).toBe('https://www.test.org')
    })

    test('should return null for invalid URLs', () => {
      expect(dataSanitizer.sanitizeUrl(null)).toBeNull()
      expect(dataSanitizer.sanitizeUrl('')).toBeNull()
      expect(dataSanitizer.sanitizeUrl('not a url at all')).toBeNull()
      expect(dataSanitizer.sanitizeUrl('ftp://invalid-protocol.com')).toBe('ftp://invalid-protocol.com')
    })
  })

  describe('sanitizeStatus', () => {
    test('should normalize status values', () => {
      expect(dataSanitizer.sanitizeStatus('open')).toBe('open')
      expect(dataSanitizer.sanitizeStatus('active')).toBe('open')
      expect(dataSanitizer.sanitizeStatus('available')).toBe('open')
      expect(dataSanitizer.sanitizeStatus('closed')).toBe('closed')
      expect(dataSanitizer.sanitizeStatus('inactive')).toBe('closed')
      expect(dataSanitizer.sanitizeStatus('expired')).toBe('closed')
      expect(dataSanitizer.sanitizeStatus('upcoming')).toBe('upcoming')
      expect(dataSanitizer.sanitizeStatus('pending')).toBe('upcoming')
      expect(dataSanitizer.sanitizeStatus('future')).toBe('upcoming')
    })

    test('should handle case insensitive status', () => {
      expect(dataSanitizer.sanitizeStatus('OPEN')).toBe('open')
      expect(dataSanitizer.sanitizeStatus('Active')).toBe('open')
      expect(dataSanitizer.sanitizeStatus('  CLOSED  ')).toBe('closed')
    })

    test('should return original cleaned value for unknown status', () => {
      expect(dataSanitizer.sanitizeStatus('custom-status')).toBe('custom-status')
    })

    test('should return null for invalid status', () => {
      expect(dataSanitizer.sanitizeStatus(null)).toBeNull()
      expect(dataSanitizer.sanitizeStatus('')).toBeNull()
    })
  })

  describe('sanitizeAmount', () => {
    test('should sanitize valid amounts', () => {
      expect(dataSanitizer.sanitizeAmount(10000)).toBe(10000)
      expect(dataSanitizer.sanitizeAmount('50000')).toBe(50000)
      expect(dataSanitizer.sanitizeAmount('$100,000')).toBe(100000)
      expect(dataSanitizer.sanitizeAmount('$1,234,567.89')).toBe(1234567.89)
    })

    test('should return null for invalid amounts', () => {
      expect(dataSanitizer.sanitizeAmount(null)).toBeNull()
      expect(dataSanitizer.sanitizeAmount(undefined)).toBeNull()
      expect(dataSanitizer.sanitizeAmount('')).toBeNull()
      expect(dataSanitizer.sanitizeAmount('0')).toBeNull()
      expect(dataSanitizer.sanitizeAmount(0)).toBeNull()
      expect(dataSanitizer.sanitizeAmount('not a number')).toBeNull()
      expect(dataSanitizer.sanitizeAmount(NaN)).toBeNull()
    })

    test('should handle currency symbols and formatting', () => {
      expect(dataSanitizer.sanitizeAmount('$50,000.00')).toBe(50000)
      expect(dataSanitizer.sanitizeAmount('100,000')).toBe(100000)
      expect(dataSanitizer.sanitizeAmount('  $75,000  ')).toBe(75000)
    })
  })

  describe('sanitizeDate', () => {
    test('should sanitize valid dates to ISO format', () => {
      // Test with UTC dates to avoid timezone issues
      expect(dataSanitizer.sanitizeDate('2025-01-01T00:00:00.000Z')).toBe('2025-01-01T00:00:00.000Z')
      expect(dataSanitizer.sanitizeDate('2025-12-31T23:59:59.000Z')).toBe('2025-12-31T23:59:59.000Z')
      expect(dataSanitizer.sanitizeDate(new Date('2025-06-15T00:00:00.000Z'))).toBe('2025-06-15T00:00:00.000Z')
    })

    test('should return null for invalid dates', () => {
      expect(dataSanitizer.sanitizeDate(null)).toBeNull()
      expect(dataSanitizer.sanitizeDate('')).toBeNull()
      expect(dataSanitizer.sanitizeDate('not a date')).toBeNull()
      expect(dataSanitizer.sanitizeDate('2025-13-01')).toBeNull() // Invalid month
    })
  })

  describe('sanitizeArray', () => {
    test('should sanitize valid arrays', () => {
      expect(dataSanitizer.sanitizeArray(['item1', 'item2', 'item3'])).toEqual(['item1', 'item2', 'item3'])
      expect(dataSanitizer.sanitizeArray(['  trimmed  ', 'items'])).toEqual(['trimmed', 'items'])
    })

    test('should filter out null, undefined, and empty values', () => {
      expect(dataSanitizer.sanitizeArray(['valid', null, undefined, '', '  ', 'item'])).toEqual(['valid', 'item'])
      expect(dataSanitizer.sanitizeArray([null, undefined, ''])).toBeNull()
    })

    test('should return null for non-arrays or empty arrays', () => {
      expect(dataSanitizer.sanitizeArray(null)).toBeNull()
      expect(dataSanitizer.sanitizeArray('not an array')).toBeNull()
      expect(dataSanitizer.sanitizeArray([])).toBeNull()
    })

    test('should convert non-string items to strings', () => {
      expect(dataSanitizer.sanitizeArray([1, 2, 3])).toEqual(['1', '2', '3'])
      expect(dataSanitizer.sanitizeArray([true, false])).toEqual(['true', 'false'])
    })
  })

  describe('sanitizeBoolean', () => {
    test('should sanitize boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean(true)).toBe(true)
      expect(dataSanitizer.sanitizeBoolean(false)).toBe(false)
    })

    test('should parse string boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean('true')).toBe(true)
      expect(dataSanitizer.sanitizeBoolean('TRUE')).toBe(true)
      expect(dataSanitizer.sanitizeBoolean('yes')).toBe(true)
      expect(dataSanitizer.sanitizeBoolean('1')).toBe(true)
      expect(dataSanitizer.sanitizeBoolean('false')).toBe(false)
      expect(dataSanitizer.sanitizeBoolean('FALSE')).toBe(false)
      expect(dataSanitizer.sanitizeBoolean('no')).toBe(false)
      expect(dataSanitizer.sanitizeBoolean('0')).toBe(false)
    })

    test('should return null for invalid boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean(null)).toBeNull()
      expect(dataSanitizer.sanitizeBoolean(undefined)).toBeNull()
      expect(dataSanitizer.sanitizeBoolean('maybe')).toBeNull()
      expect(dataSanitizer.sanitizeBoolean(123)).toBeNull()
    })
  })

  describe('sanitizePercentage', () => {
    test('should sanitize valid percentages', () => {
      expect(dataSanitizer.sanitizePercentage(50)).toBe(50)
      expect(dataSanitizer.sanitizePercentage('75')).toBe(75)
      expect(dataSanitizer.sanitizePercentage(0)).toBe(0)
      expect(dataSanitizer.sanitizePercentage(100)).toBe(100)
    })

    test('should clamp percentages to 0-100 range', () => {
      expect(dataSanitizer.sanitizePercentage(-10)).toBe(0)
      expect(dataSanitizer.sanitizePercentage(150)).toBe(100)
      expect(dataSanitizer.sanitizePercentage('-25')).toBe(0)
      expect(dataSanitizer.sanitizePercentage('200')).toBe(100)
    })

    test('should return null for invalid percentages', () => {
      expect(dataSanitizer.sanitizePercentage(null)).toBeNull()
      expect(dataSanitizer.sanitizePercentage(undefined)).toBeNull()
      expect(dataSanitizer.sanitizePercentage('not a number')).toBeNull()
      expect(dataSanitizer.sanitizePercentage(NaN)).toBeNull()
    })
  })

  describe('sanitizeRelevanceScore', () => {
    test('should sanitize valid scores', () => {
      expect(dataSanitizer.sanitizeRelevanceScore(5)).toBe(5)
      expect(dataSanitizer.sanitizeRelevanceScore('7.5')).toBe(7.5)
      expect(dataSanitizer.sanitizeRelevanceScore(0)).toBe(0)
      expect(dataSanitizer.sanitizeRelevanceScore(10)).toBe(10)
    })

    test('should round scores to 2 decimal places', () => {
      expect(dataSanitizer.sanitizeRelevanceScore(7.456)).toBe(7.46)
      expect(dataSanitizer.sanitizeRelevanceScore(3.333333)).toBe(3.33)
      expect(dataSanitizer.sanitizeRelevanceScore(9.999)).toBe(10)
    })

    test('should clamp scores to 0-10 range', () => {
      expect(dataSanitizer.sanitizeRelevanceScore(-5)).toBe(0)
      expect(dataSanitizer.sanitizeRelevanceScore(15)).toBe(10)
      expect(dataSanitizer.sanitizeRelevanceScore('-2.5')).toBe(0)
      expect(dataSanitizer.sanitizeRelevanceScore('12')).toBe(10)
    })

    test('should return null for invalid scores', () => {
      expect(dataSanitizer.sanitizeRelevanceScore(null)).toBeNull()
      expect(dataSanitizer.sanitizeRelevanceScore(undefined)).toBeNull()
      expect(dataSanitizer.sanitizeRelevanceScore('not a number')).toBeNull()
      expect(dataSanitizer.sanitizeRelevanceScore(NaN)).toBeNull()
    })
  })

  describe('Complex opportunity sanitization', () => {
    test('should handle opportunity with scoring object', () => {
      const opportunity = {
        id: 'complex-1',
        title: 'Complex Grant',
        scoring: {
          overallScore: 8.5,
          alignment: 9,
          feasibility: 7.5,
          impact: 8
        }
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.relevance_score).toBe(8.5)
      expect(result.scoring).toEqual(opportunity.scoring)
    })

    test('should derive agency_name from multiple sources', () => {
      const opportunity1 = { id: '1', agencyName: 'Explicit Agency' }
      const opportunity2 = { id: '2', funding_source: { name: 'Source Agency' } }
      const opportunity3 = { id: '3', fundingAgency: 'Funding Agency' }
      const opportunity4 = { id: '4', title: 'No Agency' }
      
      expect(dataSanitizer.prepareForInsert(opportunity1, 's1', null).agency_name).toBe('Explicit Agency')
      expect(dataSanitizer.prepareForInsert(opportunity2, 's2', null).agency_name).toBe('Source Agency')
      expect(dataSanitizer.prepareForInsert(opportunity3, 's3', null).agency_name).toBe('Funding Agency')
      expect(dataSanitizer.prepareForInsert(opportunity4, 's4', null).agency_name).toBeNull()
    })

    test('should handle all analysis fields', () => {
      const opportunity = {
        id: 'analysis-1',
        title: 'Analysis Test',
        actionableSummary: 'This is an actionable summary',
        enhancedDescription: 'This is an enhanced description',
        relevanceReasoning: 'This is the relevance reasoning'
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.actionable_summary).toBe('This is an actionable summary')
      expect(result.enhanced_description).toBe('This is an enhanced description')
      expect(result.relevance_reasoning).toBe('This is the relevance reasoning')
    })

    test('should handle opportunity with all field types', () => {
      const opportunity = {
        id: '  full-test-123  ',
        opportunityNumber: 'ALT-456',
        title: '  Full Test Opportunity  ',
        description: 'Complete test description',
        url: 'example.com',
        status: 'ACTIVE',
        minimumAward: '$10,000',
        maximumAward: 100000,
        totalFundingAvailable: '1,000,000',
        openDate: '2025-01-01',
        closeDate: new Date('2025-12-31T00:00:00.000Z'),
        postedDate: '2025-01-15T10:00:00.000Z',
        eligibleApplicants: ['Type1', null, '', 'Type2'],
        eligibleProjectTypes: ['  Project1  ', 'Project2'],
        eligibleLocations: [],
        categories: null,
        tags: ['tag1', 'tag2', 'tag3'],
        matchingRequired: 'yes',
        matchingPercentage: '25',
        isNational: false,
        disbursementType: 'Grant',
        awardProcess: 'Competitive',
        notes: 'Test notes',
        api_updated_at: '2025-01-20T12:00:00Z',
        rawResponseId: 'raw-123',
        scoring: {
          overallScore: '9.2567',
          details: {}
        }
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-123', 'funding-456')
      
      // Check all sanitized fields
      expect(result.api_opportunity_id).toBe('full-test-123')
      expect(result.title).toBe('Full Test Opportunity')
      expect(result.description).toBe('Complete test description')
      expect(result.url).toBe('https://example.com')
      expect(result.status).toBe('open')
      expect(result.minimum_award).toBe(10000)
      expect(result.maximum_award).toBe(100000)
      expect(result.total_funding_available).toBe(1000000)
      expect(result.open_date).toBe('2025-01-01T00:00:00.000Z')
      expect(result.close_date).toBe('2025-12-31T00:00:00.000Z')
      expect(result.posted_date).toBe('2025-01-15T10:00:00.000Z')
      expect(result.eligible_applicants).toEqual(['Type1', 'Type2'])
      expect(result.eligible_project_types).toEqual(['Project1', 'Project2'])
      expect(result.eligible_locations).toBeNull()
      expect(result.categories).toBeNull()
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3'])
      expect(result.cost_share_required).toBe(true)
      expect(result.cost_share_percentage).toBe(25)
      expect(result.is_national).toBe(false)
      expect(result.disbursement_type).toBe('Grant')
      expect(result.award_process).toBe('Competitive')
      expect(result.notes).toBe('Test notes')
      expect(result.api_updated_at).toBe('2025-01-20T12:00:00.000Z')
      expect(result.raw_response_id).toBe('raw-123')
      expect(result.relevance_score).toBe(9.26)
      expect(result.scoring).toEqual(opportunity.scoring)
      expect(result.api_source_id).toBe('source-123')
      expect(result.funding_source_id).toBe('funding-456')
      expect(result.created_at).toBeDefined()
      expect(result.updated_at).toBeDefined()
    })
  })

  describe('Edge cases and error handling', () => {
    test('should handle empty opportunity object', () => {
      const result = dataSanitizer.prepareForInsert({}, 'source-1', 'funding-1')
      
      expect(result.api_source_id).toBe('source-1')
      expect(result.funding_source_id).toBe('funding-1')
      expect(result.created_at).toBeDefined()
      expect(result.updated_at).toBeDefined()
      expect(result.title).toBeNull()
      expect(result.description).toBeNull()
    })

    test('should handle opportunity with invalid data types', () => {
      const opportunity = {
        id: { nested: 'object' },
        title: ['array', 'title'],
        minimumAward: { amount: 10000 },
        openDate: { date: '2025-01-01' },
        eligibleApplicants: 'not an array',
        matchingRequired: 123,
        matchingPercentage: { percent: 50 }
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.api_opportunity_id).toBe('[object Object]')
      expect(result.title).toBe('array,title')
      expect(result.minimum_award).toBeNull()
      expect(result.open_date).toBeNull()
      expect(result.eligible_applicants).toBeNull()
      expect(result.cost_share_required).toBeNull()
      expect(result.cost_share_percentage).toBeNull()
    })

    test('should handle extremely long text fields', () => {
      const veryLongTitle = 'A'.repeat(1000)
      const opportunity = {
        id: '123',
        title: veryLongTitle,
        description: 'B'.repeat(10000) // No truncation for description
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.title.length).toBe(500)
      expect(result.title).toBe('A'.repeat(500))
      expect(result.description.length).toBe(10000)
    })

    test('should handle special characters in strings', () => {
      const opportunity = {
        id: 'special-<>&"\'',
        title: 'Title with <html> & "quotes"',
        description: 'Description\nwith\nnewlines\tand\ttabs',
        url: 'https://example.com?param=value&other=123'
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.api_opportunity_id).toBe('special-<>&"\'')
      expect(result.title).toBe('Title with <html> & "quotes"')
      expect(result.description).toBe('Description\nwith\nnewlines\tand\ttabs')
      expect(result.url).toBe('https://example.com?param=value&other=123')
    })

    test('should handle whitespace-only fields', () => {
      const opportunity = {
        id: '   ',
        title: '\t\n\r',
        description: '     ',
        url: '  \t  ',
        status: '   \n   '
      }
      
      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1')
      
      expect(result.api_opportunity_id).toBeNull()
      expect(result.title).toBeNull()
      expect(result.description).toBeNull()
      expect(result.url).toBeNull()
      expect(result.status).toBeNull()
    })
  })
})
import { describe, test, expect } from '@jest/globals'
import { fieldMapping } from '../../../../lib/agents-v2/core/storageAgent/utils/fieldMapping.js'

describe('Field Mapping Utility Unit Tests', () => {
  describe('getFieldMappings', () => {
    test('should return complete field mappings object', () => {
      const mappings = fieldMapping.getFieldMappings()
      
      expect(mappings).toBeDefined()
      expect(typeof mappings).toBe('object')
      expect(mappings.minimumAward).toBe('minimum_award')
      expect(mappings.maximumAward).toBe('maximum_award')
      expect(mappings.eligibleApplicants).toBe('eligible_applicants')
      expect(mappings.matchingRequired).toBe('cost_share_required')
      expect(mappings.actionableSummary).toBe('actionable_summary')
    })

    test('should return a copy, not the original object', () => {
      const mappings1 = fieldMapping.getFieldMappings()
      const mappings2 = fieldMapping.getFieldMappings()
      
      expect(mappings1).not.toBe(mappings2)
      expect(mappings1).toEqual(mappings2)
      
      // Modifying one shouldn't affect the other
      mappings1.newField = 'new_field'
      expect(mappings2.newField).toBeUndefined()
    })

    test('should have 39 field mappings', () => {
      const mappings = fieldMapping.getFieldMappings()
      const uniqueValues = new Set(Object.values(mappings))
      
      // Some fields map to the same database field (id and opportunityNumber both map to api_opportunity_id)
      expect(Object.keys(mappings).length).toBe(39)
      expect(uniqueValues.size).toBeLessThanOrEqual(39)
    })
  })

  describe('getReverseFieldMappings', () => {
    test('should return reverse mappings from snake_case to camelCase', () => {
      const reverseMappings = fieldMapping.getReverseFieldMappings()
      
      expect(reverseMappings).toBeDefined()
      expect(reverseMappings.minimum_award).toBe('minimumAward')
      expect(reverseMappings.maximum_award).toBe('maximumAward')
      expect(reverseMappings.eligible_applicants).toBe('eligibleApplicants')
      expect(reverseMappings.cost_share_required).toBe('matchingRequired')
      expect(reverseMappings.actionable_summary).toBe('actionableSummary')
    })

    test('should handle fields that map to the same database field', () => {
      const reverseMappings = fieldMapping.getReverseFieldMappings()
      
      // Both 'id' and 'opportunityNumber' map to 'api_opportunity_id'
      // The reverse mapping will only have one of them (last one wins)
      expect(reverseMappings.api_opportunity_id).toBeDefined()
      expect(['id', 'opportunityNumber']).toContain(reverseMappings.api_opportunity_id)
    })
  })

  describe('camelToSnake', () => {
    test('should convert known camelCase fields to snake_case', () => {
      expect(fieldMapping.camelToSnake('minimumAward')).toBe('minimum_award')
      expect(fieldMapping.camelToSnake('eligibleApplicants')).toBe('eligible_applicants')
      expect(fieldMapping.camelToSnake('matchingRequired')).toBe('cost_share_required')
      expect(fieldMapping.camelToSnake('isNational')).toBe('is_national')
      expect(fieldMapping.camelToSnake('actionableSummary')).toBe('actionable_summary')
    })

    test('should return unmapped fields as-is', () => {
      expect(fieldMapping.camelToSnake('unknownField')).toBe('unknownField')
      expect(fieldMapping.camelToSnake('notMapped')).toBe('notMapped')
      expect(fieldMapping.camelToSnake('custom_field')).toBe('custom_field')
    })

    test('should handle edge cases', () => {
      expect(fieldMapping.camelToSnake('')).toBe('')
      expect(fieldMapping.camelToSnake(null)).toBe(null)
      expect(fieldMapping.camelToSnake(undefined)).toBe(undefined)
    })
  })

  describe('snakeToCamel', () => {
    test('should convert known snake_case fields to camelCase', () => {
      expect(fieldMapping.snakeToCamel('minimum_award')).toBe('minimumAward')
      expect(fieldMapping.snakeToCamel('eligible_applicants')).toBe('eligibleApplicants')
      expect(fieldMapping.snakeToCamel('cost_share_required')).toBe('matchingRequired')
      expect(fieldMapping.snakeToCamel('is_national')).toBe('isNational')
      expect(fieldMapping.snakeToCamel('actionable_summary')).toBe('actionableSummary')
    })

    test('should return unmapped fields as-is', () => {
      expect(fieldMapping.snakeToCamel('unknown_field')).toBe('unknown_field')
      expect(fieldMapping.snakeToCamel('not_mapped')).toBe('not_mapped')
      expect(fieldMapping.snakeToCamel('customField')).toBe('customField')
    })

    test('should handle edge cases', () => {
      expect(fieldMapping.snakeToCamel('')).toBe('')
      expect(fieldMapping.snakeToCamel(null)).toBe(null)
      expect(fieldMapping.snakeToCamel(undefined)).toBe(undefined)
    })
  })

  describe('convertObjectToSnakeCase', () => {
    test('should convert object with camelCase keys to snake_case', () => {
      const camelObj = {
        minimumAward: 10000,
        maximumAward: 100000,
        eligibleApplicants: ['Type1', 'Type2'],
        matchingRequired: true,
        matchingPercentage: 25,
        isNational: false
      }
      
      const result = fieldMapping.convertObjectToSnakeCase(camelObj)
      
      expect(result).toEqual({
        minimum_award: 10000,
        maximum_award: 100000,
        eligible_applicants: ['Type1', 'Type2'],
        cost_share_required: true,
        cost_share_percentage: 25,
        is_national: false
      })
    })

    test('should preserve unmapped fields', () => {
      const obj = {
        knownField: 'value',
        minimumAward: 50000,
        unknownField: 'preserved',
        custom_field: 'also_preserved'
      }
      
      const result = fieldMapping.convertObjectToSnakeCase(obj)
      
      expect(result.knownField).toBe('value')
      expect(result.minimum_award).toBe(50000)
      expect(result.unknownField).toBe('preserved')
      expect(result.custom_field).toBe('also_preserved')
    })

    test('should handle non-object inputs', () => {
      expect(fieldMapping.convertObjectToSnakeCase(null)).toBeNull()
      expect(fieldMapping.convertObjectToSnakeCase(undefined)).toBeUndefined()
      expect(fieldMapping.convertObjectToSnakeCase('string')).toBe('string')
      expect(fieldMapping.convertObjectToSnakeCase(123)).toBe(123)
      expect(fieldMapping.convertObjectToSnakeCase(true)).toBe(true)
    })

    test('should handle empty objects', () => {
      expect(fieldMapping.convertObjectToSnakeCase({})).toEqual({})
    })

    test('should handle nested values without converting them', () => {
      const obj = {
        minimumAward: 10000,
        nestedObject: {
          innerField: 'value',
          anotherField: 123
        },
        arrayField: [1, 2, 3]
      }
      
      const result = fieldMapping.convertObjectToSnakeCase(obj)
      
      expect(result.minimum_award).toBe(10000)
      expect(result.nestedObject).toEqual({
        innerField: 'value',
        anotherField: 123
      })
      expect(result.arrayField).toEqual([1, 2, 3])
    })
  })

  describe('convertObjectToCamelCase', () => {
    test('should convert object with snake_case keys to camelCase', () => {
      const snakeObj = {
        minimum_award: 10000,
        maximum_award: 100000,
        eligible_applicants: ['Type1', 'Type2'],
        cost_share_required: true,
        cost_share_percentage: 25,
        is_national: false
      }
      
      const result = fieldMapping.convertObjectToCamelCase(snakeObj)
      
      expect(result).toEqual({
        minimumAward: 10000,
        maximumAward: 100000,
        eligibleApplicants: ['Type1', 'Type2'],
        matchingRequired: true,
        matchingPercentage: 25,
        isNational: false
      })
    })

    test('should preserve unmapped fields', () => {
      const obj = {
        known_field: 'value',
        minimum_award: 50000,
        unknown_field: 'preserved',
        customField: 'also_preserved'
      }
      
      const result = fieldMapping.convertObjectToCamelCase(obj)
      
      expect(result.known_field).toBe('value')
      expect(result.minimumAward).toBe(50000)
      expect(result.unknown_field).toBe('preserved')
      expect(result.customField).toBe('also_preserved')
    })

    test('should handle non-object inputs', () => {
      expect(fieldMapping.convertObjectToCamelCase(null)).toBeNull()
      expect(fieldMapping.convertObjectToCamelCase(undefined)).toBeUndefined()
      expect(fieldMapping.convertObjectToCamelCase('string')).toBe('string')
      expect(fieldMapping.convertObjectToCamelCase(123)).toBe(123)
      expect(fieldMapping.convertObjectToCamelCase(false)).toBe(false)
    })
  })

  describe('isCamelCase', () => {
    test('should correctly identify camelCase fields', () => {
      expect(fieldMapping.isCamelCase('minimumAward')).toBe(true)
      expect(fieldMapping.isCamelCase('eligibleApplicants')).toBe(true)
      expect(fieldMapping.isCamelCase('isNational')).toBe(true)
      expect(fieldMapping.isCamelCase('id')).toBe(true)
      expect(fieldMapping.isCamelCase('title')).toBe(true)
    })

    test('should correctly identify non-camelCase fields', () => {
      expect(fieldMapping.isCamelCase('minimum_award')).toBe(false)
      expect(fieldMapping.isCamelCase('MinimumAward')).toBe(false) // PascalCase
      expect(fieldMapping.isCamelCase('MINIMUM_AWARD')).toBe(false)
      expect(fieldMapping.isCamelCase('minimum-award')).toBe(false)
      expect(fieldMapping.isCamelCase('123minimum')).toBe(false)
      expect(fieldMapping.isCamelCase('')).toBe(false)
    })
  })

  describe('isSnakeCase', () => {
    test('should correctly identify snake_case fields', () => {
      expect(fieldMapping.isSnakeCase('minimum_award')).toBe(true)
      expect(fieldMapping.isSnakeCase('eligible_applicants')).toBe(true)
      expect(fieldMapping.isSnakeCase('is_national')).toBe(true)
      expect(fieldMapping.isSnakeCase('api_opportunity_id')).toBe(true)
      expect(fieldMapping.isSnakeCase('cost_share_required')).toBe(true)
    })

    test('should correctly identify non-snake_case fields', () => {
      expect(fieldMapping.isSnakeCase('minimumAward')).toBe(false)
      expect(fieldMapping.isSnakeCase('MinimumAward')).toBe(false)
      expect(fieldMapping.isSnakeCase('MINIMUM_AWARD')).toBe(false)
      expect(fieldMapping.isSnakeCase('minimum-award')).toBe(false)
      expect(fieldMapping.isSnakeCase('123_minimum')).toBe(false)
      expect(fieldMapping.isSnakeCase('_minimum_award')).toBe(false)
      expect(fieldMapping.isSnakeCase('')).toBe(false)
      
      // Single word lowercase without underscore
      expect(fieldMapping.isSnakeCase('minimum')).toBe(false)
    })
  })

  describe('getDatabaseFields', () => {
    test('should return array of all database field names', () => {
      const dbFields = fieldMapping.getDatabaseFields()
      
      expect(Array.isArray(dbFields)).toBe(true)
      expect(dbFields).toContain('minimum_award')
      expect(dbFields).toContain('maximum_award')
      expect(dbFields).toContain('eligible_applicants')
      expect(dbFields).toContain('cost_share_required')
      expect(dbFields).toContain('actionable_summary')
      expect(dbFields.length).toBeGreaterThan(30)
    })

    test('should return snake_case fields', () => {
      const dbFields = fieldMapping.getDatabaseFields()
      
      // Most should be snake_case, but some are single words
      const snakeCaseFields = dbFields.filter(field => field.includes('_'))
      const singleWordFields = dbFields.filter(field => !field.includes('_'))
      
      expect(snakeCaseFields.length).toBeGreaterThan(0)
      expect(singleWordFields).toContain('title')
      expect(singleWordFields).toContain('description')
      expect(singleWordFields).toContain('url')
      expect(singleWordFields).toContain('status')
    })
  })

  describe('getApiFields', () => {
    test('should return array of all API field names', () => {
      const apiFields = fieldMapping.getApiFields()
      
      expect(Array.isArray(apiFields)).toBe(true)
      expect(apiFields).toContain('minimumAward')
      expect(apiFields).toContain('maximumAward')
      expect(apiFields).toContain('eligibleApplicants')
      expect(apiFields).toContain('matchingRequired')
      expect(apiFields).toContain('actionableSummary')
      expect(apiFields.length).toBeGreaterThan(30)
    })

    test('should return camelCase and single word fields', () => {
      const apiFields = fieldMapping.getApiFields()
      
      // Check for camelCase
      expect(apiFields).toContain('minimumAward')
      expect(apiFields).toContain('eligibleApplicants')
      
      // Check for single words
      expect(apiFields).toContain('id')
      expect(apiFields).toContain('title')
      expect(apiFields).toContain('description')
    })
  })

  describe('validateFieldFormat', () => {
    test('should validate camelCase object format', () => {
      const validCamelObj = {
        minimumAward: 10000,
        maximumAward: 50000,
        eligibleApplicants: [],
        id: '123',
        title: 'Test'
      }
      
      const result = fieldMapping.validateFieldFormat(validCamelObj, 'camelCase')
      expect(result.isValid).toBe(true)
    })

    test('should detect invalid camelCase fields', () => {
      const invalidObj = {
        minimumAward: 10000,
        minimum_award: 20000, // snake_case
        MaximumAward: 30000, // PascalCase
        'eligible-applicants': [] // kebab-case
      }
      
      const result = fieldMapping.validateFieldFormat(invalidObj, 'camelCase')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('minimum_award')
      expect(result.error).toContain('MaximumAward')
      expect(result.error).toContain('eligible-applicants')
    })

    test('should validate snake_case object format', () => {
      const validSnakeObj = {
        minimum_award: 10000,
        maximum_award: 50000,
        eligible_applicants: [],
        api_opportunity_id: '123',
        is_national: true
      }
      
      const result = fieldMapping.validateFieldFormat(validSnakeObj, 'snake_case')
      expect(result.isValid).toBe(true)
    })

    test('should detect invalid snake_case fields', () => {
      const invalidObj = {
        minimum_award: 10000,
        minimumAward: 20000, // camelCase
        MaximumAward: 30000, // PascalCase
        ELIGIBLE_APPLICANTS: [] // UPPER_CASE
      }
      
      const result = fieldMapping.validateFieldFormat(invalidObj, 'snake_case')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('minimumAward')
      expect(result.error).toContain('MaximumAward')
      expect(result.error).toContain('ELIGIBLE_APPLICANTS')
    })

    test('should handle non-object inputs', () => {
      expect(fieldMapping.validateFieldFormat(null, 'camelCase')).toEqual({
        isValid: false,
        error: 'Object is required'
      })
      
      expect(fieldMapping.validateFieldFormat(undefined, 'snake_case')).toEqual({
        isValid: false,
        error: 'Object is required'
      })
      
      expect(fieldMapping.validateFieldFormat('string', 'camelCase')).toEqual({
        isValid: false,
        error: 'Object is required'
      })
    })

    test('should handle empty objects', () => {
      const result = fieldMapping.validateFieldFormat({}, 'camelCase')
      expect(result.isValid).toBe(true)
    })
  })

  describe('Field mapping consistency', () => {
    test('should have consistent bidirectional mappings', () => {
      const mappings = fieldMapping.getFieldMappings()
      const reverseMappings = fieldMapping.getReverseFieldMappings()
      
      // For each forward mapping, there should be a reverse
      for (const [camel, snake] of Object.entries(mappings)) {
        // Some fields map to the same DB field, so reverse might not match exactly
        if (snake === 'api_opportunity_id') {
          // Both 'id' and 'opportunityNumber' map to 'api_opportunity_id'
          expect(['id', 'opportunityNumber']).toContain(reverseMappings[snake])
        } else if (reverseMappings[snake]) {
          expect(reverseMappings[snake]).toBe(camel)
        }
      }
    })

    test('should handle all monetary fields', () => {
      const mappings = fieldMapping.getFieldMappings()
      
      expect(mappings.minimumAward).toBe('minimum_award')
      expect(mappings.maximumAward).toBe('maximum_award')
      expect(mappings.totalFundingAvailable).toBe('total_funding_available')
    })

    test('should handle all date fields', () => {
      const mappings = fieldMapping.getFieldMappings()
      
      expect(mappings.openDate).toBe('open_date')
      expect(mappings.closeDate).toBe('close_date')
      expect(mappings.postedDate).toBe('posted_date')
      expect(mappings.applicationDeadline).toBe('application_deadline')
      expect(mappings.announcementDate).toBe('announcement_date')
      expect(mappings.lastUpdated).toBe('last_updated')
      expect(mappings.apiUpdatedAt).toBe('api_updated_at')
    })

    test('should handle all array fields', () => {
      const mappings = fieldMapping.getFieldMappings()
      
      expect(mappings.eligibleApplicants).toBe('eligible_applicants')
      expect(mappings.eligibleProjectTypes).toBe('eligible_project_types')
      expect(mappings.eligibleLocations).toBe('eligible_locations')
      expect(mappings.eligibleActivities).toBe('eligible_activities')
      expect(mappings.categories).toBe('categories')
      expect(mappings.tags).toBe('tags')
    })

    test('should handle all analysis fields', () => {
      const mappings = fieldMapping.getFieldMappings()
      
      expect(mappings.actionableSummary).toBe('actionable_summary')
      expect(mappings.relevanceScore).toBe('relevance_score')
      expect(mappings.enhancedDescription).toBe('enhanced_description')
      expect(mappings.relevanceReasoning).toBe('relevance_reasoning')
      expect(mappings.scoring).toBe('scoring')
    })
  })
})
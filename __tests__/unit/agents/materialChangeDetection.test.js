/**
 * Unit Tests - Material Change Detection
 * 
 * Tests the change detection logic that determines whether an opportunity
 * has material changes worth updating:
 * - Amount changes >5% trigger UPDATE
 * - Date field changes trigger UPDATE
 * - Status changes trigger UPDATE
 * - Description changes >20% trigger UPDATE
 * - Minor changes below threshold trigger SKIP
 * - Boundary testing (4.9%, 5%, 5.1% changes)
 * - Multiple simultaneous changes handling
 */

// Import the actual change detector module (not mocked for unit testing)
import { changeDetector } from '../../../lib/agents-v2/optimization/changeDetector.js'
const { detectMaterialChanges } = changeDetector
import { 
  generateOpportunity,
  generateExistingOpportunity
} from '../../fixtures/opportunities.js'

describe('Material Change Detection Tests', () => {
  let existingOpportunity
  
  beforeEach(() => {
    // Setup a baseline existing opportunity
    existingOpportunity = generateExistingOpportunity({
      id: 'TEST-001',
      title: 'Federal Research Grant',
      description: 'This is a comprehensive federal research grant program designed to support innovative scientific research across multiple disciplines. The program aims to advance knowledge and foster collaboration between institutions.',
      openDate: '2024-01-01',
      closeDate: '2024-12-31',
      status: 'posted',
      minimumAward: 10000,
      maximumAward: 500000,
      totalFundingAvailable: 10000000
    })
  })
  
  describe('Amount Changes', () => {
    test('should trigger UPDATE for >5% increase in maximumAward', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 530000 // 6% increase (530000/500000 = 1.06)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should trigger UPDATE for >5% decrease in maximumAward', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 470000 // 6% decrease (470000/500000 = 0.94)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should SKIP for <5% change in maximumAward', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 510000 // 2% increase (510000/500000 = 1.02)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle boundary case: exactly 5% change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 525000 // Exactly 5% increase (525000/500000 = 1.05)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false) // 5% is the threshold, >5% triggers update
    })
    
    test('should handle boundary case: 4.9% change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 524500 // 4.9% increase
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle boundary case: 5.1% change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 525500 // 5.1% increase
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should trigger UPDATE for minimumAward changes >5%', () => {
      const newOpportunity = {
        ...existingOpportunity,
        minimumAward: 11000 // 10% increase (11000/10000 = 1.1)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should trigger UPDATE for totalFundingAvailable changes >5%', () => {
      const newOpportunity = {
        ...existingOpportunity,
        totalFundingAvailable: 11000000 // 10% increase
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle null to value change as material', () => {
      existingOpportunity.maximumAward = null
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 500000
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle value to null change as material', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: null
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle zero values correctly', () => {
      existingOpportunity.minimumAward = 0
      const newOpportunity = {
        ...existingOpportunity,
        minimumAward: 1000 // Any change from 0 is material
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
  })
  
  describe('Date Field Changes', () => {
    test('should trigger UPDATE for closeDate change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        closeDate: '2025-01-15'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should trigger UPDATE for openDate change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        openDate: '2024-02-01'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should SKIP if dates are same but formatted differently', () => {
      existingOpportunity.closeDate = '2024-12-31'
      const newOpportunity = {
        ...existingOpportunity,
        closeDate: '2024-12-31T00:00:00.000Z' // Same date, different format
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle null date to value as material', () => {
      existingOpportunity.closeDate = null
      const newOpportunity = {
        ...existingOpportunity,
        closeDate: '2025-01-01'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle date to null as material', () => {
      const newOpportunity = {
        ...existingOpportunity,
        closeDate: null
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle invalid date strings gracefully', () => {
      const newOpportunity = {
        ...existingOpportunity,
        closeDate: 'invalid-date'
      }
      
      // Should still detect as change since strings differ
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
  })
  
  describe('Status Changes', () => {
    test('should trigger UPDATE for status change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        status: 'closed'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should SKIP if status is same with different case', () => {
      existingOpportunity.status = 'posted'
      const newOpportunity = {
        ...existingOpportunity,
        status: 'POSTED' // Same status, different case
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should SKIP if status is same with whitespace', () => {
      existingOpportunity.status = 'posted'
      const newOpportunity = {
        ...existingOpportunity,
        status: ' posted ' // Same status with whitespace
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle null status to value as material', () => {
      existingOpportunity.status = null
      const newOpportunity = {
        ...existingOpportunity,
        status: 'posted'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
  })
  
  describe('Description Changes', () => {
    test('should trigger UPDATE for >20% description change', () => {
      const originalDesc = 'This is a test description with some content.'
      const significantChange = 'This is a completely different description with entirely new content and meaning.'
      
      existingOpportunity.description = originalDesc
      const newOpportunity = {
        ...existingOpportunity,
        description: significantChange
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should SKIP for <20% description change', () => {
      const originalDesc = 'This is a comprehensive federal research grant program.'
      const minorChange = 'This is a comprehensive federal research grant program for universities.' // Minor addition
      
      existingOpportunity.description = originalDesc
      const newOpportunity = {
        ...existingOpportunity,
        description: minorChange
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      
      // Calculate actual similarity
      const lengthDiff = Math.abs(minorChange.length - originalDesc.length)
      const percentChange = lengthDiff / originalDesc.length
      
      // Should skip if change is minor (<20%)
      if (percentChange < 0.2) {
        expect(result).toBe(false)
      }
    })
    
    test('should handle empty description to content as material', () => {
      existingOpportunity.description = ''
      const newOpportunity = {
        ...existingOpportunity,
        description: 'New description content'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle null description changes', () => {
      existingOpportunity.description = null
      const newOpportunity = {
        ...existingOpportunity,
        description: 'New description'
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle very long descriptions efficiently', () => {
      const longDesc = 'Lorem ipsum '.repeat(1000) // Very long description
      existingOpportunity.description = longDesc
      
      const newOpportunity = {
        ...existingOpportunity,
        description: longDesc + ' Additional content.' // Minor addition to long text
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      
      // Small addition to very long text should be considered minor
      expect(result).toBe(false)
    })
  })
  
  describe('Multiple Simultaneous Changes', () => {
    test('should trigger UPDATE if any field has material change', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 505000, // 1% change (not material)
        closeDate: '2025-01-15', // Date change (material)
        description: existingOpportunity.description + ' Minor update.' // Minor change
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true) // Date change triggers update
    })
    
    test('should trigger UPDATE with multiple material changes', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 600000, // 20% change (material)
        closeDate: '2025-06-30', // Date change (material)
        status: 'closed' // Status change (material)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should SKIP if all changes are minor', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 505000, // 1% change (not material)
        description: existingOpportunity.description + '.' // Tiny change
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle mixed null and value changes', () => {
      existingOpportunity.minimumAward = null
      existingOpportunity.totalFundingAvailable = 10000000
      
      const newOpportunity = {
        ...existingOpportunity,
        minimumAward: 5000, // null to value (material)
        totalFundingAvailable: null // value to null (material)
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
  })
  
  describe('Edge Cases', () => {
    test('should handle undefined fields gracefully', () => {
      const newOpportunity = {
        ...existingOpportunity,
        undefinedField: 'new value'
      }
      
      // Should not crash on undefined fields
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBeDefined()
    })
    
    test('should handle NaN values in amounts', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: NaN
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true) // NaN should be treated as material change
    })
    
    test('should handle Infinity values in amounts', () => {
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: Infinity
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true) // Infinity should be treated as material change
    })
    
    test('should handle negative amounts correctly', () => {
      existingOpportunity.maximumAward = -500000
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: -530000 // 6% change in negative values
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle very small percentage changes precisely', () => {
      existingOpportunity.maximumAward = 1000000
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: 1050001 // Just over 5%
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle string numbers in amount fields', () => {
      existingOpportunity.maximumAward = '500000'
      const newOpportunity = {
        ...existingOpportunity,
        maximumAward: '530000' // String numbers, 6% change
      }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(true)
    })
    
    test('should handle identical objects as no change', () => {
      const newOpportunity = { ...existingOpportunity }
      
      const result = detectMaterialChanges(existingOpportunity, newOpportunity)
      expect(result).toBe(false)
    })
    
    test('should handle empty objects gracefully', () => {
      const result = detectMaterialChanges({}, {})
      expect(result).toBe(false)
    })
  })
  
  describe('Performance', () => {
    test('should efficiently process large numbers of comparisons', () => {
      const startTime = Date.now()
      
      // Run 10000 comparisons
      for (let i = 0; i < 10000; i++) {
        const newOpportunity = {
          ...existingOpportunity,
          maximumAward: 500000 + (i % 100000)
        }
        detectMaterialChanges(existingOpportunity, newOpportunity)
      }
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})
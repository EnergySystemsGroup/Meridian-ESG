// Mock dataSanitizer module
import { jest } from '@jest/globals'

export const dataSanitizer = {
  prepareForInsert: jest.fn(),
  prepareForUpdate: jest.fn(),
  sanitizeFields: jest.fn(),
  sanitizeValue: jest.fn(),
  sanitizeOpportunityId: jest.fn(),
  sanitizeTitle: jest.fn(),
  sanitizeDescription: jest.fn(),
  sanitizeUrl: jest.fn(),
  sanitizeStatus: jest.fn(),
  sanitizeAmount: jest.fn(),
  sanitizeDate: jest.fn(),
  sanitizeArray: jest.fn(),
  sanitizeBoolean: jest.fn(),
  sanitizePercentage: jest.fn(),
  sanitizeRelevanceScore: jest.fn()
}
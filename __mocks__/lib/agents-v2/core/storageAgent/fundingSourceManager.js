// Mock fundingSourceManager module
import { jest } from '@jest/globals'

const mockGetOrCreate = jest.fn()
const mockFindByName = jest.fn()
const mockUpdateIfNeeded = jest.fn()
const mockCreate = jest.fn()
const mockCategorizeAgencyType = jest.fn()

export const fundingSourceManager = {
  getOrCreate: mockGetOrCreate,
  findByName: mockFindByName,
  updateIfNeeded: mockUpdateIfNeeded,
  create: mockCreate,
  categorizeAgencyType: mockCategorizeAgencyType
}

// For test access
export {
  mockGetOrCreate,
  mockFindByName,
  mockUpdateIfNeeded,
  mockCreate,
  mockCategorizeAgencyType
}
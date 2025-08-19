// Mock stateEligibilityProcessor module
import { jest } from '@jest/globals';

export const stateEligibilityProcessor = {
  processEligibility: jest.fn(),
  updateEligibility: jest.fn(),
  parseLocationsToStateCodes: jest.fn(),
  createEligibilityRecords: jest.fn(),
  clearExistingEligibility: jest.fn(),
  getEligibleStates: jest.fn(),
  validateEligibility: jest.fn()
}
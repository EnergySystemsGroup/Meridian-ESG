// Mock locationParsing module
import { jest } from '@jest/globals';

// Create the mock functions
const parseLocationToStateCodes = jest.fn(() => []);
const isNationalLocation = jest.fn(() => false);
const parseIndividualStates = jest.fn(() => []);
const isValidStateCode = jest.fn(() => false);
const getStateName = jest.fn(() => null);
const getStatesInRegion = jest.fn(() => []);
const getAvailableRegions = jest.fn(() => []);
const expandLocationsToStateCodes = jest.fn(() => []);
const isMultiStateLocation = jest.fn(() => false);
const getLocationDescription = jest.fn(() => 'No specific states');

// Export as named export to match the real module
export const locationParsing = {
  parseLocationToStateCodes,
  isNationalLocation,
  parseIndividualStates,
  isValidStateCode,
  getStateName,
  getStatesInRegion,
  getAvailableRegions,
  expandLocationsToStateCodes,
  isMultiStateLocation,
  getLocationDescription
};
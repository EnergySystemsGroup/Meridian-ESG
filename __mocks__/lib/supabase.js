import { jest } from '@jest/globals'

// Mock Supabase client
export const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn()
  }
}

// Mock createSupabaseClient function
export const createSupabaseClient = jest.fn(() => mockSupabaseClient)

// Mock logAgentExecution function
export const logAgentExecution = jest.fn()

// Export all for easy importing
export default {
  createSupabaseClient,
  logAgentExecution,
  mockSupabaseClient
}
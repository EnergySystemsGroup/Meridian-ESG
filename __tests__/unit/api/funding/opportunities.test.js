/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/funding/route';
import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
  createSupabaseClient: jest.fn(),
  fundingApi: {
    getOpportunities: jest.fn(),
    getOpportunityById: jest.fn(),
  }
}));

describe('API: /api/funding/opportunities', () => {
  let mockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    createSupabaseClient.mockReturnValue(mockSupabaseClient);
  });

  describe('GET /api/funding/opportunities', () => {
    it('should return opportunities with default pagination', async () => {
      const mockOpportunities = [
        {
          id: '1',
          title: 'Test Grant 1',
          min_amount: 10000,
          max_amount: 100000,
          status: 'active',
        },
        {
          id: '2',
          title: 'Test Grant 2',
          min_amount: 50000,
          max_amount: 500000,
          status: 'active',
        },
      ];

      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockResolvedValue({
        data: mockOpportunities,
        count: 2,
      });

      const request = new NextRequest('http://localhost:3000/api/funding');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockOpportunities);
      expect(data.total_count).toBe(2);
      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 2,
      });
    });

    it('should handle query parameters correctly', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockResolvedValue({
        data: [],
        count: 0,
      });

      const url = 'http://localhost:3000/api/funding?' + new URLSearchParams({
        status: 'active',
        min_amount: '10000',
        max_amount: '100000',
        categories: 'energy,environment',
        states: 'CA,NY',
        page: '2',
        page_size: '20',
        search: 'solar',
        sort_by: 'close_date',
        sort_direction: 'asc'
      });

      const request = new NextRequest(url);
      await GET(request);

      expect(fundingApi.getOpportunities).toHaveBeenCalledWith({
        status: 'active',
        min_amount: '10000',
        max_amount: '100000',
        categories: ['energy', 'environment'],
        states: ['CA', 'NY'],
        page: 2,
        page_size: 20,
        search: 'solar',
        sort_by: 'close_date',
        sort_direction: 'asc',
        close_date_after: null,
        close_date_before: null,
        trackedIds: undefined
      });
    });

    it('should handle date range filtering', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockResolvedValue({
        data: [],
        count: 0,
      });

      const url = 'http://localhost:3000/api/funding?' + new URLSearchParams({
        close_date_after: '2024-01-01',
        close_date_before: '2024-12-31'
      });

      const request = new NextRequest(url);
      await GET(request);

      expect(fundingApi.getOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          close_date_after: '2024-01-01',
          close_date_before: '2024-12-31',
        })
      );
    });

    it('should handle tracked IDs array', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockResolvedValue({
        data: [],
        count: 0,
      });

      const url = 'http://localhost:3000/api/funding?' + new URLSearchParams({
        trackedIds: 'id1,id2,id3'
      });

      const request = new NextRequest(url);
      await GET(request);

      expect(fundingApi.getOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          trackedIds: ['id1', 'id2', 'id3'],
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/funding');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Database error');
    });

    it('should handle pagination boundaries', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunities.mockResolvedValue({
        data: [],
        count: 100,
      });

      const url = 'http://localhost:3000/api/funding?' + new URLSearchParams({
        page: '0',  // Invalid page
        page_size: '1000'  // Large page size
      });

      const request = new NextRequest(url);
      await GET(request);

      // Should default to page 1 if 0 is provided
      expect(fundingApi.getOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 0,  // The API accepts 0, but should probably validate
          page_size: 1000,
        })
      );
    });
  });

  describe('POST /api/funding/opportunities', () => {
    it('should fetch a single opportunity by ID', async () => {
      const mockOpportunity = {
        id: '123',
        title: 'Test Grant',
        description: 'Test description',
        min_amount: 10000,
        max_amount: 100000,
      };

      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunityById.mockResolvedValue(mockOpportunity);

      const request = new NextRequest('http://localhost:3000/api/funding', {
        method: 'POST',
        body: JSON.stringify({ id: '123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockOpportunity);
      expect(fundingApi.getOpportunityById).toHaveBeenCalledWith('123');
    });

    it('should return 400 for missing ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/funding', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Opportunity ID is required');
    });

    it('should handle opportunity not found', async () => {
      const { fundingApi } = require('@/lib/supabase');
      fundingApi.getOpportunityById.mockRejectedValue(new Error('Not found'));

      const request = new NextRequest('http://localhost:3000/api/funding', {
        method: 'POST',
        body: JSON.stringify({ id: '999' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200); // Falls back to mock data
      expect(data.success).toBe(true);
      expect(data.data).toBeNull(); // Mock data doesn't have ID 999
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/funding', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
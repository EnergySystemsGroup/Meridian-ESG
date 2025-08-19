/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/funding/sources/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/funding/sources/[id]/route';
import { POST as PROCESS_SOURCE } from '@/app/api/funding/sources/[id]/process/route';
import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { processApiSource } from '@/lib/services/processCoordinator';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  createSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/services/processCoordinator', () => ({
  processApiSource: jest.fn(),
}));

describe('API: /api/funding/sources', () => {
  let mockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Supabase client with proper chaining
    mockSupabaseClient = {
      from: jest.fn(() => mockSupabaseClient),
      select: jest.fn(() => mockSupabaseClient),
      eq: jest.fn(() => mockSupabaseClient),
      order: jest.fn(() => mockSupabaseClient),
      single: jest.fn(() => mockSupabaseClient),
      insert: jest.fn(() => mockSupabaseClient),
      update: jest.fn(() => mockSupabaseClient),
      delete: jest.fn(() => mockSupabaseClient),
      rpc: jest.fn(),
    };

    createSupabaseClient.mockReturnValue(mockSupabaseClient);
  });

  describe('GET /api/funding/sources', () => {
    it('should return all funding sources', async () => {
      const mockSources = [
        { id: '1', name: 'Source 1', type: 'federal', active: true },
        { id: '2', name: 'Source 2', type: 'state', active: true },
      ];

      mockSupabaseClient.order.mockResolvedValue({
        data: mockSources,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sources).toEqual(mockSources);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('api_sources');
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('name');
    });

    it('should filter by active status', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources?active=true');
      await GET(request);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('active', true);
    });

    it('should filter by type', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources?type=federal');
      await GET(request);

      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('type', 'federal');
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch API sources');
    });
  });

  describe('POST /api/funding/sources', () => {
    it('should create a new funding source', async () => {
      const newSource = {
        name: 'New Source',
        type: 'federal',
        url: 'https://example.com',
        organization: 'Test Org',
        api_endpoint: 'https://api.example.com',
        auth_type: 'api_key',
        update_frequency: 'daily',
        active: true,
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: '123', ...newSource },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources', {
        method: 'POST',
        body: JSON.stringify(newSource),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source).toMatchObject(newSource);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: newSource.name,
          type: newSource.type,
          url: newSource.url,
        })
      );
    });

    it('should validate required fields', async () => {
      const invalidSource = {
        name: 'Test',
        // Missing type and url
      };

      const request = new NextRequest('http://localhost:3000/api/funding/sources', {
        method: 'POST',
        body: JSON.stringify(invalidSource),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Name, type, and URL are required');
    });

    it('should check for similar sources and return 409 if found', async () => {
      const newSource = {
        name: 'Existing Source',
        type: 'federal',
        url: 'https://example.com',
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ id: '1', name: 'Existing Source', organization: null }],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources', {
        method: 'POST',
        body: JSON.stringify(newSource),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Similar sources already exist');
      expect(data.similarSources).toHaveLength(1);
    });

    it('should handle unique constraint violations', async () => {
      const newSource = {
        name: 'Duplicate Source',
        type: 'federal',
        url: 'https://example.com',
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Unique constraint violation' },
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources', {
        method: 'POST',
        body: JSON.stringify(newSource),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('A source with this name and organization already exists');
    });

    it('should insert configurations when provided', async () => {
      const sourceWithConfig = {
        name: 'Source with Config',
        type: 'federal',
        url: 'https://example.com',
        configurations: {
          query_params: { page: 1 },
          request_body: { filter: 'active' },
          pagination_config: { enabled: true, type: 'offset' },
        },
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: '123', ...sourceWithConfig },
        error: null,
      });

      mockSupabaseClient.insert.mockResolvedValue({
        data: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources', {
        method: 'POST',
        body: JSON.stringify(sourceWithConfig),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      // Check that configurations insert was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('api_source_configurations');
    });
  });

  describe('GET /api/funding/sources/[id]', () => {
    it('should return a single source with configurations', async () => {
      const mockSource = {
        id: '123',
        name: 'Test Source',
        type: 'federal',
      };

      const mockConfigs = [
        { config_type: 'query_params', configuration: { page: 1 } },
        { config_type: 'pagination_config', configuration: { enabled: true } },
      ];

      // First call for source
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSource,
        error: null,
      });

      // Second call for configurations
      mockSupabaseClient.eq.mockReturnValue({
        data: mockConfigs,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123');
      const params = { params: Promise.resolve({ id: '123' }) };
      const response = await GET_BY_ID(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toMatchObject(mockSource);
      expect(data.source.configurations).toBeDefined();
    });

    it('should return 404 for non-existent source', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/999');
      const params = { params: Promise.resolve({ id: '999' }) };
      const response = await GET_BY_ID(request, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API source not found');
    });
  });

  describe('PUT /api/funding/sources/[id]', () => {
    it('should update an existing source', async () => {
      const updateData = {
        name: 'Updated Source',
        active: false,
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: '123', ...updateData },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const params = { params: Promise.resolve({ id: '123' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source.name).toBe('Updated Source');
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Source',
          active: false,
        })
      );
    });

    it('should handle partial updates', async () => {
      const partialUpdate = {
        active: false,
        // Only updating active status
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: '123', active: false },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123', {
        method: 'PUT',
        body: JSON.stringify(partialUpdate),
      });
      const params = { params: Promise.resolve({ id: '123' }) };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
        })
      );
    });

    it('should update configurations when provided', async () => {
      const updateWithConfig = {
        name: 'Updated Source',
        configurations: {
          query_params: { page: 1, limit: 100 },
        },
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: { id: '123', name: 'Updated Source' },
        error: null,
      });

      mockSupabaseClient.rpc.mockResolvedValue({
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123', {
        method: 'PUT',
        body: JSON.stringify(updateWithConfig),
      });
      const params = { params: Promise.resolve({ id: '123' }) };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'update_source_configurations',
        expect.objectContaining({
          p_source_id: '123',
          p_configurations: expect.objectContaining({
            query_params: { page: 1, limit: 100 },
          }),
        })
      );
    });

    it('should return 404 for non-existent source', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/999', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
      });
      const params = { params: Promise.resolve({ id: '999' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API source not found');
    });
  });

  describe('DELETE /api/funding/sources/[id]', () => {
    it('should delete a source', async () => {
      mockSupabaseClient.eq.mockReturnValue({
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123', {
        method: 'DELETE',
      });
      const params = { params: Promise.resolve({ id: '123' }) };
      const response = await DELETE(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', '123');
    });

    it('should return 404 for non-existent source', async () => {
      mockSupabaseClient.eq.mockReturnValue({
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const request = new NextRequest('http://localhost:3000/api/funding/sources/999', {
        method: 'DELETE',
      });
      const params = { params: Promise.resolve({ id: '999' }) };
      const response = await DELETE(request, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API source not found');
    });
  });

  describe('POST /api/funding/sources/[id]/process', () => {
    it('should trigger processing for a source', async () => {
      const mockResult = {
        success: true,
        processed: 10,
        new: 5,
        updated: 3,
        skipped: 2,
      };

      processApiSource.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123/process', {
        method: 'POST',
      });
      const params = { params: { id: '123' } };
      const response = await PROCESS_SOURCE(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(processApiSource).toHaveBeenCalledWith('123');
    });

    it('should handle processing errors', async () => {
      processApiSource.mockRejectedValue(new Error('Processing failed'));

      const request = new NextRequest('http://localhost:3000/api/funding/sources/123/process', {
        method: 'POST',
      });
      const params = { params: { id: '123' } };
      const response = await PROCESS_SOURCE(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process API source');
      expect(data.details).toBe('Processing failed');
    });
  });
});
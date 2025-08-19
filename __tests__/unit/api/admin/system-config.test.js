/**
 * @jest-environment node
 */

import { GET, PUT, DELETE } from '@/app/api/admin/system-config/[key]/route';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

describe('API: /api/admin/system-config/[key]', () => {
  let mockSupabaseClient;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Spy on console.error to verify logging
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Setup mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    createClient.mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('GET /api/admin/system-config/[key]', () => {
    it('should return a configuration value', async () => {
      const mockConfig = {
        value: JSON.stringify({ enabled: true, threshold: 100 }),
        description: 'Test configuration',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockConfig,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key');
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConfig);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('system_config');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('key', 'test-key');
    });

    it('should return 404 for non-existent key', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/missing-key');
      const params = { params: Promise.resolve({ key: 'missing-key' }) };
      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Configuration key not found');
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key');
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch system configuration');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching system config:',
        expect.any(Error)
      );
    });
  });

  describe('PUT /api/admin/system-config/[key]', () => {
    it('should update an existing configuration', async () => {
      const updateData = {
        value: { enabled: false, threshold: 200 },
        description: 'Updated configuration',
      };

      // Mock checking for existing config
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { key: 'test-key', ...updateData, value: JSON.stringify(updateData.value) },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          value: JSON.stringify(updateData.value),
          description: updateData.description,
        })
      );
    });

    it('should create a new configuration if it does not exist', async () => {
      const newConfig = {
        value: { feature: 'new', enabled: true },
      };

      // Mock checking for existing config (not found)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock insert
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { 
          key: 'new-key', 
          value: JSON.stringify(newConfig.value),
          description: 'Configuration for new-key'
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/new-key', {
        method: 'PUT',
        body: JSON.stringify(newConfig),
      });
      const params = { params: Promise.resolve({ key: 'new-key' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'new-key',
          value: JSON.stringify(newConfig.value),
        })
      );
    });

    it('should handle partial updates without description', async () => {
      const updateData = {
        value: { setting: 'updated' },
        // No description provided
      };

      // Mock existing config
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { key: 'test-key', value: JSON.stringify(updateData.value) },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          value: JSON.stringify(updateData.value),
        })
      );
    });

    it('should handle complex JSON values', async () => {
      const complexValue = {
        nested: {
          deeply: {
            nested: {
              value: [1, 2, 3],
              enabled: true,
            },
          },
        },
        array: ['item1', 'item2'],
        number: 42,
        boolean: false,
      };

      // Mock existing config
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { key: 'complex-key', value: JSON.stringify(complexValue) },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/complex-key', {
        method: 'PUT',
        body: JSON.stringify({ value: complexValue }),
      });
      const params = { params: Promise.resolve({ key: 'complex-key' }) };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          value: JSON.stringify(complexValue),
        })
      );
    });

    it('should handle database errors during update', async () => {
      // Mock existing config check
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock failed update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Update failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'PUT',
        body: JSON.stringify({ value: { test: true } }),
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update system configuration');
    });

    it('should log configuration changes for audit purposes', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      const updateData = {
        value: { auditTest: true },
      };

      // Mock existing config
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { key: 'audit-key', value: JSON.stringify(updateData.value) },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/audit-key', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const params = { params: Promise.resolve({ key: 'audit-key' }) };
      await PUT(request, params);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[SystemConfig] Updated audit-key to {"auditTest":true}'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('DELETE /api/admin/system-config/[key]', () => {
    it('should delete a configuration', async () => {
      mockSupabaseClient.eq.mockReturnValue({
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'DELETE',
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await DELETE(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Configuration key 'test-key' deleted successfully");
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('key', 'test-key');
    });

    it('should handle database errors during deletion', async () => {
      mockSupabaseClient.eq.mockReturnValue({
        error: new Error('Delete failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'DELETE',
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await DELETE(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to delete system configuration');
    });

    it('should log deletions for audit purposes', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      mockSupabaseClient.eq.mockReturnValue({
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/admin/system-config/audit-delete-key', {
        method: 'DELETE',
      });
      const params = { params: Promise.resolve({ key: 'audit-delete-key' }) };
      await DELETE(request, params);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[SystemConfig] Deleted config key: audit-delete-key'
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('Authentication and Authorization', () => {
    // Note: The current implementation doesn't include auth checks.
    // These tests are placeholders for when auth is implemented.
    
    it.todo('should require authentication for GET requests');
    it.todo('should require admin role for PUT requests');
    it.todo('should require admin role for DELETE requests');
    it.todo('should return 401 for unauthenticated requests');
    it.todo('should return 403 for unauthorized requests');
  });

  describe('Input Validation', () => {
    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'PUT',
        body: 'invalid json',
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      const response = await PUT(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update system configuration');
    });

    it('should handle missing value in PUT request', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/system-config/test-key', {
        method: 'PUT',
        body: JSON.stringify({}), // No value provided
      });
      const params = { params: Promise.resolve({ key: 'test-key' }) };
      
      // Mock existing config
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '123' },
        error: null,
      });

      // Mock update with undefined value
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { key: 'test-key', value: 'undefined' },
        error: null,
      });

      const response = await PUT(request, params);
      
      expect(response.status).toBe(200);
      // The API currently doesn't validate required value field
      // This test documents current behavior
    });
  });
});
/**
 * Tests for the health endpoint handler
 * Verifies the health check response format and functionality
 */
import { describe, test, expect, vi } from 'vitest';
import { handleHealthRequest } from '../../src/handlers/healthHandler';
import { createCorsResponse } from '../../src/utils/corsUtils';

// Mock the CORS utility
vi.mock('../../src/utils/corsUtils', () => ({
  createCorsResponse: vi.fn(response => response)
}));

// Mock environment for testing
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'development' as const,
  API_KEYS_SALT: 'test-salt'
};

describe('Health Handler', () => {
  test('should return correct health status response', async () => {
    // Create a request to the health endpoint
    const request = new Request('https://api.example.com/health');

    // Freeze time for consistent testing of timestamp
    const mockDate = new Date('2025-05-21T12:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

    const response = await handleHealthRequest(request, mockEnv);
    
    // Verify response status and headers
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    
    // Verify response body
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      status: 'ok',
      version: '1.0.0',
      timestamp: mockDate.toISOString()
    });
    
    // Verify CORS handling
    expect(createCorsResponse).toHaveBeenCalled();
    
    // Restore Date
    vi.restoreAllMocks();
  });

  test('should work with different request methods', async () => {
    // Test with different HTTP methods
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    
    for (const method of methods) {
      const request = new Request('https://api.example.com/health', { method });
      const response = await handleHealthRequest(request, mockEnv);
      
      // All methods should return 200 OK for health endpoint
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.status).toBe('ok');
    }
  });
});

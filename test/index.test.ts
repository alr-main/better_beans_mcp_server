/**
 * Tests for the Cloudflare Worker main entry point
 * Verifies the core functionality of the worker
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import { handleRequest } from '../src/handlers/requestHandler';
import { optimizeVectorSearch } from '../src/utils/migrationUtils';

// Mock the dependencies
vi.mock('../src/handlers/requestHandler', () => ({
  handleRequest: vi.fn().mockResolvedValue(new Response('{"success":true}', {
    headers: { 'Content-Type': 'application/json' }
  }))
}));

vi.mock('../src/utils/migrationUtils', () => ({
  optimizeVectorSearch: vi.fn().mockResolvedValue({ success: true, message: 'Optimization complete' })
}));

// Mock environment for testing
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'development' as const,
  API_KEYS_SALT: 'test-salt'
};

// Mock execution context
const mockCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn()
};

describe('Cloudflare Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle normal requests through handleRequest', async () => {
    // Create a regular request
    const request = new Request('https://api.example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'search_coffee_products',
        params: { query: 'ethiopian' },
        id: '123'
      })
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    
    // Verify handleRequest was called with the right parameters
    expect(handleRequest).toHaveBeenCalledWith(request, mockEnv, mockCtx);
    
    // Verify the response
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ success: true });
  });

  test('should handle optimization endpoint requests', async () => {
    // Create a request to the optimization endpoint
    const request = new Request('https://api.example.com/optimize-vector-search', {
      method: 'POST'
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    
    // Verify optimizeVectorSearch was called with the right parameters
    expect(optimizeVectorSearch).toHaveBeenCalledWith(mockEnv);
    
    // Verify the response
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ success: true, message: 'Optimization complete' });
  });

  test('should handle errors from optimization endpoint', async () => {
    // Mock the optimization function to throw an error
    vi.mocked(optimizeVectorSearch).mockRejectedValueOnce(new Error('Optimization failed'));
    
    // Create a request to the optimization endpoint
    const request = new Request('https://api.example.com/optimize-vector-search', {
      method: 'POST'
    });

    const response = await worker.fetch(request, mockEnv, mockCtx);
    
    // Verify the error response
    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ error: 'Optimization failed' });
  });
});

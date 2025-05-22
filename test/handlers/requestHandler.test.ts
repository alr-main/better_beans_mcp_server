/**
 * Tests for the request handler
 * Verifies routing to different endpoints and error handling
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { handleRequest } from '../../src/handlers/requestHandler';
import { handleHealthRequest } from '../../src/handlers/healthHandler';
import { handleManifestRequest } from '../../src/handlers/manifestHandler';
import { handleRpcRequest } from '../../src/handlers/rpcHandler';
import { handleSseRequest } from '../../src/handlers/sseHandler';
import { createCorsResponse } from '../../src/utils/corsUtils';

// Mock all the handlers
vi.mock('../../src/handlers/healthHandler', () => ({
  handleHealthRequest: vi.fn().mockResolvedValue(new Response('{"status":"ok"}', {
    headers: { 'Content-Type': 'application/json' }
  }))
}));

vi.mock('../../src/handlers/manifestHandler', () => ({
  handleManifestRequest: vi.fn().mockResolvedValue(new Response('{"methods":{}}', {
    headers: { 'Content-Type': 'application/json' }
  }))
}));

vi.mock('../../src/handlers/rpcHandler', () => ({
  handleRpcRequest: vi.fn().mockResolvedValue(new Response('{"result":{}}', {
    headers: { 'Content-Type': 'application/json' }
  }))
}));

vi.mock('../../src/handlers/sseHandler', () => ({
  handleSseRequest: vi.fn().mockResolvedValue(new Response('', {
    headers: { 'Content-Type': 'text/event-stream' }
  }))
}));

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

// Mock execution context
const mockCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn()
};

describe('Request Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle CORS preflight requests', async () => {
    const request = new Request('https://api.example.com/rpc', {
      method: 'OPTIONS'
    });

    const response = await handleRequest(request, mockEnv, mockCtx);
    
    // Verify status code 204 for OPTIONS requests
    expect(response.status).toBe(204);
  });

  test('should route health endpoint requests correctly', async () => {
    const request = new Request('https://api.example.com/health');

    await handleRequest(request, mockEnv, mockCtx);
    
    // Verify health handler was called
    expect(handleHealthRequest).toHaveBeenCalledWith(request, mockEnv);
  });

  test('should route manifest endpoint requests correctly', async () => {
    const request = new Request('https://api.example.com/manifest');

    await handleRequest(request, mockEnv, mockCtx);
    
    // Verify manifest handler was called
    expect(handleManifestRequest).toHaveBeenCalledWith(request, mockEnv);
  });

  test('should route RPC endpoint requests correctly', async () => {
    const request = new Request('https://api.example.com/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'search_coffee_products',
        params: {},
        id: '123'
      })
    });

    await handleRequest(request, mockEnv, mockCtx);
    
    // Verify RPC handler was called with the correct parameters
    expect(handleRpcRequest).toHaveBeenCalledWith(request, mockEnv, mockCtx);
  });

  test('should route SSE endpoint requests correctly', async () => {
    const request = new Request('https://api.example.com/sse', {
      headers: { 'Accept': 'text/event-stream' }
    });

    await handleRequest(request, mockEnv, mockCtx);
    
    // Verify SSE handler was called with the correct parameters
    expect(handleSseRequest).toHaveBeenCalledWith(request, mockEnv, mockCtx);
  });

  test('should return 404 for unknown endpoints', async () => {
    const request = new Request('https://api.example.com/unknown');

    const response = await handleRequest(request, mockEnv, mockCtx);
    
    // Verify 404 response for unknown endpoints
    expect(response.status).toBe(404);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ error: 'Not Found' });
  });

  test('should handle unexpected errors gracefully', async () => {
    // Mock RPC handler to throw an error - we need to ensure it's properly mocked
    const mockError = new Error('Test server error');
    vi.mocked(handleRpcRequest).mockImplementationOnce(() => {
      throw mockError;
    });
    
    const request = new Request('https://api.example.com/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'search_coffee_products',
        params: {},
        id: '123'
      })
    });

    const response = await handleRequest(request, mockEnv, mockCtx);
    
    // Verify 500 response for unexpected errors
    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  });
});

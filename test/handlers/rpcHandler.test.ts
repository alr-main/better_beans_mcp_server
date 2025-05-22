/**
 * Tests for the RPC Handler
 * Tests JSON-RPC request processing and method routing
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { handleRpcRequest } from '../../src/handlers/rpcHandler';
import { methodRouter } from '../../src/services/methodRouter';
import { validateApiKey } from '../../src/auth/apiKeyValidation';

// Mock the method router
vi.mock('../../src/services/methodRouter', () => ({
  methodRouter: vi.fn().mockImplementation((method, params) => {
    if (method === 'test_method') {
      return { success: true, data: 'test data' };
    }
    throw new Error(`Method '${method}' not found`);
  })
}));

// Mock API key validation
vi.mock('../../src/auth/apiKeyValidation', () => ({
  validateApiKey: vi.fn().mockResolvedValue({ valid: true, error: null })
}));

// Mock ExecutionContext
class MockExecutionContext {
  waitUntil(promise: Promise<any>) {
    return promise;
  }
}

// Mock environment that matches the Env type
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'development' as const, // Using 'as const' to ensure it's the correct literal type
  API_KEYS_SALT: 'test-salt'
};

describe('RPC Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle valid JSON-RPC request', async () => {
    const request = new Request('https://example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'test_method',
        params: { test: 'value' },
        id: '1234'
      })
    });

    const ctx = new MockExecutionContext();
    const response = await handleRpcRequest(request, mockEnv, ctx as any);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      jsonrpc: '2.0',
      result: { success: true, data: 'test data' },
      id: '1234'
    });
    expect(methodRouter).toHaveBeenCalledWith('test_method', { test: 'value' }, mockEnv);
  });

  test('should handle invalid JSON-RPC request', async () => {
    const request = new Request('https://example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method: 'test_method', // Missing jsonrpc version
        params: { test: 'value' },
        id: '1234'
      })
    });

    const ctx = new MockExecutionContext();
    const response = await handleRpcRequest(request, mockEnv, ctx as any);
    const responseBody = await response.json();

    expect(response.status).toBe(200); // JSON-RPC uses 200 even for errors
    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error.code).toBe(-32600); // Invalid request error code
  });

  test('should handle method not found error', async () => {
    const request = new Request('https://example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'non_existent_method',
        params: {},
        id: '1234'
      })
    });

    // Mock methodRouter to throw MethodNotFoundError
    vi.mocked(methodRouter).mockImplementationOnce(() => {
      const error = new Error("Method 'non_existent_method' not found");
      (error as any).code = 'METHOD_NOT_FOUND';
      throw error;
    });

    const ctx = new MockExecutionContext();
    const response = await handleRpcRequest(request, mockEnv, ctx as any);
    const responseBody = await response.json();

    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error.code).toBe(-32601); // Method not found error code
  });

  test('should handle internal server errors', async () => {
    const request = new Request('https://example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'test_method',
        params: {},
        id: '1234'
      })
    });

    // Mock methodRouter to throw a generic error
    vi.mocked(methodRouter).mockImplementationOnce(() => {
      throw new Error('Unexpected error');
    });

    const ctx = new MockExecutionContext();
    const response = await handleRpcRequest(request, mockEnv, ctx as any);
    const responseBody = await response.json();

    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error.code).toBe(-32603); // Internal error code
  });

  test('should detect and handle streaming requests', async () => {
    const request = new Request('https://example.com/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'test_method',
        params: {},
        id: '1234'
      })
    });

    const ctx = new MockExecutionContext();
    const response = await handleRpcRequest(request, mockEnv, ctx as any);

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  });
});

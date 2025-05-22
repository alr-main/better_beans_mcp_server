/**
 * Utilities for testing the Better Beans MCP Server
 * Provides mock implementations for Supabase and other dependencies
 */
import { vi } from 'vitest';

/**
 * Creates a standard mock for the Supabase client that works with the
 * read-only implementation of the MCP server
 * 
 * @param mockData - The data to return from the mock queries
 * @returns A mock implementation of the Supabase client
 */
export function createMockSupabaseClient(mockData: any[] = []) {
  // Create a builder for chaining query methods
  const createQueryBuilder = () => {
    const queryBuilder: any = {};
    
    // Methods that return the query builder (for chaining)
    const chainMethods = [
      'select', 'from', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 
      'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
      'filter', 'not', 'or', 'and', 'order', 'limit', 'range',
      'single', 'maybeSingle'
    ];
    
    // Add all chain methods
    chainMethods.forEach(method => {
      queryBuilder[method] = vi.fn().mockReturnValue(queryBuilder);
    });
    
    // Terminal methods that return results
    queryBuilder.then = vi.fn().mockResolvedValue({ data: mockData, error: null });
    queryBuilder.execute = vi.fn().mockResolvedValue({ data: mockData, error: null });
    
    // Make the builder itself awaitable
    queryBuilder[Symbol.for('nodejs.util.inspect.custom')] = () => 'QueryBuilder';
    
    return queryBuilder;
  };
  
  // Create the mock client
  return {
    from: vi.fn().mockReturnValue(createQueryBuilder()),
    rpc: vi.fn().mockReturnValue({ data: mockData, error: null }),
    auth: {
      signIn: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn()
    },
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn(),
        upload: vi.fn(),
        list: vi.fn()
      })
    }
  };
}

/**
 * Mock environment variables for testing
 */
export const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'development' as const,
  API_KEYS_SALT: 'test-salt'
};

/**
 * Valid UUID for testing
 */
export const VALID_UUID = 'ef2d9417-4d8a-41e8-ab3d-302840af56ef';

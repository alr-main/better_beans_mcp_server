/**
 * Test setup file for Vitest
 * Configures the test environment
 */

// This file will run before each test file
// Add any global setup or mocks needed for testing

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null })),
            limit: vi.fn(() => ({ data: [], error: null })),
            order: vi.fn(() => ({ data: [], error: null })),
            or: vi.fn(() => ({ data: [], error: null })),
            ilike: vi.fn(() => ({ data: [], error: null })),
          })),
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: null })),
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
            limit: vi.fn(() => ({ data: [], error: null })),
            order: vi.fn(() => ({ data: [], error: null })),
            or: vi.fn(() => ({ data: [], error: null })),
          })),
          limit: vi.fn(() => ({ data: [], error: null })),
          order: vi.fn(() => ({ data: [], error: null })),
          or: vi.fn(() => ({ data: [], error: null })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  };
});

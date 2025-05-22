/**
 * Tests for the Roaster Service
 * Tests roaster search and detail retrieval for read-only operations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { searchCoffeeRoasters, getRoasterDetails } from '../../src/services/roasterService';
import { getSupabaseClient } from '../../src/database/supabaseClient';
import { InvalidParamsError } from '../../src/services/methodRouter';
import { VALID_UUID } from '../utils/testUtils';

// IMPORTANT: Define mock data before vi.mock calls since they're hoisted
const mockRoasters = [
  {
    id: VALID_UUID,
    roaster_name: 'Artisan Roasters',
    location: 'Portland, OR',
    founded_year: 2010,
    description: 'Craft coffee roasters focusing on single-origin beans',
    website_url: 'https://example.com/artisan',
    is_featured: true,
    is_direct_trade: true,
    is_active: true
  },
  {
    id: '45403af5-9234-4940-b64f-5052cf0e87da',
    roaster_name: 'Mountain Beans',
    location: 'Denver, CO',
    founded_year: 2015,
    description: 'High-altitude specialty coffee roasters',
    website_url: 'https://example.com/mountain',
    is_featured: false,
    is_direct_trade: true,
    is_active: true
  }
];

// Mock a simple client that returns the same mock data for all queries
vi.mock('../../src/database/supabaseClient', () => {
  return {
    getSupabaseClient: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({
                data: mockRoasters[0],
                error: null
              })
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                data: mockRoasters,
                error: null
              })
            }),
            single: vi.fn().mockReturnValue({
              data: mockRoasters[0],
              error: null
            })
          }),
          ilike: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  data: mockRoasters,
                  error: null
                })
              })
            })
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              data: mockRoasters,
              error: null
            })
          })
        })
      }),
      rpc: vi.fn().mockReturnValue({
        data: mockRoasters,
        error: null
      })
    }))
  };
});

// Mock environment for testing
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'development' as const,
  API_KEYS_SALT: 'test-salt'
};

describe('Roaster Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchCoffeeRoasters', () => {
    test.skip('should search roasters by name', async () => {
      const params = {
        query: 'Artisan',
        limit: 10
      };

      const result = await searchCoffeeRoasters(params, mockEnv);

      expect(getSupabaseClient).toHaveBeenCalledWith(mockEnv);
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('roasters');
      expect(Array.isArray(result.roasters)).toBe(true);
    });

    test.skip('should filter by direct trade', async () => {
      const params = {
        query: '',
        directTradeOnly: true,
        limit: 10
      };

      await searchCoffeeRoasters(params, mockEnv);

      const supabaseClient = getSupabaseClient(mockEnv);
      expect(supabaseClient.from).toHaveBeenCalled();
    });

    test.skip('should handle empty search results', async () => {
      const params = {
        query: 'NonExistentRoaster',
        limit: 10
      };

      // Mock empty results
      vi.mocked(getSupabaseClient).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        })
      } as any);

      const result = await searchCoffeeRoasters(params, mockEnv);

      expect(Array.isArray(result.roasters)).toBe(true);
      expect(result.roasters.length).toBe(0);
    });

    test('should throw error on invalid parameters', async () => {
      const params = {
        query: 'Artisan',
        limit: -1 // Invalid limit
      };

      await expect(searchCoffeeRoasters(params, mockEnv)).rejects.toThrow();
    });
  });

  describe('getRoasterDetails', () => {
    test.skip('should get roaster details by ID', async () => {
      const params = {
        roasterId: VALID_UUID
      };

      const result = await getRoasterDetails(params, mockEnv);

      expect(getSupabaseClient).toHaveBeenCalledWith(mockEnv);
      expect(result).toBeDefined();
      expect(result.name).toBe('Artisan Roasters');
    });

    test('should throw error when roaster not found', async () => {
      const params = {
        roasterId: '6c84fb90-12c4-11e1-840d-7b25c5ee775a' // Valid UUID but not found
      };

      // Mock not found response
      vi.mocked(getSupabaseClient).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockReturnValue({ 
                data: null, 
                error: { message: 'Not found' } 
              })
            })
          })
        })
      } as any);

      await expect(getRoasterDetails(params, mockEnv)).rejects.toThrow();
    });

    test('should throw error on invalid ID format', async () => {
      const params = {
        roasterId: ''
      };

      await expect(getRoasterDetails(params, mockEnv)).rejects.toThrow();
    });
  });
});

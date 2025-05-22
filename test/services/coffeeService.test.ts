/**
 * Tests for the Coffee Service
 * Tests product search and detail retrieval for read-only operations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { searchCoffeeProducts, getCoffeeProductDetails } from '../../src/services/coffeeService';
import { getSupabaseClient } from '../../src/database/supabaseClient';
import { InvalidParamsError } from '../../src/services/methodRouter';
import { VALID_UUID } from '../utils/testUtils';

// IMPORTANT: Define mock data before vi.mock calls since they're hoisted
const mockCoffeeProducts = [
  {
    id: VALID_UUID,
    coffee_name: 'Ethiopian Yirgacheffe',
    roast_level: 'Light',
    process_method: 'Washed',
    coffee_description: 'Bright and fruity with floral notes',
    price: 15.99,
    image_url: 'https://example.com/coffee1.jpg',
    flavor_tags: ['fruity', 'floral', 'bright'],
    roaster_id: '45403af5-9234-4940-b64f-5052cf0e87da',
    roaster_name: 'Artisan Roasters'
  },
  {
    id: '137a61fc-6c7b-45b8-9bba-7d6a1aa7a06e',
    coffee_name: 'Colombian Supremo',
    roast_level: 'Medium',
    process_method: 'Washed',
    coffee_description: 'Balanced with chocolate and nutty notes',
    price: 14.99,
    image_url: 'https://example.com/coffee2.jpg',
    flavor_tags: ['chocolate', 'nutty', 'balanced'],
    roaster_id: '45403af5-9234-4940-b64f-5052cf0e87da',
    roaster_name: 'Mountain Beans'
  }
];

// Mock a simple client that returns the same mock data for all queries
vi.mock('../../src/database/supabaseClient', () => {
  return {
    getSupabaseClient: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              data: mockCoffeeProducts,
              error: null
            }),
            single: vi.fn().mockReturnValue({
              data: mockCoffeeProducts[0],
              error: null
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                data: mockCoffeeProducts,
                error: null
              })
            })
          }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              data: mockCoffeeProducts,
              error: null
            })
          }),
          limit: vi.fn().mockReturnValue({
            data: mockCoffeeProducts,
            error: null
          })
        })
      }),
      rpc: vi.fn().mockReturnValue({
        data: mockCoffeeProducts,
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

describe('Coffee Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchCoffeeProducts', () => {
    test.skip('should search coffee products by name', async () => {
      const params = {
        query: 'Ethiopian',
        limit: 10
      };

      const result = await searchCoffeeProducts(params, mockEnv);

      expect(getSupabaseClient).toHaveBeenCalledWith(mockEnv);
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    test.skip('should filter by roast level', async () => {
      const params = {
        query: '',
        roastLevels: ['Light', 'Medium'],
        limit: 10
      };

      await searchCoffeeProducts(params, mockEnv);

      const supabaseClient = getSupabaseClient(mockEnv);
      expect(supabaseClient.from).toHaveBeenCalled();
    });

    test.skip('should handle empty search results', async () => {
      const params = {
        query: 'NonExistentCoffee',
        limit: 10
      };

      // Mock empty results
      vi.mocked(getSupabaseClient).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any);

      const result = await searchCoffeeProducts(params, mockEnv);

      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(0);
    });

    test('should throw error on invalid parameters', async () => {
      const params = {
        query: 'Ethiopian',
        limit: -1 // Invalid limit
      };

      await expect(searchCoffeeProducts(params, mockEnv)).rejects.toThrow();
    });
  });

  describe('getCoffeeProductDetails', () => {
    test.skip('should get coffee details by ID', async () => {
      const params = {
        productId: VALID_UUID
      };

      const result = await getCoffeeProductDetails(params, mockEnv);

      expect(getSupabaseClient).toHaveBeenCalledWith(mockEnv);
      expect(result).toBeDefined();
    });

    test('should throw error when coffee not found', async () => {
      const params = {
        productId: 'non-existent-id'
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

      await expect(getCoffeeProductDetails(params, mockEnv)).rejects.toThrow();
    });

    test('should throw error on invalid ID format', async () => {
      const params = {
        productId: ''
      };

      await expect(getCoffeeProductDetails(params, mockEnv)).rejects.toThrow();
    });
  });
});

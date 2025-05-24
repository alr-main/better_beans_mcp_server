/**
 * Tests for the Coffee Service
 * Tests product search and detail retrieval for read-only operations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { searchCoffeeProducts, getCoffeeProductDetails } from '../../src/services/coffeeService';
import { getSupabaseClient } from '../../src/database/supabaseClient';
import { InvalidParamsError } from '../../src/services/methodRouter';
import { VALID_UUID } from '../utils/testUtils';
import { secureQuery, secureRead, secureReadSingle, UserRole, OperationType } from '../../src/database/secureQuery';

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

// Mock the necessary modules
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
          }),
          or: vi.fn().mockReturnThis()
        })
      }),
      rpc: vi.fn().mockReturnValue({
        data: mockCoffeeProducts,
        error: null
      })
    }))
  };
});

// Mock the secure query functions
vi.mock('../../src/database/secureQuery', () => {
  return {
    UserRole: {
      ADMIN: 'ADMIN',
      USER: 'USER',
      ANONYMOUS: 'ANONYMOUS'
    },
    OperationType: {
      READ: 'READ',
      CREATE: 'CREATE',
      UPDATE: 'UPDATE',
      DELETE: 'DELETE'
    },
    secureQuery: vi.fn(async (env, role, table, operation, queryFunction) => {
      // For the searchCoffeeProducts test, just return a preformed result instead of trying
      // to execute the complex queryFunction which requires a lot of chained methods
      if (table === 'coffees' && operation === 'READ') {
        return {
          coffees: mockCoffeeProducts.map((coffee) => ({
            id: coffee.id,
            name: coffee.coffee_name,
            roastLevel: coffee.roast_level,
            processMethod: coffee.process_method,
            description: coffee.coffee_description,
            price: coffee.price,
            imageUrl: coffee.image_url,
            isAvailable: true,
            flavorTags: coffee.flavor_tags || [],
            origin: [],
            roaster: {
              id: coffee.roaster_id,
              name: coffee.roaster_name,
            },
          })),
          totalResults: mockCoffeeProducts.length,
        };
      }
      
      // Fallback for other uses
      return { success: true };
    }),
    secureRead: vi.fn(async (env, role, table, columns, conditions) => {
      return mockCoffeeProducts;
    }),
    secureReadSingle: vi.fn(async (env, role, table, columns, conditions) => {
      if (conditions?.id === VALID_UUID) {
        return mockCoffeeProducts[0];
      } else if (conditions?.id === 'non-existent-id') {
        return null;
      }
      return mockCoffeeProducts[0];
    })
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
    test('should search coffee products by name', async () => {
      const params = {
        query: 'Ethiopian',
        maxResults: 10
      };

      const result = await searchCoffeeProducts(params, mockEnv);

      expect(secureQuery).toHaveBeenCalled();
      expect(result).toHaveProperty('coffees');
      expect(result).toHaveProperty('totalResults');
      expect(Array.isArray(result.coffees)).toBe(true);
    });

    test('should filter by roast level', async () => {
      const params = {
        filters: {
          roastLevel: 'Light'
        },
        maxResults: 10
      };

      await searchCoffeeProducts(params, mockEnv);

      expect(secureQuery).toHaveBeenCalledWith(
        mockEnv,
        expect.anything(),
        'coffees',
        'READ',
        expect.any(Function)
      );
    });

    test('should handle empty search results', async () => {
      const params = {
        query: 'NonExistentCoffee',
        maxResults: 10
      };

      // Mock empty results for this test only
      vi.mocked(secureQuery).mockResolvedValueOnce({
        coffees: [],
        totalResults: 0
      });

      const result = await searchCoffeeProducts(params, mockEnv);

      expect(Array.isArray(result.coffees)).toBe(true);
      expect(result.totalResults).toBe(0);
    });

    test('should throw error on invalid parameters', async () => {
      // In our implementation, validation happens before secureQuery is called,
      // so this test doesn't need to mock secureQuery behavior
      const params = {
        maxResults: -1 // Invalid maxResults (should be positive)
      };

      // Since validation happens before secureQuery is called, this should still throw
      await expect(searchCoffeeProducts(params, mockEnv)).rejects.toThrow();
    });
  });

  describe('getCoffeeProductDetails', () => {
    test('should get coffee details by ID', async () => {
      const params = {
        productId: VALID_UUID
      };

      const result = await getCoffeeProductDetails(params, mockEnv);

      expect(secureReadSingle).toHaveBeenCalledWith(
        mockEnv,
        expect.anything(),
        'coffees',
        expect.anything(),
        expect.objectContaining({ id: VALID_UUID })
      );
      expect(result).toBeDefined();
    });

    test('should throw error when coffee not found', async () => {
      const params = {
        productId: 'non-existent-id'
      };

      // secureReadSingle will return null for this ID based on our mock setup
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

/**
 * Tests for the Roaster Service
 * Tests roaster search and detail retrieval for read-only operations
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { searchCoffeeRoasters, getRoasterDetails } from '../../src/services/roasterService';
import { getSupabaseClient } from '../../src/database/supabaseClient';
import { InvalidParamsError } from '../../src/services/methodRouter';
import { VALID_UUID } from '../utils/testUtils';
import { secureQuery, secureReadSingle, UserRole, OperationType } from '../../src/database/secureQuery.js';

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

// Mock necessary modules
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
          }),
          or: vi.fn().mockReturnThis()
        })
      }),
      rpc: vi.fn().mockReturnValue({
        data: mockRoasters,
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
      // For searchCoffeeRoasters, return preformed result
      if (table === 'roasters' && operation === 'READ') {
        return {
          roasters: mockRoasters.map((roaster) => ({
            id: roaster.id,
            name: roaster.roaster_name,
            location: 'Test Location',
            foundedYear: roaster.founded_year,
            description: roaster.description,
            websiteUrl: roaster.website_url,
            logoUrl: null,
            isFeatured: roaster.is_featured,
          })),
          totalResults: mockRoasters.length,
        };
      }
      
      // For getRoasterDetails coffees query
      if (table === 'coffees' && operation === 'READ') {
        return [
          {
            id: 'coffee-1',
            coffee_name: 'Test Coffee',
            roast_level: 'Medium',
            process_method: 'Washed',
            price: 15.99,
            image_url: 'https://example.com/image.jpg',
            is_available: true
          }
        ];
      }
      
      // Fallback
      return [];
    }),
    secureRead: vi.fn(async (env, role, table, columns, conditions) => {
      return mockRoasters;
    }),
    secureReadSingle: vi.fn(async (env, role, table, columns, conditions) => {
      if (conditions?.id === VALID_UUID) {
        return mockRoasters[0];
      } else if (conditions?.id === '6c84fb90-12c4-11e1-840d-7b25c5ee775a') {
        return null;
      }
      return mockRoasters[0];
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

describe('Roaster Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchCoffeeRoasters', () => {
    test('should search roasters by name', async () => {
      const params = {
        query: 'Artisan',
        maxResults: 10
      };

      const result = await searchCoffeeRoasters(params, mockEnv);

      expect(secureQuery).toHaveBeenCalled();
      expect(result).toHaveProperty('roasters');
      expect(result).toHaveProperty('totalResults');
      expect(Array.isArray(result.roasters)).toBe(true);
    });

    test('should filter by location', async () => {
      const params = {
        location: 'New York',
        maxResults: 10
      };

      await searchCoffeeRoasters(params, mockEnv);

      expect(secureQuery).toHaveBeenCalledWith(
        mockEnv,
        expect.anything(),
        'roasters',
        'READ',
        expect.any(Function)
      );
    });

    test('should handle empty search results', async () => {
      const params = {
        query: 'NonExistentRoaster',
        maxResults: 10
      };

      // Mock empty results for this test only
      vi.mocked(secureQuery).mockResolvedValueOnce({
        roasters: [],
        totalResults: 0
      });

      const result = await searchCoffeeRoasters(params, mockEnv);

      expect(Array.isArray(result.roasters)).toBe(true);
      expect(result.totalResults).toBe(0);
    });

    test('should throw error on invalid parameters', async () => {
      const params = {
        maxResults: -1 // Invalid maxResults (should be positive)
      };

      await expect(searchCoffeeRoasters(params, mockEnv)).rejects.toThrow();
    });
  });

  describe('getRoasterDetails', () => {
    test('should get roaster details by ID', async () => {
      const params = {
        roasterId: VALID_UUID
      };

      const result = await getRoasterDetails(params, mockEnv);

      expect(secureReadSingle).toHaveBeenCalledWith(
        mockEnv,
        expect.anything(),
        'roasters',
        expect.anything(),
        expect.objectContaining({ id: VALID_UUID })
      );
      expect(result).toBeDefined();
      expect(result.name).toBe('Artisan Roasters');
    });

    test('should throw error when roaster not found', async () => {
      const params = {
        roasterId: '6c84fb90-12c4-11e1-840d-7b25c5ee775a' // Valid UUID but not found
      };

      // secureReadSingle will return null for this ID based on our mock setup
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

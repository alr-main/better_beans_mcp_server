/**
 * Secure Query Pipeline Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { secureQuery, secureRead, secureReadSingle, UserRole, OperationType } from '../../src/database/secureQuery.js';
import { getSupabaseClient } from '../../src/database/supabaseClient.js';

// Mock the supabase client
vi.mock('../../src/database/supabaseClient.js', () => ({
  getSupabaseClient: vi.fn()
}));

describe('Secure Query Pipeline', () => {
  const mockEnv = { SUPABASE_URL: 'https://example.com', SUPABASE_KEY: 'mock-key' } as any;
  let mockSupabase: any;
  
  beforeEach(() => {
    // Reset mock data
    vi.clearAllMocks();
    
    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis()
    };
    
    (getSupabaseClient as any).mockReturnValue(mockSupabase);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('secureQuery', () => {
    it('should throw error for unauthorized operations', async () => {
      // Attempt to write to coffees table as ANONYMOUS role (not allowed)
      await expect(
        secureQuery(
          mockEnv,
          UserRole.ANONYMOUS,
          'coffees',
          OperationType.CREATE,
          async () => ({})
        )
      ).rejects.toThrow(/not allowed/);
    });
    
    it('should execute authorized operations', async () => {
      // Mock successful query
      const mockQueryFunction = vi.fn().mockResolvedValue({ success: true });
      
      const result = await secureQuery(
        mockEnv,
        UserRole.ANONYMOUS,
        'coffees',
        OperationType.READ,
        mockQueryFunction
      );
      
      expect(result).toEqual({ success: true });
      expect(mockQueryFunction).toHaveBeenCalledWith(mockSupabase);
    });
    
    it('should handle query errors properly', async () => {
      // Mock failed query
      const mockError = new Error('Database error');
      const mockQueryFunction = vi.fn().mockRejectedValue(mockError);
      
      await expect(
        secureQuery(
          mockEnv,
          UserRole.ANONYMOUS,
          'coffees',
          OperationType.READ,
          mockQueryFunction
        )
      ).rejects.toThrow('Database error');
    });
  });
  
  describe('secureRead', () => {
    it('should read data successfully', async () => {
      // Mock successful read
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase = {
        ...mockSupabase,
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation(callback => callback({ data: [{ id: '1', name: 'Test Coffee' }], error: null }))
      };
      
      (getSupabaseClient as any).mockReturnValue(mockSupabase);
      
      const result = await secureRead(
        mockEnv,
        UserRole.ANONYMOUS,
        'coffees',
        'id,coffee_name',
        { is_available: true }
      );
      
      expect(mockSupabase.from).toHaveBeenCalledWith('coffees');
      expect(mockSupabase.select).toHaveBeenCalled();
    });
    
    it('should reject invalid table names', async () => {
      await expect(
        secureRead(
          mockEnv,
          UserRole.ANONYMOUS,
          'DROP TABLE; --',
          'id',
          {}
        )
      ).rejects.toThrow(/Invalid table/);
    });
    
    it('should reject invalid column names', async () => {
      await expect(
        secureRead(
          mockEnv,
          UserRole.ANONYMOUS,
          'coffees',
          ['id', 'DELETE FROM users; --'],
          {}
        )
      ).rejects.toThrow(/Invalid table or column names/);
    });
  });
  
  describe('secureReadSingle', () => {
    it('should read a single record successfully', async () => {
      // Mock successful single read
      mockSupabase = {
        ...mockSupabase,
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation(callback => callback({ data: { id: '1', name: 'Test Coffee' }, error: null }))
      };
      
      (getSupabaseClient as any).mockReturnValue(mockSupabase);
      
      const result = await secureReadSingle(
        mockEnv,
        UserRole.ANONYMOUS,
        'coffees',
        'id,coffee_name',
        { id: '1' }
      );
      
      expect(mockSupabase.from).toHaveBeenCalledWith('coffees');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(mockSupabase.single).toHaveBeenCalled();
    });
    
    it('should return null for non-existent records', async () => {
      // Mock not found error
      mockSupabase = {
        ...mockSupabase,
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation(callback => callback({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        }))
      };
      
      (getSupabaseClient as any).mockReturnValue(mockSupabase);
      
      const result = await secureReadSingle(
        mockEnv,
        UserRole.ANONYMOUS,
        'coffees',
        'id,coffee_name',
        { id: 'non-existent' }
      );
      
      expect(result).toBeNull();
    });
  });
});

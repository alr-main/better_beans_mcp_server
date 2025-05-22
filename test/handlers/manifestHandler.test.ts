/**
 * Tests for the manifest endpoint handler
 * Verifies the manifest response format and structure
 */
import { describe, test, expect, vi } from 'vitest';
import { handleManifestRequest } from '../../src/handlers/manifestHandler';
import { createCorsResponse } from '../../src/utils/corsUtils';
import { serverManifest } from '../../src/schema/manifest';

// Mock the CORS utility
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

describe('Manifest Handler', () => {
  test('should return correct manifest response', async () => {
    // Create a request to the manifest endpoint
    const request = new Request('https://api.example.com/manifest');

    const response = await handleManifestRequest(request, mockEnv);
    
    // Verify response status and headers
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    
    // Verify response body matches the server manifest
    const responseBody = await response.json();
    expect(responseBody).toEqual(serverManifest);
    
    // Verify CORS handling
    expect(createCorsResponse).toHaveBeenCalled();
  });

  test('should validate manifest structure contains required fields', async () => {
    // Create a request to the manifest endpoint
    const request = new Request('https://api.example.com/manifest');

    const response = await handleManifestRequest(request, mockEnv);
    
    // Parse the response
    const manifest = await response.json();
    
    // Verify manifest has all required fields for MCP Server standard
    expect(manifest).toHaveProperty('mcp_version');
    expect(manifest).toHaveProperty('name_for_human');
    expect(manifest).toHaveProperty('name_for_model');
    expect(manifest).toHaveProperty('description_for_human');
    expect(manifest).toHaveProperty('description_for_model');
    expect(manifest).toHaveProperty('auth');
    expect(manifest).toHaveProperty('api');
    expect(manifest).toHaveProperty('functions');
    
    // Verify auth structure
    expect(manifest.auth).toHaveProperty('type');
    
    // Verify API structure
    expect(manifest.api).toHaveProperty('type');
    expect(manifest.api).toHaveProperty('url');
    expect(manifest.api.type).toBe('jsonrpc');
    
    // Verify functions array contains required methods
    expect(Array.isArray(manifest.functions)).toBe(true);
    expect(manifest.functions.length).toBeGreaterThan(0);
    
    // Check required methods are present - these methods are part of the read-only implementation
    const methodNames = manifest.functions.map(func => func.name);
    expect(methodNames).toContain('search_coffee_roasters');
    expect(methodNames).toContain('get_roaster_details');
    expect(methodNames).toContain('search_coffee_products');
    expect(methodNames).toContain('get_coffee_product_details');
    expect(methodNames).toContain('similarity_search');
    
    // Verify each function has required properties
    manifest.functions.forEach(func => {
      expect(func).toHaveProperty('name');
      expect(func).toHaveProperty('description');
      expect(func).toHaveProperty('parameters');
    });
  });
});

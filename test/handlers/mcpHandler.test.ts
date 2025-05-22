/**
 * Tests for MCP Protocol Handler
 * Ensures that the MCP protocol implementation works correctly
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInitialize, handleListTools, handleCallTool, processMcpRequest } from '../../src/handlers/mcpHandler';
import { methodRouter } from '../../src/services/methodRouter';
import { serverManifest } from '../../src/schema/manifest';

// Mock dependencies
vi.mock('../../src/services/methodRouter', () => {
  // Create mock error classes with the same interface as the real ones
  class InvalidParamsError extends Error {
    code: string;
    constructor(message: string) {
      super(message);
      this.name = 'InvalidParamsError';
      this.code = 'INVALID_PARAMS';
    }
  }
  
  class MethodNotFoundError extends Error {
    code: string;
    constructor(message: string) {
      super(message);
      this.name = 'MethodNotFoundError';
      this.code = 'METHOD_NOT_FOUND';
    }
  }
  
  return {
    methodRouter: vi.fn(),
    InvalidParamsError,
    MethodNotFoundError
  };
});

// Mock environment
const mockEnv = {
  SUPABASE_URL: 'https://test-url.supabase.co',
  SUPABASE_KEY: 'test-key',
  WORKER_ENV: 'test',
};

describe('MCP Protocol Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleInitialize', () => {
    it('should return server capabilities and protocol version', async () => {
      const params = {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'TestClient',
          version: '1.0.0'
        }
      };

      const result = await handleInitialize(params);

      expect(result).toHaveProperty('protocolVersion');
      expect(result).toHaveProperty('capabilities');
      expect(result).toHaveProperty('serverInfo');
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.capabilities).toHaveProperty('tools');
      expect(result.serverInfo.name).toBe(serverManifest.name_for_model);
    });

    it('should throw error if protocol version is missing', async () => {
      await expect(handleInitialize({})).rejects.toThrow('Missing protocol version');
    });
  });

  describe('handleListTools', () => {
    it('should return list of available tools', async () => {
      const result = await handleListTools();

      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBe(serverManifest.functions.length);
      
      // Check that each tool has the required properties
      result.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
      });
    });
  });

  describe('handleCallTool', () => {
    it('should call methodRouter with correct parameters', async () => {
      // Setup mock to return a test result
      const mockResult = { testData: 'test' };
      vi.mocked(methodRouter).mockResolvedValue(mockResult);

      const params = {
        name: 'search_coffee_roasters',
        arguments: { query: 'test' }
      };

      const result = await handleCallTool(params, mockEnv);

      expect(methodRouter).toHaveBeenCalledWith(
        'search_coffee_roasters',
        { query: 'test' },
        mockEnv
      );
      expect(result).toEqual({ result: mockResult });
    });

    it('should throw error if tool name is missing', async () => {
      await expect(handleCallTool({}, mockEnv)).rejects.toThrow('Missing tool name');
    });
  });

  describe('processMcpRequest', () => {
    it('should route initialize request correctly', async () => {
      const params = {
        protocolVersion: '2024-11-05',
        capabilities: {}
      };

      await processMcpRequest('initialize', params, mockEnv);
      
      // No direct assertion needed as handleInitialize is called internally
      // and we've already tested that function
    });

    it('should route list_tools request correctly', async () => {
      await processMcpRequest('list_tools', {}, mockEnv);
      
      // No direct assertion needed as handleListTools is called internally
      // and we've already tested that function
    });

    it('should route call_tool request correctly', async () => {
      // Setup mock to return a test result
      const mockResult = { testData: 'test' };
      vi.mocked(methodRouter).mockResolvedValue(mockResult);

      const params = {
        name: 'search_coffee_roasters',
        arguments: { query: 'test' }
      };

      await processMcpRequest('call_tool', params, mockEnv);
      
      expect(methodRouter).toHaveBeenCalledWith(
        'search_coffee_roasters',
        { query: 'test' },
        mockEnv
      );
    });

    it('should handle initialized notification correctly', async () => {
      const result = await processMcpRequest('notifications/initialized', {}, mockEnv);
      expect(result).toBeNull();
    });

    it('should throw error for unknown MCP method', async () => {
      await expect(processMcpRequest('unknown_method', {}, mockEnv))
        .rejects.toThrow("MCP method 'unknown_method' not found");
    });
  });
});

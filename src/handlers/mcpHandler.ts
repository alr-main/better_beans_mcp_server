/**
 * MCP Protocol Handler
 * Implements the Model Context Protocol (MCP) for the Better Beans server
 * Handles initialization, tool execution, and other MCP-specific operations
 */
import { Env } from '../index.js';
import { methodRouter } from '../services/methodRouter.js';
import { serverManifest } from '../schema/manifest.js';
import { createCorsResponse } from '../utils/corsUtils.js';
import { InvalidParamsError, MethodNotFoundError } from '../services/methodRouter.js';

// MCP Protocol version that we support
const MCP_PROTOCOL_VERSION = '2024-11-05';

// MCP JSON-RPC Error codes (in addition to standard JSON-RPC codes)
const MCP_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

/**
 * Server capabilities that we support
 * This defines what optional MCP protocol features we implement
 */
const SERVER_CAPABILITIES = {
  tools: {
    listChanged: true
  }
};

/**
 * Handler for MCP initialize request
 * Performs protocol version negotiation and capability exchange
 * 
 * @param params - Initialization parameters from client
 * @returns MCP initialization response
 */
export async function handleInitialize(params: any): Promise<any> {
  // Check if the client's protocol version is supported
  const clientProtocolVersion = params?.protocolVersion;
  
  if (!clientProtocolVersion) {
    throw new InvalidParamsError('Missing protocol version in initialize request');
  }
  
  // Note: In a production system, you would check if the client's protocol
  // version is compatible. For simplicity, we're always returning our version.
  
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: SERVER_CAPABILITIES,
    serverInfo: {
      name: serverManifest.name_for_model,
      version: '1.0.0'
    }
  };
}

/**
 * Handler for MCP list_tools request
 * Returns the list of available tools (methods) that the client can call
 * 
 * @returns List of available tools
 */
export async function handleListTools(): Promise<any> {
  // Convert our server manifest functions to MCP tools format
  const tools = serverManifest.functions.map(func => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters
  }));
  
  return { tools };
}

/**
 * Handler for MCP call_tool request
 * Calls a specific tool (method) with the provided parameters
 * 
 * @param params - Call parameters including name and arguments
 * @param env - Environment variables
 * @returns Result of the tool execution
 */
export async function handleCallTool(params: any, env: Env): Promise<any> {
  const { name, arguments: args } = params;
  
  if (!name) {
    throw new InvalidParamsError('Missing tool name in call_tool request');
  }
  
  try {
    // Route the call to our existing method router
    const result = await methodRouter(name, args || {}, env);
    return { result };
  } catch (error) {
    if (error instanceof MethodNotFoundError) {
      throw error; // Let the RPC handler transform this to proper JSON-RPC error
    } else if (error instanceof InvalidParamsError) {
      throw error; // Let the RPC handler transform this to proper JSON-RPC error
    } else {
      // Rethrow any other errors
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }
}

/**
 * Processes an MCP request and routes it to the appropriate handler
 * 
 * @param method - The MCP method name
 * @param params - Method parameters
 * @param env - Environment variables
 * @returns Result of the method call
 */
export async function processMcpRequest(
  method: string,
  params: any,
  env: Env
): Promise<any> {
  switch (method) {
    case 'initialize':
      return handleInitialize(params);
      
    case 'list_tools':
      return handleListTools();
      
    case 'call_tool':
      return handleCallTool(params, env);
      
    // Handle initialized notification (nothing to return)
    case 'notifications/initialized':
      console.log('Client sent initialized notification');
      return null;
      
    default:
      throw new MethodNotFoundError(`MCP method '${method}' not found`);
  }
}

/**
 * Creates a JSON-RPC response
 * 
 * @param result - The result to include in the response
 * @param id - The request ID
 * @returns Formatted JSON-RPC response
 */
export function createJsonRpcResponse(result: any, id: string | number | null): Response {
  const response = {
    jsonrpc: '2.0',
    result,
    id
  };
  
  return createCorsResponse(
    new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  );
}

/**
 * Creates a JSON-RPC error response
 * 
 * @param code - Error code
 * @param message - Error message
 * @param id - The request ID
 * @returns Formatted JSON-RPC error response
 */
export function createJsonRpcErrorResponse(
  code: number,
  message: string,
  id: string | number | null
): Response {
  const response = {
    jsonrpc: '2.0',
    error: {
      code,
      message
    },
    id
  };
  
  return createCorsResponse(
    new Response(JSON.stringify(response), {
      status: 200, // JSON-RPC uses 200 OK even for errors
      headers: {
        'Content-Type': 'application/json'
      }
    })
  );
}

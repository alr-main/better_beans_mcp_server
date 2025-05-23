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

  console.log('🔄 MCP Initialize request received:', JSON.stringify(params));

  // Check if the client's protocol version is supported
  const clientProtocolVersion = params?.protocolVersion;
  
  if (!clientProtocolVersion) {
    console.log('❌ Missing protocol version');
    throw new InvalidParamsError('Missing protocol version in initialize request');
  }
  
  // Note: In a production system, you would check if the client's protocol
  // version is compatible. For simplicity, we're always returning our version.
  
  console.log('✅ Returning initialize response');

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
  console.error('🔄 MCP list_tools request received');
  
  // Convert our server manifest functions to MCP tools format
  const tools = serverManifest.functions.map(func => ({
    name: func.name,
    description: func.description,
    inputSchema: func.inputSchema  // Map inputSchema to inputSchema
  }));
  
  console.error(`🔍 Returning ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
  
  // Return the raw list without content wrapping
  const toolsResponse = { tools };
  
  // For MCP tools list, return the raw response without any content wrapping
  console.error('🔍 Formatted tools/list response for MCP protocol');
  
  return toolsResponse;
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
  console.error('🔄 MCP call_tool request received:', JSON.stringify(params, null, 2));
  
  const { name, arguments: args } = params;
  
  if (!name) {
    console.error('❌ Missing tool name in call_tool request');
    throw new InvalidParamsError('Missing tool name in call_tool request');
  }
  
  console.error('🔍 Calling tool:', name);
  console.error('🔍 Raw arguments:', JSON.stringify(args || {}, null, 2));
  
  // Process arguments to handle Claude's backtick format for similarity_search
  let processedArgs = args;
  
  // For similarity_search, we need special handling for Claude's input format
  if (name === 'similarity_search') {
    console.error('⚠️ Processing similarity_search request specially');
    
    // First, set up default parameters
    processedArgs = { flavorProfile: [], maxResults: 10, threshold: 0.01, useCache: false };
    
    // Check for Claude's special backtick format
    if (args && typeof args === 'object') {
      // Check for backtick-wrapped keys first
      if (args['`flavorProfile`'] !== undefined) {
        console.error('🔍 Found backtick-wrapped flavorProfile key');
        processedArgs.flavorProfile = args['`flavorProfile`'];
      } else if (args.flavorProfile !== undefined) {
        processedArgs.flavorProfile = args.flavorProfile;
      }
      
      // Handle maxResults with or without backticks
      if (args['`maxResults`'] !== undefined) {
        console.error('🔍 Found backtick-wrapped maxResults key');
        processedArgs.maxResults = args['`maxResults`'];
      } else if (args.maxResults !== undefined) {
        processedArgs.maxResults = args.maxResults;
      }
      
      // Handle backtick-wrapped flavor profile values if present
      if (Array.isArray(processedArgs.flavorProfile)) {
        processedArgs.flavorProfile = processedArgs.flavorProfile.map(flavor => {
          if (typeof flavor === 'string' && flavor.startsWith('`') && flavor.endsWith('`')) {
            console.error(`🍫 Removing backticks from flavor: ${flavor}`);
            return flavor.slice(1, -1);
          }
          return flavor;
        });
      }
    }
    
    // Ensure we have a valid flavorProfile array
    if (!processedArgs.flavorProfile || processedArgs.flavorProfile.length === 0) {
      console.error('⚠️ No flavor profile found, using default');
      processedArgs.flavorProfile = ['chocolate', 'nutty'];  // Default fallback
    }
    
    console.error('⚠️ Processed similarity_search args:', JSON.stringify(processedArgs, null, 2));
  }
  
  try {
    // Route the call to our existing method router - use processedArgs instead of args
    const result = await methodRouter(name, processedArgs || {}, env);
    
    console.error('✅ Tool execution successful');
    console.error('🔍 Result type:', typeof result);
    
    return result;
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
  console.error(`🔄 Processing MCP request: ${method}`);
  
  switch (method) {
    case 'initialize':
      return handleInitialize(params);
      
    case 'list_tools':
    case 'tools/list':  // Add support for the tools/list variant that Claude uses
      console.error('🔄 Handling tools list request');
      return handleListTools();
      
    case 'call_tool':
    case 'tools/call':  // Add support for the tools/call variant that Claude might use
      console.error('🔄 Handling tool call request');
      return handleCallTool(params, env);
      
    case 'resources/list':
      // Return empty resources list since we don't have resources
      console.error('🔄 Returning empty resources list');
      return { resources: [] };
      
    case 'prompts/list':
      // Return empty prompts list since we don't have prompts
      console.error('🔄 Returning empty prompts list');
      return { prompts: [] };
      
    // Handle initialized notification (nothing to return)
    case 'notifications/initialized':
      console.error('🔄 Client sent initialized notification');
      return null;
      
    default:
      console.error(`❌ MCP method '${method}' not found`);
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

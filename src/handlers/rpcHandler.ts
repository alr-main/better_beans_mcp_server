/**
 * RPC endpoint handler
 * Processes JSON-RPC requests and routes them to the appropriate method handlers
 * Supports both standard and streaming responses using Server-Sent Events (SSE)
 * Implements Model Context Protocol (MCP) support for AI assistants
 */
import { Env } from '../index.js';
import { createCorsResponse } from '../utils/corsUtils.js';
import { validateApiKey } from '../auth/apiKeyValidation.js';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from '../schema/jsonRpc.js';
import { methodRouter } from '../services/methodRouter.js';
import { 
  createSseStream, 
  writeJsonRpcSuccessToStream, 
  writeJsonRpcErrorToStream,
  closeSseStream 
} from '../utils/sseUtils.js';
import { processMcpRequest } from './mcpHandler.js';

// Standard JSON-RPC error codes
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001,
  RATE_LIMIT_EXCEEDED: -32002,
  STREAMING_NOT_SUPPORTED: -32003,
};

/**
 * Handles requests to the /rpc endpoint
 * Supports both standard and streaming responses
 * @param request - The incoming request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Response with the result of the RPC call
 */
export async function handleRpcRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Check if client wants streaming response
  const acceptHeader = request.headers.get('Accept') || '';
  const isStreamingRequested = acceptHeader.includes('text/event-stream');

  console.error('🔍 Accept header:', acceptHeader);
  
  // For SSE requests, we can accept both GET and POST
  // For regular JSON-RPC, we only allow POST
  if (request.method !== 'POST' && !isStreamingRequested) {
    return createCorsResponse(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Method not allowed. Only POST requests are supported for regular JSON-RPC.',
          },
          id: null,
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': 'POST',
          },
        }
      )
    );
  }
  
  // Parse the JSON-RPC request
  let rpcRequest: JsonRpcRequest;
  
  try {
    // For SSE requests, we need to check the URL query parameters first
    if (isStreamingRequested) {
      const url = new URL(request.url);
      const requestParam = url.searchParams.get('request');
      
      if (requestParam) {
        try {
          rpcRequest = JSON.parse(requestParam) as JsonRpcRequest;
        } catch (parseError) {
          console.error('Error parsing request from URL params:', parseError);
          return createJsonRpcErrorResponse({
            code: ERROR_CODES.PARSE_ERROR,
            message: 'Invalid JSON in request parameter',
            id: null,
          });
        }
      } else {
        // Fall back to body for SSE if no query param
        rpcRequest = await request.json() as JsonRpcRequest;
      }
    } else {
      // Standard JSON-RPC - parse from body
      rpcRequest = await request.json() as JsonRpcRequest;
    }
  } catch (error) {
    console.error('Error parsing request:', error);
    return createJsonRpcErrorResponse({
      code: ERROR_CODES.PARSE_ERROR,
      message: 'Invalid JSON in request body',
      id: null,
    });
  }
  
  // Validate JSON-RPC structure
  if (!isValidJsonRpcRequest(rpcRequest)) {
    return createJsonRpcErrorResponse({
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Invalid JSON-RPC request format',
      id: (rpcRequest as any)?.id || null,
    });
  }
  
  console.error('🔍 Is streaming requested:', isStreamingRequested);
  
  // MCP requests should NEVER be treated as streaming
  const isMcpRequest = [
    'initialize',
    'list_tools',
    'tools/list',        // Claude Desktop uses this
    'call_tool',
    'tools/call',        // In case Claude uses this variant
    'resources/list',    // Claude is trying to list resources
    'prompts/list',      // Claude is trying to list prompts
    'notifications/initialized'
  ].includes(rpcRequest.method);
  
  // Override streaming detection for MCP requests
  const shouldUseStreaming = isStreamingRequested && !isMcpRequest;
  
  console.error('🔍 Method:', rpcRequest.method);
  console.error('🔍 Is MCP request:', isMcpRequest);
  console.error('🔍 Should use streaming:', shouldUseStreaming);

  try {
    // Get authorization from request header
    const apiKey = request.headers.get('X-Api-Key');
    
    // API key validation is disabled for this public read-only MCP server
    // All methods are accessible without authentication
    
    // Log API key attempts for debugging but don't require them
    if (apiKey) {
      console.log('API key provided but not required:', apiKey.substring(0, 3) + '...');
    } else {
      console.log('No API key provided (not required for this public read-only server)');
    }
    
    // No validation performed - all requests are allowed

    // If streaming is requested and method supports it, use streaming response
    if (shouldUseStreaming) {
      console.error(`Streaming requested for method ${rpcRequest.method}`);
      return await handleStreamingRequest(rpcRequest, env, ctx);
    }

    // Route the request to the appropriate handler
    let result;
    
    // Handle MCP protocol requests differently
    if (isMcpRequest) {
      console.error('🔄 Processing MCP request');
      // Process via the MCP protocol handler
      result = await processMcpRequest(rpcRequest.method, rpcRequest.params, env);
      
      // For notifications that don't require a response
      if (rpcRequest.method === 'notifications/initialized') {
        return new Response(null, { status: 204 });
      }
    } else {
      console.error('🔄 Processing regular request');
      // Handle regular methods via our existing router
      result = await methodRouter(rpcRequest.method, rpcRequest.params, env);
    }
    
    // Return the JSON-RPC response
    return createJsonRpcSuccessResponse({
      result,
      id: rpcRequest.id,
    });
  } catch (error) {
    console.error(`Error processing method ${rpcRequest.method}:`, error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if ((error as any).code === 'INVALID_PARAMS') {
        return createJsonRpcErrorResponse({
          code: ERROR_CODES.INVALID_PARAMS,
          message: error.message,
          id: rpcRequest.id,
        });
      } else if ((error as any).code === 'METHOD_NOT_FOUND') {
        return createJsonRpcErrorResponse({
          code: ERROR_CODES.METHOD_NOT_FOUND,
          message: `Method '${rpcRequest.method}' not found`,
          id: rpcRequest.id,
        });
      } else if ((error as any).code === 'STREAMING_NOT_SUPPORTED') {
        return createJsonRpcErrorResponse({
          code: ERROR_CODES.STREAMING_NOT_SUPPORTED,
          message: `Streaming is not supported for method '${rpcRequest.method}'`,
          id: rpcRequest.id,
        });
      }
    }
    
    // Default to internal error
    return createJsonRpcErrorResponse({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      id: rpcRequest.id,
    });
  }
}

/**
 * Creates a JSON-RPC success response
 * @param response - The success response data
 * @returns Response object with proper formatting
 */
function createJsonRpcSuccessResponse(response: { result: any; id: string | number }): Response {
  console.error('🔄 Creating JSON-RPC success response for id:', response.id);
  console.error('🔍 Response type:', typeof response.result);
  
  // Special handling for MCP responses - don't wrap these in content arrays
  const isMcpDirectResponse = response.result && 
                            typeof response.result === 'object' && 
                            (
                              // initialize response
                              (response.result.protocolVersion && 
                               response.result.capabilities && 
                               response.result.serverInfo) ||
                              // tools/list response
                              response.result.tools instanceof Array ||
                              // resources/list response
                              response.result.resources instanceof Array ||
                              // prompts/list response
                              response.result.prompts instanceof Array
                            );
  
  // Special handling for similarity_search results - detect by checking for query and results structure
  const isSimilaritySearchResponse = response.result && 
                                   typeof response.result === 'object' && 
                                   response.result.query && 
                                   response.result.query.flavorProfile && 
                                   Array.isArray(response.result.results);
  
  // Check if this is an MCP response that already has the content array structure
  const isMcpContentResponse = response.result && 
                               typeof response.result === 'object' && 
                               Array.isArray(response.result.content);
  
  let finalResult;
  
  if (isMcpDirectResponse) {
    // Don't wrap MCP protocol responses
    // The client expects the raw response for MCP methods
    finalResult = response.result;
    console.error('📤 Sending direct MCP response');
  } else if (isSimilaritySearchResponse) {
    // Special formatting for similarity_search to match Claude's expected format
    console.error('🍺 COFFEE SEARCH: Formatting response for Claude');
    console.error('🔍 Results count:', response.result.results ? response.result.results.length : 0);
    
    // Log if no results were found, but DO NOT use hardcoded data
    if (response.result.results && response.result.results.length === 0) {
      console.error('🚨 No coffee matches found for the search criteria');
      
      // Keep the empty results instead of using hardcoded test data
      // This ensures we only return real database results
      console.error('📊 Returning empty results set - no hardcoded fallback');
    }
    
    // Format for Claude's expected structure - text must be a simple string, not an object
    const resultString = JSON.stringify(response.result);
    console.error('Stringified result:', resultString.substring(0, 100) + '...');
    
    finalResult = {
      content: [
        {
          type: "text",
          text: resultString
        }
      ]
    };
    
    console.error('📤 Formatted similarity_search response for Claude with content.text.text structure');
  } else if (isMcpContentResponse) {
    // Already has content array - use as is
    finalResult = response.result;
    console.error('📤 Sending content-wrapped response');
  } else {
    // For standard RPC responses (non-MCP), wrap in content array
    // Format for Claude Desktop which expects {content: [{type: "text", text: "..."}]}
    finalResult = {
      content: [
        {
          type: "text",
          text: JSON.stringify(response.result)
        }
      ]
    };
    console.error('📤 Wrapping response in content array');
  }
  
  const jsonRpcResponse: JsonRpcResponse = {
    jsonrpc: '2.0',
    result: finalResult,
    id: response.id,
  };
  
  return createCorsResponse(
    new Response(JSON.stringify(jsonRpcResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
}

/**
 * Creates a JSON-RPC error response
 * @param error - The error response data
 * @returns Response object with proper formatting
 */
function createJsonRpcErrorResponse(error: { code: number; message: string; id: string | number | null }): Response {
  const jsonRpcError: JsonRpcError = {
    jsonrpc: '2.0',
    error: {
      code: error.code,
      message: error.message,
    },
    id: error.id,
  };
  
  return createCorsResponse(
    new Response(JSON.stringify(jsonRpcError), {
      status: 200, // JSON-RPC uses 200 OK even for errors
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
}

/**
 * Handles a streaming RPC request using Server-Sent Events
 * @param rpcRequest - The JSON-RPC request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Streaming response
 */
async function handleStreamingRequest(
  rpcRequest: JsonRpcRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Create an SSE stream
  const [response, writer] = createSseStream({
    onClose: () => console.log(`Stream closed for request ${rpcRequest.id}`),
  });
  
  // Execute the method in a non-blocking way
  ctx.waitUntil(
    (async () => {
      try {
        // Check if the method supports streaming
        const streamResult = await methodRouter(
          rpcRequest.method, 
          rpcRequest.params, 
          env, 
          {
            streaming: true,
            onPartialResult: async (partialResult: any) => {
              try {
                await writeJsonRpcSuccessToStream(
                  writer,
                  partialResult,
                  rpcRequest.id,
                  false // Not final
                );
              } catch (error) {
                console.error(`Error writing partial result to stream:`, error);
              }
            }
          }
        );
        
        // Write the final result
        await writeJsonRpcSuccessToStream(
          writer,
          streamResult,
          rpcRequest.id,
          true // Final result
        );
      } catch (error) {
        console.error(`Error in streaming request:`, error);
        
        // Determine the error code and message
        let errorCode = ERROR_CODES.INTERNAL_ERROR;
        let errorMessage = 'Internal server error';
        
        if (error instanceof Error) {
          if ((error as any).code === 'INVALID_PARAMS') {
            errorCode = ERROR_CODES.INVALID_PARAMS;
            errorMessage = error.message;
          } else if ((error as any).code === 'METHOD_NOT_FOUND') {
            errorCode = ERROR_CODES.METHOD_NOT_FOUND;
            errorMessage = `Method '${rpcRequest.method}' not found`;
          } else if ((error as any).code === 'STREAMING_NOT_SUPPORTED') {
            errorCode = ERROR_CODES.STREAMING_NOT_SUPPORTED;
            errorMessage = `Streaming is not supported for method '${rpcRequest.method}'`;
          } else {
            errorMessage = error.message || errorMessage;
          }
        }
        
        // Write the error to the stream
        await writeJsonRpcErrorToStream(
          writer,
          {
            code: errorCode,
            message: errorMessage,
          },
          rpcRequest.id
        );
      } finally {
        // Always close the stream at the end
        await closeSseStream(writer);
      }
    })()
  );
  
  return response;
}

/**
 * Validates that a request follows the JSON-RPC 2.0 format
 * @param request - The request to validate
 * @returns Whether the request is valid
 */
function isValidJsonRpcRequest(request: any): request is JsonRpcRequest {
  return (
    request &&
    request.jsonrpc === '2.0' &&
    typeof request.method === 'string' &&
    (request.id === undefined || typeof request.id === 'string' || typeof request.id === 'number') &&
    (request.params === undefined || typeof request.params === 'object')
  );
}

/**
 * Server-Sent Events (SSE) endpoint handler
 * Dedicated endpoint for streaming responses using SSE
 * Follows the MCP server architecture with proper separation of concerns
 */
import { Env } from '../index.js';
import { 
  createSseStream, 
  writeJsonRpcSuccessToStream, 
  writeJsonRpcErrorToStream,
  formatSseMessage 
} from '../utils/sseUtils.js';
import { JsonRpcRequest } from '../schema/jsonRpc.js';
import { methodRouter } from '../services/methodRouter.js';
import { validateApiKey } from '../auth/apiKeyValidation.js';
import { createCorsResponse } from '../utils/corsUtils.js';

// This is a list of methods that support streaming
// Used for better error reporting
const STREAMING_SUPPORTED_METHODS = [
  'search_coffee_roasters',
  'search_coffee_products',
  'similarity_search'
];

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
 * Handles requests to the /sse endpoint
 * Dedicated endpoint for streaming responses using Server-Sent Events
 * @param request - The incoming request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns SSE streaming response
 */
export async function handleSseRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Verify it's a GET request as required by EventSource
  if (request.method !== 'GET') {
    return createCorsResponse(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Method not allowed. Only GET requests are supported for SSE endpoint.',
          },
          id: null,
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': 'GET',
          },
        }
      )
    );
  }

  // Parse the JSON-RPC request from URL query parameters
  let rpcRequest: JsonRpcRequest;
  const url = new URL(request.url);
  const requestParam = url.searchParams.get('request');

  if (!requestParam) {
    return createCorsResponse(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Missing "request" parameter containing JSON-RPC request',
          },
          id: null,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
  }

  try {
    rpcRequest = JSON.parse(requestParam) as JsonRpcRequest;
  } catch (error) {
    console.error('Error parsing request from URL params:', error);
    return createCorsResponse(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.PARSE_ERROR,
            message: 'Invalid JSON in request parameter',
          },
          id: null,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
  }

  // Validate JSON-RPC structure
  if (!isValidJsonRpcRequest(rpcRequest)) {
    return createCorsResponse(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Invalid JSON-RPC request format',
          },
          id: (rpcRequest as any)?.id || null,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
  }

  // Get the API key from the request headers
  const apiKey = request.headers.get('X-Api-Key') || '';

  // Validate the API key (skip in development mode)
  if (env.WORKER_ENV !== 'development') {
    const { valid, error } = await validateApiKey(apiKey, env);

    if (!valid) {
      return createCorsResponse(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: ERROR_CODES.UNAUTHORIZED,
              message: error || 'Unauthorized: Invalid API key',
            },
            id: rpcRequest.id,
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );
    }
  }

  // Create an SSE stream
  const [response, writer] = createSseStream({
    onClose: () => {}, // Handle stream closure gracefully
  });

  // Execute the method in a non-blocking way
  ctx.waitUntil(
    (async () => {
      try {
        // Execute the method with streaming option enabled
        const streamResult = await methodRouter(
          rpcRequest.method,
          rpcRequest.params,
          env,
          {
            streaming: true,
            onPartialResult: async (partialResult: any) => {
              try {
                // Send event with partial results
                // Use the format that browsers expect for SSE
                await writer.write(new TextEncoder().encode(
                  formatSseMessage(
                    JSON.stringify({
                      jsonrpc: '2.0',
                      result: partialResult,
                      id: rpcRequest.id
                    }),
                    'partial_result'
                  )
                ));
              } catch (error) {
                console.error(`Error writing partial result to stream:`, error);
              }
            }
          }
        );

        // Write the final result
        // Use the format that browsers expect for SSE with proper event type
        await writer.write(new TextEncoder().encode(
          formatSseMessage(
            JSON.stringify({
              jsonrpc: '2.0',
              result: streamResult,
              id: rpcRequest.id
            }),
            'result' // Mark this as the final result
          )
        ));
      } catch (error) {
        // Log minimal error information to avoid exposing sensitive data
        console.error(`Error in streaming request: ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Determine the error code and message
        let errorCode = ERROR_CODES.INTERNAL_ERROR;
        let errorMessage = 'Internal server error';
        let errorData: any = null;

        if (error instanceof Error) {
          
          if ((error as any).code === 'INVALID_PARAMS') {
            errorCode = ERROR_CODES.INVALID_PARAMS;
            errorMessage = error.message;
            errorData = { method: rpcRequest.method, params: rpcRequest.params };
          } else if ((error as any).code === 'METHOD_NOT_FOUND') {
            errorCode = ERROR_CODES.METHOD_NOT_FOUND;
            errorMessage = `Method '${rpcRequest.method}' not found`;
            errorData = { availableMethods: ['search_coffee_roasters', 'search_coffee_products', 'similarity_search', 'get_roaster_details', 'get_coffee_product_details'] };
          } else if ((error as any).code === 'STREAMING_NOT_SUPPORTED' || !STREAMING_SUPPORTED_METHODS.includes(rpcRequest.method)) {
            errorCode = ERROR_CODES.STREAMING_NOT_SUPPORTED;
            errorMessage = `Streaming is not supported for method '${rpcRequest.method}'`;
            errorData = { 
              streamingSupportedMethods: STREAMING_SUPPORTED_METHODS,
              nonStreamingMethods: ['get_roaster_details', 'get_coffee_product_details']
            };
          } else {
            errorMessage = error.message || errorMessage;
          }
        }

        // Write the error to the stream with proper SSE format
        await writer.write(new TextEncoder().encode(
          formatSseMessage(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: errorCode,
                message: errorMessage,
                data: errorData
              },
              id: rpcRequest.id
            }),
            'error' // Use a specific event type for errors
          )
        ));
        
        // Send a special close message that the client can use to know the stream is done
        await writer.write(new TextEncoder().encode(
          formatSseMessage(
            JSON.stringify({ status: 'stream_complete' }),
            'close'
          )
        ));
      }
    })()
  );

  return response;
}

/**
 * Validates that a request follows the JSON-RPC 2.0 specification
 * @param request - The request to validate
 * @returns Whether the request is valid
 */
function isValidJsonRpcRequest(request: any): request is JsonRpcRequest {
  return (
    request &&
    request.jsonrpc === '2.0' &&
    typeof request.method === 'string' &&
    (request.params === undefined || typeof request.params === 'object') &&
    (typeof request.id === 'string' || typeof request.id === 'number')
  );
}

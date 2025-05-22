/**
 * Request handler for MCP server endpoints
 * Routes requests to the appropriate handler based on the URL path
 */
import { Env } from '../index.js';
import { handleHealthRequest } from './healthHandler.js';
import { handleManifestRequest } from './manifestHandler.js';
import { handleRpcRequest } from './rpcHandler.js';
import { handleSseRequest } from './sseHandler.js';
import { createCorsResponse } from '../utils/corsUtils.js';

/**
 * Main request handler that routes requests to specific endpoint handlers
 * @param request - The incoming request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Response object
 */
export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Handle preflight CORS requests
  if (request.method === 'OPTIONS') {
    return createCorsResponse(new Response(null, { status: 204 }));
  }
  
  // Parse the URL to determine the endpoint
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // Route to the appropriate handler based on the path
    if (path.endsWith('/health')) {
      return handleHealthRequest(request, env);
    } else if (path.endsWith('/manifest')) {
      return handleManifestRequest(request, env);
    } else if (path.endsWith('/rpc') || path === '/' || path === '') {
      // Handle both /rpc and root path requests with the RPC handler
      // This ensures MCP protocol requests to the root URL work correctly
      return handleRpcRequest(request, env, ctx);
    } else if (path.endsWith('/sse')) {
      // Handle streaming requests with our dedicated SSE handler
      return handleSseRequest(request, env, ctx);
    }
    
    // If no matching endpoint, return 404
    return createCorsResponse(
      new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('Unhandled error in request handler:', error);
    
    return createCorsResponse(
      new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
  }
}

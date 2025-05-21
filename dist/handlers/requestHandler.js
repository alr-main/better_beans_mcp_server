import { handleHealthRequest } from './healthHandler';
import { handleManifestRequest } from './manifestHandler';
import { handleRpcRequest } from './rpcHandler';
import { createCorsResponse } from '../utils/corsUtils';
/**
 * Main request handler that routes requests to specific endpoint handlers
 * @param request - The incoming request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns Response object
 */
export async function handleRequest(request, env, ctx) {
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
        }
        else if (path.endsWith('/manifest')) {
            return handleManifestRequest(request, env);
        }
        else if (path.endsWith('/rpc')) {
            return handleRpcRequest(request, env, ctx);
        }
        // If no matching endpoint, return 404
        return createCorsResponse(new Response(JSON.stringify({ error: 'Not Found' }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
            },
        }));
    }
    catch (error) {
        // Handle unexpected errors
        console.error('Unhandled error in request handler:', error);
        return createCorsResponse(new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        }));
    }
}

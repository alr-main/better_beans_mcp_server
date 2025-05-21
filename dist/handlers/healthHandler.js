import { createCorsResponse } from '../utils/corsUtils';
/**
 * Handles requests to the /health endpoint
 * @param request - The incoming request
 * @param env - Environment variables
 * @returns Response with health status
 */
export async function handleHealthRequest(request, env) {
    // Simple health check response with status and version
    const healthResponse = {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    };
    return createCorsResponse(new Response(JSON.stringify(healthResponse), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    }));
}

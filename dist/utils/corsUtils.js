/**
 * CORS (Cross-Origin Resource Sharing) utilities
 * Handles CORS headers for requests and responses
 */
/**
 * Adds CORS headers to a response
 * @param response - The response to add CORS headers to
 * @returns Response with CORS headers
 */
export function createCorsResponse(response) {
    // Clone the response to avoid modifying the original
    const corsResponse = new Response(response.body, response);
    // Add CORS headers
    corsResponse.headers.set('Access-Control-Allow-Origin', '*');
    corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    corsResponse.headers.set('Access-Control-Max-Age', '86400');
    return corsResponse;
}

/**
 * Better Beans MCP Server
 * Main entry point for the Cloudflare Worker
 */
import { handleRequest } from './handlers/requestHandler';
export default {
    /**
     * Handle incoming fetch requests to the worker
     * @param request - The incoming request
     * @param env - Environment variables
     * @param ctx - Execution context
     * @returns Response object
     */
    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    },
};

/**
 * Better Beans MCP Server
 * Main entry point for the Cloudflare Worker
 */
import { handleRequest } from './handlers/requestHandler.js';

export default {
  /**
   * Handle incoming fetch requests to the worker
   * @param request - The incoming request
   * @param env - Environment variables
   * @param ctx - Execution context
   * @returns Response object
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};

/**
 * Environment variable interface for the worker
 */
export interface Env {
  // Supabase connection details
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  
  // API key validation
  API_KEYS_SALT: string;
  
  // Environment configuration
  WORKER_ENV: 'development' | 'staging' | 'production';
}

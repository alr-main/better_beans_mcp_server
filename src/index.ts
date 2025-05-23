/**
 * Better Beans MCP Server
 * Main entry point for the Cloudflare Worker
 */
import { handleRequest } from './handlers/requestHandler.js';
import { getSupabaseClient } from './database/supabaseClient.js';
import { getFlavorProfileEmbedding } from './vector/openaiClient.js';
import { optimizeVectorSearch } from './utils/migrationUtils.js';
import { handleDebugRequest } from './routes/debug.js';

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
    // For optimization requests, check URL path
    const url = new URL(request.url);
    if (url.pathname === '/optimize-vector-search') {
      try {
        const result = await optimizeVectorSearch(env);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Optimization failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle different routes
    if (url.pathname.startsWith('/debug/')) {
      // Debug routes for direct testing
      return handleDebugRequest(request, env);
    } else {
      // All other routes go to the main request handler
      return handleRequest(request, env, ctx);
    }
    
    // Temporary endpoint for updating vector embeddings
    if (url.pathname === '/update-vector-embeddings') {
      try {
        // Import the migration utilities dynamically
        const { updateCoffeeEmbeddings } = await import('./vector/updateEmbeddings.js');
        
        // Call the updateEmbeddings function to update all coffees
        const result = await updateCoffeeEmbeddings(env);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Vector embeddings updated successfully',
          result
        }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error updating vector embeddings:', error);
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Error updating vector embeddings',
          error: error instanceof Error ? error.message : String(error)
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // Handle normal requests
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
  
  // OpenAI API configuration (optional, for vector embeddings)
  OPENAI_API_KEY?: string;
}

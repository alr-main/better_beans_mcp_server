/**
 * Debug route for testing the similarity search directly
 * This bypasses the RPC layer to test direct functionality
 */
import { Env } from '../index.js';
import { directVectorSearch } from '../services/betterVectorSearch.js';

export async function handleDebugRequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Only allow in development mode for security
  if (env.WORKER_ENV === 'production') {
    return new Response('Debug endpoint not available in production', { status: 403 });
  }
  
  try {
    // Extract path from URL to determine debug action
    const url = new URL(request.url);
    const path = url.pathname.replace('/debug/', '');
    
    // Handle different debug actions
    if (path === 'similarity_search') {
      return await handleSimilaritySearchDebug(request, env);
    }
    
    // Default response
    return new Response(JSON.stringify({ error: 'Unknown debug action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in debug handler:', error);
    return new Response(JSON.stringify({ error: 'Debug handler error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Debug handler for the similarity search feature
 */
// Define interface for similarity search params
interface SimilaritySearchParams {
  flavorProfile: string[] | string;
  maxResults?: number;
  threshold?: number;
  useCache?: boolean;
  offset?: number;
}

async function handleSimilaritySearchDebug(request: Request, env: Env): Promise<Response> {
  try {
    // Parse request body
    const params = await request.json() as Record<string, any>;
    console.error('Debug similarity search with params:', JSON.stringify(params, null, 2));
    
    // Special handling for Claude's format
    let processedParams: Record<string, any> = { ...params };
    
    // Handle backtick-wrapped flavorProfile
    if (params.flavorProfile && typeof params.flavorProfile === 'string') {
      if (params.flavorProfile.startsWith('`') && params.flavorProfile.endsWith('`')) {
        try {
          processedParams.flavorProfile = JSON.parse(params.flavorProfile.slice(1, -1));
        } catch (e) {
          processedParams.flavorProfile = [params.flavorProfile.slice(1, -1)];
        }
      } else {
        try {
          processedParams.flavorProfile = JSON.parse(params.flavorProfile);
        } catch (e) {
          processedParams.flavorProfile = [params.flavorProfile];
        }
      }
    }
    
    // Handle backtick wrapping for each item in flavor profile array
    if (Array.isArray(processedParams.flavorProfile)) {
      processedParams.flavorProfile = processedParams.flavorProfile.map(flavor => {
        if (typeof flavor === 'string' && flavor.startsWith('`') && flavor.endsWith('`')) {
          return flavor.slice(1, -1);
        }
        return flavor;
      });
    }
    
    console.error('Processed params:', JSON.stringify(processedParams, null, 2));
    
    // Call the new vector search function directly to bypass RPC layer
    const result = await directVectorSearch(
      processedParams.flavorProfile, 
      processedParams.maxResults || 10, 
      env
    );
    
    // Log the result for debugging
    console.error('Result count:', result.results ? result.results.length : 0);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in similarity search debug:', error);
    return new Response(JSON.stringify({ error: 'Similarity search debug error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

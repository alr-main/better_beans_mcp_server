/**
 * Semantic Service
 * Handles vector-based similarity searches for coffee products
 */
import { z } from 'zod';
import { Env } from '../index.js';
import { getSupabaseClient } from '../database/supabaseClient.js';
import { InvalidParamsError } from './methodRouter.js';

/**
 * Schema for validating similarity search parameters
 */
const SimilaritySearchParamsSchema = z.object({
  flavorProfile: z.array(z.string()).min(1).max(10),
  maxResults: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0)
});

/**
 * Type definition for validated similarity search parameters
 */
export type SimilaritySearchParams = z.infer<typeof SimilaritySearchParamsSchema>;

/**
 * Validates and sanitizes similarity search parameters
 * Throws a validation error if parameters are invalid
 * 
 * @param params - The parameters to validate
 * @returns Validated and sanitized parameters
 */
export function validateSimilaritySearchParams(params: Record<string, any>): SimilaritySearchParams {
  return SimilaritySearchParamsSchema.parse(params);
}

/**
 * Performs a similarity search based on a flavor profile
 * @param params - Search parameters with flavor profile
 * @param env - Environment variables with database connection
 * @returns Results of the similarity search
 */
export async function similaritySearch(
  params: Record<string, any>,
  env: Env
): Promise<any> {
  try {
    // Validate parameters
    const validParams = validateSimilaritySearchParams(params);
    
    // Get Supabase client
    const supabase = getSupabaseClient(env);
    
    // Perform the search
    const { data: coffeeProducts, error: queryError } = await supabase
      .from('coffee_products')
      .select(`
        id, name, roast_level, process_method, description, price, image_url,
        flavor_tags,
        roaster:roaster_id (id, name)
      `)
      .limit(validParams.maxResults);
    
    if (queryError) {
      console.error('Error in similarity search:', queryError);
      throw new Error('Failed to perform similarity search');
    }
    
    // If we have no products, return empty results
    if (!coffeeProducts || coffeeProducts.length === 0) {
      return {
        query: { flavorProfile: validParams.flavorProfile },
        results: [],
        totalResults: 0
      };
    }
    
    // Calculate a simple similarity score based on matching tags
    const results = coffeeProducts.map(product => {
      // Convert flavor tags array to proper format if needed
      const flavorTags = product.flavor_tags || [];
      
      // Calculate how many tags match the requested flavor profile
      const matchingTags = validParams.flavorProfile.filter(tag => 
        flavorTags.includes(tag)
      );
      
      // Calculate a simple similarity score based on matching tags
      const similarityScore = matchingTags.length / validParams.flavorProfile.length;
      
      // Transform the data format to match the desired output structure
      return {
        coffee: {
          id: product.id,
          name: product.name,
          roastLevel: product.roast_level,
          processMethod: product.process_method,
          description: product.description,
          price: product.price,
          imageUrl: product.image_url,
          flavorTags: flavorTags,
          roaster: product.roaster || { id: null, name: null }
        },
        similarityScore,
        matchingTags
      };
    })
    // Filter out products with no matching tags
    .filter(result => result.similarityScore > 0)
    // Sort by similarity score (highest first)
    .sort((a, b) => b.similarityScore - a.similarityScore);
    
    return {
      query: { flavorProfile: validParams.flavorProfile },
      results,
      totalResults: results.length
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidParamsError(error.errors.map(e => e.message).join('\n'));
    }
    throw error;
  }
}

/**
 * Handles streaming implementation for similarity search
 * Provides partial results as they become available
 * 
 * @param params - Search parameters
 * @param env - Environment variables
 * @param options - Streaming options
 * @returns Final result after streaming is complete
 */
export async function handleStreamingSimilaritySearch(
  params: Record<string, any>,
  env: Env,
  options?: any
): Promise<any> {
  // Validate parameters
  const validParams = validateSimilaritySearchParams(params);
  
  // In a production environment, we would implement a real progressive search
  // by sending database queries with pagination and streaming results as they arrive
  
  // Step 1: Send a quick initial count query to get total results
  // This would be implemented as a separate database count query in production
  const initialResult = await similaritySearch({
    ...validParams,
    maxResults: 1, // Just get count and first result quickly
  }, env);
  
  // Send first result immediately if available
  if (options?.onPartialResult && initialResult.results.length > 0) {
    await options.onPartialResult({
      ...initialResult,
      status: 'partial',
      progress: `${initialResult.results.length}/${initialResult.totalResults || initialResult.results.length}`
    });
  }
  
  // Step 2: Execute the full query in batches
  // In a real implementation, you would use cursor-based pagination
  const batchSize = 2;
  const totalBatches = Math.ceil((validParams.maxResults || 10) / batchSize);
  
  let allResults = [...initialResult.results];
  
  // Get remaining results in batches
  for (let i = 1; i < totalBatches; i++) {
    // This would be a separate paginated query in production
    const batchResults = await similaritySearch({
      ...validParams,
      maxResults: batchSize,
      offset: i * batchSize
    }, env);
    
    // Add new results to our collection
    allResults = [...allResults, ...batchResults.results];
    
    // Send partial results if we have a handler
    if (options?.onPartialResult && batchResults.results.length > 0) {
      await options.onPartialResult({
        query: initialResult.query,
        results: allResults,
        totalResults: initialResult.totalResults || allResults.length,
        status: 'partial',
        progress: `${allResults.length}/${initialResult.totalResults || validParams.maxResults || 10}`
      });
    }
  }
  
  // Return the complete result
  return {
    query: initialResult.query,
    results: allResults,
    totalResults: initialResult.totalResults || allResults.length,
    status: 'complete'
  };
}

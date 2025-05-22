/**
 * Semantic Service
 * Handles vector-based similarity searches for coffee products
 * Uses pgvector in Supabase for efficient vector embedding searches
 */
import { z } from 'zod';
import { Env } from '../index.js';
import { getSupabaseClient } from '../database/supabaseClient.js';
import { InvalidParamsError } from './methodRouter.js';

/**
 * Vector dimension - must match the dimension of the stored embeddings
 * For flavor profile embeddings, we use a 384-dimensional space
 */
const VECTOR_DIMENSIONS = 384;

/**
 * Maximum distance threshold for similarity matching
 * Matches with distance greater than this value will be filtered
 */
const MAX_DISTANCE_THRESHOLD = 0.75;

/**
 * Cache expiration time in milliseconds
 * Results are cached for 10 minutes to reduce database load
 */
const CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory cache for similarity search results
 * Maps query hash to cached results and timestamp
 */
interface CacheEntry {
  results: any;
  timestamp: number;
}

const similarityCache = new Map<string, CacheEntry>();

/**
 * Schema for validating similarity search parameters
 */
const SimilaritySearchParamsSchema = z.object({
  flavorProfile: z.array(z.string()).min(1).max(10),
  maxResults: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0),
  threshold: z.number().min(0).max(1).optional().default(0.5), // Similarity threshold
  useCache: z.boolean().optional().default(true) // Allow bypassing cache for fresh results
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
 * Generates a cache key from the flavor profile
 * @param flavorProfile - Array of flavor tags
 * @returns A deterministic hash key for the cache
 */
function generateCacheKey(flavorProfile: string[]): string {
  // Sort for deterministic behavior regardless of input order
  return [...flavorProfile].sort().join('|');
}

/**
 * Converts flavor profile tags to vector embeddings
 * In a real implementation, this would use a proper embedding model
 * @param flavorTags - Array of flavor profile tags
 * @returns Vector embedding representation
 */
async function getFlavorEmbedding(flavorTags: string[]): Promise<number[]> {
  // This is a simplified vector embedding generation method
  // In production, this would use a proper ML model via Cloudflare AI or an external API
  
  // Create a base vector of zeros
  const embedding = new Array(VECTOR_DIMENSIONS).fill(0);
  
  // Map known flavor tags to specific dimensions in the vector space
  // This is a simplified approach - real embeddings would be more sophisticated
  const flavorDimensions: Record<string, number[]> = {
    'chocolate': [10, 30, 50, 70],
    'nutty': [15, 35, 55, 75],
    'fruity': [20, 40, 60, 80],
    'berry': [25, 45, 65, 85],
    'floral': [12, 32, 52, 72],
    'citrus': [18, 38, 58, 78],
    'caramel': [22, 42, 62, 82],
    'spicy': [28, 48, 68, 88],
    'earthy': [14, 34, 54, 74],
    'smoky': [26, 46, 66, 86]
  };
  
  // Set values in the embedding based on the flavor tags
  flavorTags.forEach(tag => {
    const dimensions = flavorDimensions[tag.toLowerCase()];
    if (dimensions) {
      dimensions.forEach(dim => {
        if (dim < VECTOR_DIMENSIONS) {
          embedding[dim] = 1.0;
        }
      });
    }
  });
  
  // Normalize the vector to unit length for cosine similarity calculations
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return embedding.map(val => val / magnitude);
  }
  
  return embedding;
}

/**
 * Performs a similarity search based on a flavor profile using vector embeddings
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
    
    // Generate cache key
    const cacheKey = generateCacheKey(validParams.flavorProfile);
    
    // Check cache first if enabled
    if (validParams.useCache) {
      const cachedEntry = similarityCache.get(cacheKey);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_EXPIRATION_MS) {
        // Apply pagination if needed
        const results = cachedEntry.results.results.slice(
          validParams.offset,
          validParams.offset + validParams.maxResults
        );
        
        return {
          query: { flavorProfile: validParams.flavorProfile },
          results,
          totalResults: cachedEntry.results.totalResults,
          fromCache: true
        };
      }
    }
    
    // Convert flavor profile to vector embedding
    const embedding = await getFlavorEmbedding(validParams.flavorProfile);
    
    // Get Supabase client
    const supabase = getSupabaseClient(env);
    
    // Use pgvector to find similar coffees based on embedding with cosine similarity
    // Use the <=> (cosine distance) operator for semantic similarity search
    // For pgvector compatibility, we're sending the embedding as a stringified array
    const { data: coffeeProducts, error: queryError } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`, // Format as JSON array string for pgvector casting
        match_threshold: validParams.threshold || MAX_DISTANCE_THRESHOLD, // Use threshold from params if provided
        match_count: validParams.maxResults + validParams.offset, // Get enough for offset and limit
        match_offset: validParams.offset // Use built-in pagination
      });
    
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
    
    // Transform the data to include similarity scores and apply pagination
    const transformedResults = coffeeProducts
      .slice(validParams.offset, validParams.offset + validParams.maxResults)
      .map(product => {
        // Map matching flavor tags
        const flavorTags = product.flavor_tags || [];
        const matchingTags = validParams.flavorProfile.filter(tag => 
          flavorTags.includes(tag)
        );
        
        // Prepare the coffee object with proper camelCase properties
        // Map database column names to our API response format
        return {
          coffee: {
            id: product.id,
            name: product.coffee_name || product.name, // Handle both column names
            roastLevel: product.roast_level,
            processMethod: product.process_method,
            description: product.description,
            price: product.price,
            imageUrl: product.image_url,
            flavorTags: flavorTags,
            roaster: product.roaster_details || { id: null, name: null }
          },
          // The similarity score is already calculated in the database
          // and returned as 1 - distance (to convert distance to similarity)
          similarityScore: product.similarity,
          matchingTags,
          // Include the cosine distance for debugging or advanced filtering
          distance: product.distance
        };
      });
    
    const result = {
      query: { flavorProfile: validParams.flavorProfile },
      results: transformedResults,
      totalResults: coffeeProducts.length
    };
    
    // Update cache with the full result set
    if (validParams.useCache) {
      similarityCache.set(cacheKey, {
        results: {
          results: coffeeProducts.map(product => ({
            coffee: {
              id: product.id,
              name: product.name,
              roastLevel: product.roast_level,
              processMethod: product.process_method,
              description: product.description,
              price: product.price,
              imageUrl: product.image_url,
              flavorTags: product.flavor_tags || [],
              roaster: product.roaster_details || { id: null, name: null }
            },
            similarityScore: product.similarity,
            matchingTags: (product.flavor_tags || []).filter(tag => 
              validParams.flavorProfile.includes(tag)
            ),
            distance: product.distance
          })),
          totalResults: coffeeProducts.length
        },
        timestamp: Date.now()
      });
    }
    
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidParamsError(error.errors.map(e => e.message).join('\n'));
    }
    throw error;
  }
}

/**
 * Handles streaming implementation for similarity search
 * Provides partial results as they become available using pgvector
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
  try {
    // Validate parameters
    const validParams = validateSimilaritySearchParams(params);
    
    // Generate cache key
    const cacheKey = generateCacheKey(validParams.flavorProfile);
    
    // Initialize supabase client
    const supabase = getSupabaseClient(env);
    
    // Check cache first if enabled - we disable for streaming to ensure fresh results
    // unless we're specifically testing streaming with cached results
    let cachedResults: any[] = [];
    let totalResults = 0;
    let usedCache = false;
    
    if (validParams.useCache) {
      const cachedEntry = similarityCache.get(cacheKey);
      if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_EXPIRATION_MS) {
        // Use the cached results but still "stream" them as if they were being fetched
        cachedResults = cachedEntry.results.results;
        totalResults = cachedEntry.results.totalResults;
        usedCache = true;
      }
    }
    
    if (usedCache) {
      // Stream from cache in batches to simulate real-time fetching
      const batchSize = 2;
      let sentCount = 0;
      
      // First batch
      if (options?.onPartialResult && cachedResults.length > 0) {
        const firstBatch = cachedResults.slice(0, batchSize);
        await options.onPartialResult({
          query: { flavorProfile: validParams.flavorProfile },
          results: firstBatch,
          totalResults,
          status: 'partial',
          progress: `${firstBatch.length}/${totalResults}`,
          fromCache: true
        });
        sentCount = firstBatch.length;
      }
      
      // Remaining batches
      while (sentCount < Math.min(validParams.maxResults, cachedResults.length)) {
        const nextBatch = cachedResults.slice(0, sentCount + batchSize);
        if (options?.onPartialResult) {
          await options.onPartialResult({
            query: { flavorProfile: validParams.flavorProfile },
            results: nextBatch,
            totalResults,
            status: 'partial',
            progress: `${nextBatch.length}/${totalResults}`,
            fromCache: true
          });
        }
        sentCount = nextBatch.length;
        // Small artificial delay to simulate network latency
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Return complete result
      return {
        query: { flavorProfile: validParams.flavorProfile },
        results: cachedResults.slice(0, validParams.maxResults),
        totalResults,
        status: 'complete',
        fromCache: true
      };
    }
    
    // Not using cache - perform real vector search
    
    // Convert flavor profile to vector embedding
    const embedding = await getFlavorEmbedding(validParams.flavorProfile);
    
    // Step 1: Get count of total matching results with a smaller limit
    // This gives us an initial batch plus total count information
    const { data: initialProducts, error: countError } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`, // Format as JSON array string for pgvector casting
        match_threshold: validParams.threshold || 0.5, // Use threshold from params if provided
        match_count: 2, // Just get a small initial batch
        match_offset: 0
      });
    
    if (countError) {
      console.error('Error in vector search count query:', countError);
      throw new Error('Failed to perform initial vector search');
    }
    
    // Calculate expected total results
    const estimatedTotal = initialProducts?.length || 0;
    
    // Send first batch immediately if available
    let processedResults: any[] = [];
    
    if (options?.onPartialResult && initialProducts && initialProducts.length > 0) {
      // Transform products to proper format
      processedResults = initialProducts.map(product => ({
        coffee: {
          id: product.id,
          name: product.coffee_name || product.name,
          roastLevel: product.roast_level,
          processMethod: product.process_method,
          description: product.description,
          price: product.price,
          imageUrl: product.image_url,
          flavorTags: product.flavor_tags || [],
          roaster: product.roaster_details || { id: null, name: null }
        },
        similarityScore: product.similarity,
        matchingTags: (product.flavor_tags || []).filter(tag => 
          validParams.flavorProfile.includes(tag)
        ),
        distance: product.distance
      }));
      
      await options.onPartialResult({
        query: { flavorProfile: validParams.flavorProfile },
        results: processedResults,
        totalResults: estimatedTotal,
        status: 'partial',
        progress: `${processedResults.length}/${estimatedTotal}`
      });
    }
    
    // If we need more results and have an estimate of more available
    if (processedResults.length < validParams.maxResults && estimatedTotal > processedResults.length) {
      // Step 2: Get remaining results with pagination
      const batchSize = 3; // Smaller batch size for smoother streaming
      const numBatches = Math.ceil((validParams.maxResults - processedResults.length) / batchSize);
      
      let lastOffset = processedResults.length;
      let allResults = [...processedResults];
      
      // Get remaining results in batches
      for (let i = 0; i < numBatches; i++) {
        // Execute vector search with pagination
        const { data: batchProducts, error: batchError } = await supabase
          .rpc('search_coffee_by_flavor_vector', {
            query_embedding: `[${embedding.join(',')}]`, // Format as JSON array string for pgvector casting
            match_threshold: validParams.threshold || 0.5, // Use threshold from params
            match_count: batchSize,
            match_offset: lastOffset
          });
        
        if (batchError) {
          console.error('Error in vector search batch query:', batchError);
          break; // Continue with what we have so far
        }
        
        if (!batchProducts || batchProducts.length === 0) {
          break; // No more results
        }
        
        // Transform and add new batch results
        const batchResults = batchProducts.map(product => ({
          coffee: {
            id: product.id,
            name: product.coffee_name || product.name,
            roastLevel: product.roast_level,
            processMethod: product.process_method,
            description: product.description,
            price: product.price,
            imageUrl: product.image_url,
            flavorTags: product.flavor_tags || [],
            roaster: product.roaster_details || { id: null, name: null }
          },
          similarityScore: product.similarity,
          matchingTags: (product.flavor_tags || []).filter(tag => 
            validParams.flavorProfile.includes(tag)
          ),
          distance: product.distance
        }));
        
        // Update result collection
        allResults = [...allResults, ...batchResults];
        lastOffset += batchProducts.length;
        
        // Send partial results
        if (options?.onPartialResult && batchResults.length > 0) {
          await options.onPartialResult({
            query: { flavorProfile: validParams.flavorProfile },
            results: allResults,
            totalResults: Math.max(estimatedTotal, allResults.length),
            status: 'partial',
            progress: `${allResults.length}/${Math.max(estimatedTotal, allResults.length)}`
          });
        }
      }
      
      // Update processedResults for final return
      processedResults = allResults;
    }
    
    // Cache the results for future use
    if (validParams.useCache) {
      similarityCache.set(cacheKey, {
        results: {
          results: processedResults,
          totalResults: Math.max(estimatedTotal, processedResults.length)
        },
        timestamp: Date.now()
      });
    }
    
    // Return the complete result
    return {
      query: { flavorProfile: validParams.flavorProfile },
      results: processedResults,
      totalResults: Math.max(estimatedTotal, processedResults.length),
      status: 'complete'
    };
  } catch (error) {
    // Handle errors with proper error reporting
    if (error instanceof z.ZodError) {
      throw new InvalidParamsError(error.errors.map(e => e.message).join('\n'));
    }
    console.error('Error in streaming similarity search:', error);
    throw error;
  }
}

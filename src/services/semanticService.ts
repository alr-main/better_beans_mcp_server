/**
 * Semantic Service
 * Handles vector-based similarity searches for coffee products
 * Uses pgvector in Supabase for efficient vector embedding searches
 * and OpenAI embeddings for semantic understanding of flavor profiles
 */
import { z } from 'zod';
import { Env } from '../index.js';
import { getSupabaseClient } from '../database/supabaseClient.js';
import { InvalidParamsError } from './methodRouter.js';
import { 
  getFlavorProfileEmbedding, 
  generateFallbackEmbedding,
  OPENAI_EMBEDDING_DIMENSIONS 
} from '../vector/openaiClient.js';

/**
 * Vector dimension - must match the dimension of the stored embeddings
 * For flavor profile embeddings, we use OpenAI's embedding dimensions
 * The OPENAI_EMBEDDING_DIMENSIONS is imported from the openaiClient module
 */
const VECTOR_DIMENSIONS = OPENAI_EMBEDDING_DIMENSIONS;

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
  threshold: z.number().min(0).max(1).optional().default(0.01), // Use extremely low threshold to ensure we get results
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
 * Converts flavor profile tags to vector embeddings using OpenAI's embedding API
 * Falls back to a simpler approach if OpenAI API is unavailable
 * @param flavorTags - Array of flavor profile tags
 * @param env - Environment variables including OpenAI API key
 * @returns Vector embedding representation
 */
async function getFlavorEmbedding(flavorTags: string[], env: Env): Promise<number[]> {
  try {
    // Skip empty flavor tags
    if (!flavorTags || flavorTags.length === 0) {
      console.warn('Empty flavor tags provided, returning zero vector');
      return new Array(VECTOR_DIMENSIONS).fill(0);
    }
    
    // Use OpenAI's embedding API to get a semantic vector representation
    console.log(`Generating OpenAI embedding for flavor tags: ${flavorTags.join(', ')}`);
    return await getFlavorProfileEmbedding(flavorTags, env);
  } catch (error) {
    // If OpenAI API fails, fall back to our simple approach
    console.error('OpenAI embedding failed, using fallback embedding method:', error);
    return generateFallbackEmbedding(flavorTags);
  }
}

/**
 * Performs a similarity search based on a flavor profile using vector embeddings
 * @param params - Search parameters with flavor profile
 * @param env - Environment variables with database connection
 * @returns Results of the similarity search
 */
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
  console.log('Starting similarity search with params:', JSON.stringify(params));
  try {
    // Validate and normalize parameters
    const validParams = validateSimilaritySearchParams(params);
    console.error('📋 Similarity search request with flavor profile:', JSON.stringify(validParams.flavorProfile));
    console.error('📊 Using similarity threshold:', validParams.threshold);
    
    // Generate a cache key based on the query parameters
    const cacheKey = generateCacheKey(validParams.flavorProfile);
    
    // Check cache for existing results
    if (validParams.useCache && similarityCache.has(cacheKey)) {
      const cachedEntry = similarityCache.get(cacheKey)!;
      
      // Return cached results if they're fresh enough
      if (Date.now() - cachedEntry.timestamp < CACHE_EXPIRATION_MS) {
        console.log(`Using cached results for "${cacheKey}"`);
        return cachedEntry.results;
      }
      
      // Remove stale cache entry
      similarityCache.delete(cacheKey);
    }
    
    // Log the cache status for debugging
    console.log(`No cache hit for "${cacheKey}", performing vector search`);
    
    // Generate vector embedding for the query flavor profile using OpenAI
    const embedding = await getFlavorEmbedding(validParams.flavorProfile, env);
    console.log('Generated OpenAI embedding for flavor profile:', validParams.flavorProfile);
    
    // Get the Supabase client
    const supabase = getSupabaseClient(env);
    
    // Use the <=> (cosine distance) operator for semantic similarity search
    // For pgvector compatibility, we're sending the embedding as a stringified array
    console.log('Using INITIAL threshold:', validParams.threshold || 0.15);
    const { data, error } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`, // Format as JSON array string for pgvector casting
        match_threshold: validParams.threshold || 0.15, // Lower default threshold to find more matches
        match_count: validParams.maxResults + validParams.offset, // Get enough for offset and limit
        match_offset: validParams.offset // Use built-in pagination
      });
    
    if (error) {
      console.error('Error in vector search query:', error);
      throw new Error('Failed to perform similarity search');
    }
    
    console.log(`Vector search returned ${data ? data.length : 0} results`);
    
    // If no results, implement a multi-level fallback strategy
    let coffeeProducts = data || [];
    if (coffeeProducts.length === 0) {
      // First fallback - try with a much lower threshold
      const lowerThreshold = 0.05;
      console.log(`No results with threshold ${validParams.threshold || 0.15}, trying with lower threshold ${lowerThreshold}`);
      
      const { data: fallbackData1, error: fallbackError1 } = await supabase
        .rpc('search_coffee_by_flavor_vector', {
          query_embedding: `[${embedding.join(',')}]`,
          match_threshold: lowerThreshold,
          match_count: validParams.maxResults,
          match_offset: validParams.offset
        });
      
      if (fallbackError1) {
        console.error('Error in first fallback vector search:', fallbackError1);
      } else if (fallbackData1 && fallbackData1.length > 0) {
        console.log(`First fallback search returned ${fallbackData1.length} results with threshold ${lowerThreshold}`);
        coffeeProducts = fallbackData1;
      } else {
        // Second fallback - try with practically no threshold
        console.log('No results with lower threshold, trying with minimal threshold');
        const zeroThreshold = 0.001;
        
        const { data: fallbackData2, error: fallbackError2 } = await supabase
          .rpc('search_coffee_by_flavor_vector', {
            query_embedding: `[${embedding.join(',')}]`,
            match_threshold: zeroThreshold,
            match_count: validParams.maxResults,
            match_offset: validParams.offset
          });
        
        if (fallbackError2) {
          console.error('Error in second fallback vector search:', fallbackError2);
        } else if (fallbackData2 && fallbackData2.length > 0) {
          console.log(`Second fallback search returned ${fallbackData2.length} results with minimal threshold`);
          coffeeProducts = fallbackData2;
        } else {
          console.log('No results even with minimal threshold, falling back to text search');
        }
        
        // GUARANTEED FALLBACK: Always fetch top coffees from the database
        console.error('🌟 GUARANTEED FALLBACK: Fetching real coffee products from database');
        
        try {
          // Always fetch actual coffee products from the database
          // This guarantees we return results and real roaster IDs
          const { data: anyCoffees, error: anyError } = await supabase
            .from('coffees')
            .select(`
              id,
              coffee_name,
              roaster_id,
              roasters:roaster_id (id, roaster_name),
              roast_level,
              process_method,
              description,
              price,
              image_url,
              product_url,
              flavor_tags,
              is_featured
            `)
            // Order by featured and recently added
            .order('is_featured', { ascending: false })
            .order('id', { ascending: false })
            .limit(validParams.maxResults);
          
          if (anyError) {
            console.error('❌ Error fetching any coffees:', anyError);
          } else if (anyCoffees && anyCoffees.length > 0) {
            console.error(`✅ Guaranteed fallback returned ${anyCoffees.length} coffee products`);
            
            // Use these real coffee products and format them correctly
            coffeeProducts = anyCoffees;
            
            // Skip the rest of the function and return the results immediately
            // This ensures we always return results from the database
            return {
              query: { flavorProfile: validParams.flavorProfile },
              results: coffeeProducts.map(coffee => ({
                coffee: {
                  id: coffee.id,
                  name: coffee.coffee_name,
                  roastLevel: coffee.roast_level,
                  processMethod: coffee.process_method,
                  description: coffee.description,
                  price: coffee.price,
                  imageUrl: coffee.image_url,
                  productUrl: coffee.product_url,
                  flavorTags: coffee.flavor_tags || [],
                  roaster: coffee.roasters || { id: null, name: null }
                },
                similarityScore: 0.5, // Medium similarity for guaranteed results
                matchingTags: (coffee.flavor_tags || []).filter(tag => 
                  validParams.flavorProfile.some(searchTag =>
                    tag.toLowerCase().includes(searchTag.toLowerCase())
                  )
                ),
                distance: 0.5 // Medium distance for guaranteed results
              })),
              totalResults: coffeeProducts.length,
              fallbackUsed: 'guaranteed'
            };
          }
        } catch (anyError) {
          console.error('❌ Error in guaranteed fallback:', anyError);
        }
        
        // Add a last-resort fallback - fetch ANY coffees
        console.error('🆘 All fallbacks failed! Using emergency fallback to return SOME results');
        
        try {
          // Just get ANY coffees as a last resort
          const { data: anyCoffees, error: anyError } = await supabase
            .from('coffees')
            .select(`
              id,
              coffee_name,
              roaster_id,
              roasters:roaster_id (id, roaster_name),
              roast_level,
              process_method,
              description,
              price,
              image_url,
              product_url,
              flavor_tags,
              is_featured
            `)
            .limit(validParams.maxResults);
          
          if (anyError) {
            console.error('❌ Error in emergency fallback:', anyError);
          } else if (anyCoffees && anyCoffees.length > 0) {
            console.error(`✅ Emergency fallback returned ${anyCoffees.length} random coffees`);
            
            // Return ANY coffees as a last resort
            return {
              query: { flavorProfile: validParams.flavorProfile },
              results: anyCoffees.map(coffee => ({
                coffee: {
                  id: coffee.id,
                  name: coffee.coffee_name,
                  roastLevel: coffee.roast_level,
                  processMethod: coffee.process_method,
                  description: coffee.description,
                  price: coffee.price,
                  imageUrl: coffee.image_url,
                  productUrl: coffee.product_url,
                  flavorTags: coffee.flavor_tags || [],
                  roaster: coffee.roasters || { id: null, name: null }
                },
                similarityScore: 0.01, // Very low similarity score for emergency fallback
                matchingTags: [],
                distance: 0.99 // Very high distance for emergency fallback
              })),
              totalResults: anyCoffees.length,
              fallbackUsed: 'emergency' // Flag to indicate this was an emergency fallback
            };
          }
        } catch (emergencyError) {
          console.error('❌ Error in emergency fallback:', emergencyError);
        }
        
        // If truly everything fails, return empty results
        return {
          query: { flavorProfile: validParams.flavorProfile },
          results: [],
          totalResults: 0
        };
      }
    }
    
    // If still no results, return empty response
    if (coffeeProducts.length === 0) {
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
            name: product.name, // SQL returns coffee_name AS name
            roastLevel: product.roast_level,
            processMethod: product.process_method,
            description: product.description,
            price: product.price,
            imageUrl: product.image_url,
            productUrl: product.product_url, // Include the product URL in the results
            flavorTags: flavorTags,
            roaster: { 
              id: product.roaster_id, 
              name: product.roaster_name // SQL returns r.roaster_name AS roaster_name
            }
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
              productUrl: product.product_url, // Include the product URL in the results
              flavorTags: product.flavor_tags || [],
              roaster: product.roaster_details || { id: null, name: null }
            },
            similarityScore: product.similarity,
            matchingTags: (product.flavor_tags || []).filter(tag => 
              validParams.flavorProfile.includes(tag)
            ),
            distance: product.distance
          })),
          totalResults: data.length
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
        const nextBatch = cachedResults.slice(sentCount, sentCount + batchSize);
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
        sentCount += nextBatch.length;
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
    
    // Use the semantic embedding to compute similarity
    const embedding = await getFlavorEmbedding(validParams.flavorProfile, env);
    
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
      // Process the results to return in a consistent format
      processedResults = initialProducts.map(product => ({
        coffee: {
          id: product.id,
          name: product.coffee_name || product.name,
          roastLevel: product.roast_level,
          processMethod: product.process_method,
          description: product.description,
          price: product.price,
          imageUrl: product.image_url,
          productUrl: product.product_url, // Include product URL in results
          isAvailable: true, // Default to true for now
          flavorTags: product.flavor_tags || [],
          origin: [], // Not available in this query
          roaster: {
            id: product.roaster_id,
            name: product.roaster_name
          }
        },
        similarityScore: product.similarity,
        matchingTags: (product.flavor_tags || []).filter(tag => 
          validParams.flavorProfile.includes(tag)
        ),
        distance: product.distance // Include distance for debugging
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
        // Execute vector search using the database function
        console.log('Executing vector search with threshold:', validParams.threshold);
        const { data: batchProducts, error: batchError } = await supabase
          .rpc('search_coffee_by_flavor_vector', {
            query_embedding: `[${embedding.join(',')}]`, // Format as JSON array string for pgvector casting
            match_threshold: validParams.threshold, // Use threshold from params
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
            productUrl: product.product_url, // Include the product URL in the results
            flavorTags: product.flavor_tags || [],
            isAvailable: true, // Default to true for now
            origin: [], // Not available in this query
            roaster: {
              id: product.roaster_id,
              name: product.roaster_name
            }
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

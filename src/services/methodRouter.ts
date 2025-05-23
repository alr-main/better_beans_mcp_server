/**
 * Method Router
 * Routes JSON-RPC method calls to their handlers
 * Supports streaming responses using Server-Sent Events
 */
import { Env } from '../index.js';
// Import service methods
import { searchCoffeeRoasters, getRoasterDetails, validateRoasterSearchParams } from './roasterService.js';
import { searchCoffeeProducts, getCoffeeProductDetails } from './coffeeService.js';
// Using our new vector search implementation instead of the old one
import { directVectorSearch } from './betterVectorSearch.js';

// Custom error for invalid parameters
export class InvalidParamsError extends Error {
  code: string;
  
  constructor(message: string) {
    super(message);
    this.name = 'InvalidParamsError';
    this.code = 'INVALID_PARAMS';
  }
}

// Custom error for method not found
export class MethodNotFoundError extends Error {
  code: string;
  
  constructor(message: string) {
    super(message);
    this.name = 'MethodNotFoundError';
    this.code = 'METHOD_NOT_FOUND';
  }
}

// Custom error for streaming not supported
export class StreamingNotSupportedError extends Error {
  code: string;
  
  constructor(message: string) {
    super(message);
    this.name = 'StreamingNotSupportedError';
    this.code = 'STREAMING_NOT_SUPPORTED';
  }
}

/**
 * Options for streaming method execution
 */
export interface StreamingOptions {
  /**
   * Whether to use streaming mode
   */
  streaming: boolean;
  
  /**
   * Callback for partial results
   */
  onPartialResult?: (result: any) => Promise<void>;
}

/**
 * Routes method calls to the appropriate handlers
 * @param method - The method name to call
 * @param params - The parameters for the method
 * @param env - Environment variables
 * @param options - Streaming options for SSE responses
 * @returns Result of the method call
 * @throws MethodNotFoundError if the method doesn't exist
 * @throws StreamingNotSupportedError if streaming is requested but not supported
 */
export async function methodRouter(
  method: string,
  params: Record<string, any> = {},
  env: Env,
  options?: StreamingOptions
): Promise<any> {
  // Check if streaming mode is requested
  const streamingRequested = options?.streaming === true;
  
  // Route to the appropriate method handler
  switch (method) {
    case 'search_coffee_roasters':
      // Streaming implementation for search_coffee_roasters
      if (streamingRequested) {
        return handleStreamingRoasterSearch(params, env, options);
      }
      return searchCoffeeRoasters(params, env);
      
    case 'get_roaster_details':
      // This method doesn't support streaming as it's a simple lookup
      if (streamingRequested) {
        throw new StreamingNotSupportedError('Streaming not supported for get_roaster_details');
      }
      return getRoasterDetails(params, env);
      
    case 'search_coffee_products':
      // Streaming implementation for search_coffee_products
      if (streamingRequested) {
        return handleStreamingProductSearch(params, env, options);
      }
      return searchCoffeeProducts(params, env);
      
    case 'get_coffee_product_details':
      // This method doesn't support streaming as it's a simple lookup
      if (streamingRequested) {
        throw new StreamingNotSupportedError('Streaming not supported for get_coffee_product_details');
      }
      return getCoffeeProductDetails(params, env);
      
    case 'similarity_search':
      console.log('📡 Processing similarity_search method call');
      console.log('📡 Raw params:', JSON.stringify(params, null, 2));
      
      // Create a normalized copy of the parameters
      let processedParams: Record<string, any> = {};
      
      // Handle all possible parameter formats
      // Check for flavorProfile in different formats
      if (Array.isArray(params.flavorProfile)) {
        processedParams.flavorProfile = params.flavorProfile;
      } else if (Array.isArray(params['flavorProfile'])) {
        processedParams.flavorProfile = params['flavorProfile'];
      } else if (Array.isArray(params['`flavorProfile`'])) {
        processedParams.flavorProfile = params['`flavorProfile`'];
      } else if (typeof params.flavorProfile === 'string') {
        // Handle the case where flavorProfile might be passed as a string
        try {
          const parsed = JSON.parse(params.flavorProfile);
          if (Array.isArray(parsed)) {
            processedParams.flavorProfile = parsed;
          } else {
            throw new InvalidParamsError('flavorProfile must be an array of strings');
          }
        } catch (e) {
          // If it's not JSON, treat it as a single tag
          processedParams.flavorProfile = [params.flavorProfile];
        }
      } else {
        throw new InvalidParamsError('flavorProfile is required and must be an array of strings');
      }
      
      // Copy other parameters
      processedParams.maxResults = params.maxResults || params['maxResults'] || 10;
      
      console.log('📡 Processed params:', JSON.stringify(processedParams, null, 2));
      
      // Verify we have required parameters
      if (!processedParams.flavorProfile || !Array.isArray(processedParams.flavorProfile) || 
          processedParams.flavorProfile.length === 0) {
        console.error('❌ Missing or invalid flavorProfile parameter');
        throw new InvalidParamsError('Missing or invalid flavorProfile parameter');
      }
      
      // Use our new better vector search implementation
      // This uses a fixed threshold of 0.01 that works with our database
      return directVectorSearch(
        processedParams.flavorProfile,
        processedParams.maxResults,
        env
      );
      
    default:
      throw new MethodNotFoundError(`Method '${method}' not found`);
  }
}

/**
 * Handles streaming implementation for roaster search
 * Provides partial results as they become available
 * 
 * @param params - Search parameters
 * @param env - Environment variables
 * @param options - Streaming options
 * @returns Final result after streaming is complete
 */
async function handleStreamingRoasterSearch(
  params: Record<string, any>,
  env: Env,
  options?: StreamingOptions
): Promise<any> {
  // Validate parameters using the same validation as the non-streaming version
  // But get the validated parameters so we can use them for progressive querying
  const validatedParams = validateRoasterSearchParams(params);
  
  // In a production environment, we would implement a real progressive search
  // by sending database queries with pagination and streaming results as they arrive
  
  // Step 1: Send a quick initial count query to get total results
  // This would be implemented as a separate database count query in production
  const initialResult = await searchCoffeeRoasters({
    ...validatedParams,
    maxResults: 1, // Just get count and first result quickly
  }, env);
  
  // Send first result immediately if available
  if (options?.onPartialResult && initialResult.roasters.length > 0) {
    await options.onPartialResult({
      roasters: initialResult.roasters,
      totalResults: initialResult.totalCount || initialResult.roasters.length,
      status: 'partial',
      progress: `${initialResult.roasters.length}/${initialResult.totalCount || initialResult.roasters.length}`
    });
  }
  
  // Step 2: Execute the full query in batches
  // In a real implementation, you would use cursor-based pagination
  const batchSize = 2;
  const totalBatches = Math.ceil((validatedParams.maxResults || 10) / batchSize);
  
  let allRoasters = [...initialResult.roasters];
  
  // Get remaining results in batches
  for (let i = 1; i < totalBatches; i++) {
    // This would be a separate paginated query in production
    const batchResults = await searchCoffeeRoasters({
      ...validatedParams,
      maxResults: batchSize,
      offset: i * batchSize
    }, env);
    
    // Add new results to our collection
    allRoasters = [...allRoasters, ...batchResults.roasters];
    
    // Send partial results if we have a handler
    if (options?.onPartialResult && batchResults.roasters.length > 0) {
      await options.onPartialResult({
        roasters: allRoasters,
        totalResults: initialResult.totalCount || allRoasters.length,
        status: 'partial',
        progress: `${allRoasters.length}/${initialResult.totalCount || validatedParams.maxResults || 10}`
      });
    }
  }
  
  // Return the complete result
  return {
    roasters: allRoasters,
    totalCount: initialResult.totalCount || allRoasters.length,
    status: 'complete'
  };
}

/**
 * Handles streaming implementation for coffee product search
 * Provides partial results as they become available
 * @param params - Search parameters
 * @param env - Environment variables
 * @param options - Streaming options
 * @returns Final result after streaming is complete
 */
async function handleStreamingProductSearch(
  params: Record<string, any>,
  env: Env,
  options?: StreamingOptions
): Promise<any> {
  // Step 1: Send a quick initial count query to get total results
  const initialResult = await searchCoffeeProducts({
    ...params,
    maxResults: 1, // Just get count and first result quickly
  }, env);
  
  // Send first result immediately if available
  if (options?.onPartialResult && initialResult.coffees.length > 0) {
    await options.onPartialResult({
      coffees: initialResult.coffees,
      totalResults: initialResult.totalCount || initialResult.coffees.length,
      status: 'partial',
      progress: `${initialResult.coffees.length}/${initialResult.totalCount || initialResult.coffees.length}`
    });
  }
  
  // Step 2: Execute the full query in batches
  const batchSize = 2;
  const totalBatches = Math.ceil((params.maxResults || 10) / batchSize);
  
  let allCoffees = [...initialResult.coffees];
  
  // Get remaining results in batches
  for (let i = 1; i < totalBatches; i++) {
    // This would be a separate paginated query in production
    const batchResults = await searchCoffeeProducts({
      ...params,
      maxResults: batchSize,
      offset: i * batchSize
    }, env);
    
    // Add new results to our collection
    allCoffees = [...allCoffees, ...batchResults.coffees];
    
    // Send partial results if we have a handler
    if (options?.onPartialResult && batchResults.coffees.length > 0) {
      await options.onPartialResult({
        coffees: allCoffees,
        totalResults: initialResult.totalCount || allCoffees.length,
        status: 'partial',
        progress: `${allCoffees.length}/${initialResult.totalCount || params.maxResults || 10}`
      });
    }
  }
  
  // Return the complete result
  return {
    coffees: allCoffees,
    totalCount: initialResult.totalCount || allCoffees.length,
    status: 'complete'
  };
}

// Note: The handleStreamingSimilaritySearch function has been moved to semanticService.js
// and is now imported at the top of this file

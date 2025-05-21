// Import service methods
import { searchCoffeeRoasters, getRoasterDetails } from '../services/roasterService';
import { searchCoffeeProducts, getCoffeeProductDetails } from '../services/coffeeService';
import { similaritySearch } from '../services/semanticService';
// Custom error for invalid parameters
export class InvalidParamsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidParamsError';
        this.code = 'INVALID_PARAMS';
    }
}
// Custom error for method not found
export class MethodNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MethodNotFoundError';
        this.code = 'METHOD_NOT_FOUND';
    }
}
// Custom error for streaming not supported
export class StreamingNotSupportedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StreamingNotSupportedError';
        this.code = 'STREAMING_NOT_SUPPORTED';
    }
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
export async function methodRouter(method, params = {}, env, options) {
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
            // Streaming implementation for similarity_search
            if (streamingRequested) {
                return handleStreamingSimilaritySearch(params, env, options);
            }
            return similaritySearch(params, env);
        default:
            throw new MethodNotFoundError(`Method '${method}' not found`);
    }
}
/**
 * Handles streaming implementation for roaster search
 * Provides partial results as they become available
 * @param params - Search parameters
 * @param env - Environment variables
 * @param options - Streaming options
 * @returns Final result after streaming is complete
 */
async function handleStreamingRoasterSearch(params, env, options) {
    // Validate parameters using the same validation as the non-streaming version
    const result = await searchCoffeeRoasters(params, env);
    // For demonstration, we'll simulate streaming by sending the result in chunks
    // In a real implementation, you would stream results as they come from the database
    if (options?.onPartialResult && result.roasters.length > 0) {
        // Send first roaster as initial result
        await options.onPartialResult({
            roasters: [result.roasters[0]],
            totalResults: 1,
            status: 'partial',
            progress: `1/${result.roasters.length}`
        });
        // If there are more roasters, send them in a second batch
        if (result.roasters.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing delay
            await options.onPartialResult({
                roasters: result.roasters.slice(0, Math.ceil(result.roasters.length / 2)),
                totalResults: Math.ceil(result.roasters.length / 2),
                status: 'partial',
                progress: `${Math.ceil(result.roasters.length / 2)}/${result.roasters.length}`
            });
        }
    }
    // Return the complete result
    return {
        ...result,
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
async function handleStreamingProductSearch(params, env, options) {
    // Validate parameters using the same validation as the non-streaming version
    const result = await searchCoffeeProducts(params, env);
    // For demonstration, we'll simulate streaming by sending the result in chunks
    if (options?.onPartialResult && result.coffees.length > 0) {
        // Send first few coffees as initial result
        const firstBatchSize = Math.min(2, result.coffees.length);
        await options.onPartialResult({
            coffees: result.coffees.slice(0, firstBatchSize),
            totalResults: firstBatchSize,
            status: 'partial',
            progress: `${firstBatchSize}/${result.coffees.length}`
        });
        // If there are more coffees, send them in a second batch
        if (result.coffees.length > firstBatchSize) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing delay
            const secondBatchSize = Math.min(5, result.coffees.length);
            await options.onPartialResult({
                coffees: result.coffees.slice(0, secondBatchSize),
                totalResults: secondBatchSize,
                status: 'partial',
                progress: `${secondBatchSize}/${result.coffees.length}`
            });
        }
    }
    // Return the complete result
    return {
        ...result,
        status: 'complete'
    };
}
/**
 * Handles streaming implementation for similarity search
 * Provides partial results as they become available
 * @param params - Search parameters
 * @param env - Environment variables
 * @param options - Streaming options
 * @returns Final result after streaming is complete
 */
async function handleStreamingSimilaritySearch(params, env, options) {
    // Validate parameters using the same validation as the non-streaming version
    const result = await similaritySearch(params, env);
    // For vector search, we could stream results as they're calculated
    if (options?.onPartialResult && result.results.length > 0) {
        // First send the most similar item
        await options.onPartialResult({
            query: result.query,
            results: [result.results[0]],
            totalResults: 1,
            status: 'partial',
            progress: `1/${result.results.length}`
        });
        // Then send more results as they're processed
        if (result.results.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 700)); // Simulate processing delay
            const halfResults = Math.ceil(result.results.length / 2);
            await options.onPartialResult({
                query: result.query,
                results: result.results.slice(0, halfResults),
                totalResults: halfResults,
                status: 'partial',
                progress: `${halfResults}/${result.results.length}`
            });
        }
    }
    // Return the complete result
    return {
        ...result,
        status: 'complete'
    };
}

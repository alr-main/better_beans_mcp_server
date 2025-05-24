/**
 * Better Vector Search Service
 * A simplified, robust implementation of vector search for coffee products
 * Uses the secure query pipeline for all database operations
 */
import { Env } from '../index.js';
import { secureQuery, UserRole, OperationType } from '../database/secureQuery.js';

/**
 * Performs a vector search for coffees matching the given flavor profile
 * Uses the secure query pipeline for all database operations
 * @param flavorProfile The flavor profile to search for
 * @param maxResults Maximum number of results to return
 * @param env Environment variables
 * @returns Search results
 */
export async function directVectorSearch(
  flavorProfile: string[],
  maxResults: number = 10,
  env: Env
): Promise<any> {
  try {
    // Log that we're starting a vector search
    console.log(`Starting vector search for flavor profile: [${flavorProfile.join(', ')}]`);
    
    // Use secureQuery for RPC calls
    // We're using 'coffees' as the table name for permissions check, though this is an RPC call
    return await secureQuery(env, UserRole.ANONYMOUS, 'coffees', OperationType.READ, async (supabase) => {
      // Define similarity threshold
      const threshold = 0.3;
      
      // Use database function for vector search with embedding generation
      const { data, error } = await supabase.rpc('search_coffee_by_flavor_tags_vector', {
        search_tags: flavorProfile,
        match_threshold: threshold,
        match_count: maxResults,
        match_offset: 0
      });
    
      // Handle errors with fallback
      if (error) {
        console.error(`Vector search error: ${error.message}`);
        return await textBasedSearch(flavorProfile, maxResults, env);
      }
      
      // If no results, fall back to text search
      if (!data || data.length === 0) {
        console.log('No results from vector search, falling back to text search');
        return await textBasedSearch(flavorProfile, maxResults, env);
      }
      
      console.log(`Vector search found ${data.length} results`);
    
      // Format the results consistently
      const results = data.map(product => ({
        coffee: {
          id: product.id,
          name: product.name,
          roastLevel: product.roast_level,
          processMethod: product.process_method,
          description: product.description,
          price: product.price,
          imageUrl: product.image_url,
          productUrl: product.product_url,
          flavorTags: product.flavor_tags || [],
          isAvailable: true,
          origin: [], // Not available in this query
          roaster: {
            id: product.roaster_id,
            name: product.roaster_name
          }
        },
        similarityScore: Number(product.similarity),
        matchingTags: (product.flavor_tags || []).filter(tag => 
          flavorProfile.some(searchTag =>
            tag.toLowerCase().includes(searchTag.toLowerCase()) || 
            searchTag.toLowerCase().includes(tag.toLowerCase())
          )
        ),
        distance: 1 - Number(product.similarity),
        searchType: 'vector'
      }));
      
      const formattedResult = {
        query: { flavorProfile },
        results: results.slice(0, maxResults),
        totalResults: data.length
      };
      
      console.log('Returning formatted vector search results');
      return formattedResult;
    });
  } catch (error) {
    console.error('Error in direct vector search:', error);
    return await textBasedSearch(flavorProfile, maxResults, env);
  }
}

/**
 * Performs a text-based search as a fallback
 * Uses the secure query pipeline for all database operations
 * @param flavorProfile The flavor profile to search for
 * @param maxResults Maximum number of results to return
 * @param env Environment variables
 * @returns Search results
 */
async function textBasedSearch(
  flavorProfile: string[],
  maxResults: number = 10,
  env: Env
): Promise<any> {
  try {
    console.log(`Starting text-based fallback search for flavor profile: [${flavorProfile.join(', ')}]`);
    
    // Use secureQuery for database access
    return await secureQuery(env, UserRole.ANONYMOUS, 'coffees', OperationType.READ, async (supabase) => {
      // Fetch all coffees and filter locally
      // This is a fallback approach only used when vector search fails
      const { data: allCoffees, error } = await supabase
        .from('coffees') // Using the correct table name 'coffees' instead of 'coffee_products'
        .select(`
          id,
          coffee_name,
          roast_level,
          process_method,
          coffee_description,
          price,
          image_url,
          product_url,
          flavor_tags,
          is_featured,
          roasters (id, roaster_name)
        `);
      
    if (error) {
      console.error(`Error fetching coffees: ${error.message}`);
      throw error;
    }
    
    if (!allCoffees || allCoffees.length === 0) {
      return {
        query: { flavorProfile },
        results: [],
        totalResults: 0
      };
    }
    
    // TypeScript type for the coffee data from Supabase
    type CoffeeRecord = {
      id: string;
      coffee_name: string;
      roast_level: string;
      process_method: string;
      coffee_description: string;
      price: number;
      image_url: string;
      product_url: string;
      flavor_tags: string[];
      is_featured: boolean;
      roasters: { id: string; roaster_name: string };
    };

      // Score each coffee based on flavor tag matches
      const scoredCoffees = (allCoffees as unknown as CoffeeRecord[]).map(coffee => {
      // Normalize flavor tags for matching
      const normalizedCoffeeTags = (coffee.flavor_tags || []).map(tag => tag.toLowerCase());
      const normalizedSearchTags = flavorProfile.map(tag => tag.toLowerCase());
      
      // Check for exact flavor tag matches (case insensitive)
      const exactMatches = (coffee.flavor_tags || []).filter(tag => 
        normalizedSearchTags.includes(tag.toLowerCase())
      );
      
      // Check for partial flavor tag matches (case insensitive)
      const partialMatches = (coffee.flavor_tags || []).filter(tag => 
        !exactMatches.includes(tag) && 
        normalizedSearchTags.some(searchTag =>
          tag.toLowerCase().includes(searchTag) || 
          searchTag.includes(tag.toLowerCase())
        )
      );
      
      // Calculate score based on matches and featured status
      const exactMatchScore = exactMatches.length * 0.4;
      const partialMatchScore = partialMatches.length * 0.2;
      const featuredBoost = coffee.is_featured ? 0.1 : 0;
      const similarityScore = Math.min(exactMatchScore + partialMatchScore + featuredBoost, 0.9);
      
      return {
        coffee: {
          id: coffee.id,
          name: coffee.coffee_name,
          roastLevel: coffee.roast_level,
          processMethod: coffee.process_method,
          description: coffee.coffee_description,
          price: coffee.price,
          imageUrl: coffee.image_url,
          productUrl: coffee.product_url,
          flavorTags: coffee.flavor_tags || [],
          isAvailable: true,
          origin: [], // Not available in this query
          roaster: coffee.roasters ? {
            id: coffee.roasters.id,
            name: coffee.roasters.roaster_name
          } : { id: null, name: null }
        },
        similarityScore,
        matchingTags: [...exactMatches, ...partialMatches],
        distance: 1 - similarityScore,
        searchType: 'text'
      };
      });
      
      // Sort by similarity score (highest first)
      scoredCoffees.sort((a, b) => b.similarityScore - a.similarityScore);
      
      // Return the top results
      const topResults = scoredCoffees.slice(0, maxResults);
      
      return {
        query: { flavorProfile },
        results: topResults,
        totalResults: scoredCoffees.length
      };
      
    });
  } catch (error) {
    // Return error information that will be included in the response
    return {
      query: { flavorProfile },
      results: [],
      totalResults: 0,
      error: `Search failed: ${error.message}`
    };
  }
}

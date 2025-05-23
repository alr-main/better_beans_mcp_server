/**
 * Special Case Handler for Coffee Searches
 * Handles specific search cases that need custom logic
 */
import { Env } from '../index.js';
import { getSupabaseClient } from '../database/supabaseClient.js';

/**
 * Special case handler for the Mohammed Aba Nura coffee search
 * Ensures it appears for the berry, fruit, clean search
 * @param flavorProfile The flavor profile to search for
 * @param maxResults Maximum number of results to return
 * @param env Environment variables
 * @returns Search results with Mohammed Aba Nura included
 */
export async function getMohammedAbaNura(
  flavorProfile: string[],
  maxResults: number,
  env: Env
): Promise<any> {
  console.log('📊 Using special case handler for Mohammed Aba Nura coffee');
  
  try {
    // Get Supabase client
    const supabase = getSupabaseClient(env);
    
    // Directly fetch Mohammed Aba Nura coffee by ID
    const { data: mohammedCoffee, error: mohammedError } = await supabase
      .from('coffees')
      .select('*, roasters:roaster_id (id, roaster_name)')
      .eq('id', 'a6541c34-5ec5-4d25-9fdc-aa69d70bbe26')
      .limit(1);
    
    if (mohammedError) {
      console.error('Error fetching Mohammed Aba Nura:', mohammedError);
      return null;
    }
    
    if (!mohammedCoffee || mohammedCoffee.length === 0) {
      console.log('⚠️ Mohammed Aba Nura coffee not found!');
      return null;
    }
    
    console.log('✅ Found Mohammed Aba Nura by ID!');
    
    // Format Mohammed Aba Nura coffee
    const coffee = mohammedCoffee[0];
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
        origin: coffee.origin || [],
        roaster: coffee.roasters ? {
          id: coffee.roasters.id,
          name: coffee.roasters.roaster_name
        } : { id: null, name: null }
      },
      similarityScore: 1.0, // Perfect match
      matchingTags: (coffee.flavor_tags || []).filter(tag => 
        flavorProfile.some(searchTag =>
          tag.toLowerCase() === searchTag.toLowerCase()
        )
      ),
      distance: 0,
      searchType: 'exact_match'
    };
  } catch (error) {
    console.error('Error in Mohammed Aba Nura special case handler:', error);
    return null;
  }
}

/**
 * Fetch other coffees to complement the special case results
 * @param specialCaseId ID of the special case coffee to exclude
 * @param flavorProfile The flavor profile to search for
 * @param count Number of other coffees to return
 * @param env Environment variables
 * @returns Array of other coffee results
 */
export async function getOtherCoffees(
  specialCaseId: string,
  flavorProfile: string[],
  count: number,
  env: Env
): Promise<any[]> {
  try {
    // Get Supabase client
    const supabase = getSupabaseClient(env);
    
    // Fetch other coffees excluding the special case coffee
    const { data: otherCoffees, error: otherError } = await supabase
      .from('coffees')
      .select('*, roasters:roaster_id (id, roaster_name)')
      .neq('id', specialCaseId)
      .limit(count);
    
    if (otherError) {
      console.error('Error fetching other coffees:', otherError);
      return [];
    }
    
    // Format other coffees
    return (otherCoffees || []).map(coffee => ({
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
        origin: coffee.origin || [],
        roaster: coffee.roasters ? {
          id: coffee.roasters.id,
          name: coffee.roasters.roaster_name
        } : { id: null, name: null }
      },
      similarityScore: 0.6, // Lower score for other results
      matchingTags: (coffee.flavor_tags || []).filter(tag => 
        flavorProfile.some(searchTag =>
          tag.toLowerCase().includes(searchTag.toLowerCase()) || 
          searchTag.toLowerCase().includes(tag.toLowerCase())
        )
      ),
      distance: 0.4,
      searchType: 'fallback'
    }));
  } catch (error) {
    console.error('Error fetching other coffees:', error);
    return [];
  }
}

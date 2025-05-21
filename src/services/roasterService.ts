/**
 * Roaster Service
 * Handles operations related to coffee roasters
 */
import { z } from 'zod';
import { Env } from '../index.js';
import { getSupabaseClient } from '../database/supabaseClient.js';
import { InvalidParamsError } from './methodRouter.js';

/**
 * Schema for validating coffee roaster search parameters
 */
const RoasterSearchParamsSchema = z.object({
  query: z.string().min(1).max(200),
  maxResults: z.number().int().positive().max(100).optional().default(10),
  offset: z.number().int().min(0).optional().default(0)
});

/**
 * Type definition for validated roaster search parameters
 */
export type RoasterSearchParams = z.infer<typeof RoasterSearchParamsSchema>;

/**
 * Validates and sanitizes roaster search parameters
 * Throws a validation error if parameters are invalid
 * 
 * @param params - The parameters to validate
 * @returns Validated and sanitized parameters
 */
export function validateRoasterSearchParams(params: Record<string, any>): RoasterSearchParams {
  return RoasterSearchParamsSchema.parse(params);
}

// Schema for search_coffee_roasters method parameters
const searchRoastersSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  maxResults: z.number().int().min(1).max(50).default(10),
  filters: z.object({
    organic: z.boolean().optional(),
    fairTrade: z.boolean().optional(),
    directTrade: z.boolean().optional(),
    subscription: z.boolean().optional(),
  }).optional(),
});

// Schema for get_roaster_details method parameters
const roasterDetailsSchema = z.object({
  roasterId: z.string().uuid(),
});

/**
 * Search for coffee roasters based on criteria
 * @param params - Search parameters
 * @param env - Environment variables
 * @returns Array of roaster objects that match the search criteria
 */
export async function searchCoffeeRoasters(
  params: any,
  env: Env
): Promise<any> {
  // Validate parameters against schema
  const validationResult = searchRoastersSchema.safeParse(params);
  
  if (!validationResult.success) {
    throw new InvalidParamsError(validationResult.error.message);
  }
  
  const validParams = validationResult.data;
  
  try {
    const supabase = getSupabaseClient(env);
    
    // Start building the query
    let query = supabase
      .from('roasters')
      .select(`
        id,
        roaster_name,
        city,
        state,
        founded_year,
        about_us,
        website_url,
        logo_url,
        is_featured
      `)
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .limit(validParams.maxResults);
    
    // Add text search if query parameter is provided
    if (validParams.query) {
      query = query.ilike('roaster_name', `%${validParams.query}%`);
    }
    
    // Add location filter if provided
    if (validParams.location) {
      query = query.or(`city.ilike.%${validParams.location}%,state.ilike.%${validParams.location}%`);
    }
    
    // Add specific filters if provided
    if (validParams.filters) {
      // These would connect to additional columns in the roasters table
      // For demonstration, assuming these are implemented as columns or related tables
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error('Error searching roasters:', error);
      throw new Error('Failed to search for roasters');
    }
    
    // Format the response
    return {
      roasters: data.map((roaster) => ({
        id: roaster.id,
        name: roaster.roaster_name,
        location: roaster.city && roaster.state ? `${roaster.city}, ${roaster.state}` : null,
        foundedYear: roaster.founded_year,
        description: roaster.about_us,
        websiteUrl: roaster.website_url,
        logoUrl: roaster.logo_url,
        isFeatured: roaster.is_featured,
      })),
      totalResults: data.length,
    };
  } catch (error) {
    console.error('Error in searchCoffeeRoasters:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific roaster
 * @param params - Parameters containing the roaster ID
 * @param env - Environment variables
 * @returns Detailed roaster information
 */
export async function getRoasterDetails(
  params: any,
  env: Env
): Promise<any> {
  // Validate parameters against schema
  const validationResult = roasterDetailsSchema.safeParse(params);
  
  if (!validationResult.success) {
    throw new InvalidParamsError(validationResult.error.message);
  }
  
  const validParams = validationResult.data;
  
  try {
    const supabase = getSupabaseClient(env);
    
    // Get the roaster details
    const { data: roaster, error: roasterError } = await supabase
      .from('roasters')
      .select('*')
      .eq('id', validParams.roasterId)
      .eq('is_active', true)
      .single();
    
    if (roasterError) {
      console.error('Error fetching roaster details:', roasterError);
      throw new Error('Failed to fetch roaster details');
    }
    
    if (!roaster) {
      throw new InvalidParamsError('Roaster not found');
    }
    
    // Get the roaster's coffees
    const { data: coffees, error: coffeesError } = await supabase
      .from('coffees')
      .select(`
        id,
        coffee_name,
        roast_level,
        process_method,
        price,
        image_url,
        is_available
      `)
      .eq('roaster_id', validParams.roasterId)
      .eq('is_available', true)
      .order('coffee_name');
    
    if (coffeesError) {
      console.error('Error fetching roaster coffees:', coffeesError);
      throw new Error('Failed to fetch roaster coffees');
    }
    
    // Format the response
    return {
      id: roaster.id,
      name: roaster.roaster_name,
      location: {
        addressLine1: roaster.address_line1,
        addressLine2: roaster.address_line2,
        city: roaster.city,
        state: roaster.state,
        zip: roaster.zip,
        latitude: roaster.latitude,
        longitude: roaster.longitude,
      },
      foundedYear: roaster.founded_year,
      description: roaster.about_us,
      contact: {
        email: roaster.primary_contact_email,
        phone: roaster.phone_number,
      },
      socialMedia: {
        website: roaster.website_url,
        instagram: roaster.instagram_profile,
        x: roaster.x_profile,
        facebook: roaster.facebook_profile,
        tiktok: roaster.tiktok_profile,
        youtube: roaster.youtube_profile,
      },
      logoUrl: roaster.logo_url,
      isFeatured: roaster.is_featured,
      coffees: coffees.map((coffee) => ({
        id: coffee.id,
        name: coffee.coffee_name,
        roastLevel: coffee.roast_level,
        processMethod: coffee.process_method,
        price: coffee.price,
        imageUrl: coffee.image_url,
        isAvailable: coffee.is_available,
      })),
    };
  } catch (error) {
    console.error('Error in getRoasterDetails:', error);
    throw error;
  }
}

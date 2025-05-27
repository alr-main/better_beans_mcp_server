/**
 * Roaster Service
 * Handles operations related to coffee roasters
 */
import { z } from 'zod';
import { Env } from '../index.js';
import { InvalidParamsError } from './methodRouter.js';
import { secureQuery, secureReadSingle, UserRole, OperationType } from '../database/secureQuery.js';

/**
 * Schema for validating coffee roaster search parameters
 */
const RoasterSearchParamsSchema = z.object({
  query: z.string().min(1).max(200).optional(),
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
  query: z.string().optional().or(z.null()),
  location: z.string().optional().or(z.null()),
  maxResults: z.number().int().min(1).max(50).default(10),
  // New geospatial search parameters
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMiles: z.number().positive().default(60) // Default 60 mile radius
  }).optional(),
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
  console.error('🔍 searchCoffeeRoasters called with params:', JSON.stringify(params));
  
  try {
    // Validate parameters against schema
    const validationResult = searchRoastersSchema.safeParse(params);
    
    if (!validationResult.success) {
      throw new InvalidParamsError(validationResult.error.message);
    }
    
    const validParams = validationResult.data;
    console.error('✅ Validated params:', JSON.stringify(validParams));
    
    console.error('🔄 Using secure query pipeline');
    return await secureQuery(env, UserRole.ANONYMOUS, 'roasters', OperationType.READ, async (supabase) => {
      // Start building the query
      console.error('🔄 Building query to search for roasters');
      
      // Initialize select columns, adding geospatial calculations if needed
      let selectQuery = `
        id,
        roaster_name,
        city,
        state,
        latitude,
        longitude,
        founded_year,
        about_us,
        website_url,
        logo_url,
        is_featured
      `;
      
      // Add distance calculation if coordinates are provided
      if (validParams.coordinates) {
        const { latitude, longitude } = validParams.coordinates;
        selectQuery += `, (point(longitude, latitude) <@> point(${longitude}, ${latitude})) as distance_miles`;
      }
      
      // Start the query
      let query = supabase
        .from('roasters')
        .select(selectQuery)
        .eq('is_active', true);
    
    // Add text search if query parameter is provided
    if (validParams.query && validParams.query.trim() !== '') {
      console.error(`🔍 Filtering by query: '${validParams.query}'`);
      query = query.ilike('roaster_name', `%${validParams.query}%`);
    } else {
      console.error('🔍 No query filter provided, returning all roasters');
    }
    
    // Add location filter if provided
    if (validParams.location && validParams.location.trim() !== '') {
      console.error(`🔍 Filtering by location text: '${validParams.location}'`);
      query = query.or(`city.ilike.%${validParams.location}%,state.ilike.%${validParams.location}%`);
    }
    
    // Add geospatial search if coordinates are provided
    if (validParams.coordinates) {
      const { latitude, longitude, radiusMiles } = validParams.coordinates;
      console.error(`🔍 Filtering by coordinates: (${latitude}, ${longitude}) with radius ${radiusMiles} miles`);
      
      // Filter by radius - point operator <@> returns distance in miles
      // Using raw SQL in the filter with column names, operator, and value
      query = query.filter('distance_miles', 'lt', radiusMiles);
      
      // Order by distance (closest first) - when coordinates are provided
      query = query.order('distance_miles', { ascending: true });
    } else {
      // Default ordering by featured status when no coordinates are provided
      query = query.order('is_featured', { ascending: false });
    }
    
    // Apply result limit
    query = query.limit(validParams.maxResults);
    
    // Add specific filters if provided
    if (validParams.filters) {
      // These would connect to additional columns in the roasters table
      // For demonstration, assuming these are implemented as columns or related tables
    }
    
      // Execute the query
      console.error('🔄 Executing Supabase query...');
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error searching roasters:', error);
        throw new Error('Failed to search for roasters');
      }
      
      // Ensure data is an array
      const roasterData = Array.isArray(data) ? data : [];
      console.error(`🔍 Query returned ${roasterData.length} results:`, JSON.stringify(roasterData));
      
      // Format the response with type safety
      const formattedResponse = {
        roasters: roasterData.map((roaster: any) => {
          // Apply default values for safety
          return {
            id: roaster.id || '',
            name: roaster.roaster_name || 'Unknown Roaster',
            location: (roaster.city && roaster.state) ? `${roaster.city}, ${roaster.state}` : null,
            coordinates: (roaster.latitude && roaster.longitude) ? {
              latitude: Number(roaster.latitude),
              longitude: Number(roaster.longitude)
            } : null,
            foundedYear: roaster.founded_year || null,
            description: roaster.about_us || '',
            websiteUrl: roaster.website_url || '',
            logoUrl: roaster.logo_url || '',
            isFeatured: Boolean(roaster.is_featured),
            // Include distance if available (from geospatial search)
            distance: roaster.distance_miles ? parseFloat(roaster.distance_miles).toFixed(1) + ' miles' : null,
          };
        }),
        totalResults: roasterData.length,
      };
      
      console.error('✅ Returning formatted response:', JSON.stringify(formattedResponse));
      return formattedResponse;
    });
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
    // Get the roaster details using secure query pipeline
    const roaster = await secureReadSingle(
      env, 
      UserRole.ANONYMOUS, 
      'roasters', 
      '*',
      { 
        id: validParams.roasterId,
        is_active: true 
      }
    );
    
    if (!roaster) {
      throw new InvalidParamsError('Roaster not found');
    }
    
    // Get the roaster's coffees using secure query pipeline
    const coffees = await secureQuery(
      env,
      UserRole.ANONYMOUS,
      'coffees',
      OperationType.READ,
      async (supabase) => {
        const { data, error } = await supabase
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
          
        if (error) {
          console.error('Error fetching roaster coffees:', error);
          throw new Error('Failed to fetch roaster coffees');
        }
        
        return data;
      }
    );
    
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

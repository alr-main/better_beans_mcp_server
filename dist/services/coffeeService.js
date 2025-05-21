/**
 * Coffee Service
 * Handles operations related to coffee products
 */
import { z } from 'zod';
import { getSupabaseClient } from '../database/supabaseClient';
import { InvalidParamsError } from './methodRouter';
// Schema for search_coffee_products method parameters
const searchCoffeeProductsSchema = z.object({
    query: z.string().optional(),
    roasterId: z.string().uuid().optional(),
    maxResults: z.number().int().min(1).max(50).default(10),
    filters: z.object({
        processMethod: z.string().optional(),
        roastLevel: z.string().optional(),
        origin: z.array(z.string()).optional(),
        flavorProfile: z.array(z.string()).optional(),
        isCaffeinated: z.boolean().optional(),
    }).optional(),
});
// Schema for get_coffee_product_details method parameters
const coffeeDetailsSchema = z.object({
    productId: z.string().uuid(),
});
/**
 * Search for coffee products based on criteria
 * @param params - Search parameters
 * @param env - Environment variables
 * @returns Array of coffee product objects that match the search criteria
 */
export async function searchCoffeeProducts(params, env) {
    // Validate parameters against schema
    const validationResult = searchCoffeeProductsSchema.safeParse(params);
    if (!validationResult.success) {
        throw new InvalidParamsError(validationResult.error.message);
    }
    const validParams = validationResult.data;
    try {
        const supabase = getSupabaseClient(env);
        // Start building the query
        let query = supabase
            .from('coffees')
            .select(`
        id,
        coffee_name,
        roast_level,
        process_method,
        coffee_description,
        price,
        image_url,
        is_available,
        flavor_tags,
        origin,
        roasters(id, roaster_name)
      `)
            .eq('is_available', true)
            .limit(validParams.maxResults);
        // Add text search if query parameter is provided
        if (validParams.query) {
            query = query.or(`coffee_name.ilike.%${validParams.query}%,coffee_description.ilike.%${validParams.query}%`);
        }
        // Add roaster filter if provided
        if (validParams.roasterId) {
            query = query.eq('roaster_id', validParams.roasterId);
        }
        // Add specific filters if provided
        if (validParams.filters) {
            if (validParams.filters.processMethod) {
                query = query.eq('process_method', validParams.filters.processMethod);
            }
            if (validParams.filters.roastLevel) {
                query = query.eq('roast_level', validParams.filters.roastLevel);
            }
            if (validParams.filters.origin && validParams.filters.origin.length > 0) {
                // Filter by any matching origin in the array
                const originConditions = validParams.filters.origin.map(origin => `origin.cs.{${origin}}`).join(',');
                query = query.or(originConditions);
            }
            if (validParams.filters.flavorProfile && validParams.filters.flavorProfile.length > 0) {
                // Filter by any matching flavor tag in the array
                const flavorConditions = validParams.filters.flavorProfile.map(flavor => `flavor_tags.cs.{${flavor}}`).join(',');
                query = query.or(flavorConditions);
            }
            if (validParams.filters.isCaffeinated !== undefined) {
                query = query.eq('is_caffeinated', validParams.filters.isCaffeinated);
            }
        }
        // Execute the query
        const { data, error } = await query;
        if (error) {
            console.error('Error searching coffee products:', error);
            throw new Error('Failed to search for coffee products');
        }
        // Format the response
        return {
            coffees: data.map((coffee) => ({
                id: coffee.id,
                name: coffee.coffee_name,
                roastLevel: coffee.roast_level,
                processMethod: coffee.process_method,
                description: coffee.coffee_description,
                price: coffee.price,
                imageUrl: coffee.image_url,
                isAvailable: coffee.is_available,
                flavorTags: coffee.flavor_tags || [],
                origin: coffee.origin || [],
                roaster: {
                    id: coffee.roasters?.id,
                    name: coffee.roasters?.roaster_name,
                },
            })),
            totalResults: data.length,
        };
    }
    catch (error) {
        console.error('Error in searchCoffeeProducts:', error);
        throw error;
    }
}
/**
 * Get detailed information about a specific coffee product
 * @param params - Parameters containing the coffee product ID
 * @param env - Environment variables
 * @returns Detailed coffee product information
 */
export async function getCoffeeProductDetails(params, env) {
    // Validate parameters against schema
    const validationResult = coffeeDetailsSchema.safeParse(params);
    if (!validationResult.success) {
        throw new InvalidParamsError(validationResult.error.message);
    }
    const validParams = validationResult.data;
    try {
        const supabase = getSupabaseClient(env);
        // Get the coffee product details
        const { data: coffee, error } = await supabase
            .from('coffees')
            .select(`
        *,
        roasters(id, roaster_name, city, state, logo_url)
      `)
            .eq('id', validParams.productId)
            .eq('is_available', true)
            .single();
        if (error) {
            console.error('Error fetching coffee product details:', error);
            throw new Error('Failed to fetch coffee product details');
        }
        if (!coffee) {
            throw new InvalidParamsError('Coffee product not found');
        }
        // Format the response
        return {
            id: coffee.id,
            name: coffee.coffee_name,
            description: coffee.coffee_description,
            roastLevel: coffee.roast_level,
            processMethod: coffee.process_method,
            coffeeType: coffee.coffee_type,
            acidityLevel: coffee.acidity_level,
            isCaffeinated: coffee.is_caffeinated,
            price: coffee.price,
            bagSize: coffee.bag_size,
            imageUrl: coffee.image_url,
            productUrl: coffee.product_url,
            flavorTags: coffee.flavor_tags || [],
            certificationTypes: coffee.certification_types || [],
            origin: coffee.origin || [],
            beanVariety: coffee.bean_variety || [],
            grindOptions: coffee.grind_options || [],
            brewingMethods: coffee.brewing_methods || [],
            roaster: coffee.roasters ? {
                id: coffee.roasters.id,
                name: coffee.roasters.roaster_name,
                location: coffee.roasters.city && coffee.roasters.state ?
                    `${coffee.roasters.city}, ${coffee.roasters.state}` : null,
                logoUrl: coffee.roasters.logo_url,
            } : null,
        };
    }
    catch (error) {
        console.error('Error in getCoffeeProductDetails:', error);
        throw error;
    }
}

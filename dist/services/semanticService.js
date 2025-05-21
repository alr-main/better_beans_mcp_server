/**
 * Semantic Search Service
 * Handles vector-based similarity searches for coffee products
 */
import { z } from 'zod';
import { getSupabaseClient } from '../database/supabaseClient';
import { InvalidParamsError } from './methodRouter';
// Schema for similarity_search method parameters
const similaritySearchSchema = z.object({
    flavorProfile: z.array(z.string()).min(1),
    maxResults: z.number().int().min(1).max(50).default(10),
});
/**
 * Search for coffees with similar flavor profiles
 * @param params - Search parameters with flavor profile
 * @param env - Environment variables
 * @returns Array of similar coffee products
 */
export async function similaritySearch(params, env) {
    // Validate parameters against schema
    const validationResult = similaritySearchSchema.safeParse(params);
    if (!validationResult.success) {
        throw new InvalidParamsError(validationResult.error.message);
    }
    const validParams = validationResult.data;
    try {
        // For vector search, we need to:
        // 1. Check if we have vector embeddings stored for these flavor profiles
        // 2. If not, use tag-based search as a fallback
        // With pgvector in Supabase, we'd normally build a query like:
        // SELECT * FROM coffees 
        // ORDER BY flavor_embedding <-> (SELECT embedding FROM flavor_embeddings WHERE flavor_tag = 'chocolate')
        // LIMIT 10;
        // For now, we'll implement a tag-based search as a simpler alternative
        const supabase = getSupabaseClient(env);
        // Start the query
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
        flavor_tags,
        roasters(id, roaster_name)
      `)
            .eq('is_available', true)
            .limit(validParams.maxResults);
        // Build a condition to match any of the provided flavor tags
        const flavorConditions = validParams.flavorProfile.map(flavor => `flavor_tags.cs.{${flavor}}`);
        if (flavorConditions.length > 0) {
            query = query.or(flavorConditions.join(','));
        }
        // Execute the query
        const { data, error } = await query;
        if (error) {
            console.error('Error in similarity search:', error);
            throw new Error('Failed to perform similarity search');
        }
        // Calculate a simple similarity score based on matching tags
        const results = data.map(coffee => {
            const matchingTags = (coffee.flavor_tags || []).filter((tag) => validParams.flavorProfile.includes(tag));
            const similarityScore = matchingTags.length / validParams.flavorProfile.length;
            return {
                coffee: {
                    id: coffee.id,
                    name: coffee.coffee_name,
                    roastLevel: coffee.roast_level,
                    processMethod: coffee.process_method,
                    description: coffee.coffee_description,
                    price: coffee.price,
                    imageUrl: coffee.image_url,
                    flavorTags: coffee.flavor_tags || [],
                    roaster: {
                        id: coffee.roasters?.id,
                        name: coffee.roasters?.roaster_name,
                    },
                },
                similarityScore: similarityScore,
                matchingTags: matchingTags,
            };
        });
        // Sort by similarity score, highest first
        results.sort((a, b) => b.similarityScore - a.similarityScore);
        // Format the response
        return {
            query: {
                flavorProfile: validParams.flavorProfile,
            },
            results: results,
            totalResults: results.length,
        };
    }
    catch (error) {
        console.error('Error in similaritySearch:', error);
        throw error;
    }
}

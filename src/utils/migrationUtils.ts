/**
 * Migration Utilities
 * Handles database migrations and vector search optimizations
 * Modified for Cloudflare Workers environment (no filesystem access)
 */
import { getSupabaseClient } from '../database/supabaseClient.js';
import { Env } from '../index.js';

// Store the SQL migration content directly in the code for Cloudflare Workers
// Since we can't read from the filesystem in Workers environment
const VECTOR_SEARCH_SQL = `
-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create an index on the embedding column for faster similarity searches
-- This assumes a coffees table with a flavor_embedding column of type vector(384)
DO $$
BEGIN
    -- Check if the index already exists to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'coffees_flavor_embedding_idx'
        AND n.nspname = 'public'
    ) THEN
        -- Create HNSW index for fast approximate nearest neighbor search
        CREATE INDEX coffees_flavor_embedding_idx 
        ON coffees USING hnsw (flavor_embedding vector_cosine_ops);
    END IF;
END
$$;

-- Create a stored function for vector-based coffee search
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    match_offset int DEFAULT 0
) 
RETURNS TABLE (
    id uuid,
    name text,
    roast_level text,
    process_method text,
    description text,
    price decimal,
    image_url text,
    flavor_tags text[],
    roaster_details json,
    similarity float,
    distance float
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.coffee_name as name,
        c.roast_level,
        c.process_method,
        c.description,
        c.price,
        c.image_url,
        c.flavor_tags,
        json_build_object(
            'id', r.id,
            'name', r.name
        ) as roaster_details,
        -- Use your existing similarity score calculation
        1 - (c.flavor_embedding <=> query_embedding) AS similarity,
        -- Raw distance for debugging
        c.flavor_embedding <=> query_embedding as distance
    FROM 
        coffees c
    LEFT JOIN
        roasters r ON c.roaster_id = r.id
    WHERE
        c.flavor_embedding IS NOT NULL
        -- Use cosine distance threshold
        AND 1 - (c.flavor_embedding <=> query_embedding) > match_threshold
    ORDER BY
        similarity DESC
    LIMIT match_count
    OFFSET match_offset;
END;
$$;

-- Create a function to calculate the total count of matches
CREATE OR REPLACE FUNCTION count_coffee_by_flavor_vector(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5
) 
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    match_count bigint;
BEGIN
    SELECT COUNT(*) INTO match_count
    FROM coffees
    WHERE flavor_embedding IS NOT NULL
    AND 1 - (flavor_embedding <=> query_embedding) > match_threshold;
    
    RETURN match_count;
END;
$$;
`;

/**
 * Executes the vector search optimization SQL directly
 * 
 * @param env - Environment variables with database connection
 * @returns Result of the SQL execution
 */
async function executeVectorSearchSQL(env: Env): Promise<{ success: boolean; message: string }> {
  try {
    // Execute the SQL using Supabase
    const supabase = getSupabaseClient(env);
    
    // We'll use rpc to execute the SQL statements
    const { error } = await supabase.rpc('pg_execute', { sql: VECTOR_SEARCH_SQL });
    
    if (error) {
      console.error(`Vector search SQL execution failed:`, error);
      return {
        success: false,
        message: `Failed to optimize vector search: ${error.message}`
      };
    }
    
    return {
      success: true,
      message: `Successfully executed vector search optimizations.`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing vector search SQL:`, errorMessage);
    return {
      success: false,
      message: `Vector search optimization error: ${errorMessage}`
    };
  }
}

/**
 * Verifies if pgvector is installed and vector search functions are available
 * 
 * @param env - Environment variables with database connection
 * @returns Check result with status information
 */
export async function checkVectorSearchCapabilities(
  env: Env
): Promise<{ 
  pgvectorInstalled: boolean; 
  searchFunctionExists: boolean;
  countFunctionExists: boolean;
  vectorIndexExists: boolean;
}> {
  const supabase = getSupabaseClient(env);
  
  try {
    // Check if pgvector extension is installed
    const { data: extensionData, error: extensionError } = await supabase
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector')
      .single();
    
    const pgvectorInstalled = !extensionError && extensionData !== null;
    
    // Check if search function exists
    const { data: searchFunctionData, error: searchFunctionError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'search_coffee_by_flavor_vector')
      .single();
    
    const searchFunctionExists = !searchFunctionError && searchFunctionData !== null;
    
    // Check if count function exists
    const { data: countFunctionData, error: countFunctionError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'count_coffee_by_flavor_vector')
      .single();
    
    const countFunctionExists = !countFunctionError && countFunctionData !== null;
    
    // Check if vector index exists
    const { data: indexData, error: indexError } = await supabase
      .from('pg_class')
      .select('relname')
      .eq('relname', 'coffees_flavor_embedding_idx') // Updated to match our actual index name
      .single();
    
    const vectorIndexExists = !indexError && indexData !== null;
    
    return {
      pgvectorInstalled,
      searchFunctionExists,
      countFunctionExists,
      vectorIndexExists
    };
  } catch (error) {
    console.error('Error checking vector search capabilities:', error);
    return {
      pgvectorInstalled: false,
      searchFunctionExists: false,
      countFunctionExists: false,
      vectorIndexExists: false
    };
  }
}

/**
 * Optimizes vector search by ensuring all required database objects exist
 * 
 * @param env - Environment variables with database connection
 * @returns Result of the optimization process
 */
export async function optimizeVectorSearch(
  env: Env
): Promise<{ success: boolean; message: string }> {
  try {
    // Check current vector search capabilities
    const capabilities = await checkVectorSearchCapabilities(env);
    
    // If everything is already set up, we're good
    if (
      capabilities.pgvectorInstalled &&
      capabilities.searchFunctionExists && 
      capabilities.countFunctionExists &&
      capabilities.vectorIndexExists
    ) {
      return {
        success: true,
        message: 'Vector search is already optimized and ready to use.'
      };
    }
    
    // Execute the vector search SQL
    const sqlResult = await executeVectorSearchSQL(env);
    
    if (!sqlResult.success) {
      return sqlResult;
    }
    
    // Verify that the SQL execution was successful
    const updatedCapabilities = await checkVectorSearchCapabilities(env);
    
    if (
      !updatedCapabilities.pgvectorInstalled ||
      !updatedCapabilities.searchFunctionExists || 
      !updatedCapabilities.countFunctionExists
    ) {
      return {
        success: false,
        message: 'SQL executed but required vector search objects were not created.'
      };
    }
    
    // Success!
    return {
      success: true,
      message: 'Vector search has been successfully optimized.'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error optimizing vector search:', errorMessage);
    return {
      success: false,
      message: `Vector search optimization failed: ${errorMessage}`
    };
  }
}

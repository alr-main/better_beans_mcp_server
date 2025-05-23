/**
 * Vector Embedding Update Script
 * 
 * This script populates the flavor_embedding column in the coffees table
 * by generating vector embeddings for each coffee's flavor tags using OpenAI.
 * 
 * Run this script whenever new coffees are added or flavor tags are updated.
 * Also includes functionality to update the database schema for OpenAI embeddings.
 */
import { getSupabaseClient } from '../database/supabaseClient.js';
import { Env } from '../index.js';
import { SupabaseClient } from '@supabase/supabase-js';
// Cloudflare Workers don't have direct access to file system
// We'll use hardcoded SQL instead
import {
  getFlavorProfileEmbedding,
  generateFallbackEmbedding,
  OPENAI_EMBEDDING_DIMENSIONS
} from './openaiClient.js';

// Vector dimension for the flavor embeddings (OpenAI uses 1536 dimensions)
const VECTOR_DIMENSIONS = OPENAI_EMBEDDING_DIMENSIONS;

/**
 * Gets a vector embedding for a set of flavor tags
 * Uses OpenAI embedding API for semantic understanding
 * Falls back to a simpler approach if OpenAI API is unavailable
 */
async function getEmbeddingForFlavor(flavorTags: string[], env: Env): Promise<number[]> {
  try {
    // Use OpenAI's embedding API if key is available
    if (env.OPENAI_API_KEY) {
      console.log(`Using OpenAI embedding API for ${flavorTags.join(', ')}`);
      return await getFlavorProfileEmbedding(flavorTags, env);
    } else {
      console.log(`No OpenAI API key, using fallback embedding for ${flavorTags.join(', ')}`);
      return generateFallbackEmbedding(flavorTags);
    }
  } catch (error) {
    console.error('Error getting OpenAI embedding:', error);
    console.log('Falling back to simplified embedding method');
    return generateFallbackEmbedding(flavorTags);
  }
}

/**
 * Updates flavor embeddings for all coffees in the database using OpenAI
 */
/**
 * Update the vector embedding for a single coffee product
 * 
 * @param coffee The coffee object with ID and flavor tags
 * @param env Environment variables
 * @param supabase Supabase client instance
 * @returns Object with success status and message
 */
async function updateCoffeeEmbedding(
  coffee: { id: string; flavor_tags: string[] },
  env: Env,
  supabase: SupabaseClient
): Promise<{ success: boolean; message: string }> {
  // Skip coffees without flavor tags
  if (!coffee.flavor_tags || !Array.isArray(coffee.flavor_tags) || coffee.flavor_tags.length === 0) {
    return {
      success: false,
      message: `Skipping coffee ${coffee.id} - no flavor tags available`
    };
  }
  
  try {
    // Generate embedding for this coffee's flavor tags using OpenAI
    console.log(`Generating embedding for coffee ${coffee.id} with tags: ${coffee.flavor_tags.join(', ')}`);
    const embedding = await getFlavorProfileEmbedding(coffee.flavor_tags, env);
    
    if (!embedding || embedding.length === 0) {
      const errorMsg = `Empty embedding generated for coffee ${coffee.id}`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
    
    // Ensure we have exactly 1536 dimensions as required by our database schema
    if (embedding.length !== VECTOR_DIMENSIONS) {
      const errorMsg = `Vector dimension mismatch: got ${embedding.length}, expected ${VECTOR_DIMENSIONS}`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    // Convert the embedding to a PostgreSQL-compatible format using the exact approach from the Python script
    // Explicitly cast each value to float before joining
    const embeddingStr = `[${embedding.map(x => parseFloat(String(x))).join(',')}]`;
    console.log(`Formatted embedding for coffee ${coffee.id} (${embedding.length} dimensions)`);
    
    // Use the dedicated RPC function for updating embeddings
    console.log(`Calling RPC function to update embedding for coffee ${coffee.id}...`);
    const { data: result, error: updateError } = await supabase.rpc(
      'update_coffee_flavor_vector',
      {
        p_coffee_id: coffee.id,
        p_embedding: embeddingStr
      }
    );
    
    if (updateError) {
      const errorMsg = `RPC error updating embedding for coffee ${coffee.id}: ${updateError.message}`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    // Check the result from the RPC function (should be boolean)
    if (result !== true) {
      const errorMsg = `RPC function failed to update embedding for coffee ${coffee.id}`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    const successMsg = `Successfully updated embedding for coffee ${coffee.id}`;
    console.log(successMsg);
    return { success: true, message: successMsg };
  } catch (error) {
    const errorMsg = `Error updating embedding for coffee ${coffee.id}: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Update embeddings for all coffees in the database
 * @param env Environment variables containing API keys
 * @returns Object with count of updated and failed coffees and optional log messages
 */
export async function updateCoffeeEmbeddings(env: Env): Promise<{ updated: number; failed: number; logs?: string[] }> {
  // Create Supabase client
  const supabase = getSupabaseClient(env);
  const logs: string[] = []; // Array to store log messages
  
  try {
    // First, apply the migration to update vector dimensions
    const migrationSuccess = await applyVectorDimensionMigration(env);
    logs.push(`[${new Date().toISOString()}] Migration success: ${migrationSuccess}`);
    
    if (!migrationSuccess) {
      const msg = 'Migration failed, proceeding with caution';
      console.error(msg);
      logs.push(`[${new Date().toISOString()}] ${msg}`);
    }
    
    // Get all coffees that have flavor tags
    const { data: coffees, error } = await supabase
      .from('coffees')
      .select('id, flavor_tags')
      .not('flavor_tags', 'is', null);
    
    if (error) {
      const errorMsg = `Error fetching coffees: ${error.message}`;
      console.error(errorMsg);
      logs.push(`[${new Date().toISOString()}] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    if (!coffees || coffees.length === 0) {
      const msg = 'No coffees found with flavor tags';
      console.log(msg);
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      return { updated: 0, failed: 0, logs };
    }
    
    const statusMsg = `Found ${coffees.length} coffees with flavor tags to update`;
    console.log(statusMsg);
    logs.push(`[${new Date().toISOString()}] ${statusMsg}`);
    
    // Track success/failure counts
    let updated = 0;
    let failed = 0;
    
    // Process each coffee with rate limiting
    // Only process a limited batch at a time to avoid overwhelming the worker
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES_MS = 1000;
    const DELAY_BETWEEN_REQUESTS_MS = 200;
    
    // Helper function to wait/sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Process in batches
    for (let i = 0; i < coffees.length; i += BATCH_SIZE) {
      const batchMsg = `Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(coffees.length/BATCH_SIZE)}`;
      console.log(batchMsg);
      logs.push(`[${new Date().toISOString()}] ${batchMsg}`);
      
      const batch = coffees.slice(i, i + BATCH_SIZE);
      
      // Process each coffee in the current batch
      for (const coffee of batch) {
        try {
          // Call the enhanced updateCoffeeEmbedding function that returns {success, message}
          const result = await updateCoffeeEmbedding(coffee, env, supabase);
          logs.push(`[${new Date().toISOString()}] Coffee ${coffee.id}: ${result.message}`);
          
          if (result.success) {
            updated++;
          } else {
            failed++;
          }
          
          // Add a small delay between individual requests
          await sleep(DELAY_BETWEEN_REQUESTS_MS);
        } catch (error) {
          const errorMsg = `Unexpected error processing coffee ${coffee.id}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          logs.push(`[${new Date().toISOString()}] ${errorMsg}`);
          failed++;
        }
      }
      
      // Add a delay between batches to avoid overwhelming the worker
      if (i + BATCH_SIZE < coffees.length) {
        const delayMsg = `Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before processing next batch`;
        console.log(delayMsg);
        logs.push(`[${new Date().toISOString()}] ${delayMsg}`);
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }
    
    const completionMsg = `Vector embedding update complete: ${updated} updated, ${failed} failed`;
    console.log(completionMsg);
    logs.push(`[${new Date().toISOString()}] ${completionMsg}`);
    
    return { updated, failed, logs };
  } catch (error) {
    const errorMsg = `Failed to complete vector embedding update: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    logs.push(`[${new Date().toISOString()}] ${errorMsg}`);
    return { updated: 0, failed: 0, logs };
  }
}

/**
 * Check if the flavor_embedding column exists in the coffees table
 * If not, creates it
 */
export async function ensureFlavorEmbeddingColumn(env: Env): Promise<boolean> {
  try {
    const supabase = getSupabaseClient(env);
    
    // Use system schema to check if column exists
    const { data, error } = await supabase.rpc('check_column_exists', {
      table_name: 'coffees',
      column_name: 'flavor_embedding'
    });
    
    if (error) {
      console.error('Error checking for column:', error);
      
      // If the RPC function doesn't exist, create it first
      await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE OR REPLACE FUNCTION check_column_exists(table_name text, column_name text)
          RETURNS boolean
          LANGUAGE plpgsql
          AS $$
          DECLARE
            column_exists boolean;
          BEGIN
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = 'public'
                AND table_name = check_column_exists.table_name
                AND column_name = check_column_exists.column_name
            ) INTO column_exists;
            
            RETURN column_exists;
          END;
          $$;
        `
      });
      
      // Try again after creating the function
      const { data: retryData, error: retryError } = await supabase.rpc('check_column_exists', {
        table_name: 'coffees',
        column_name: 'flavor_embedding'
      });
      
      if (retryError || !retryData) {
        console.error('Error on retry check for column:', retryError);
        return false;
      }
      
      if (!retryData) {
        // Column doesn't exist, create it
        await createFlavorEmbeddingColumn(supabase);
        return true;
      }
      
      return !!retryData;
    }
    
    if (!data) {
      // Column doesn't exist, create it
      await createFlavorEmbeddingColumn(supabase);
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('Error in ensureFlavorEmbeddingColumn:', error);
    return false;
  }
}

/**
 * Creates the flavor_embedding column in the coffees table with OpenAI dimensions
 */
async function createFlavorEmbeddingColumn(supabase: any): Promise<void> {
  try {
    // First, enable the vector extension
    await supabase.rpc('exec_sql', {
      sql_query: 'CREATE EXTENSION IF NOT EXISTS vector;'
    });
    
    // Then add the column with OpenAI dimensions
    await supabase.rpc('exec_sql', {
      sql_query: `ALTER TABLE coffees ADD COLUMN IF NOT EXISTS flavor_embedding vector(${VECTOR_DIMENSIONS});`
    });
    
    // Create an index for faster similarity searches
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE INDEX IF NOT EXISTS coffees_flavor_embedding_idx 
        ON coffees USING hnsw (flavor_embedding vector_cosine_ops);
      `
    });
    
    console.log(`Successfully created flavor_embedding column with ${VECTOR_DIMENSIONS} dimensions and index`);
  } catch (error) {
    console.error('Error creating flavor_embedding column:', error);
    throw error;
  }
}

/**
 * Apply the SQL migration to update vector dimensions for OpenAI embeddings
 */
export async function applyVectorDimensionMigration(env: Env): Promise<boolean> {
console.log('Starting vector dimension migration...');
const supabase = getSupabaseClient(env);

try {
  // Use hardcoded SQL for Cloudflare Workers environment
  // Workers don't have access to the file system
  const sql = `
    -- Ensure pgvector extension is enabled
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Drop the existing index if it exists
    DROP INDEX IF EXISTS coffees_flavor_embedding_idx;
    
    -- Alter the flavor_embedding column to use OpenAI dimensions
    ALTER TABLE coffees ALTER COLUMN flavor_embedding TYPE vector(${VECTOR_DIMENSIONS}) USING NULL;
    
    -- Recreate the index
    CREATE INDEX coffees_flavor_embedding_idx ON coffees USING hnsw (flavor_embedding vector_cosine_ops);
    
    -- Create a function to update coffee embeddings via RPC
    CREATE OR REPLACE FUNCTION update_coffee_embedding(
      coffee_id uuid,
      embedding vector(${VECTOR_DIMENSIONS})
    )
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE coffees
      SET 
        flavor_embedding = embedding,
        updated_at = NOW()
      WHERE id = coffee_id;
    END;
    $$;
    
    -- Update stored procedures
    CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
      query_embedding vector(${VECTOR_DIMENSIONS}),
      match_threshold float DEFAULT 0.3,
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
        1 - (c.flavor_embedding <=> query_embedding) AS similarity,
        c.flavor_embedding <=> query_embedding as distance
      FROM 
        coffees c
      LEFT JOIN
        roasters r ON c.roaster_id = r.id
      WHERE
        c.flavor_embedding IS NOT NULL
        AND 1 - (c.flavor_embedding <=> query_embedding) > match_threshold
      ORDER BY
        similarity DESC
      LIMIT match_count
      OFFSET match_offset;
    END;
    $$;
    
    CREATE OR REPLACE FUNCTION count_coffee_by_flavor_vector(
      query_embedding vector(${VECTOR_DIMENSIONS}),
      match_threshold float DEFAULT 0.3
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

  // Execute the SQL migration with more detailed logging
  console.log('Executing SQL migration...');

  // First check if exec_sql function exists
  try {
    const { data, error: checkError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'exec_sql')
      .limit(1);

    if (checkError) {
      console.log('Could not check for exec_sql function:', checkError);
    } else {
      console.log('exec_sql function exists:', !!data && data.length > 0);
    }
  } catch (checkErr) {
    console.log('Error checking for exec_sql function:', checkErr);
  }

  // Execute the migration
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: sql
  });

  if (error) {
    console.error('Migration error:', error);

    // Try alternate approach with raw queries if RPC fails
    console.log('Attempting migration with raw queries...');
    try {
      // Just try to create the update_coffee_embedding function directly
      const updateFnSql = `
        CREATE OR REPLACE FUNCTION update_coffee_embedding(
          coffee_id uuid,
          embedding vector(${VECTOR_DIMENSIONS})
        )
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
          UPDATE coffees
          SET 
            flavor_embedding = embedding,
            updated_at = NOW()
          WHERE id = coffee_id;
        END;
        $$;
      `;

      const { error: rawError } = await supabase.rpc('exec_sql', {
        sql_query: updateFnSql
      });

      if (rawError) {
        console.error('Raw migration error:', rawError);
        return false;
      } else {
        console.log('Function creation successful with raw query');
        return true;
      }
    } catch (rawErr) {
      console.error('Error with raw migration:', rawErr);
      return false;
    }
  }

  console.log('Vector dimension migration completed successfully');
  return true;
} catch (error) {
  console.error('Error applying vector dimension migration:', error);
  return false;
}
}

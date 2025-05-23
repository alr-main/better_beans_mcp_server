/**
 * Migration and Embeddings Update Script
 * 
 * This script:
 * 1. Applies the SQL migration to update vector dimensions
 * 2. Updates all coffee records with OpenAI embeddings
 * 
 * Usage: npx tsx src/scripts/applyMigrationAndUpdateEmbeddings.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { getFlavorProfileEmbedding, generateFallbackEmbedding } from '../vector/openaiClient.js';
import { Env } from '../index.js';

// Load environment variables
dotenv.config();

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing required environment variables (SUPABASE_URL, SUPABASE_KEY)');
  process.exit(1);
}

if (!openaiApiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. Will use fallback embedding method.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Environment object matching the worker Env interface
const env: Env = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_KEY: supabaseKey,
  WORKER_ENV: 'development' as 'development' | 'staging' | 'production',
  API_KEYS_SALT: process.env.API_KEYS_SALT || 'Teadog',
  OPENAI_API_KEY: openaiApiKey
};

/**
 * Apply SQL migration to update vector dimensions
 */
async function applyMigration(): Promise<boolean> {
  try {
    console.log('Starting migration to update vector dimensions...');
    
    // Read the migration SQL file
    const migrationPath = path.resolve('./src/database/migrations/02_update_vector_dimensions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL using Supabase's REST API
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: sql
    });
    
    if (error) {
      console.error('Error applying migration:', error);
      throw error;
    }
    
    console.log('Migration applied successfully!');
    return true;
  } catch (error) {
    console.error('Failed to apply migration:', error);
    return false;
  }
}

/**
 * Update all coffee records with OpenAI embeddings
 */
async function updateCoffeeEmbeddings(): Promise<{ success: number; failed: number }> {
  try {
    console.log('Starting update of coffee embeddings...');
    
    // Get all coffees with flavor tags
    const { data: coffees, error } = await supabase
      .from('coffees')
      .select('id, flavor_tags')
      .not('flavor_tags', 'is', null);
    
    if (error) {
      console.error('Error fetching coffees:', error);
      throw error;
    }
    
    if (!coffees) {
      console.error('No coffees returned from query');
      return { success: 0, failed: 0 };
    }
    
    console.log(`Found ${coffees.length} coffees to update with embeddings`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each coffee
    for (const coffee of coffees) {
      try {
        // Skip coffees with no flavor tags
        if (!coffee.flavor_tags || coffee.flavor_tags.length === 0) {
          console.log(`Skipping coffee ${coffee.id} - no flavor tags`);
          continue;
        }
        
        console.log(`Processing coffee ${coffee.id} with tags: ${coffee.flavor_tags.join(', ')}`);
        
        // Generate embedding using OpenAI or fallback
        let embedding;
        try {
          if (openaiApiKey) {
            embedding = await getFlavorProfileEmbedding(coffee.flavor_tags, env);
            console.log(`Generated OpenAI embedding for coffee ${coffee.id}`);
          } else {
            embedding = generateFallbackEmbedding(coffee.flavor_tags);
            console.log(`Generated fallback embedding for coffee ${coffee.id}`);
          }
        } catch (embeddingError) {
          console.error(`Error generating embedding for coffee ${coffee.id}:`, embeddingError);
          embedding = generateFallbackEmbedding(coffee.flavor_tags);
          console.log(`Used fallback embedding for coffee ${coffee.id} after error`);
        }
        
        // Update the coffee record with the new embedding
        const { error: updateError } = await supabase
          .from('coffees')
          .update({ 
            flavor_embedding: embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', coffee.id);
        
        if (updateError) {
          console.error(`Error updating coffee ${coffee.id}:`, updateError);
          failureCount++;
        } else {
          console.log(`Successfully updated embedding for coffee ${coffee.id}`);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (coffeeError) {
        console.error(`Error processing coffee ${coffee.id}:`, coffeeError);
        failureCount++;
      }
    }
    
    console.log(`Embedding update complete!`);
    console.log(`Success: ${successCount} coffees`);
    console.log(`Failed: ${failureCount} coffees`);
    
    return {
      success: successCount,
      failed: failureCount
    };
  } catch (error) {
    console.error('Failed to update coffee embeddings:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Step 1: Apply the migration
    const migrationSuccess = await applyMigration();
    if (!migrationSuccess) {
      console.error('Migration failed, aborting embedding update');
      process.exit(1);
    }
    
    // Step 2: Update all coffee embeddings
    await updateCoffeeEmbeddings();
    
    console.log('All tasks completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the main function
main();

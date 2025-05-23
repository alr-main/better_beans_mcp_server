// Test script to verify direct Supabase querying
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Simplified version of getFlavorEmbedding from semanticService.ts
async function getFlavorEmbedding(flavorProfile) {
  try {
    // Convert the flavor profile array to a string for embedding
    const flavorText = flavorProfile.join(', ');
    console.log(`Generating embedding for flavor profile: ${flavorText}`);
    
    // Use OpenAI to generate the embedding
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: flavorText
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// The exact query flow from our actual server
async function testRealDatabaseQuery() {
  console.log('\n===== TESTING DIRECT DATABASE QUERY =====');
  
  try {
    // Use the exact same flavor profile
    const flavorProfile = ['chocolate', 'dark chocolate', 'cocoa'];
    console.log(`Testing with flavor profile: ${flavorProfile.join(', ')}`);
    
    // Generate embedding
    const embedding = await getFlavorEmbedding(flavorProfile);
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Set threshold and parameters
    const threshold = 0.01; // Very low threshold to ensure results
    const maxResults = 10;
    
    console.log(`Using threshold: ${threshold}`);
    
    // Make the exact same RPC call as in our code
    const { data, error } = await supabase.rpc('search_coffee_by_flavor_vector', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: threshold,
      match_count: maxResults,
      match_offset: 0
    });
    
    if (error) {
      console.error('Error in database query:', error);
      return;
    }
    
    console.log(`Database returned ${data ? data.length : 0} results`);
    
    if (data && data.length > 0) {
      // Display some results
      data.slice(0, 3).forEach((coffee, i) => {
        console.log(`\nResult ${i + 1}:`);
        console.log(`- Name: ${coffee.name}`);
        console.log(`- Similarity: ${coffee.similarity}`);
        console.log(`- Flavor tags: ${Array.isArray(coffee.flavor_tags) ? coffee.flavor_tags.join(', ') : 'None'}`);
        console.log(`- Product URL: ${coffee.product_url || 'None'}`);
        console.log(`- Roaster: ${coffee.roaster_name || 'Unknown'}`);
      });
    } else {
      console.log('No results from database - we need to diagnose why!');
      
      // Last resort - just fetch ANY coffees to verify we can connect to database
      const { data: anyCoffees, error: anyError } = await supabase
        .from('coffees')
        .select(`
          id,
          coffee_name,
          roaster_id,
          flavor_tags,
          product_url
        `)
        .limit(3);
      
      if (anyError) {
        console.error('Error fetching any coffees:', anyError);
      } else {
        console.log(`\nVerification: Database has ${anyCoffees ? anyCoffees.length : 0} coffees total`);
        if (anyCoffees && anyCoffees.length > 0) {
          anyCoffees.forEach((coffee, i) => {
            console.log(`- ${coffee.coffee_name} (${Array.isArray(coffee.flavor_tags) ? coffee.flavor_tags.join(', ') : 'No tags'})`);
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Execute the test
testRealDatabaseQuery();

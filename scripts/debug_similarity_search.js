// Debug script for similarity search
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test vectors with different flavor profiles
const testProfiles = [
  ['chocolate', 'dark chocolate', 'cocoa'], // Exact profile from Claude
  ['fruity', 'smokey', 'light roast'],
  ['fruity', 'chocolatey'],
  ['nutty', 'caramel'],
  ['chocolate'] // Single chocolate flavor
];

async function getEmbedding(flavorTags) {
  const flavorText = flavorTags.join(', ');
  console.log(`Generating embedding for: ${flavorText}`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
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
    return null;
  }
}

async function testVectorSearch(flavorProfile) {
  console.log(`\n===== Testing vector search for: ${flavorProfile.join(', ')} =====`);
  
  try {
    // Get embedding for flavor profile
    const embedding = await getEmbedding(flavorProfile);
    if (!embedding) {
      console.error('Failed to generate embedding');
      return;
    }
    
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Try with different thresholds
    const thresholds = [0.3, 0.15, 0.05, 0.01];
    
    for (const threshold of thresholds) {
      console.log(`\nTrying with threshold: ${threshold}`);
      
      // Call the search function directly
      const { data, error } = await supabase.rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: threshold,
        match_count: 10,
        match_offset: 0
      });
      
      if (error) {
        console.error('Error executing vector search:', error);
        continue;
      }
      
      console.log(`Results found: ${data ? data.length : 0}`);
      
      if (data && data.length > 0) {
        // Show the first 3 results
        data.slice(0, 3).forEach((result, i) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`- Name: ${result.name}`);
          console.log(`- Similarity: ${result.similarity.toFixed(4)}`);
          console.log(`- Distance: ${result.distance.toFixed(4)}`);
          console.log(`- Flavor tags: ${result.flavor_tags ? result.flavor_tags.join(', ') : 'None'}`);
          console.log(`- Roast level: ${result.roast_level || 'Unknown'}`);
          console.log(`- Product URL: ${result.product_url || 'None'}`);
        });
        
        // No need to try lower thresholds if we found results
        break;
      }
    }
    
    // If no results with vector search, try text search
    if (thresholds.every(async (threshold) => {
      const { data } = await supabase.rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: threshold,
        match_count: 10
      });
      return !data || data.length === 0;
    })) {
      console.log('\nTrying text search as fallback...');
      
      const searchQuery = flavorProfile.join(' ');
      const { data, error } = await supabase
        .from('coffees')
        .select(`
          id,
          coffee_name,
          roast_level,
          flavor_tags,
          product_url
        `)
        .or(`description.ilike.%${searchQuery}%, coffee_name.ilike.%${searchQuery}%`)
        .limit(5);
      
      if (error) {
        console.error('Error executing text search:', error);
      } else {
        console.log(`Text search results: ${data ? data.length : 0}`);
        
        if (data && data.length > 0) {
          data.forEach((result, i) => {
            console.log(`\nText Result ${i + 1}:`);
            console.log(`- Name: ${result.coffee_name}`);
            console.log(`- Flavor tags: ${result.flavor_tags ? result.flavor_tags.join(', ') : 'None'}`);
            console.log(`- Roast level: ${result.roast_level || 'Unknown'}`);
            console.log(`- Product URL: ${result.product_url || 'None'}`);
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run tests for each flavor profile
async function runTests() {
  // First, check if vector function exists and has the correct signature
  try {
    console.log('Checking for vector search function...');
    
    const { data, error } = await supabase
      .from('pg_proc')
      .select('*')
      .eq('proname', 'search_coffee_by_flavor_vector')
      .limit(1);
    
    if (error) {
      console.error('Error checking function:', error);
    } else if (!data || data.length === 0) {
      console.error('Vector search function not found in database!');
    } else {
      console.log('Vector search function exists in database');
    }
  } catch (functionError) {
    console.error('Error checking function:', functionError);
  }
  
  // Run the actual tests
  for (const profile of testProfiles) {
    await testVectorSearch(profile);
  }
}

runTests().catch(console.error);

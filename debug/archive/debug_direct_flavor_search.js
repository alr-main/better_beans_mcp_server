import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple vector filled with 0.1 values
const testEmbedding = new Array(1536).fill(0.1);

// Direct test of the vector search function
async function testVectorSearch() {
  console.log('Testing vector search function directly...');
  
  const { data, error } = await supabase
    .rpc('search_coffee_by_flavor_vector', {
      query_embedding: `[${testEmbedding.join(',')}]`, 
      match_threshold: 0.0001,  // Very low threshold to match almost anything
      match_count: 10,
      match_offset: 0
    });
    
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log(`Found ${data?.length || 0} results`);
    if (data && data.length > 0) {
      console.log('First result:', {
        name: data[0].name,
        similarity: data[0].similarity,
        distance: data[0].distance
      });
    }
  }
}

// Test different approach: direct SQL query
async function testDirectQuery() {
  console.log('\nTesting with direct SQL query...');
  
  const { data, error } = await supabase
    .from('coffees')
    .select(`
      id, 
      coffee_name,
      flavor_tags
    `)
    .limit(3);
    
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log(`Found ${data?.length || 0} coffees directly`);
    console.log('Sample coffee:', data?.[0]);
  }
}

// Run the tests
async function runTests() {
  await testVectorSearch();
  await testDirectQuery();
}

runTests();

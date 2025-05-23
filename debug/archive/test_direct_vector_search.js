// Direct test of vector search function
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

console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`API Key: ${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}`);

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple vector filled with 0.1 values
const testEmbedding = new Array(1536).fill(0.1);

// Direct test of the vector search function
async function testVectorSearch() {
  console.log('\n1️⃣ Testing vector search function directly...');
  
  try {
    const { data, error } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${testEmbedding.join(',')}]`, 
        match_threshold: 0.0001,  // Very low threshold to match almost anything
        match_count: 10,
        match_offset: 0
      });
      
    if (error) {
      console.error('❌ ERROR in vector search:', error);
      console.error('   Message:', error.message);
      if (error.details) console.error('   Details:', error.details);
      if (error.hint) console.error('   Hint:', error.hint);
    } else {
      console.log(`✅ Found ${data?.length || 0} results`);
      if (data && data.length > 0) {
        console.log('   First result:', {
          name: data[0].name,
          similarity: data[0].similarity,
          distance: data[0].distance
        });
      } else {
        console.log('   No results returned from vector search');
      }
    }
  } catch (e) {
    console.error('❌ EXCEPTION in vector search:', e);
  }
}

// Test with explicit parameters to check signature
async function testFunctionSignature() {
  console.log('\n2️⃣ Testing function signature with explicit parameters...');
  
  try {
    const { data, error } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${testEmbedding.join(',')}]`, 
        match_threshold: 0.0001,
        match_count: 10,
        match_offset: 0,
        vector_weight: 0.8,
        featured_weight: 0.2
      });
      
    if (error) {
      console.error('❌ ERROR in signature test:', error);
      console.error('   Message:', error.message);
      if (error.details) console.error('   Details:', error.details);
      if (error.hint) console.error('   Hint:', error.hint);
    } else {
      console.log(`✅ Found ${data?.length || 0} results with explicit parameters`);
    }
  } catch (e) {
    console.error('❌ EXCEPTION in signature test:', e);
  }
}

// Test if coffee embeddings exist
async function testCoffeeEmbeddings() {
  console.log('\n3️⃣ Checking if coffees have embeddings...');
  
  try {
    const { count, error } = await supabase
      .from('coffees')
      .select('*', { count: 'exact', head: true })
      .not('flavor_embedding', 'is', null);
      
    if (error) {
      console.error('❌ ERROR checking embeddings:', error);
    } else {
      console.log(`✅ Found ${count || 0} coffees with embeddings`);
      
      // Get total count for comparison
      const { count: totalCount } = await supabase
        .from('coffees')
        .select('*', { count: 'exact', head: true });
        
      console.log(`   Total coffees: ${totalCount || 0}`);
      console.log(`   Percentage with embeddings: ${totalCount ? (count / totalCount * 100).toFixed(1) : 0}%`);
    }
  } catch (e) {
    console.error('❌ EXCEPTION checking embeddings:', e);
  }
}

// Test direct SQL query to check database access
async function testDirectQuery() {
  console.log('\n4️⃣ Testing with direct SQL query...');
  
  try {
    const { data, error } = await supabase
      .from('coffees')
      .select(`
        id, 
        coffee_name,
        flavor_tags
      `)
      .limit(3);
      
    if (error) {
      console.error('❌ ERROR in direct query:', error);
    } else {
      console.log(`✅ Found ${data?.length || 0} coffees directly`);
      if (data && data.length > 0) {
        console.log('   Sample coffee:');
        console.log(`   - ID: ${data[0].id}`);
        console.log(`   - Name: ${data[0].coffee_name}`);
        console.log(`   - Flavor Tags: ${JSON.stringify(data[0].flavor_tags)}`);
      }
    }
  } catch (e) {
    console.error('❌ EXCEPTION in direct query:', e);
  }
}

// Run all tests sequentially
async function runAllTests() {
  try {
    await testDirectQuery();
    await testCoffeeEmbeddings();
    await testVectorSearch();
    await testFunctionSignature();
    
    console.log('\n✨ All tests completed');
  } catch (e) {
    console.error('❌ Test execution failed:', e);
  }
}

runAllTests();

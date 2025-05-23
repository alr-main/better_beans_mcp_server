/**
 * Check Mohammed Aba Nura coffee embedding
 * This script verifies if the Mohammed Aba Nura coffee has a properly generated embedding
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Mohammed Aba Nura coffee ID
const MOHAMMED_COFFEE_ID = 'a6541c34-5ec5-4d25-9fdc-aa69d70bbe26';

// Test both the specific coffee and create a new embedding for the flavor profile
async function checkMohammedEmbedding() {
  console.log('=====================================================');
  console.log('🔍 Checking Mohammed Aba Nura coffee embedding');
  console.log('=====================================================');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Check if the coffee exists and get its data
    console.log(`🔎 Fetching coffee with ID: ${MOHAMMED_COFFEE_ID}`);
    const { data: coffee, error: coffeeError } = await supabase
      .from('coffees')
      .select('*')
      .eq('id', MOHAMMED_COFFEE_ID)
      .single();
    
    if (coffeeError) {
      console.error('❌ Error fetching coffee:', coffeeError);
      return;
    }
    
    if (!coffee) {
      console.error('❌ Coffee not found');
      return;
    }
    
    console.log(`✅ Found coffee: ${coffee.coffee_name}`);
    console.log(`📝 Flavor tags: ${JSON.stringify(coffee.flavor_tags)}`);
    
    // 2. Check if the embedding exists and if it has data
    console.log('\n📊 EMBEDDING STATUS:');
    console.log('-----------------------------------------------------');
    const { data: embedRow, error: embedRowError } = await supabase
      .from('coffees')
      .select('id, coffee_name, flavor_embedding')
      .eq('id', MOHAMMED_COFFEE_ID)
      .single();
      
    if (embedRowError) {
      console.error('❌ Error fetching embedding row:', embedRowError);
      return;
    }
    
    // Check if embedding exists in the row
    const hasEmbedding = embedRow && embedRow.flavor_embedding !== null;
    console.log(`Embedding exists: ${hasEmbedding ? '✅ YES' : '❌ NO'}`);
    
    // Get the raw embedding from our custom function
    const { data: embedding, error: embeddingError } = await supabase
      .rpc('get_coffee_embedding', { p_coffee_id: MOHAMMED_COFFEE_ID });
    
    if (embeddingError) {
      console.error('❌ Error fetching embedding data:', embeddingError);
    } else if (embedding) {
      console.log(`Embedding dimensions: ${embedding.length}`);
      
      // Check if the embedding has any non-zero values
      const nonZeroCount = embedding.filter(val => val !== 0).length;
      console.log(`Non-zero values: ${nonZeroCount} (${(nonZeroCount / embedding.length * 100).toFixed(2)}%)`);
      
      if (nonZeroCount === 0) {
        console.log('⚠️ WARNING: Embedding consists of all zeros');
      }
    }
    
    // 3. Test the newly created embedding function with the Mohammed coffee tags
    console.log('\n📊 TESTING EMBEDDING FUNCTION:');
    console.log('-----------------------------------------------------');
    
    // Test the embedding similarity between Mohammed Aba Nura and the search tags
    const { data: testResults, error: testError } = await supabase
      .rpc('test_embedding_similarity', {
        p_coffee_id: MOHAMMED_COFFEE_ID,
        p_search_tags: ['berry', 'fruit', 'clean']
      });
      
    if (testError) {
      console.error('❌ Error testing embedding similarity:', testError.message);
    } else {
      console.log('✅ Embedding similarity test results:');
      console.log(JSON.stringify(testResults, null, 2));
    }
    
    // 4. Try vector search with the new embedding function
    console.log('\n📊 VECTOR SEARCH RESULTS WITH NEW FUNCTION:');
    console.log('-----------------------------------------------------');
    
    // Try with standard threshold now that our function should be working
    const { data: vectorResults, error: vectorError } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${Array(1536).fill(0)}]`, // This will be ignored as the function will generate its own embedding
        match_threshold: 0.1, // Standard threshold
        match_count: 10 // Top results
      });
    
    if (vectorError) {
      console.error('❌ Error in vector search:', vectorError.message);
    } else {
      console.log(`Vector search returned ${vectorResults?.length || 0} results`);
      
      // Check if Mohammed Aba Nura is in the results
      const mohammedResult = vectorResults?.find(result => result.id === MOHAMMED_COFFEE_ID);
      
      if (mohammedResult) {
        console.log(`✅ Found Mohammed Aba Nura in vector search results`);
        console.log(`   Similarity score: ${mohammedResult.similarity}`);
        console.log(`   Position: ${vectorResults.indexOf(mohammedResult) + 1} of ${vectorResults.length}`);
      } else {
        console.log(`❌ Mohammed Aba Nura NOT found in vector search results`);
        
        // Show top 5 results
        if (vectorResults && vectorResults.length > 0) {
          console.log('\nTop 5 vector search results:');
          vectorResults.slice(0, 5).forEach((result, i) => {
            console.log(`${i+1}. ${result.name} (similarity: ${result.similarity.toFixed(6)})`);
          });
        }
      }
    }
    
    // 4. Try direct vector comparison
    console.log('\n📊 DIRECT EMBEDDING COMPARISON:');
    console.log('-----------------------------------------------------');
    const { data: sqlResult, error: sqlError } = await supabase
      .rpc('check_coffee_embedding', {
        p_coffee_id: MOHAMMED_COFFEE_ID,
        p_search_tags: ['berry', 'fruit', 'clean']
      });
    
    if (sqlError) {
      console.error('❌ Error in direct comparison:', sqlError.message);
    } else {
      console.log('Results from direct embedding comparison:');
      console.log(JSON.stringify(sqlResult, null, 2));
    }
    
    // 5. Test simple text search
    console.log('\n📊 SIMPLE TAG SEARCH:');
    console.log('-----------------------------------------------------');
    // Direct query from the database using simple flavor tag overlap
    const { data: tagResults, error: tagError } = await supabase
      .from('coffees')
      .select('id, coffee_name, flavor_tags')
      .contains('flavor_tags', ['berry', 'fruit', 'clean'])
      .limit(10);
      
    if (tagError) {
      console.error('❌ Error in tag search:', tagError.message);
    } else {
      console.log(`Tag search returned ${tagResults?.length || 0} results`);
      if (tagResults && tagResults.length > 0) {
        tagResults.forEach((coffee, i) => {
          console.log(`${i+1}. ${coffee.coffee_name}`);
          console.log(`   Tags: ${JSON.stringify(coffee.flavor_tags)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkMohammedEmbedding().catch(console.error);

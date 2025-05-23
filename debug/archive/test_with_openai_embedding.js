// Test vector search with real OpenAI embeddings
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`Supabase Key: ${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}`);
console.log(`OpenAI Key: ${openaiApiKey.substring(0, 5)}...${openaiApiKey.substring(openaiApiKey.length - 5)}`);

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({
  apiKey: openaiApiKey
});

// Generate an embedding using OpenAI
async function generateEmbedding(text) {
  console.log(`Generating embedding for: "${text}"`);
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });
    
    const embedding = response.data[0].embedding;
    console.log(`✅ Generated ${embedding.length}-dimensional embedding`);
    return embedding;
  } catch (error) {
    console.error('❌ Error generating embedding:', error);
    throw error;
  }
}

// Test vector search with real embedding
async function testWithRealEmbedding(flavorProfile) {
  console.log(`\n🔍 Testing vector search with "${flavorProfile}" flavor profile...`);
  
  try {
    // Generate embedding for the flavor profile
    const embedding = await generateEmbedding(flavorProfile);
    
    // Test with different thresholds
    const thresholds = [0.3, 0.15, 0.05, 0.01, 0.001, 0.0001];
    
    for (const threshold of thresholds) {
      console.log(`\n📊 Testing with threshold: ${threshold}`);
      
      const { data, error } = await supabase
        .rpc('search_coffee_by_flavor_vector', {
          query_embedding: `[${embedding.join(',')}]`,
          match_threshold: threshold,
          match_count: 5,
          match_offset: 0
        });
        
      if (error) {
        console.error(`❌ ERROR with threshold ${threshold}:`, error);
      } else {
        console.log(`✅ Found ${data?.length || 0} results with threshold ${threshold}`);
        
        if (data && data.length > 0) {
          console.log('\n   Top results:');
          data.forEach((result, i) => {
            console.log(`   ${i+1}. ${result.name} (similarity: ${result.similarity.toFixed(4)}, distance: ${result.distance.toFixed(4)})`);
            console.log(`      Flavor tags: ${JSON.stringify(result.flavor_tags)}`);
          });
        } else {
          console.log('   No results returned');
        }
      }
    }
  } catch (e) {
    console.error('❌ EXCEPTION in test:', e);
  }
}

// Run tests with different flavor profiles
async function runTests() {
  try {
    // Test with common flavor profiles
    await testWithRealEmbedding('chocolate');
    await testWithRealEmbedding('fruity');
    await testWithRealEmbedding('nutty caramel');
    
    console.log('\n✨ All tests completed');
  } catch (e) {
    console.error('❌ Test execution failed:', e);
  }
}

runTests();

/**
 * Consolidated test script for the vector search functionality
 * Tests both direct database access and MCP endpoint
 */
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const mcpServerUrl = 'https://better-beans-mcp-server.al-ricotta.workers.dev/rpc';

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

// Test the MCP endpoint
async function testMcpEndpoint(flavorProfile) {
  console.log(`\n🌐 Testing MCP endpoint with "${flavorProfile.join(', ')}" flavor profile...`);
  
  try {
    const response = await fetch(mcpServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-similarity-search',
        method: 'similarity_search',
        params: {
          flavorProfile,
          maxResults: 5
        }
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.error(`❌ MCP endpoint error: ${JSON.stringify(result.error)}`);
      return;
    }
    
    // Parse the content from the MCP response
    let searchResults = {};
    try {
      if (result.result && result.result.content && result.result.content[0] && result.result.content[0].text) {
        searchResults = JSON.parse(result.result.content[0].text);
      } else {
        console.error('❌ Unexpected MCP response format:', JSON.stringify(result));
        return;
      }
    } catch (error) {
      console.error('❌ Error parsing MCP response:', error);
      return;
    }
    
    console.log(`✅ Found ${searchResults.results ? searchResults.results.length : 0} results via MCP endpoint`);
    
    if (searchResults.results && searchResults.results.length > 0) {
      console.log('\n   Top results:');
      searchResults.results.forEach((result, i) => {
        console.log(`   ${i+1}. ${result.coffee.name}`);
        console.log(`      Flavor tags: ${JSON.stringify(result.coffee.flavorTags)}`);
        console.log(`      Similarity: ${result.similarityScore?.toFixed(4) || 'N/A'}`);
        if (result.matchingTags && result.matchingTags.length > 0) {
          console.log(`      Matching tags: ${JSON.stringify(result.matchingTags)}`);
        }
      });
    } else {
      console.log('   No results returned');
    }
  } catch (e) {
    console.error('❌ Error testing MCP endpoint:', e);
  }
}

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
async function testDirectVectorSearch(flavorProfile) {
  console.log(`\n🔍 Testing direct vector search with "${flavorProfile.join(', ')}" flavor profile...`);
  
  try {
    // Generate embedding for the flavor profile
    const embedding = await generateEmbedding(flavorProfile.join(', '));
    
    // Fixed threshold that works with our database
    const threshold = 0.01;
    console.log(`📊 Testing with threshold: ${threshold}`);
    
    const { data, error } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: threshold,
        match_count: 5,
        match_offset: 0
      });
      
    if (error) {
      console.error(`❌ ERROR with direct vector search:`, error);
    } else {
      console.log(`✅ Found ${data?.length || 0} results with direct vector search`);
      
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
  } catch (e) {
    console.error('❌ EXCEPTION in direct vector search:', e);
  }
}

// Run all tests
async function runAllTests() {
  try {
    const flavorProfiles = [
      ['berry', 'fruit', 'clean'],
      ['chocolate', 'nutty'],
      ['citrus', 'floral', 'bright']
    ];
    
    for (const profile of flavorProfiles) {
      await testMcpEndpoint(profile);
      await testDirectVectorSearch(profile);
      console.log('\n' + '-'.repeat(80) + '\n');
    }
    
    console.log('✨ All tests completed');
  } catch (e) {
    console.error('❌ Test execution failed:', e);
  }
}

// Execute all tests
runAllTests();

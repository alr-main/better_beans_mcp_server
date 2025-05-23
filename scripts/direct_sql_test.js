// Direct SQL test bypassing all TypeScript code
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

// Hardcoded embedding for chocolate-related flavors
// This is a pre-generated embedding for "chocolate, dark chocolate, cocoa"
const CHOCOLATE_EMBEDDING = [
  // ... (removed for brevity, we'll generate this dynamically)
];

async function getEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
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

async function testDirectSql() {
  console.log('\n===== DIRECT SQL TEST =====');
  console.log('This test bypasses all TypeScript code and calls SQL directly');
  
  try {
    // Get a fresh embedding for chocolate-related flavors
    const embedding = await getEmbedding('chocolate, dark chocolate, cocoa');
    if (!embedding) {
      console.error('Failed to generate embedding');
      return;
    }
    
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Test with various thresholds
    const thresholds = [0.5, 0.3, 0.15, 0.05, 0.01];
    
    for (const threshold of thresholds) {
      console.log(`\n----- Testing with threshold: ${threshold} -----`);
      
      // Call the SQL function directly
      const { data, error } = await supabase.rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: threshold,
        match_count: 10,
        match_offset: 0
      });
      
      if (error) {
        console.error('Error executing SQL function:', error);
        continue;
      }
      
      console.log(`Results found: ${data ? data.length : 0}`);
      
      if (data && data.length > 0) {
        // Show first 3 results
        data.slice(0, 3).forEach((item, i) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`- Name: ${item.name}`);
          console.log(`- Similarity: ${item.similarity}`);
          console.log(`- Flavor tags: ${Array.isArray(item.flavor_tags) ? item.flavor_tags.join(', ') : 'None'}`);
          console.log(`- Product URL: ${item.product_url || 'None'}`);
        });
        
        // We found results, so we can stop testing lower thresholds
        break;
      }
    }
    
    // Test if the problem might be related to the OpenAI embedding
    // Try a direct text search as well
    console.log('\n----- Testing direct text search -----');
    const { data: textData, error: textError } = await supabase
      .from('coffees')
      .select('id, coffee_name, flavor_tags, product_url')
      .textSearch('flavor_tags', 'chocolate | cocoa', {
        type: 'plain',
        config: 'english'
      })
      .limit(5);
    
    if (textError) {
      console.error('Error executing text search:', textError);
    } else {
      console.log(`Text search results: ${textData ? textData.length : 0}`);
      
      if (textData && textData.length > 0) {
        textData.forEach((item, i) => {
          console.log(`\nText Result ${i + 1}:`);
          console.log(`- Name: ${item.coffee_name}`);
          console.log(`- Flavor tags: ${Array.isArray(item.flavor_tags) ? item.flavor_tags.join(', ') : 'None'}`);
        });
      }
    }
    
    // Last resort: try to fetch ANY coffees to confirm database connection
    console.log('\n----- Fetching any coffees to verify DB connection -----');
    const { data: anyCoffees, error: anyError } = await supabase
      .from('coffees')
      .select('id, coffee_name, flavor_tags')
      .limit(3);
    
    if (anyError) {
      console.error('Error fetching coffees:', anyError);
    } else {
      console.log(`Found ${anyCoffees ? anyCoffees.length : 0} coffees in database`);
      
      if (anyCoffees && anyCoffees.length > 0) {
        anyCoffees.forEach((item, i) => {
          console.log(`- ${item.coffee_name} (${Array.isArray(item.flavor_tags) ? item.flavor_tags.join(', ') : 'No tags'})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error in direct SQL test:', error);
  }
}

// Run the test
testDirectSql();

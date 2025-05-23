import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Diagnosing Better Beans Similarity Search Issues\n');

async function runDiagnostics() {
  try {
    // 1. Check if vector extension is enabled
    console.log('1️⃣ Checking pgvector extension...');
    const { data: extensionData, error: extensionError } = await supabase
      .from('pg_extension')
      .select('*')
      .eq('extname', 'vector');
    
    if (extensionError) {
      console.error('❌ Error checking pgvector extension:', extensionError);
    } else if (!extensionData || extensionData.length === 0) {
      console.error('❌ pgvector extension is NOT installed!');
    } else {
      console.log('✅ pgvector extension is installed');
    }

    // 2. Check if the function exists by querying PostgreSQL's system tables
    console.log('\n2️⃣ Checking if search_coffee_by_flavor_vector function exists...');
    
    // Query the pg_proc table which stores procedure/function information
    const { data: functionData, error: functionError } = await supabase
      .from('pg_proc')
      .select('proname, proargnames')
      .ilike('proname', 'search_coffee_by_flavor_vector')
      .limit(1);
    
    if (functionError) {
      console.error('❌ Function does not exist or error checking:', functionError.message);
    } else {
      console.log('✅ Function exists');
    }

    // 3. Check coffees table structure
    console.log('\n3️⃣ Checking coffees table structure...');
    const { data: tableData, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'coffees')
      .in('column_name', ['id', 'coffee_name', 'flavor_embedding', 'flavor_tags']);
    
    if (tableError) {
      console.error('❌ Error checking table structure:', tableError);
    } else {
      console.log('✅ Found columns:');
      tableData?.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    }

    // 4. Check if any coffees have embeddings
    console.log('\n4️⃣ Checking if coffees have embeddings...');
    const { count: totalCount, error: countError } = await supabase
      .from('coffees')
      .select('*', { count: 'exact', head: true });
    
    const { count: embeddingCount, error: embeddingError } = await supabase
      .from('coffees')
      .select('*', { count: 'exact', head: true })
      .not('flavor_embedding', 'is', null);
    
    if (countError || embeddingError) {
      console.error('❌ Error counting coffees:', countError || embeddingError);
    } else {
      console.log(`📊 Total coffees: ${totalCount}`);
      console.log(`📊 Coffees with embeddings: ${embeddingCount}`);
      console.log(`📊 Percentage with embeddings: ${totalCount ? (embeddingCount / totalCount * 100).toFixed(1) : 0}%`);
      
      if (embeddingCount === 0) {
        console.error('❌ NO coffees have embeddings! This is why similarity search returns no results.');
      }
    }

    // 5. Get a sample coffee with embedding
    console.log('\n5️⃣ Checking sample coffee with embedding...');
    const { data: sampleCoffee, error: sampleError } = await supabase
      .from('coffees')
      .select('id, coffee_name, flavor_tags')
      .not('flavor_embedding', 'is', null)
      .limit(1)
      .single();
    
    if (sampleError || !sampleCoffee) {
      console.error('❌ No coffee with embedding found');
    } else {
      console.log('✅ Sample coffee with embedding:');
      console.log(`   - ID: ${sampleCoffee.id}`);
      console.log(`   - Name: ${sampleCoffee.coffee_name}`);
      console.log(`   - Flavor tags: ${sampleCoffee.flavor_tags?.join(', ') || 'None'}`);
    }

    // 6. Test generating an embedding with OpenAI
    if (openaiKey) {
      console.log('\n6️⃣ Testing OpenAI embedding generation...');
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: 'Coffee with flavors of chocolate and nutty'
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
        } else {
          const data = await response.json();
          const embedding = data.data[0].embedding;
          console.log(`✅ Successfully generated embedding with ${embedding.length} dimensions`);
        }
      } catch (error) {
        console.error('❌ Error calling OpenAI:', error.message);
      }
    } else {
      console.log('\n⚠️ OPENAI_API_KEY not found - cannot test embedding generation');
    }

    // 7. Try a direct RPC call
    console.log('\n7️⃣ Testing direct RPC call to search function...');
    
    // Generate a simple test embedding (all zeros except a few dimensions)
    const testEmbedding = new Array(1536).fill(0);
    testEmbedding[0] = 1;
    testEmbedding[100] = 1;
    testEmbedding[500] = 1;
    
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('search_coffee_by_flavor_vector', {
        query_embedding: `[${testEmbedding.join(',')}]`,
        match_threshold: 0.001,
        match_count: 5,
        match_offset: 0
      });
    
    if (rpcError) {
      console.error('❌ RPC call failed:', rpcError);
      console.error('   Error details:', JSON.stringify(rpcError, null, 2));
    } else {
      console.log(`✅ RPC call successful, returned ${rpcData?.length || 0} results`);
      if (rpcData && rpcData.length > 0) {
        console.log('   First result:', {
          name: rpcData[0].name,
          similarity: rpcData[0].similarity,
          distance: rpcData[0].distance
        });
      }
    }

    // 8. Check for any recent errors in logs (if available)
    console.log('\n8️⃣ Summary of findings:');
    console.log('========================');
    
    // Provide actionable recommendations based on findings
    if (embeddingCount === 0) {
      console.log('\n🚨 CRITICAL ISSUE: No coffee products have embeddings!');
      console.log('\n📋 To fix this:');
      console.log('   1. Run the embedding generation script to populate embeddings');
      console.log('   2. Check that OPENAI_API_KEY is properly configured');
      console.log('   3. Ensure the embedding generation process completes successfully');
    } else if (embeddingCount < totalCount * 0.5) {
      console.log('\n⚠️ WARNING: Only ' + (embeddingCount / totalCount * 100).toFixed(1) + '% of coffees have embeddings');
      console.log('\n📋 Consider regenerating embeddings for all products');
    }

  } catch (error) {
    console.error('\n❌ Unexpected error during diagnostics:', error);
  }
}

// Run the diagnostics
runDiagnostics();

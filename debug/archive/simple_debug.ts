/**
 * Simple Debug Route
 * Returns basic coffee data directly from the database
 * This helps diagnose database connection issues vs vector search issues
 */
import { Env } from '../index.js';
import { createCorsResponse } from '../utils/corsUtils.js';
import { getSupabaseClient } from '../database/supabaseClient.js';

/**
 * Handle requests to the simple debug endpoint
 * Always returns coffee results from the database without vector search
 */
export async function handleSimpleDebugRequest(request: Request, env: Env): Promise<Response> {
  console.error('🔍 Simple debug route called - direct database access');
  
  try {
    // Get Supabase client
    const supabase = getSupabaseClient(env);

    // First, inspect the database schema to see what columns actually exist
    console.error('🔎 Checking database schema for coffees table');
    const { data: tableInfo, error: tableError } = await supabase
      .from('coffees')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Error checking table schema:', tableError);
      return new Response(JSON.stringify({ 
        error: 'Schema error',
        details: tableError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the available columns
    const availableColumns = tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : [];
    console.error('📊 Available columns:', availableColumns.join(', '));
    
    // Just get all columns with * to discover the actual schema
    console.error('🔍 Querying all columns with * to discover schema');
    const { data: coffees, error } = await supabase
      .from('coffees')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Database query error:', error);
      return new Response(JSON.stringify({ 
        error: 'Database error',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!coffees || coffees.length === 0) {
      console.error('⚠️ No coffee data found in database');
      return new Response(JSON.stringify({ 
        message: 'No coffee data found',
        databaseConnection: 'successful',
        query: 'successful',
        result: 'empty'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Transform the data to a simplified format that matches our actual query
    const results = coffees.map(coffee => ({
      id: coffee.id,
      name: coffee.name,
      roasterId: coffee.roaster_id,
    }));
    
    console.error(`✅ Retrieved ${results.length} coffee products directly from database`);
    
    // Return the results
    return createCorsResponse(
      new Response(JSON.stringify({
        databaseConnection: 'successful',
        query: 'successful',
        count: results.length,
        coffees: results
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Unexpected error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Supabase Client
 * Provides database connection and query utilities
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../index.js';
// Temporarily defining a simple Database type for testing
type Database = any;

// Cache the Supabase client instance
let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get a Supabase client instance
 * @param env - Environment variables containing Supabase credentials
 * @returns Supabase client instance
 */
export function getSupabaseClient(env: Env): SupabaseClient<Database> {
  if (!supabaseInstance) {
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    
    supabaseInstance = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_KEY,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            'x-better-beans-source': 'mcp-server',
          },
        },
      }
    );
  }
  
  return supabaseInstance;
}

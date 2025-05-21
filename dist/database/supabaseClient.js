/**
 * Supabase Client
 * Provides database connection and query utilities
 */
import { createClient } from '@supabase/supabase-js';
// Cache the Supabase client instance
let supabaseInstance = null;
/**
 * Get a Supabase client instance
 * @param env - Environment variables containing Supabase credentials
 * @returns Supabase client instance
 */
export function getSupabaseClient(env) {
    if (!supabaseInstance) {
        if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
            throw new Error('Supabase credentials not configured');
        }
        supabaseInstance = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
            auth: {
                persistSession: false,
            },
            global: {
                headers: {
                    'x-better-beans-source': 'mcp-server',
                },
            },
        });
    }
    return supabaseInstance;
}

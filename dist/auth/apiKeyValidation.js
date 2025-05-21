/**
 * API Key Validation
 * Validates API keys against the database
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
/**
 * Validates an API key against the database
 * @param apiKey - The API key to validate
 * @param env - Environment variables
 * @returns Validation result
 */
export async function validateApiKey(apiKey, env) {
    // If no API key provided, return invalid
    if (!apiKey) {
        return {
            valid: false,
            error: 'API key is required',
        };
    }
    try {
        // Create Supabase client
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
        // Hash the API key (don't store plain text keys in database)
        const keyHash = hashApiKey(apiKey, env.API_KEYS_SALT);
        // Query the database for the API key
        const { data, error } = await supabase
            .from('api_keys')
            .select('id, permissions, rate_limit, is_active, expires_at')
            .eq('key_hash', keyHash)
            .single();
        // Check for database error
        if (error) {
            console.error('Error querying API keys table:', error);
            return {
                valid: false,
                error: 'Invalid API key',
            };
        }
        // Check if key was found
        if (!data) {
            return {
                valid: false,
                error: 'Invalid API key',
            };
        }
        // Check if key is active
        if (!data.is_active) {
            return {
                valid: false,
                error: 'API key is inactive',
            };
        }
        // Check if key has expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
            return {
                valid: false,
                error: 'API key has expired',
            };
        }
        // Key is valid, update last_used_at timestamp
        await supabase
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', data.id);
        // Return success with permissions and rate limit
        return {
            valid: true,
            permissions: data.permissions,
            rateLimit: data.rate_limit,
        };
    }
    catch (error) {
        console.error('Error validating API key:', error);
        return {
            valid: false,
            error: 'Error validating API key',
        };
    }
}
/**
 * Hashes an API key with a salt
 * @param apiKey - The API key to hash
 * @param salt - Salt for the hash
 * @returns Hashed API key
 */
function hashApiKey(apiKey, salt) {
    return createHash('sha256')
        .update(apiKey + salt)
        .digest('hex');
}

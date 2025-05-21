/**
 * API Key Validation
 * Validates API keys against the database
 */
import { createClient } from '@supabase/supabase-js';
import { Env } from '../index.js';

/**
 * Result of API key validation
 */
interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  permissions?: string[];
  rateLimit?: number;
}

/**
 * Validates an API key against the database
 * @param apiKey - The API key to validate
 * @param env - Environment variables
 * @returns Validation result
 */
export async function validateApiKey(
  apiKey: string,
  env: Env
): Promise<ApiKeyValidationResult> {
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
    const keyHash = await hashApiKey(apiKey, env.API_KEYS_SALT);
    
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
  } catch (error) {
    console.error('Error validating API key:', error);
    return {
      valid: false,
      error: 'Error validating API key',
    };
  }
}

/**
 * Hashes an API key with a salt using Web Crypto API
 * @param apiKey - The API key to hash
 * @param salt - Salt for the hash
 * @returns Hashed API key as a hex string
 */
async function hashApiKey(apiKey: string, salt: string): Promise<string> {
  // Convert the API key + salt to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey + salt);
  
  // Hash the data using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert the hash to a hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

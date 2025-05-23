import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const apiKeySalt = process.env.API_KEYS_SALT || 'Teadog'; // Default from script

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Generate a random API key
const generateApiKey = () => {
  return randomBytes(24).toString('hex');
};

// Hash the API key (similar to the server implementation)
const hashApiKey = (apiKey, salt) => {
  return createHash('sha256')
    .update(apiKey + salt)
    .digest('hex');
};

// Create a test API key in the database
async function createTestApiKey() {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey, apiKeySalt);
  
  // Insert the hashed key into the database
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      key_hash: keyHash,
      name: 'Test API Key',
      permissions: ['read'],
      is_active: true,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating API key:', error);
    return;
  }
  
  console.log('Created API key successfully:');
  console.log('---------------------------');
  console.log(`API Key: ${apiKey}`);
  console.log(`Key ID: ${data.id}`);
  console.log('---------------------------');
  console.log('Add this to your .env file as MCP_API_KEY=your-key');
}

createTestApiKey();

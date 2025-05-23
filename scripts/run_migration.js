// Migration script for Supabase database
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Running migration script...');
  
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
    process.exit(1);
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized');
  
  try {
    // Read SQL migration file
    const migrationPath = path.join(__dirname, 'combined_migrations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Read migration file: ${migrationPath}`);
    console.log('SQL content:', sql.substring(0, 100) + '...');
    
    // Execute each SQL statement separately using raw SQL query
    // First, drop the existing function
    console.log('Dropping existing function...');
    const { data: dropData, error: dropError } = await supabase
      .from('_migrations')
      .select('*')
      .limit(1) // This is just a workaround to be able to execute SQL directly
      .then(async () => {
        // Then use raw SQL API to run the query
        return await supabase.rpc('pgrest_sql', { query: 'DROP FUNCTION IF EXISTS search_coffee_by_flavor_vector(vector(1536), float, int, int, float, float);' });
      });
    
    if (dropError) {
      console.error('Error dropping function:', dropError);
    } else {
      console.log('Function dropped successfully');
    }
    
    // Now create the new function
    console.log('Creating new function...');
    const createFunctionSql = sql.split('--')[2]; // Get just the CREATE FUNCTION part
    
    const { data: createData, error: createError } = await supabase
      .from('_migrations')
      .select('*')
      .limit(1)
      .then(async () => {
        return await supabase.rpc('pgrest_sql', { query: createFunctionSql });
      });
    
    if (createError) {
      console.error('Error creating function:', createError);
    } else {
      console.log('Function created successfully');
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();

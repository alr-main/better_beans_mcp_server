#!/usr/bin/env python3
"""
Apply Migration Script

This script applies a migration SQL file to the Supabase database.
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure basic logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Apply SQL migration")
    parser.add_argument(
        "migration_file", 
        help="Path to the migration SQL file"
    )
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Enable verbose logging"
    )
    return parser.parse_args()

def initialize_supabase():
    """Initialize Supabase client."""
    # Load environment variables from .env file
    env_path = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # Get credentials from environment
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    # Validate credentials
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL and key are required (set in .env file)")
        sys.exit(1)
    
    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized successfully")
        return supabase
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        sys.exit(1)

def read_migration_file(file_path):
    """Read the migration SQL file."""
    try:
        with open(file_path, 'r') as f:
            sql = f.read()
        logger.info(f"Successfully read migration file: {file_path}")
        return sql
    except Exception as e:
        logger.error(f"Error reading migration file: {e}")
        sys.exit(1)

def apply_migration(supabase, sql):
    """Apply the SQL migration to the database."""
    try:
        # Execute the SQL as a single transaction
        logger.info("Applying migration...")
        response = supabase.rpc('exec_sql', {'sql': sql}).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error applying migration: {response.error}")
            return False
        
        logger.info("Migration applied successfully")
        return True
    except Exception as e:
        logger.error(f"Error applying migration: {e}")
        return False

def main():
    """Main entry point."""
    args = get_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info("Starting migration application")
    
    # Check if the migration file exists
    migration_file = args.migration_file
    if not os.path.exists(migration_file):
        logger.error(f"Migration file does not exist: {migration_file}")
        sys.exit(1)
    
    # Initialize Supabase client
    supabase = initialize_supabase()
    
    # Read the migration file
    sql = read_migration_file(migration_file)
    
    # Apply the migration
    success = apply_migration(supabase, sql)
    
    if success:
        logger.info("Migration completed successfully")
    else:
        logger.error("Migration failed")
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        sys.exit(1)

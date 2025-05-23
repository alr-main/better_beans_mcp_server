#!/usr/bin/env python3
"""
Test Vector Search Script

This script tests the vector search functionality in the database to verify
that the embeddings are working correctly.
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
import openai
from supabase import create_client, Client

# Configure basic logging
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
OPENAI_MODEL = "text-embedding-ada-002"
LIMIT = 5  # Number of results to return

def get_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Test Vector Search")
    parser.add_argument(
        "query", 
        help="Search query to test (e.g., 'fruity chocolate coffee')"
    )
    parser.add_argument(
        "--limit", 
        type=int, 
        default=LIMIT,
        help=f"Number of results to return (default: {LIMIT})"
    )
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Enable verbose logging"
    )
    return parser.parse_args()

def initialize_clients():
    """Initialize Supabase and OpenAI clients."""
    # Load environment variables from .env file
    env_path = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # Get credentials from environment
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    # Validate credentials
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL and key are required (set in .env file)")
        sys.exit(1)
    
    has_openai = bool(openai_key)
    if has_openai:
        openai.api_key = openai_key
        logger.info("OpenAI API key configured")
    else:
        logger.warning("No OpenAI API key provided - vector search will fail")
        sys.exit(1)
    
    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized successfully")
        return supabase
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        sys.exit(1)

def generate_embedding(query_text):
    """Generate an embedding for the search query."""
    try:
        logger.info(f"Generating embedding for query: {query_text}")
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = client.embeddings.create(
            model=OPENAI_MODEL,
            input=query_text
        )
        
        embedding = response.data[0].embedding
        logger.info(f"Generated embedding with {len(embedding)} dimensions")
        return embedding
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        sys.exit(1)

def perform_vector_search(supabase, embedding, limit):
    """Perform vector search in the database."""
    try:
        # Convert embedding to string format for RPC call
        embedding_str = f"[{','.join(str(float(x)) for x in embedding)}]"
        
        # Call the RPC function for vector search
        logger.info(f"Performing vector search with limit {limit}")
        
        # Add debug info about the request
        logger.info(f"Using supabase URL: {os.environ.get('SUPABASE_URL')}")
        logger.info(f"Embedding dimensions: {len(embedding)}")
        
        # Perform the RPC call with detailed error handling
        try:
            result = supabase.rpc(
                "search_coffee_by_flavor_vector",
                {
                    "query_embedding": embedding_str,
                    "match_threshold": 0.5,
                    "match_count": limit
                }
            ).execute()
            
            if result.data:
                logger.info(f"Search successful, found {len(result.data)} results")
                return result.data
            else:
                logger.warning("No search results found")
                return []
        except Exception as rpc_error:
            logger.error(f"RPC call failed: {rpc_error}")
            if hasattr(rpc_error, 'details'):
                logger.error(f"Error details: {rpc_error.details}")
            raise rpc_error
    except Exception as e:
        logger.error(f"Error performing vector search: {e}")
        # Check if we can get more details about the error
        if hasattr(e, '__dict__'):
            for attr, value in e.__dict__.items():
                logger.error(f"Error attribute {attr}: {value}")
        return []

def main():
    """Main entry point."""
    args = get_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    logger.info("Starting vector search test")
    
    # Initialize clients
    supabase = initialize_clients()
    
    # Generate embedding for query
    embedding = generate_embedding(args.query)
    
    # Perform vector search
    results = perform_vector_search(supabase, embedding, args.limit)
    
    # Display results
    print("\n=== Vector Search Results ===")
    if not results:
        print("No results found")
    else:
        print(f"Found {len(results)} results:")
        for i, coffee in enumerate(results):
            # Print all available fields
            print(f"\n{i+1}. {coffee.get('name', 'Unknown')} (Similarity: {coffee.get('similarity', 0):.4f})")
            print(f"   ID: {coffee.get('id', 'Unknown')}")
            print(f"   Roaster: {coffee.get('roaster_name', 'Unknown')}")
            print(f"   Flavors: {', '.join(coffee.get('flavor_tags', []))}")
            print(f"   Roast Level: {coffee.get('roast_level', 'Unknown')}")
            
            if coffee.get('process_method'):
                print(f"   Process Method: {coffee['process_method']}")
                
            if coffee.get('is_featured'):
                print(f"   Featured: Yes")
                
            if coffee.get('price'):
                print(f"   Price: ${coffee['price']}")
                
            # Print all fields for debugging
            print("\n   All available fields:")
            for key, value in coffee.items():
                if key not in ['id', 'name', 'roaster_name', 'flavor_tags', 'roast_level', 'process_method', 'is_featured', 'price', 'similarity']:
                    print(f"      {key}: {value}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        sys.exit(1)

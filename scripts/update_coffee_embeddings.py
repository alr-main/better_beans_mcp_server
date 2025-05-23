#!/usr/bin/env python3
"""
Coffee Embedding Update Script

This script updates the flavor_embedding column in the coffees table by 
generating vector embeddings for each coffee's flavor tags using OpenAI.

Features:
- Robust error handling and detailed logging
- Rate limiting to avoid API throttling
- Batched processing with progress tracking
- Command-line arguments for flexible usage
"""

import os
import sys
import time
import json
import argparse
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

import openai
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("embedding_update.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Constants
OPENAI_MODEL = "text-embedding-ada-002"
VECTOR_DIMENSIONS = 1536  # OpenAI's embedding dimensions
BATCH_SIZE = 5  # Number of coffees to process in a batch
DELAY_BETWEEN_REQUESTS = 1.0  # Seconds between OpenAI API calls
DELAY_BETWEEN_BATCHES = 3.0  # Seconds between batches


def get_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Update coffee flavor embeddings")
    parser.add_argument(
        "--supabase-url", 
        required=False,
        help="Supabase URL (or set SUPABASE_URL env variable)"
    )
    parser.add_argument(
        "--supabase-key", 
        required=False,
        help="Supabase API key (or set SUPABASE_KEY env variable)"
    )
    parser.add_argument(
        "--openai-key", 
        required=False,
        help="OpenAI API key (or set OPENAI_API_KEY env variable)"
    )
    parser.add_argument(
        "--force-all", 
        action="store_true",
        help="Force update all coffees even if they haven't changed"
    )
    parser.add_argument(
        "--batch-size", 
        type=int, 
        default=BATCH_SIZE,
        help=f"Number of coffees to process in each batch (default: {BATCH_SIZE})"
    )
    parser.add_argument(
        "--delay", 
        type=float, 
        default=DELAY_BETWEEN_REQUESTS,
        help=f"Delay between API requests in seconds (default: {DELAY_BETWEEN_REQUESTS})"
    )
    parser.add_argument(
        "--batch-delay", 
        type=float, 
        default=DELAY_BETWEEN_BATCHES,
        help=f"Delay between batches in seconds (default: {DELAY_BETWEEN_BATCHES})"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true",
        help="Preview what would be updated without making changes"
    )
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Enable verbose logging"
    )
    
    return parser.parse_args()


def initialize_clients(args: argparse.Namespace) -> Tuple[Client, bool]:
    """Initialize Supabase and OpenAI clients."""
    # Load environment variables from .env file
    env_path = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / '.env'
    load_dotenv(dotenv_path=env_path)
    
    # Get configuration from args or environment
    supabase_url = args.supabase_url or os.environ.get("SUPABASE_URL")
    supabase_key = args.supabase_key or os.environ.get("SUPABASE_KEY")
    openai_key = args.openai_key or os.environ.get("OPENAI_API_KEY")
    
    # Validate credentials
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL and key are required (via args or environment variables)")
        sys.exit(1)
    
    has_openai = bool(openai_key)
    if has_openai:
        openai.api_key = openai_key
        logger.info("OpenAI API key configured")
    else:
        logger.warning("No OpenAI API key provided - will use fallback embedding method")
    
    # Initialize Supabase client
    try:
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized successfully")
        return supabase, has_openai
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        sys.exit(1)


def get_coffee_data(supabase: Client, force_all: bool = False) -> List[Dict[str, Any]]:
    """Fetch coffee data from Supabase, focusing on coffees that need updates."""
    try:
        # Get all coffees with flavor tags
        response = supabase.table('coffees').select('*').execute()
        coffees = response.data
        
        if not coffees:
            logger.warning("No coffees found with flavor tags")
            return []
        
        logger.info(f"Found {len(coffees)} total coffees with flavor tags")
        
        if force_all:
            logger.info(f"Force update mode: will update all {len(coffees)} coffees")
            return coffees
        
        # Get the last time embedding updates were run
        try:
            last_update_response = supabase.table('update_logs').select('created_at').execute()
            
            if last_update_response.data and len(last_update_response.data) > 0:
                last_update_time = last_update_response.data[0]["created_at"]
                logger.info(f"Last successful embedding update was at {last_update_time}")
            else:
                logger.info("No previous embedding updates found in logs")
                return coffees  # Update all if no previous updates
        except Exception as e:
            logger.warning(f"Could not determine last update time: {e}")
            return coffees  # Update all if we can't determine last update
        
        # Filter coffees that have been updated since the last embedding update
        need_update = []
        for coffee in coffees:
            coffee_updated = coffee.get("updated_at") or coffee.get("created_at")
            if coffee_updated and coffee_updated > last_update_time:
                need_update.append(coffee)
            elif not coffee.get("flavor_embedding"):
                # Also include coffees with missing embeddings
                need_update.append(coffee)
        
        logger.info(f"Found {len(need_update)} coffees that need embedding updates")
        return need_update
    except Exception as e:
        logger.error(f"Error fetching coffees: {e}")
        return []


def generate_openai_embedding(flavor_tags: List[str]) -> Optional[List[float]]:
    """Generate embedding using OpenAI API."""
    # Prepare the text for OpenAI embedding
    text = ", ".join(flavor_tags)
    
    try:
        logger.debug(f"Generating OpenAI embedding for: {text}")
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = client.embeddings.create(
            model=OPENAI_MODEL,
            input=text
        )
        
        # Extract the embedding from the response
        embedding = response.data[0].embedding
        
        # Validate dimensions
        if len(embedding) != VECTOR_DIMENSIONS:
            logger.error(f"Invalid embedding dimensions: got {len(embedding)}, expected {VECTOR_DIMENSIONS}")
            return None
        
        return embedding
    except Exception as e:
        logger.error(f"Error generating OpenAI embedding: {e}")
        return None


def generate_fallback_embedding(flavor_tags: List[str]) -> List[float]:
    """Generate a simple fallback embedding when OpenAI is unavailable."""
    # Create a simple embedding based on preset values for common flavor descriptors
    flavor_map = {
        "fruity": [0.8, 0.2, 0.1, 0.0, 0.3],
        "chocolate": [0.2, 0.9, 0.4, 0.1, 0.1],
        "nutty": [0.3, 0.5, 0.8, 0.2, 0.1],
        "floral": [0.7, 0.1, 0.2, 0.1, 0.6],
        "spicy": [0.4, 0.2, 0.7, 0.5, 0.3],
        "sweet": [0.5, 0.6, 0.3, 0.1, 0.2],
        "bitter": [0.1, 0.4, 0.5, 0.8, 0.1],
        "acidic": [0.6, 0.2, 0.1, 0.7, 0.4],
    }
    
    # Generate a composite embedding based on the flavor tags
    base_vector = [0.1] * 5  # Starting point
    
    for tag in flavor_tags:
        tag_lower = tag.lower()
        # Find the closest matching flavor in our map
        matched = False
        for flavor, vector in flavor_map.items():
            if flavor in tag_lower:
                # Add the flavor's vector to our base vector
                base_vector = [base + (0.5 * flavor_val) for base, flavor_val in zip(base_vector, vector)]
                matched = True
                break
        
        # If no match, add a small random component
        if not matched:
            base_vector = [val + 0.05 for val in base_vector]
    
    # Normalize the vector
    magnitude = sum(val**2 for val in base_vector) ** 0.5
    normalized = [val / magnitude for val in base_vector]
    
    # Extend to full dimensions by repeating pattern with small variations
    full_embedding = []
    while len(full_embedding) < VECTOR_DIMENSIONS:
        for val in normalized:
            # Add small variation
            variation = val * (0.95 + (hash(str(len(full_embedding))) % 10) / 100)
            full_embedding.append(variation)
            if len(full_embedding) >= VECTOR_DIMENSIONS:
                break
    
    return full_embedding[:VECTOR_DIMENSIONS]


def update_coffee_embedding(
    supabase: Client, 
    coffee: Dict[str, Any], 
    has_openai: bool,
    dry_run: bool
) -> bool:
    """Update the embedding for a single coffee."""
    coffee_id = coffee["id"]
    coffee_name = coffee.get("coffee_name", "Unknown")
    flavor_tags = coffee["flavor_tags"]
    
    if not flavor_tags:
        logger.warning(f"Coffee {coffee_id} ({coffee_name}) has no flavor tags, skipping")
        return False
    
    logger.info(f"Processing coffee {coffee_id} ({coffee_name}) with flavor tags: {', '.join(flavor_tags)}")
    
    # Generate embedding
    embedding = None
    if has_openai:
        embedding = generate_openai_embedding(flavor_tags)
    else:
        embedding = generate_fallback_embedding(flavor_tags)
    
    if not embedding:
        logger.error(f"Failed to generate embedding for coffee {coffee_id}")
        return False
    
    # Format embedding for PostgreSQL
    embedding_str = f"[{','.join(str(float(x)) for x in embedding)}]"
    logger.debug(f"Generated embedding with {len(embedding)} dimensions")
    
    if dry_run:
        logger.info(f"DRY RUN: Would update coffee {coffee_id} with embedding of {len(embedding)} dimensions")
        return True
    
    # Update the database using our RPC function
    try:
        result = supabase.rpc(
            "update_coffee_flavor_vector",
            {
                "p_coffee_id": coffee_id,
                "p_embedding": embedding_str
            }
        ).execute()
        
        if result.data is True:
            logger.info(f"Successfully updated embedding for coffee {coffee_id}")
            return True
        else:
            logger.error(f"RPC function returned failure for coffee {coffee_id}")
            return False
    except Exception as e:
        logger.error(f"Error updating embedding for coffee {coffee_id}: {e}")
        return False


def main():
    """Main entry point for the script."""
    # Parse arguments
    args = get_args()
    
    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        
    logger.info("Starting coffee embedding update script")
    
    # Initialize clients
    supabase, has_openai = initialize_clients(args)
    
    # Get coffees that need updates
    coffees = get_coffee_data(supabase, args.force_all)
    if not coffees:
        logger.info("No coffees need updating, exiting")
        return
        
    if not has_openai and not args.force_all:
        logger.warning("No OpenAI API key but attempting to update embeddings!")
        user_input = input("Continue with fallback embeddings? [y/N]: ")
        if user_input.lower() != 'y':
            logger.info("Operation cancelled by user")
            return
    
    # Set up tracking
    start_time = time.time()
    total_coffees = len(coffees)
    updated = 0
    failed = 0
    
    # Process in batches
    batch_size = args.batch_size
    
    logger.info(f"Starting update with batch size {batch_size}")
    if args.dry_run:
        logger.info("DRY RUN MODE: No actual updates will be made")
    
    for i in range(0, total_coffees, batch_size):
        batch = coffees[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (total_coffees + batch_size - 1) // batch_size
        
        logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} coffees)")
        
        for coffee in batch:
            success = update_coffee_embedding(supabase, coffee, has_openai, args.dry_run)
            if success:
                updated += 1
            else:
                failed += 1
            
            # Add delay between requests
            if args.delay > 0 and coffee != batch[-1]:
                time.sleep(args.delay)
        
        # Report progress
        progress = (i + len(batch)) / total_coffees * 100
        elapsed = time.time() - start_time
        rate = (i + len(batch)) / elapsed if elapsed > 0 else 0
        
        logger.info(f"Progress: {progress:.1f}% ({i + len(batch)}/{total_coffees})")
        logger.info(f"Rate: {rate:.2f} coffees/sec, Elapsed: {elapsed:.1f}s")
        logger.info(f"Updated: {updated}, Failed: {failed}")
        
        # Add delay between batches
        if i + batch_size < total_coffees and args.batch_delay > 0:
            logger.info(f"Waiting {args.batch_delay}s before next batch...")
            time.sleep(args.batch_delay)
    
    # Final report
    total_time = time.time() - start_time
    logger.info(f"Update complete in {total_time:.2f}s")
    logger.info(f"Final results: {updated} updated, {failed} failed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Update interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        sys.exit(1)

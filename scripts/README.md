# Coffee Embedding Update Scripts

This directory contains scripts for updating coffee flavor embeddings in the database.

## `update_coffee_embeddings.py`

This script provides a reliable way to update vector embeddings for coffee flavor profiles using the OpenAI API. It is designed to run outside the Cloudflare Worker environment to avoid request limits and timeout issues.

### Features

- Robust error handling and detailed logging
- Rate limiting to prevent API throttling
- Batched processing with progress tracking
- Smart detection of coffees that need updates (only updates changed coffees)
- Command-line arguments for flexible usage
- Fallback embedding generation when OpenAI is unavailable

### Requirements

Install the required Python packages:

```bash
pip install openai supabase
```

### Usage

Basic usage to update only changed coffees:

```bash
python update_coffee_embeddings.py
```

Force update all coffees (even if unchanged):

```bash
python update_coffee_embeddings.py --force-all
```

Perform a dry run (no actual updates):

```bash
python update_coffee_embeddings.py --dry-run
```

### Command-line Options

```
--supabase-url    Supabase URL (or set SUPABASE_URL env variable)
--supabase-key    Supabase API key (or set SUPABASE_KEY env variable)
--openai-key      OpenAI API key (or set OPENAI_API_KEY env variable)
--force-all       Force update all coffees even if they haven't changed
--batch-size      Number of coffees to process in each batch (default: 5)
--delay           Delay between API requests in seconds (default: 1.0)
--batch-delay     Delay between batches in seconds (default: 3.0)
--dry-run         Preview what would be updated without making changes
--verbose         Enable verbose logging
```

### Environment Variables

Instead of passing API keys on the command line, you can set these environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-supabase-key"
export OPENAI_API_KEY="your-openai-key"
```

### How It Works

This script intelligently manages coffee embeddings by:

1. Checking the database for coffees that have been updated since the last embedding update
2. Only processing coffees that have changed or are missing embeddings
3. Using the same RPC function (`update_coffee_flavor_vector`) that's used by the MCP server
4. Recording updates in the `update_logs` table for future change detection

This approach ensures your embeddings stay in sync with coffee details automatically without unnecessary processing.

### When to Use This Script

This script is designed to be run:

1. After bulk changes to your coffee database
2. Periodically as a scheduled task to catch any missed updates
3. When switching to a new OpenAI model
4. During recovery if embeddings are lost or corrupted

### Logging

The script logs to both the console and a file named `embedding_update.log` in the current directory.

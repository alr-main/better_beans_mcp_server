#!/bin/bash

# Test the similarity_search endpoint with very low threshold
# This uses the same threshold that worked in the diagnostic test

# Extract the MCP_API_KEY from the .env file and clean it up
if [ -f "../.env" ]; then
  # Extract the key and clean up any quotes or whitespace
  MCP_API_KEY=$(grep "^MCP_API_KEY=" ../.env | cut -d= -f2 | tr -d '"\r\n ')
  echo "Loaded MCP_API_KEY from ../.env"
else
  echo "Warning: .env file not found. You may need to manually set API_KEY."
fi

# Use the API key from the environment
API_KEY=${MCP_API_KEY}
echo "Using API key: ${API_KEY:0:3}...${API_KEY: -3} (masked for security)"

echo "\nMethod 1: Testing with Bearer prefix in Authorization header..."
curl -X POST https://better-beans-mcp-server.al-ricotta.workers.dev/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-similarity-search-1",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["chocolate"],
      "maxResults": 5,
      "threshold": 0.001
    }
  }' | jq .

echo "\nMethod 2: Testing with API key directly in Authorization header..."
curl -X POST https://better-beans-mcp-server.al-ricotta.workers.dev/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: ${API_KEY}" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-similarity-search-2",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["chocolate"],
      "maxResults": 5,
      "threshold": 0.001
    }
  }' | jq .

echo "\nMethod 3: Testing with x-api-key header..."
curl -X POST https://better-beans-mcp-server.al-ricotta.workers.dev/rpc \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-similarity-search-3",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["chocolate"],
      "maxResults": 5,
      "threshold": 0.001
    }
  }' | jq .

echo "\nTesting direct /simple_debug endpoint (if available)..."
curl -X GET "https://better-beans-mcp-server.al-ricotta.workers.dev/simple_debug?flavor=chocolate&api_key=${API_KEY}" | jq .

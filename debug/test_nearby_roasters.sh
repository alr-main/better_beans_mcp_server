#!/bin/bash

# Test script for the nearby roasters search functionality
# This script sends a JSON-RPC request to search for coffee roasters near a specific location

# Default values
HOST="localhost:8787"
METHOD="search_coffee_roasters"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --prod)
      HOST="better-beans-mcp.alr-main.workers.dev"
      shift
      ;;
    --method)
      METHOD="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

echo "Testing nearby roasters search against $HOST"

# Sample coordinates for San Francisco
LAT=37.7749
LNG=-122.4194
RADIUS=60 # Updated to 60 miles default radius

echo "Using coordinates: $LAT, $LNG with radius $RADIUS miles"

# Create the JSON-RPC request
REQUEST="{
  \"jsonrpc\": \"2.0\",
  \"id\": \"test-nearby-$(date +%s)\",
  \"method\": \"$METHOD\",
  \"params\": {
    \"coordinates\": {
      \"latitude\": $LAT,
      \"longitude\": $LNG,
      \"radiusMiles\": $RADIUS
    },
    \"maxResults\": 5
  }
}"

echo "Request:"
echo "$REQUEST"

# Send the request
RESPONSE=$(curl -s -X POST "http://$HOST/rpc" \
  -H "Content-Type: application/json" \
  -d "$REQUEST")

echo "Response:"
echo "$RESPONSE"

# Simple check for success
if [[ "$RESPONSE" == *"result"* ]]; then
  echo "Successfully received results from the API!"
else
  echo "No results or error in the response."
fi

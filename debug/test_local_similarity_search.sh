#!/bin/bash

# Test the similarity_search endpoint against our local development server
# This tests our secure query pipeline implementation with the vector search

echo "Testing similarity_search with chocolate flavor profile..."
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["chocolate"],
      "maxResults": 5
    },
    "id": 1
  }'

echo -e "\n\nTesting with multiple flavor notes..."
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["fruity", "floral", "bright"],
      "maxResults": 3
    },
    "id": 2
  }'

echo -e "\n\nTesting with unusual flavor combination (should trigger fallbacks)..."
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "similarity_search",
    "params": {
      "flavorProfile": ["licorice", "tobacco", "earthy"],
      "maxResults": 3
    },
    "id": 3
  }'

echo -e "\n\nTesting with invalid parameters (should return an error)..."
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "similarity_search",
    "params": {
      "flavorProfile": "not-an-array",
      "maxResults": 3
    },
    "id": 4
  }'

echo -e "\n"

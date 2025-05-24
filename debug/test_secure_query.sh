#!/bin/bash

# Test script for the secure query pipeline implementation
# This script sends a JSON-RPC request to test the searchCoffeeProducts method

echo "Testing secure query pipeline with searchCoffeeProducts method..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "search_coffee_products",
    "params": {
      "query": "ethiopian",
      "maxResults": 5
    },
    "id": 1
  }'

echo -e "\n\nTesting with filters..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "search_coffee_products",
    "params": {
      "filters": {
        "roastLevel": "Light",
        "flavorProfile": ["fruity", "floral"]
      },
      "maxResults": 3
    },
    "id": 2
  }'

echo -e "\n\nTesting invalid parameters (should return an error)..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "search_coffee_products",
    "params": {
      "maxResults": -5
    },
    "id": 3
  }'

echo -e "\n"

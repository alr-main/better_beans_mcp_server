#!/bin/bash

# Test script for the secure query pipeline implementation in the roaster service
# This script sends JSON-RPC requests to test the searchCoffeeRoasters and getRoasterDetails methods

echo "Testing secure query pipeline with searchCoffeeRoasters method..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "search_coffee_roasters",
    "params": {
      "query": "coffee",
      "maxResults": 3
    },
    "id": 1
  }'

echo -e "\n\nTesting with location filter..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "search_coffee_roasters",
    "params": {
      "location": "New York",
      "maxResults": 3
    },
    "id": 2
  }'

echo -e "\n\nTesting get_roaster_details method..."

# Use an ID from your first search results or replace with a known valid ID
curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_roaster_details",
    "params": {
      "roasterId": "f172bd51-baaf-43e6-8bb8-d565ea579da4"
    },
    "id": 3
  }'

echo -e "\n\nTesting invalid parameters (should return an error)..."

curl -X POST http://localhost:8787/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_roaster_details",
    "params": {
      "roasterId": "invalid-uuid"
    },
    "id": 4
  }'

echo -e "\n"

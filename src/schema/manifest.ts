/**
 * MCP Server Manifest Schema
 * Defines the MCP server capabilities and available methods
 * Implements the Model Context Protocol (MCP) server manifest format
 */
import { methodSchemas } from './methods';

/**
 * The MCP server manifest
 * This defines the server capabilities and available methods
 */
export const serverManifest = {
  // MCP Protocol specific fields
  mcp_version: '2024-11-05',  // MCP protocol version supported
  
  // Server identification
  name_for_human: 'Better Beans Coffee Discovery',
  name_for_model: 'better_beans',
  description_for_human: 'Search for coffee roasters and products from specialty roasters around the world.',
  description_for_model: 'This tool helps find coffee roasters and their products based on various criteria including location, flavor profile, and certifications. Use this when looking for coffee recommendations or information about coffee roasters.',
  auth: {
    type: 'none'
  },
  api: {
    type: 'jsonrpc',
    url: 'https://better-beans-mcp-server.al-ricotta.workers.dev/rpc' // Updated with correct subdomain
  },
  
  // MCP capabilities
  capabilities: {
    tools: {
      listChanged: true
    }
  },
  functions: [
    {
      name: 'search_coffee_roasters',
      description: 'Find coffee roasters based on search criteria',
      inputSchema: methodSchemas.searchCoffeeRoasters
    },
    {
      name: 'get_roaster_details',
      description: 'Get detailed information about a specific roaster',
      inputSchema: methodSchemas.getRoasterDetails
    },
    {
      name: 'search_coffee_products',
      description: 'Find coffee products based on search criteria',
      inputSchema: methodSchemas.searchCoffeeProducts
    },
    {
      name: 'get_coffee_product_details',
      description: 'Get detailed information about a specific coffee product',
      inputSchema: methodSchemas.getCoffeeProductDetails
    },
    {
      name: 'similarity_search',
      description: 'Find similar coffees based on taste profile',
      inputSchema: methodSchemas.similaritySearch
    }
  ]
};

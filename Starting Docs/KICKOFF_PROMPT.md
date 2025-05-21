# Better Beans MCP Server - Kickoff Prompt

## Project Introduction

I'm developing a Model Context Protocol (MCP) server for a coffee roaster discovery service called Better Beans. This server will enable AI assistants to search for and retrieve information about specialty coffee roasters and their products.

## Project Details

- **Type**: Read-only MCP server for coffee discovery
- **Deployment Target**: Cloudflare Workers
- **Database**: Existing Supabase PostgreSQL (project ID: izdbjqabwtenpgxopmyf)
- **Language**: JavaScript/TypeScript
- **Protocol**: JSON-RPC 2.0 following Cloudflare MCP Server specifications

## Key Documents

1. **PLANNING_CLOUDFLARE.md**: Contains the technical architecture, database schema, and MCP implementation details
2. **TASKS_CLOUDFLARE.md**: Lists specific implementation tasks broken down by phase
3. **WINDSURF_RULES.md**: Outlines development standards, code organization, and project management practices

## First Steps

Let's start implementing the Better Beans MCP Server. Here's what we need to do first:

1. **Project Setup**: Initialize a new Cloudflare Workers project using Wrangler
2. **Core Infrastructure**: Set up the basic MCP server with health, manifest, and RPC endpoints
3. **Database Connection**: Establish a connection to the Supabase PostgreSQL database

Can you help me with these tasks by:

1. Setting up the project structure following the folder organization in WINDSURF_RULES.md
2. Creating the initial Wrangler configuration
3. Implementing the required MCP server endpoints (health, manifest, rpc)
4. Establishing the Supabase database connection
5. Implementing the basic request handler to route MCP method calls

## Key Requirements

- This is a **read-only** service - no data modification operations
- Security is critical - all queries must be parameterized
- Follow JSON-RPC 2.0 specification exactly
- Use TypeScript with strict typing
- Implement proper error handling and logging
- Use the actual database schema columns exactly as specified
- Include vector embedding search capabilities

## Key MCP Methods to Implement

1. `search_coffee_roasters`: Find coffee roasters based on search criteria
2. `get_roaster_details`: Get detailed information about a specific roaster
3. `search_coffee_products`: Find coffee products based on search criteria
4. `get_coffee_product_details`: Get detailed information about a specific coffee product
5. `similarity_search`: Find similar coffees based on taste profile

## Development Approach

1. Start with the core infrastructure and request handling
2. Then implement the database connection layer
3. Add one method at a time, starting with `search_coffee_roasters`
4. Add comprehensive tests for each component
5. Implement proper error handling throughout

## Critical Success Factors

- Strict adherence to JSON-RPC 2.0 specification
- Parameterized database queries for security
- Comprehensive error handling
- Proper API key validation and rate limiting
- Clear and consistent response formatting
- Optimized database queries
- Thorough testing of each component

In each development session, we'll:
1. Review the planning documents
2. Update the tasks list
3. Focus on implementing specific components
4. Document decisions and progress

Let's start by setting up the project structure and initial Cloudflare Workers configuration using Wrangler.

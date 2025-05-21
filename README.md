# Better Beans MCP Server

A Model Context Protocol (MCP) server for discovering specialty coffee roasters and their products. This service enables AI assistants to search for and retrieve information about coffee roasters and products using the Cloudflare MCP Server protocol.

## Project Overview

- **Type**: Read-only MCP server for coffee discovery
- **Deployment Target**: Cloudflare Workers
- **Database**: Supabase PostgreSQL
- **Protocol**: JSON-RPC 2.0 following Cloudflare MCP Server specifications

## Features

- Search for coffee roasters by name, location, and attributes
- Get detailed information about specific roasters
- Search for coffee products by various criteria
- Get detailed information about specific coffee products
- Find similar coffees using flavor profile matching

## Project Structure

```
├── src/
│   ├── handlers/        # Request handlers (health, manifest, rpc)
│   ├── services/        # Business logic for roasters and coffees
│   ├── database/        # Database access layer
│   ├── schema/          # Zod schemas and type definitions
│   ├── utils/           # Helper functions
│   ├── auth/            # API key validation and security
│   ├── vector/          # Vector embedding search functionality
│   └── index.js         # Main entry point
├── test/                # Test files mirroring src structure
└── wrangler.toml        # Cloudflare configuration
```

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Wrangler CLI (`npm install -g wrangler`)
- Supabase account with an existing project

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd better-beans-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` (if it exists)
   - Update Supabase URL and key in `wrangler.toml`
   - Add secrets using Wrangler:
     ```
     wrangler secret put SUPABASE_KEY
     wrangler secret put API_KEYS_SALT
     ```

### Development

Start a local development server:

```
npm run dev
```

This will start a local server at http://localhost:8787.

### Testing

Run the test suite:

```
npm test
```

Watch mode for development:

```
npm run test:watch
```

### Deployment

Deploy to Cloudflare Workers:

```
npm run deploy
```

For staging environment:

```
npm run deploy:staging
```

For production environment:

```
npm run deploy:production
```

## API Endpoints

- `/health` - Health check endpoint
- `/manifest` - MCP server manifest
- `/rpc` - JSON-RPC endpoint for MCP method calls

## MCP Methods

- `search_coffee_roasters` - Find coffee roasters based on search criteria
- `get_roaster_details` - Get detailed information about a specific roaster
- `search_coffee_products` - Find coffee products based on search criteria
- `get_coffee_product_details` - Get detailed information about a specific coffee product
- `similarity_search` - Find similar coffees based on taste profile

## Security

- Input validation with Zod schemas
- Parameterized database queries
- API key authentication
- Rate limiting
- Proper error handling

## License

[Specify license information]

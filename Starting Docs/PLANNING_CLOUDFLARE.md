# Better Beans MCP Server - Planning Document

## Project Overview

**Project Name**: Better Beans MCP Server  
**Type**: Read-only MCP (Model Context Protocol) server for coffee roaster discovery  
**Deployment Target**: Cloudflare Workers  
**Database**: Existing Supabase PostgreSQL (project ID: izdbjqabwtenpgxopmyf)  
**Primary Language**: JavaScript/TypeScript

### Project Purpose

The Better Beans MCP server will enable AI assistants to discover and retrieve information about coffee roasters and their products. This is a read-only service designed to integrate with AI assistants through the Model Context Protocol (MCP).

### MCP Server Specification

Following Cloudflare's Remote MCP Server specifications, this server will:

1. Implement the MCP Server protocol for handling tool calls from AI agents
2. Support the JSON-RPC 2.0 standard for communication
3. Conform to the required API endpoints and response formats
4. Provide reliable tool management and execution

## Technical Architecture

### Technology Stack

- **Runtime Environment**: Cloudflare Workers
- **Language**: JavaScript/TypeScript
- **Database Access**: Supabase JavaScript Client
- **API Framework**: Cloudflare Workers API (fetch event handlers)
- **Schema Validation**: Zod
- **Vector Embeddings**: Cloudflare Vector Engine or Supabase pgvector
- **Testing**: Vitest, Miniflare
- **Protocol**: JSON-RPC 2.0 over HTTP

### System Components

1. **MCP Request Handler**
   - Validates incoming MCP requests following JSON-RPC 2.0 spec
   - Routes to appropriate service based on method name
   - Handles error cases and response formatting
   - Implements the required MCP Server endpoints:
     - `/health`: Health check endpoint
     - `/rpc`: Main JSON-RPC endpoint for tool execution

2. **Roaster Discovery Service**
   - Search for coffee roasters by name, location, etc.
   - Filter roasters by characteristics (organic, fair trade, etc.)
   - Return formatted roaster information

3. **Coffee Product Service**
   - Search for coffee products by roaster, origin, etc.
   - Filter coffees by characteristics (processing method, flavor notes, etc.)
   - Return formatted coffee product information

4. **Semantic Search Service**
   - Handle similarity-based coffee and roaster searches
   - Process vector embeddings for semantic matching
   - Optimize relevance ranking

5. **Database Integration Layer**
   - Secure parameterized query execution
   - Query optimization for Supabase PostgreSQL
   - Connection pooling and error handling

6. **Security Module**
   - Request authentication and validation
   - Rate limiting and abuse prevention
   - Input sanitization

### Data Flow Architecture

```
                                   ┌─────────────────────┐
                                   │                     │
                                   │  Cloudflare Worker  │
                                   │                     │
                                   └──────────┬──────────┘
                                              │
                                              ▼
┌────────────────┐              ┌─────────────────────────┐
│                │              │                         │
│ MCP Client     │──────────────▶ MCP Request Handler     │
│ (AI Assistant) │              │                         │
│                │◀─────────────│                         │
└────────────────┘              └──────────┬──────────────┘
                                           │
                                           │
                          ┌────────────────┼─────────────────┐
                          │                │                 │
                          ▼                ▼                 ▼
           ┌───────────────────┐  ┌────────────────┐ ┌──────────────────┐
           │                   │  │                │ │                  │
           │ Roaster Discovery │  │ Coffee Product │ │ Semantic Search  │
           │ Service           │  │ Service        │ │ Service          │
           │                   │  │                │ │                  │
           └─────────┬─────────┘  └────────┬───────┘ └────────┬─────────┘
                     │                     │                   │
                     └──────────┬──────────┘                   │
                                │                              │
                                ▼                              │
                     ┌────────────────────┐                    │
                     │                    │                    │
                     │ Database           │◀───────────────────┘
                     │ Integration Layer  │
                     │                    │
                     └─────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │                     │
                    │ Supabase PostgreSQL │
                    │                     │
                    └─────────────────────┘
```

### Database Schema

The system uses an existing Supabase PostgreSQL database with the following schema:

#### Table: `roasters`

| Column                | Type                     | Nullable | Default     | Description                                   |
|-----------------------|--------------------------|----------|-------------|-----------------------------------------------|
| id                    | uuid                     | NO       | uuid_generate_v4() | Primary key                               |
| roaster_name          | text                     | NO       | null        | Name of the coffee roaster                   |
| address_line1         | text                     | YES      | null        | First line of roaster's address              |
| address_line2         | text                     | YES      | null        | Second line of roaster's address             |
| city                  | text                     | YES      | null        | City where roaster is located                |
| state                 | text                     | YES      | null        | State/province where roaster is located      |
| zip                   | text                     | YES      | null        | Postal/ZIP code                              |
| founded_year          | integer                  | YES      | null        | Year the roaster was founded                 |
| about_us              | text                     | YES      | null        | Description of the roaster                   |
| primary_contact_email | text                     | YES      | null        | Primary contact email address                |
| primary_contact_name  | text                     | YES      | null        | Primary contact person's name                |
| secondary_contact_email | text                   | YES      | null        | Secondary contact email address              |
| secondary_contact_name | text                    | YES      | null        | Secondary contact person's name              |
| phone_number          | text                     | YES      | null        | Roaster's phone number                       |
| website_url           | text                     | YES      | null        | URL to roaster's website                     |
| logo_url              | text                     | YES      | null        | URL to roaster's logo image                  |
| instagram_profile     | text                     | YES      | null        | Instagram profile handle                     |
| x_profile             | text                     | YES      | null        | Twitter/X profile handle                     |
| facebook_profile      | text                     | YES      | null        | Facebook profile link                        |
| tiktok_profile        | text                     | YES      | null        | TikTok profile handle                        |
| youtube_profile       | text                     | YES      | null        | YouTube channel link                         |
| is_featured           | boolean                  | YES      | false       | Whether roaster is featured                  |
| is_active             | boolean                  | YES      | true        | Whether roaster is active                    |
| created_at            | timestamp with time zone | YES      | now()       | Record creation timestamp                    |
| updated_at            | timestamp with time zone | YES      | now()       | Record update timestamp                     |
| latitude              | numeric(10,7)            | YES      | null        | Geographic latitude                         |
| longitude             | numeric(10,7)            | YES      | null        | Geographic longitude                        |
| removal_type          | character varying(10)    | YES      | null        | How to handle removed content (redirect/gone) |

#### Table: `coffees`

| Column                | Type                     | Nullable | Default     | Description                                 |
|-----------------------|--------------------------|----------|-------------|---------------------------------------------|
| id                    | uuid                     | NO       | uuid_generate_v4() | Primary key                             |
| roaster_id            | uuid                     | NO       | null        | Foreign key to roasters table              |
| coffee_name           | text                     | NO       | null        | Name of the coffee                         |
| process_method        | text                     | YES      | null        | Processing method (washed, natural, etc.)  |
| roast_level           | text                     | YES      | null        | Level of roast (light, medium, dark)       |
| coffee_description    | text                     | YES      | null        | Description of the coffee                   |
| coffee_type           | text                     | YES      | null        | Type of coffee                             |
| acidity_level         | text                     | YES      | null        | Level of acidity                           |
| is_caffeinated        | boolean                  | YES      | true        | Whether coffee contains caffeine           |
| price                 | numeric                  | YES      | null        | Price                                      |
| bag_size              | text                     | YES      | null        | Size of coffee bag                         |
| is_available          | boolean                  | YES      | true        | Whether coffee is currently available      |
| image_url             | text                     | YES      | null        | URL to coffee image                        |
| slug                  | text                     | YES      | null        | URL-friendly identifier                     |
| product_url           | text                     | YES      | null        | URL to product page                        |
| flavor_tags           | text[]                   | YES      | null        | Array of flavor profile tags               |
| certification_types   | text[]                   | YES      | null        | Array of certifications                    |
| origin                | text[]                   | YES      | null        | Array of origin locations                  |
| bean_variety          | text[]                   | YES      | null        | Array of bean varieties                    |
| grind_options         | text[]                   | YES      | null        | Array of available grind options           |
| brewing_methods       | text[]                   | YES      | null        | Array of recommended brewing methods       |
| created_at            | timestamp with time zone | YES      | now()       | Record creation timestamp                  |
| updated_at            | timestamp with time zone | YES      | now()       | Record update timestamp                    |
| removal_type          | character varying(10)    | YES      | null        | How to handle removed content (redirect/gone) |
| flavor_embedding      | vector                   | YES      | null        | Vector embedding for semantic search       |

#### Table: `api_keys` (To be created)

| Column            | Type                     | Nullable | Default     | Description                                 |
|-------------------|--------------------------|----------|-------------|---------------------------------------------|
| id                | uuid                     | NO       | uuid_generate_v4() | Primary key                             |
| key_hash          | text                     | NO       | null        | Hashed API key                             |
| name              | text                     | NO       | null        | Name for the API key                       |
| permissions       | text[]                   | YES      | null        | Array of permissions granted to this key   |
| rate_limit        | integer                  | YES      | 60          | Rate limit per minute                      |
| created_at        | timestamp with time zone | YES      | now()       | Record creation timestamp                  |
| updated_at        | timestamp with time zone | YES      | now()       | Record update timestamp                    |
| expires_at        | timestamp with time zone | YES      | null        | Expiration date (null if no expiration)    |
| last_used_at      | timestamp with time zone | YES      | null        | Last usage timestamp                       |
| created_by        | uuid                     | YES      | null        | Reference to the creator of this key       |
| is_active         | boolean                  | YES      | true        | Whether the key is active                  |

#### Relationships

- `coffees.roaster_id` → `roasters.id` (Many coffees belong to one roaster)

#### Other Tables

The database also contains the following auxiliary tables that won't be directly exposed through the MCP API:

- `clicks`: Tracks click data for analytics purposes
- `roaster_leads`: Stores potential roaster leads for future outreach
- `subscribers`: Manages newsletter subscribers
- `pending_embeddings`: Manages the queue for vector embedding generation

## Security Requirements

1. **Input Validation and Sanitization**
   - All user inputs must be validated using Zod schemas
   - Implement strict type checking for all parameters
   - Sanitize inputs to prevent injection attacks

2. **Database Query Security**
   - Use parameterized queries exclusively
   - No string concatenation for SQL queries
   - Implement proper error handling that doesn't leak database details
   - Use column names exactly as defined in the database schema
   - Explicitly define all selected columns (no `SELECT *`)
   - Create typed interfaces for all database entities

3. **Authentication and Authorization**
   - Implement proper API key validation using the `api_keys` table
   - Hash API keys before storing in the database
   - Include rate limiting per API key based on the `rate_limit` field
   - Check key validity and permissions for each request
   - Use Cloudflare Workers environment variables for secrets
   - Implement proper key rotation mechanisms

4. **Network Security**
   - TLS for all connections (provided by Cloudflare)
   - Proper CORS configuration
   - HTTP security headers

5. **Error Handling**
   - Implement custom error types
   - Avoid exposing internal errors to clients
   - Log errors for monitoring without sensitive information

6. **Rate Limiting and Abuse Prevention**
   - Implement Cloudflare rate limiting
   - Add circuit breakers for database connections
   - Monitor and alert on suspicious activity

## MCP Integration

### MCP Server Protocol Implementation

The server will fully implement the MCP Server protocol as defined by Cloudflare:

1. **Server Manifest**
   - Provide a `/manifest` endpoint returning tool definitions
   - Include tool descriptions, parameter schemas, and examples
   - Support proper versioning of tools

2. **JSON-RPC Endpoints**
   - Implement the required `/rpc` endpoint to handle JSON-RPC requests
   - Support both HTTP POST requests and SSE for streaming responses
   - Provide proper error handling with standard error codes

3. **Health Checking**
   - Implement the `/health` endpoint for monitoring
   - Return appropriate status codes and response format

### MCP Methods

The server will expose the following MCP methods:

1. `search_coffee_roasters`: Find coffee roasters based on search criteria
2. `get_roaster_details`: Get detailed information about a specific roaster
3. `search_coffee_products`: Find coffee products based on search criteria
4. `get_coffee_product_details`: Get detailed information about a specific coffee product
5. `similarity_search`: Find similar coffees based on taste profile

### MCP Method Schemas

All method schemas will be defined using Zod and enforced at runtime. They will follow the JSON Schema specification as required by the MCP Server protocol.

Example schema for `search_coffee_roasters`:

```javascript
const searchRoastersSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  maxResults: z.number().int().min(1).max(50).default(10),
  filters: z.object({
    organic: z.boolean().optional(),
    fairTrade: z.boolean().optional(),
    directTrade: z.boolean().optional(),
    subscription: z.boolean().optional(),
  }).optional(),
});
```

The manifest will expose this schema in JSON Schema format:

```json
{
  "description": "Find coffee roasters based on search criteria",
  "name": "search_coffee_roasters",
  "parameters": {
    "properties": {
      "query": {
        "type": "string",
        "description": "Search term for finding roasters"
      },
      "location": {
        "type": "string",
        "description": "Geographic location to search within"
      },
      "maxResults": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "default": 10,
        "description": "Maximum number of results to return"
      },
      "filters": {
        "type": "object",
        "properties": {
          "organic": {
            "type": "boolean",
            "description": "Only show organic certified roasters"
          },
          "fairTrade": {
            "type": "boolean",
            "description": "Only show fair trade certified roasters"
          },
          "directTrade": {
            "type": "boolean",
            "description": "Only show direct trade roasters"
          },
          "subscription": {
            "type": "boolean",
            "description": "Only show roasters offering subscriptions"
          }
        }
      }
    },
    "type": "object"
  }
}
```

### Prompt Templates

These templates guide AI assistants on how to use the MCP methods effectively:

#### Search Coffee Roasters
```
To find coffee roasters, you can use the search_coffee_roasters method.

Example parameters:
{
  "query": "specialty coffee",
  "location": "portland",
  "maxResults": 5,
  "filters": {
    "organic": true
  }
}

This will return information about organic specialty coffee roasters in Portland.
```

#### Get Roaster Details
```
To get detailed information about a specific coffee roaster, use the get_roaster_details method.

Example parameters:
{
  "roasterId": "123e4567-e89b-12d3-a456-426614174000"
}

This will return comprehensive information about the specified roaster, including their story, sourcing practices, and available coffees.
```

#### Search Coffee Products
```
To find coffee products, use the search_coffee_products method.

Example parameters:
{
  "query": "ethiopia",
  "roasterId": "123e4567-e89b-12d3-a456-426614174000",
  "maxResults": 5,
  "filters": {
    "processMethod": "washed",
    "flavorProfile": ["fruity", "floral"]
  }
}

This will return information about washed Ethiopian coffees with fruity and floral notes from the specified roaster.
```

#### Get Coffee Product Details
```
To get detailed information about a specific coffee product, use the get_coffee_product_details method.

Example parameters:
{
  "productId": "123e4567-e89b-12d3-a456-426614174000"
}

This will return comprehensive information about the specified coffee product, including origin, processing, flavor notes, and brewing recommendations.
```

#### Similarity Search
```
To find coffees similar to a specific flavor profile, use the similarity_search method.

Example parameters:
{
  "flavorProfile": ["chocolate", "nutty", "caramel"],
  "maxResults": 5
}

This will return coffees with similar flavor profiles to the specified combination of chocolate, nutty, and caramel notes.
```

## MCP Server-Specific Requirements

### JSON-RPC Implementation

1. **Request Handling**
   - Support the JSON-RPC 2.0 specification
   - Accept POST requests to the `/rpc` endpoint
   - Validate all requests match the required format:
     ```json
     {
       "jsonrpc": "2.0",
       "id": "unique-request-id",
       "method": "method-name",
       "params": {}
     }
     ```

2. **Response Formatting**
   - For success responses:
     ```json
     {
       "jsonrpc": "2.0",
       "id": "unique-request-id",
       "result": {}
     }
     ```
   - For error responses:
     ```json
     {
       "jsonrpc": "2.0",
       "id": "unique-request-id",
       "error": {
         "code": -32603,
         "message": "Internal error"
       }
     }
     ```

3. **Streaming Support**
   - Implement Server-Sent Events (SSE) for streaming responses
   - Format partial results correctly
   - Handle client disconnections gracefully

### Server Manifest

The server will implement a `/manifest` endpoint returning:

```json
{
  "schema_version": "v1",
  "name_for_human": "Better Beans Coffee Discovery",
  "name_for_model": "better_beans",
  "description_for_human": "Search for coffee roasters and products from specialty roasters around the world.",
  "description_for_model": "This tool helps find coffee roasters and their products based on various criteria including location, flavor profile, and certifications. Use this when looking for coffee recommendations or information about coffee roasters.",
  "auth": {
    "type": "none"
  },
  "api": {
    "type": "jsonrpc",
    "url": "https://better-beans-mcp.example.com/rpc"
  },
  "functions": [
    /* All function definitions will be listed here */
  ]
}
```

## Development Guidelines

1. **Code Organization**
   - Maximum 500 lines per file
   - Clear separation of concerns
   - Modular design with single responsibility principle
   - Conform to MCP Server specification

2. **Documentation**
   - JSDoc comments for all functions and classes
   - Clear README with setup and usage instructions
   - Inline comments for complex logic
   - Comprehensive examples for each MCP method

3. **Error Handling**
   - Custom error classes
   - Standard JSON-RPC error codes
   - Consistent error response format
   - Appropriate error logging

4. **Testing**
   - Unit tests for all business logic
   - Integration tests for database operations
   - End-to-end tests for MCP method workflows
   - Verify compliance with MCP Server specification

5. **Performance**
   - Optimize database queries
   - Implement caching where appropriate
   - Monitor and optimize Cloudflare Worker CPU/memory usage
   - Handle concurrent requests efficiently

6. **Deployment**
   - CI/CD pipeline with GitHub Actions
   - Staging and production environments
   - Automated testing before deployment
   - Proper versioning of the API

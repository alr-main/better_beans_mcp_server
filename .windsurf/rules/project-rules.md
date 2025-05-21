---
trigger: always_on
---

# Windsurf Rules for Better Beans MCP Server

These rules establish consistent development practices and standards for the Better Beans MCP Server project.

## Code Organization & Architecture

1. **Module Structure**
   - Organize code into feature-based modules
   - Each MCP method should have its own file
   - Maximum 500 lines per file
   - Use clear folder structure:
     ```
     ├── src/
     │   ├── handlers/         # Request handlers (health, manifest, rpc)
     │   ├── services/         # Business logic for roasters and coffees
     │   ├── database/         # Database access layer
     │   ├── schema/           # Zod schemas and type definitions
     │   ├── utils/            # Helper functions
     │   ├── auth/             # API key validation and security
     │   ├── vector/           # Vector embedding search functionality
     │   └── index.js          # Main entry point
     ├── test/                 # Test files mirroring src structure
     └── wrangler.toml         # Cloudflare configuration
     ```

2. **Naming Conventions**
   - Use camelCase for variables, functions, and method names
   - Use PascalCase for classes, interfaces, and type aliases
   - Use UPPER_CASE for constants
   - Use descriptive names that reflect purpose

3. **TypeScript Usage**
   - Use TypeScript for all files (.ts extension)
   - Define interfaces for all database entities matching exact column names
   - No usage of `any` type except in extreme cases with proper comments
   - Use type assertions sparingly and only when necessary

## Database Interaction

1. **Query Safety**
   - Use parameterized queries exclusively
   - No string concatenation for dynamic SQL
   - Use column names exactly as defined in the schema
   - Create typed interfaces for all database entities

2. **Error Handling**
   - Implement proper error handling for all database operations
   - Log database errors without exposing sensitive information
   - Provide meaningful error messages to clients

3. **Optimization**
   - Select only needed columns (no `SELECT *`)
   - Limit result sets to necessary size
   - Implement caching where appropriate

## MCP Server Implementation

1. **JSON-RPC Compliance**
   - Strictly follow JSON-RPC 2.0 specification
   - Validate all request objects against the spec
   - Return proper error codes and messages
   - Implement proper batch request handling

2. **Method Implementation**
   - Each method must validate input parameters with Zod
   - Methods must be pure functions where possible
   - Separate business logic from request handling

3. **Manifest Endpoint**
   - Keep manifest definition in a separate file
   - Ensure all method schemas are consistent with implementations
   - Include comprehensive examples in function descriptions

4. **Response Formatting**
   - Format all responses consistently
   - Include only necessary data in responses
   - Follow consistent JSON structure
   - Ensure proper serialization of special types

## Security Practices

1. **API Key Management**
   - Hash API keys before storing
   - Validate keys on every request
   - Implement rate limiting
   - Verify permissions for each operation

2. **Input Validation**
   - Validate all inputs with Zod schemas
   - Sanitize all user-provided data
   - Implement strict type checking

3. **Error Exposure**
   - Never expose internal errors to clients
   - Log detailed errors for debugging
   - Return generic errors to clients

## Testing

1. **Test Coverage**
   - Write tests for all MCP methods
   - Test both success and failure scenarios
   - Test edge cases and boundary conditions

2. **Test Organization**
   - Organize tests to mirror source code structure
   - Use descriptive test names
   - Group related tests with describe blocks

3. **Mocking**
   - Mock external dependencies (Supabase, etc.)
   - Create fixture data for testing
   - Use dependency injection to facilitate testing

## Performance Optimization

1. **Worker Efficiency**
   - Optimize for cold start performance
   - Minimize dependencies
   - Use streaming where appropriate
   - Avoid large in-memory data structures

2. **Caching Strategy**
   - Use proper cache headers
   - Implement cache invalidation strategy

3. **Vector Search Optimization**
   - Limit vector search results to enhance performance
   - Implement fallback for cases where vector search is slow

## Deployment & CI/CD

1. **Versioning**
   - Use semantic versioning
   - Tag all releases
   - Update version in manifest

2. **Environment Configuration**
   - Use environment variables for configuration
   - Keep secrets in Cloudflare Workers secrets
   - Maintain separate environments (dev, staging, prod)

3. **Deployment Process**
   - Run all tests before deployment
   - Validate API contract before deployment
   - Implement zero-downtime deployments

## Documentation

1. **Code Documentation**
   - Document all functions with JSDoc comments
   - Document all parameters and return types
   - Explain complex logic with inline comments
2. **API Documentation**
   - Maintain comprehensive API documentation
   - Document all methods, parameters, and responses
   - Include usage examples
3. **Readme and Setup**
   - Maintain clear README with setup instructions
   - Document environment requirements

## Logging & Monitoring

1. **Logging Standards**
   - Use structured logging
   - Include appropriate context in logs
   - Log all errors and significant events
   - Avoid logging sensitive information

2. **Monitoring**
   - Implement health checks
   - Monitor error rates
   - Track performance metrics

## Development Practices

1. **Package Management**
   - Always use the most recent stable package versions
   - Document all dependencies with exact versions in package.json

## Project Management
   - Update TASKS_CLOUDFLARE.md at the beginning and end of each work session
   - Mark completed tasks promptly
   - Add newly discovered tasks or requirements as they arise

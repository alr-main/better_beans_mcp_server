/**
 * MCP Method Schemas
 * Defines the JSON schema for each MCP method
 */

/**
 * JSON Schema definitions for all MCP methods
 */
export const methodSchemas = {
  /**
   * Schema for search_coffee_roasters method
   */
  searchCoffeeRoasters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term for finding roasters'
      },
      location: {
        type: 'string',
        description: 'Geographic location to search within'
      },
      maxResults: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum number of results to return'
      },
      filters: {
        type: 'object',
        properties: {
          organic: {
            type: 'boolean',
            description: 'Only show organic certified roasters'
          },
          fairTrade: {
            type: 'boolean',
            description: 'Only show fair trade certified roasters'
          },
          directTrade: {
            type: 'boolean',
            description: 'Only show direct trade roasters'
          },
          subscription: {
            type: 'boolean',
            description: 'Only show roasters offering subscriptions'
          }
        }
      }
    }
  },

  /**
   * Schema for get_roaster_details method
   */
  getRoasterDetails: {
    type: 'object',
    required: ['roasterId'],
    properties: {
      roasterId: {
        type: 'string',
        description: 'UUID of the roaster to retrieve details for'
      }
    }
  },

  /**
   * Schema for search_coffee_products method
   */
  searchCoffeeProducts: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term for finding coffee products'
      },
      roasterId: {
        type: 'string',
        description: 'Optional UUID of a specific roaster to filter by'
      },
      maxResults: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum number of results to return'
      },
      filters: {
        type: 'object',
        properties: {
          processMethod: {
            type: 'string',
            description: 'Filter by processing method (e.g., washed, natural)'
          },
          roastLevel: {
            type: 'string',
            description: 'Filter by roast level (e.g., light, medium, dark)'
          },
          origin: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Filter by origin countries or regions'
          },
          flavorProfile: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Filter by flavor notes'
          },
          isCaffeinated: {
            type: 'boolean',
            description: 'Filter by caffeination status'
          }
        }
      }
    }
  },

  /**
   * Schema for get_coffee_product_details method
   */
  getCoffeeProductDetails: {
    type: 'object',
    required: ['productId'],
    properties: {
      productId: {
        type: 'string',
        description: 'UUID of the coffee product to retrieve details for'
      }
    }
  },

  /**
   * Schema for similarity_search method
   */
  similaritySearch: {
    type: 'object',
    required: ['flavorProfile'],
    properties: {
      flavorProfile: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Array of flavor notes to search for similar coffees'
      },
      maxResults: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 10,
        description: 'Maximum number of results to return'
      }
    }
  }
};

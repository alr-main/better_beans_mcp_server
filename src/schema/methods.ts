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
    description: 'Find coffee roasters based on search criteria. To list all roasters, omit the query parameter or leave it empty. For targeted searches, use terms like "coffee", "roast", or city names like "Portland". For location-based searches, you can use either a text location or precise coordinates.',
    properties: {
      query: {
        type: 'string',
        description: 'Search term for finding roasters by name. Example values: "coffee", "roast", or city names. Optional - omit to list all roasters.'
      },
      location: {
        type: 'string',
        description: 'Text-based geographic location to search within (e.g., "Portland", "New York")'
      },
      coordinates: {
        type: 'object',
        description: 'Precise geographic coordinates for finding nearby roasters',
        properties: {
          latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Latitude coordinate (between -90 and 90)'
          },
          longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Longitude coordinate (between -180 and 180)'
          },
          radiusMiles: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            default: 60,
            description: 'Search radius in miles (1-500, default 60)'
          }
        }
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
    description: 'Get detailed information about a specific coffee roaster, including their location, contact information, and available coffees. First use search_coffee_roasters to find a roaster, then use this method with the returned ID.',
    required: ['roasterId'],
    properties: {
      roasterId: {
        type: 'string',
        description: 'UUID of the roaster to retrieve details for. This ID must be obtained from the search_coffee_roasters method results.'
      }
    }
  },

  /**
   * Schema for search_coffee_products method
   */
  searchCoffeeProducts: {
    type: 'object',
    description: 'Search for coffee products by name, origin, or roaster. Best for general searches by text, NOT for flavor-based queries. For flavor-specific searches (like "fruity", "chocolatey", etc.), use the similarity_search method instead.',
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
    description: 'Get detailed information about a specific coffee product, including origin, flavor profile, and processing details. First use search_coffee_products to find a coffee, then use this method with the returned ID.',
    required: ['productId'],
    properties: {
      productId: {
        type: 'string',
        description: 'UUID of the coffee product to retrieve details for. This ID must be obtained from search_coffee_products method results.'
      }
    }
  },

  /**
   * Schema for similarity_search method
   */
  similaritySearch: {
    type: 'object',
    description: 'PREFERRED METHOD FOR FLAVOR-BASED SEARCHES. Use this tool whenever searching for coffees by flavor characteristics like "fruity", "chocolatey", "nutty", "berry", "citrus", etc. This provides more accurate results than text search for flavor profiles.',
    required: ['flavorProfile'],
    properties: {
      flavorProfile: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Array of flavor notes to search for similar coffees. Example values: ["chocolate", "berry", "citrus"], ["nutty", "caramel"], etc.'
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

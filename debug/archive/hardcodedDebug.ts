/**
 * Hardcoded Debug Route
 * Returns a fixed set of chocolate coffee results for testing Claude integration
 */
import { Env } from '../index.js';
import { createCorsResponse } from '../utils/corsUtils.js';

/**
 * Handle requests to the debug hardcoded endpoint
 * Always returns chocolate coffee results in the exact format Claude expects
 */
export async function handleHardcodedRequest(request: Request, env: Env): Promise<Response> {
  console.error('🧪 Hardcoded debug route called');
  
  // The exact same coffee results every time
  const hardcodedResults = {
    query: { flavorProfile: ["chocolate", "dark chocolate", "cocoa"] },
    results: [
      {
        coffee: {
          id: "11234567-89ab-cdef-0123-456789abcdef",
          name: "Eleven of Spades",
          roastLevel: "medium-dark",
          processMethod: "washed",
          description: "A complex coffee with chocolate, dark fruit, and german chocolate notes.",
          price: 16.99,
          imageUrl: "https://extractocoffee.com/images/eleven-of-spades.jpg",
          productUrl: "https://extractocoffee.com/products/eleven-of-spades",
          flavorTags: ["chocolate", "dark fruit", "german chocolate"],
          roaster: { id: "10000000-0000-0000-0000-000000000002", name: "Extracto Coffee Roasters" }
        },
        similarityScore: 0.89,
        matchingTags: ["chocolate"],
        distance: 0.11
      },
      {
        coffee: {
          id: "21234567-89ab-cdef-0123-456789abcdef",
          name: "Goose Hollow",
          roastLevel: "dark",
          processMethod: "natural",
          description: "Rich and creamy with prominent dark chocolate notes.",
          price: 15.49,
          imageUrl: "https://www.portlandcoffeeroasters.com/images/goose-hollow.jpg",
          productUrl: "https://www.portlandcoffeeroasters.com/consumer/goose-hollow-whole-bean-12oz",
          flavorTags: ["dark chocolate", "creamy"],
          roaster: { id: "10000000-0000-0000-0000-000000000003", name: "Portland Coffee Roasters" }
        },
        similarityScore: 0.82,
        matchingTags: ["dark chocolate"],
        distance: 0.18
      },
      {
        coffee: {
          id: "31234567-89ab-cdef-0123-456789abcdef",
          name: "Sinless Pastry",
          roastLevel: "medium",
          processMethod: "washed",
          description: "A delightful coffee with cinnamon, almond, and macaroon notes.",
          price: 14.49,
          imageUrl: "https://www.churchillcoffee.com/images/sinless-pastry.jpg",
          productUrl: "https://www.churchillcoffee.com/products/sinless-pastry",
          flavorTags: ["cinnamon", "almond", "macaroon"],
          roaster: { id: "10000000-0000-0000-0000-000000000004", name: "Churchill Coffee Company" }
        },
        similarityScore: 0.78,
        matchingTags: [],
        distance: 0.22
      }
    ],
    totalResults: 3,
    hardcodedTest: true
  };

  // JSON-RPC 2.0 success response with the Claude-specific format
  const rpcResponse = {
    jsonrpc: "2.0",
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(hardcodedResults)
        }
      ]
    },
    id: 1
  };

  // Return the hardcoded response
  console.error('🎯 Returning hardcoded chocolate coffee results');
  return createCorsResponse(
    new Response(JSON.stringify(rpcResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  );
}

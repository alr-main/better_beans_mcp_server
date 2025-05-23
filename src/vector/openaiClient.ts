/**
 * OpenAI Client Module
 * Provides a simple interface for generating embeddings using OpenAI's API
 */
import { Env } from '../index.js';

// Default embedding model to use
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

// Dimensionality of the embedding model
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;

/**
 * Get an embedding for a flavor profile text using OpenAI's API
 * 
 * @param text - The text to generate an embedding for
 * @param env - Environment variables including OpenAI API key
 * @param model - Optional embedding model to use
 * @returns Vector embedding as an array of numbers
 */
export async function getOpenAIEmbedding(
  text: string,
  env: Env,
  model: string = DEFAULT_EMBEDDING_MODEL
): Promise<number[]> {
  try {
    if (!env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      throw new Error('OpenAI API key is not configured');
    }

    console.log(`Generating embedding for text (length ${text.length}) using model: ${model}`);
    
    // Prepare the API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          input: text
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (${response.status}):`, errorText);
        throw new Error(`OpenAI API returned ${response.status}: ${errorText}`);
      }

      // Define the expected response type
      interface OpenAIEmbeddingResponse {
        data: {
          embedding: number[];
          index: number;
          object: string;
        }[];
        model: string;
        object: string;
        usage: {
          prompt_tokens: number;
          total_tokens: number;
        };
      }

      const data = await response.json() as OpenAIEmbeddingResponse;
      
      // Validate that we got a proper response with embeddings
      if (!data || !data.data || !data.data[0] || !data.data[0].embedding) {
        console.error('Invalid response from OpenAI API:', JSON.stringify(data).substring(0, 200));
        throw new Error('Invalid response format from OpenAI API');
      }
      
      const embedding = data.data[0].embedding;
      
      // Verify we have exactly 1536 dimensions as required by our database schema
      if (!Array.isArray(embedding)) {
        console.error('Embedding is not an array');
        throw new Error('OpenAI returned embedding is not an array');
      }
      
      if (embedding.length !== OPENAI_EMBEDDING_DIMENSIONS) {
        console.error(`Invalid embedding dimensions: got ${embedding.length}, expected ${OPENAI_EMBEDDING_DIMENSIONS}`);
        throw new Error(`OpenAI embedding has incorrect dimensions: ${embedding.length}`);
      }
      
      // Validate that all values are numbers
      for (let i = 0; i < embedding.length; i++) {
        if (typeof embedding[i] !== 'number' || isNaN(embedding[i])) {
          console.error(`Invalid value in embedding at position ${i}: ${embedding[i]}`);
          throw new Error(`OpenAI embedding contains invalid values`);
        }
      }
      
      console.log(`Successfully generated ${embedding.length}-dimensional embedding`);
      return embedding;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error generating OpenAI embedding:', error);
    throw error;
  }
}

/**
 * Generates a flavor profile embedding from an array of flavor tags
 * 
 * @param flavorTags - Array of flavor tags to embed
 * @param env - Environment variables including OpenAI API key
 * @returns Vector embedding as an array of numbers
 */
export async function getFlavorProfileEmbedding(
  flavorTags: string[],
  env: Env
): Promise<number[]> {
  // Normalize and prepare flavor tags
  const normalizedTags = flavorTags.map(tag => tag.toLowerCase().trim());
  
  // Create a textual description that captures the flavor profile
  // Format: "Coffee with flavors of [tag1], [tag2], and [tag3]"
  let flavorText = 'Coffee with flavors of ';
  
  if (normalizedTags.length === 1) {
    flavorText += normalizedTags[0];
  } else if (normalizedTags.length === 2) {
    flavorText += `${normalizedTags[0]} and ${normalizedTags[1]}`;
  } else {
    const lastTag = normalizedTags.pop();
    flavorText += `${normalizedTags.join(', ')}, and ${lastTag}`;
  }
  
  // Get embedding for the flavor profile text
  return getOpenAIEmbedding(flavorText, env);
}

/**
 * Generates a fallback embedding when OpenAI API is unavailable
 * Uses a simple hash-based approach to distribute flavor tags across the vector space
 * 
 * @param flavorTags - Array of flavor tags to embed
 * @returns Fallback vector embedding
 */
export function generateFallbackEmbedding(flavorTags: string[]): number[] {
  // Create a vector of zeros with the correct dimensionality
  const embedding = new Array(OPENAI_EMBEDDING_DIMENSIONS).fill(0);
  
  // Simple hash function to convert strings to numbers
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
  
  // Set dimensions based on hashed flavor tags
  for (const tag of flavorTags) {
    const normalizedTag = tag.toLowerCase().trim();
    const hash = hashString(normalizedTag);
    
    // Set multiple dimensions for each tag to create a unique pattern
    for (let i = 0; i < 4; i++) {
      const index = (hash + i * 739) % OPENAI_EMBEDDING_DIMENSIONS;
      embedding[index] = 1.0;
    }
  }
  
  // Normalize the vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return embedding.map(val => val / magnitude);
  }
  
  return embedding;
}

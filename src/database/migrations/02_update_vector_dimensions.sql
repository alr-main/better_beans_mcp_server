-- Update vector dimensions for OpenAI embeddings
-- This migration alters the coffees table to use 1536-dimensional vectors for OpenAI embeddings

-- First, ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create update_logs table for debugging embedding updates
CREATE TABLE IF NOT EXISTS update_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation text NOT NULL,
  coffee_id uuid REFERENCES coffees(id),
  error_message text,
  success boolean DEFAULT false,
  timestamp timestamptz DEFAULT NOW(),
  details jsonb
);

-- Drop the existing index to allow column type change
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'coffees_flavor_embedding_idx'
    AND n.nspname = 'public'
  ) THEN
    DROP INDEX coffees_flavor_embedding_idx;
  END IF;
END
$$;

-- Alter the flavor_embedding column to use 1536 dimensions
ALTER TABLE coffees 
  ALTER COLUMN flavor_embedding TYPE vector(1536) USING NULL;

-- Recreate the HNSW index for the new dimensions
CREATE INDEX coffees_flavor_embedding_idx 
ON coffees USING hnsw (flavor_embedding vector_cosine_ops);

-- Create a function to update coffee embeddings via RPC
-- This is safer than direct updates for vector types
CREATE OR REPLACE FUNCTION update_coffee_embedding(
  coffee_id uuid,
  embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE coffees
  SET 
    flavor_embedding = embedding,
    updated_at = NOW()
  WHERE id = coffee_id;
END;
$$;

-- Update the stored functions to use the new dimensions
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  match_offset int DEFAULT 0
) 
RETURNS TABLE (
  id uuid,
  name text,
  roast_level text,
  process_method text,
  description text,
  price decimal,
  image_url text,
  flavor_tags text[],
  roaster_details json,
  similarity float,
  distance float
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.coffee_name as name,
    c.roast_level,
    c.process_method,
    c.description,
    c.price,
    c.image_url,
    c.flavor_tags,
    json_build_object(
      'id', r.id,
      'name', r.name
    ) as roaster_details,
    -- Use cosine similarity score calculation
    1 - (c.flavor_embedding <=> query_embedding) AS similarity,
    -- Raw distance for debugging
    c.flavor_embedding <=> query_embedding as distance
  FROM 
    coffees c
  LEFT JOIN
    roasters r ON c.roaster_id = r.id
  WHERE
    c.flavor_embedding IS NOT NULL
    -- Use cosine distance threshold
    AND 1 - (c.flavor_embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count
  OFFSET match_offset;
END;
$$;

-- Update the count function
CREATE OR REPLACE FUNCTION count_coffee_by_flavor_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3
) 
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  match_count bigint;
BEGIN
  SELECT COUNT(*) INTO match_count
  FROM coffees
  WHERE flavor_embedding IS NOT NULL
  AND 1 - (flavor_embedding <=> query_embedding) > match_threshold;
  
  RETURN match_count;
END;
$$;

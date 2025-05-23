-- 04_update_vector_search_function.sql
-- Update vector search function to use 1536 dimensions and add featured weighting

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS search_coffee_by_flavor_vector(vector(384), float, int, int);

-- Create the new function with updated parameters and weighting
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  vector_weight float DEFAULT 0.8,
  featured_weight float DEFAULT 0.2
)
RETURNS TABLE (
  id uuid,
  name text,
  roaster_id uuid,
  roaster_name text,
  roast_level text,
  process_method text,
  description text,
  price decimal,
  image_url text,
  flavor_tags text[],
  is_featured boolean,
  similarity float
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.coffee_name as name,
    c.roaster_id,
    r.name as roaster_name,
    c.roast_level,
    c.process_method,
    c.description,
    c.price,
    c.image_url,
    c.flavor_tags,
    c.is_featured,
    -- Calculate the weighted similarity score
    (
      vector_weight * (1 - (c.flavor_embedding <=> query_embedding)) +
      featured_weight * (CASE WHEN c.is_featured THEN 1.0 ELSE 0.0 END)
    ) as similarity
  FROM 
    coffees c
  LEFT JOIN 
    roasters r ON c.roaster_id = r.id
  WHERE 
    c.flavor_embedding IS NOT NULL AND
    (1 - (c.flavor_embedding <=> query_embedding)) > match_threshold
  ORDER BY 
    similarity DESC
  LIMIT 
    match_count;
END;
$$;

-- Update the count function to match the new dimensions
DROP FUNCTION IF EXISTS count_coffee_by_flavor_vector(vector(384), float);

CREATE OR REPLACE FUNCTION count_coffee_by_flavor_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5
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

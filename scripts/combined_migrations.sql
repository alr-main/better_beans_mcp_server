-- Combined migrations for vector search functions (updated with 06_add_product_url_to_vector_search.sql)

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS search_coffee_by_flavor_vector(vector(1536), float, int, int, float, float);

-- Create the updated search function with weighted results and product_url field
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  match_offset int DEFAULT 0,
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
  product_url text,
  flavor_tags text[],
  is_featured boolean,
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
    c.roaster_id,
    r.roaster_name as roaster_name,
    c.roast_level,
    c.process_method,
    c.coffee_description as description,
    c.price,
    c.image_url,
    c.product_url,
    c.flavor_tags,
    COALESCE(c.is_featured, false) as is_featured,
    -- Calculate the weighted similarity score
    (
      vector_weight * (1 - (c.flavor_embedding <=> query_embedding)) +
      featured_weight * (CASE WHEN COALESCE(c.is_featured, false) THEN 1.0 ELSE 0.0 END)
    ) as similarity,
    -- Include the raw distance for debugging and advanced filtering
    (c.flavor_embedding <=> query_embedding) as distance
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
    match_count
  OFFSET
    match_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_coffee_by_flavor_vector(vector(1536), float, int, int, float, float) TO service_role;

-- Update the count function to match the new dimensions
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

-- Update the vector search function to always return some results, even if no matches are found
-- This is a fallback mechanism to ensure Claude always gets something back

-- Drop the existing function
DROP FUNCTION IF EXISTS search_coffee_by_flavor_vector(vector(1536), float, int, int, float, float);

-- Create the updated function with guaranteed results
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
DECLARE
  vector_result_count integer;
BEGIN
  -- First try the vector search approach
  CREATE TEMP TABLE vector_results ON COMMIT DROP AS
  SELECT
    c.id,
    c.coffee_name as name,
    c.roaster_id,
    r.roaster_name as roaster_name,
    c.roast_level,
    c.process_method,
    c.description,
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
  
  -- Check if we found any results
  SELECT COUNT(*) INTO vector_result_count FROM vector_results;
  
  -- If we found vector results, return them
  IF vector_result_count > 0 THEN
    RETURN QUERY SELECT * FROM vector_results;
  ELSE
    -- Otherwise, just return ANY coffees as a fallback
    -- This ensures Claude always gets some results
    RETURN QUERY
    SELECT
      c.id,
      c.coffee_name as name,
      c.roaster_id,
      r.roaster_name as roaster_name,
      c.roast_level,
      c.process_method,
      c.description,
      c.price,
      c.image_url,
      c.product_url,
      c.flavor_tags,
      COALESCE(c.is_featured, false) as is_featured,
      0.1 as similarity, -- Low similarity score for fallback results
      0.9 as distance
    FROM 
      coffees c
    LEFT JOIN
      roasters r ON c.roaster_id = r.id
    ORDER BY 
      CASE WHEN c.flavor_tags @> ARRAY['chocolate'] THEN 0 
           WHEN c.flavor_tags @> ARRAY['cocoa'] THEN 1
           WHEN c.flavor_tags @> ARRAY['dark chocolate'] THEN 2
           ELSE 3 
      END, -- Prioritize chocolatey coffees
      COALESCE(c.is_featured, false) DESC
    LIMIT 
      match_count
    OFFSET
      match_offset;
  END IF;
END;
$$;

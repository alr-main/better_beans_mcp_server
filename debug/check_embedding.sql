-- SQL function to check a coffee's embedding
CREATE OR REPLACE FUNCTION check_coffee_embedding(p_coffee_id UUID, p_search_tags TEXT[])
RETURNS JSON AS $$
DECLARE
  v_embedding VECTOR;
  v_search_embedding VECTOR;
  v_coffee_tags TEXT[];
  v_similarity FLOAT;
  v_has_embedding BOOLEAN;
  v_result JSON;
BEGIN
  -- Get the coffee's embedding and flavor tags
  SELECT 
    flavor_embedding,
    flavor_tags,
    (flavor_embedding IS NOT NULL) AS has_embedding
  INTO 
    v_embedding,
    v_coffee_tags,
    v_has_embedding
  FROM coffees
  WHERE id = p_coffee_id;
  
  -- Generate a result object with debugging info
  v_result := json_build_object(
    'coffee_id', p_coffee_id,
    'has_embedding', v_has_embedding,
    'flavor_tags', v_coffee_tags,
    'search_tags', p_search_tags
  );
  
  -- If no embedding, return early
  IF NOT v_has_embedding THEN
    RETURN v_result;
  END IF;
  
  -- Get the search embedding from OpenAI
  -- This requires the embedding generation function from our server
  v_search_embedding := get_embedding_for_flavor_tags(p_search_tags);
  
  -- Calculate similarity if both embeddings exist
  IF v_embedding IS NOT NULL AND v_search_embedding IS NOT NULL THEN
    v_similarity := 1 - (v_embedding <=> v_search_embedding);
    
    v_result := v_result || json_build_object(
      'embedding_dimensions', array_length(v_embedding, 1),
      'search_dimensions', array_length(v_search_embedding, 1),
      'similarity', v_similarity,
      'distance', (v_embedding <=> v_search_embedding)
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get coffee embedding by ID
CREATE OR REPLACE FUNCTION get_coffee_embedding(p_coffee_id UUID)
RETURNS FLOAT[] AS $$
DECLARE
  v_embedding VECTOR;
BEGIN
  SELECT flavor_embedding INTO v_embedding
  FROM coffees
  WHERE id = p_coffee_id;
  
  RETURN v_embedding;
END;
$$ LANGUAGE plpgsql;

-- Function to search coffees by flavor tags directly
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_tags(
  search_tags TEXT[],
  match_count INT DEFAULT 10
)
RETURNS SETOF coffees AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM coffees c
  WHERE c.flavor_tags && search_tags
  ORDER BY array_length(array(SELECT unnest(c.flavor_tags) INTERSECT SELECT unnest(search_tags)), 1) DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Debug version of vector search that returns more results
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector_debug(
  search_tags TEXT[],
  match_threshold FLOAT DEFAULT 0.0001,
  match_count INT DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  roast_level TEXT,
  process_method TEXT,
  description TEXT,
  price NUMERIC,
  image_url TEXT,
  product_url TEXT,
  flavor_tags TEXT[],
  roaster_id UUID,
  roaster_name TEXT,
  similarity FLOAT,
  distance FLOAT
) AS $$
DECLARE
  search_embedding VECTOR;
BEGIN
  -- Get embedding for search tags using our function
  search_embedding := get_embedding_for_flavor_tags(search_tags);
  
  -- Return all matches ordered by similarity
  RETURN QUERY
  SELECT
    c.id,
    c.coffee_name,
    c.roast_level,
    c.process_method,
    c.coffee_description,
    c.price,
    c.image_url,
    c.product_url,
    c.flavor_tags,
    r.id,
    r.roaster_name,
    (1 - (c.flavor_embedding <=> search_embedding)) AS similarity,
    (c.flavor_embedding <=> search_embedding) AS distance
  FROM
    coffees c
    JOIN roasters r ON c.roaster_id = r.id
  WHERE
    c.flavor_embedding IS NOT NULL
    AND (1 - (c.flavor_embedding <=> search_embedding)) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$ LANGUAGE plpgsql;

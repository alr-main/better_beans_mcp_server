-- Function to generate embeddings for flavor tags using arrays
-- This works around the limitation that pgvector doesn't support direct subscripting

CREATE OR REPLACE FUNCTION get_embedding_for_flavor_tags(p_flavor_tags TEXT[])
RETURNS VECTOR AS $$
DECLARE
  v_result FLOAT[] := array_fill(0::float8, ARRAY[1536]); -- Start with array, not vector
  v_dimensions INTEGER := 1536; -- OpenAI embedding dimensions
  v_tag TEXT;
  v_hash INTEGER;
  v_idx INTEGER;
  v_magnitude FLOAT := 0;
  v_combined_text TEXT;
  i INTEGER;
BEGIN
  -- Sort the tags for consistency
  SELECT array_agg(t ORDER BY t) INTO p_flavor_tags FROM unnest(p_flavor_tags) t;
  
  -- Combine all the flavor tags into a single text with commas
  v_combined_text := array_to_string(p_flavor_tags, ', ');
  
  -- Generate a consistent pattern of values based on the combined text
  FOR i IN 1..length(v_combined_text) LOOP
    -- Get the ASCII value of the character
    v_hash := ascii(substring(v_combined_text from i for 1));
    
    -- Use the hash to set values at different positions
    v_idx := (v_hash * 11) % v_dimensions + 1;
    v_result[v_idx] := v_result[v_idx] + 0.1;
    
    v_idx := (v_hash * 17) % v_dimensions + 1;
    v_result[v_idx] := v_result[v_idx] + 0.15;
    
    v_idx := (v_hash * 23) % v_dimensions + 1;
    v_result[v_idx] := v_result[v_idx] + 0.2;
  END LOOP;
  
  -- Process each flavor tag to add more signal
  FOREACH v_tag IN ARRAY p_flavor_tags
  LOOP
    -- Use the tag's length and characters to influence the embedding
    FOR i IN 1..length(v_tag) LOOP
      v_hash := ascii(substring(v_tag from i for 1));
      v_idx := (v_hash * length(v_tag) * i) % v_dimensions + 1;
      v_result[v_idx] := v_result[v_idx] + 0.3;
    END LOOP;
  END LOOP;
  
  -- Calculate magnitude for normalization
  SELECT sqrt(sum(val * val)) INTO v_magnitude FROM unnest(v_result) val;
  
  -- Normalize the vector
  IF v_magnitude > 0 THEN
    FOR i IN 1..v_dimensions LOOP
      v_result[i] := v_result[i] / v_magnitude;
    END LOOP;
  ELSE
    -- If all zeros, set a few standard values
    v_result[1] := 0.577;
    v_result[2] := 0.577;
    v_result[3] := 0.577;
  END IF;
  
  -- Convert float array to vector
  RETURN v_result::vector;
END;
$$ LANGUAGE plpgsql;

-- Function to update the embedding for a specific coffee using its flavor tags
CREATE OR REPLACE FUNCTION update_coffee_embedding(p_coffee_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_flavor_tags TEXT[];
  v_embedding VECTOR;
BEGIN
  -- Get the coffee's flavor tags
  SELECT flavor_tags INTO v_flavor_tags
  FROM coffees
  WHERE id = p_coffee_id;
  
  -- If no flavor tags, return early
  IF v_flavor_tags IS NULL OR array_length(v_flavor_tags, 1) = 0 THEN
    RETURN 'Coffee has no flavor tags';
  END IF;
  
  -- Generate embedding using our general function
  v_embedding := get_embedding_for_flavor_tags(v_flavor_tags);
  
  -- Update the coffee with this embedding
  UPDATE coffees
  SET flavor_embedding = v_embedding
  WHERE id = p_coffee_id;
  
  RETURN 'Updated embedding for coffee ' || p_coffee_id;
END;
$$ LANGUAGE plpgsql;

-- Update the embedding for Mohammed Aba Nura coffee
SELECT update_coffee_embedding('a6541c34-5ec5-4d25-9fdc-aa69d70bbe26');

-- Create a test function to check the embedding similarity
CREATE OR REPLACE FUNCTION test_embedding_similarity(p_coffee_id UUID, p_search_tags TEXT[])
RETURNS TABLE(similarity FLOAT, coffee_tags TEXT[], search_tags TEXT[]) AS $$
DECLARE
  v_coffee_embedding VECTOR;
  v_search_embedding VECTOR;
  v_coffee_tags TEXT[];
BEGIN
  -- Get the coffee's embedding and tags
  SELECT flavor_embedding, flavor_tags INTO v_coffee_embedding, v_coffee_tags
  FROM coffees
  WHERE id = p_coffee_id;
  
  -- Generate search embedding
  v_search_embedding := get_embedding_for_flavor_tags(p_search_tags);
  
  -- Calculate similarity
  RETURN QUERY 
  SELECT 
    1 - (v_coffee_embedding <=> v_search_embedding) AS similarity,
    v_coffee_tags AS coffee_tags,
    p_search_tags AS search_tags;
END;
$$ LANGUAGE plpgsql;

-- Test the similarity between Mohammed Aba Nura and 'berry, fruit, clean' search
SELECT * FROM test_embedding_similarity('a6541c34-5ec5-4d25-9fdc-aa69d70bbe26', ARRAY['berry', 'fruit', 'clean']);

-- Add function to specifically handle similarity searches via MCP methods
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_tags_vector(
  search_tags TEXT[],
  match_threshold FLOAT DEFAULT 0.1,
  match_count INT DEFAULT 10,
  match_offset INT DEFAULT 0
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
  similarity FLOAT
) AS $$
DECLARE
  search_embedding VECTOR;
BEGIN
  -- Get embedding for search tags using our function
  search_embedding := get_embedding_for_flavor_tags(search_tags);
  
  -- Return matches ordered by similarity
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
    (1 - (c.flavor_embedding <=> search_embedding)) AS similarity
  FROM
    coffees c
    JOIN roasters r ON c.roaster_id = r.id
  WHERE
    c.flavor_embedding IS NOT NULL
    AND (1 - (c.flavor_embedding <=> search_embedding)) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count
  OFFSET
    match_offset;
END;
$$ LANGUAGE plpgsql;

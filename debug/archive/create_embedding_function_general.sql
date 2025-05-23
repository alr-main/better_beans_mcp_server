-- Function to generate embeddings for flavor tags
-- This is a general purpose function that can handle any flavor combination
-- It uses a deterministic algorithm to generate consistent embeddings

CREATE OR REPLACE FUNCTION get_embedding_for_flavor_tags(p_flavor_tags TEXT[])
RETURNS VECTOR AS $$
DECLARE
  v_result VECTOR;
  v_dimensions INTEGER := 1536; -- OpenAI embedding dimensions
  v_tag TEXT;
  v_hash INTEGER;
  v_hash_str TEXT;
  v_value FLOAT;
  v_magnitude FLOAT := 0;
  v_combined_text TEXT;
  i INTEGER;
BEGIN
  -- Initialize the embedding with zeros
  v_result := array_fill(0::float8, ARRAY[v_dimensions]);
  
  -- Sort the tags for consistency
  SELECT array_agg(t ORDER BY t) INTO p_flavor_tags FROM unnest(p_flavor_tags) t;
  
  -- Combine all the flavor tags into a single text with commas
  v_combined_text := array_to_string(p_flavor_tags, ', ');
  
  -- Generate a consistent pattern of values based on the combined text
  -- For each character in the combined text, set values in the embedding
  FOR i IN 1..length(v_combined_text) LOOP
    -- Get the ASCII value of the character
    v_hash := ascii(substring(v_combined_text from i for 1));
    
    -- Use the hash to set multiple positions in the embedding
    -- Spread values throughout the embedding space
    v_result[(v_hash * 11) % v_dimensions + 1] := v_result[(v_hash * 11) % v_dimensions + 1] + 0.1;
    v_result[(v_hash * 17) % v_dimensions + 1] := v_result[(v_hash * 17) % v_dimensions + 1] + 0.15;
    v_result[(v_hash * 23) % v_dimensions + 1] := v_result[(v_hash * 23) % v_dimensions + 1] + 0.2;
  END LOOP;
  
  -- Process each flavor tag individually to add more specificity
  FOREACH v_tag IN ARRAY p_flavor_tags
  LOOP
    -- Hash the tag using a simple algorithm
    v_hash_str := md5(v_tag);
    
    -- Set multiple values based on the hash
    FOR i IN 1..8 LOOP
      -- Convert each character pair in the hash to a position
      v_hash := (get_byte(v_hash_str, i-1) * 256 + get_byte(v_hash_str, (i*2-1) % 16)) % v_dimensions + 1;
      
      -- Set a value at this position based on the tag length
      v_value := 0.5 / (i * 2);
      v_result[v_hash] := v_result[v_hash] + v_value;
    END LOOP;
  END LOOP;
  
  -- Calculate magnitude
  SELECT sqrt(sum(power(val, 2))) INTO v_magnitude
  FROM unnest(v_result) val;
  
  -- Normalize the vector if magnitude is not zero
  IF v_magnitude > 0 THEN
    FOR i IN 1..v_dimensions LOOP
      v_result[i] := v_result[i] / v_magnitude;
    END LOOP;
  ELSE
    -- If all zeros, set a few values so it's not completely empty
    v_result[1] := 0.5773502691896258;
    v_result[2] := 0.5773502691896258;
    v_result[3] := 0.5773502691896258;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to update the embedding for Mohammed Aba Nura coffee
-- This doesn't assume any specific flavors, it just ensures the coffee has a valid embedding
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

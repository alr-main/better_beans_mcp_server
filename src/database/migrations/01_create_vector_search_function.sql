-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create an index on the embedding column for faster similarity searches
-- This assumes a coffees table with a flavor_embedding column of type vector(384)
DO $$
BEGIN
    -- Check if the index already exists to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'coffees_flavor_embedding_idx'
        AND n.nspname = 'public'
    ) THEN
        -- Create HNSW index for fast approximate nearest neighbor search
        CREATE INDEX coffees_flavor_embedding_idx 
        ON coffees USING hnsw (flavor_embedding vector_cosine_ops);
    END IF;
END
$$;

-- Create a stored function for vector-based coffee search
CREATE OR REPLACE FUNCTION search_coffee_by_flavor_vector(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
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

-- Create a function to calculate the total count of matches
CREATE OR REPLACE FUNCTION count_coffee_by_flavor_vector(
    query_embedding vector(384),
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

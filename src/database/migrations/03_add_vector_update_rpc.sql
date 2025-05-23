-- Migration: Add dedicated RPC function for updating vector embeddings
-- This ensures proper handling of vector embeddings with exact casting and error handling

-- Create update_logs table for structured logging
CREATE TABLE IF NOT EXISTS update_logs (
  id SERIAL PRIMARY KEY,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for efficient queries on update_logs
CREATE INDEX IF NOT EXISTS idx_update_logs_entity_id ON update_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_update_logs_status ON update_logs (status);

-- Grant appropriate permissions for the logs table
GRANT ALL ON TABLE update_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE update_logs_id_seq TO service_role;

-- Create RPC function with comprehensive logging and error handling
CREATE OR REPLACE FUNCTION update_coffee_flavor_vector(
  p_coffee_id UUID,
  p_embedding TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id INT;
  dimensions INT;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  execution_time INTERVAL;
  coffee_exists BOOLEAN;
BEGIN
  -- Record start time for performance logging
  start_time := NOW();
  
  -- Initial log entry
  INSERT INTO update_logs (
    entity_id, entity_type, operation, details, status
  ) VALUES (
    p_coffee_id, 'coffee', 'update_flavor_vector',
    format('Starting vector update for coffee %s', p_coffee_id),
    'started'
  ) RETURNING id INTO log_id;
  
  -- Check if the coffee exists
  SELECT EXISTS(SELECT 1 FROM coffees WHERE id = p_coffee_id) INTO coffee_exists;
  
  IF NOT coffee_exists THEN
    -- Log the error for non-existent coffee
    UPDATE update_logs SET 
      details = format('Coffee with ID %s not found', p_coffee_id),
      status = 'error',
      created_at = NOW()
    WHERE id = log_id;
    
    RAISE NOTICE 'Coffee with ID % not found', p_coffee_id;
    RETURN FALSE;
  END IF;
  
  -- Validate embedding format and dimensions
  BEGIN
    -- Calculate approximate dimensions from the embedding string
    SELECT (LENGTH(p_embedding) - LENGTH(REPLACE(p_embedding, ',', '')) + 1) INTO dimensions;
    
    -- Log the dimensions check
    UPDATE update_logs SET 
      details = format('Validated embedding format with ~%s dimensions', dimensions),
      created_at = NOW()
    WHERE id = log_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log validation error
    UPDATE update_logs SET 
      details = format('Error validating embedding format: %s', SQLERRM),
      status = 'error',
      created_at = NOW()
    WHERE id = log_id;
    
    RAISE NOTICE 'Error validating embedding format: %', SQLERRM;
    RETURN FALSE;
  END;
  
  BEGIN
    -- Update the coffee with the new embedding
    UPDATE coffees
    SET 
      flavor_embedding = p_embedding::vector,
      updated_at = NOW()
    WHERE id = p_coffee_id;
    
    -- Record end time and calculate execution time
    end_time := NOW();
    execution_time := end_time - start_time;
    
    -- Log successful update
    UPDATE update_logs SET 
      details = format('Successfully updated embedding for coffee %s in %s ms', 
                      p_coffee_id, 
                      EXTRACT(MILLISECONDS FROM execution_time)),
      status = 'success',
      created_at = NOW()
    WHERE id = log_id;
    
    RETURN TRUE;
  EXCEPTION WHEN OTHERS THEN
    -- Log database error
    UPDATE update_logs SET 
      details = format('Error updating embedding: %s', SQLERRM),
      status = 'error',
      created_at = NOW()
    WHERE id = log_id;
    
    RAISE NOTICE 'Error updating embedding: %', SQLERRM;
    RETURN FALSE;
  END;
END;
$$;

-- Grant appropriate permissions on the function
GRANT EXECUTE ON FUNCTION update_coffee_flavor_vector TO service_role;

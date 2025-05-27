-- Migration to add a distance calculation function that works with PostgREST
-- This encapsulates the earthdistance extension functionality in a way
-- that can be easily called from the Supabase API

-- Create the function to calculate distance between two geographic points
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float) 
RETURNS float AS $$
  SELECT earth_distance(
    ll_to_earth($3, $4),
    ll_to_earth($1, $2)
  ) * 0.000621371; -- Convert meters to miles
$$ LANGUAGE SQL IMMUTABLE;

-- Add a comment to describe the function
COMMENT ON FUNCTION calculate_distance IS 'Calculates the distance between two geographic points in miles using earthdistance extension';

-- Test the function with San Francisco to San Jose distance
-- This is around 42-43 miles
SELECT calculate_distance(37.7749, -122.4194, 37.3382, -121.8863) AS sf_to_sj_miles;

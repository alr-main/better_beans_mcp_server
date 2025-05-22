/**
 * Database Schema Types
 * TypeScript definitions matching the Supabase database schema
 */

/**
 * Database schema types
 * Includes support for vector embeddings and similarity search
 */

/**
 * Vector type for pgvector integration
 * This is a custom type that represents a vector of floating point numbers
 */
export type Vector = number[];

/**
 * Database function response types
 */
export interface VectorSearchResult {
  id: string;
  name: string;
  roast_level: string;
  process_method: string;
  description: string;
  price: number;
  image_url: string;
  flavor_tags: string[];
  roaster_details: { id: string; name: string };
  embedding?: Vector;
  similarity: number;
  distance: number;
}

/**
 * Database schema definition for type safety
 */
export interface Database {
  public: {
    Tables: {
      roasters: {
        Row: {
          id: string;
          roaster_name: string;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          founded_year: number | null;
          about_us: string | null;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          secondary_contact_email: string | null;
          secondary_contact_name: string | null;
          phone_number: string | null;
          website_url: string | null;
          logo_url: string | null;
          instagram_profile: string | null;
          x_profile: string | null;
          facebook_profile: string | null;
          tiktok_profile: string | null;
          youtube_profile: string | null;
          is_featured: boolean | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          latitude: number | null;
          longitude: number | null;
          removal_type: string | null;
        };
        Insert: {
          id?: string;
          roaster_name: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          founded_year?: number | null;
          about_us?: string | null;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          secondary_contact_email?: string | null;
          secondary_contact_name?: string | null;
          phone_number?: string | null;
          website_url?: string | null;
          logo_url?: string | null;
          instagram_profile?: string | null;
          x_profile?: string | null;
          facebook_profile?: string | null;
          tiktok_profile?: string | null;
          youtube_profile?: string | null;
          is_featured?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          removal_type?: string | null;
        };
        Update: {
          id?: string;
          roaster_name?: string;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          founded_year?: number | null;
          about_us?: string | null;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          secondary_contact_email?: string | null;
          secondary_contact_name?: string | null;
          phone_number?: string | null;
          website_url?: string | null;
          logo_url?: string | null;
          instagram_profile?: string | null;
          x_profile?: string | null;
          facebook_profile?: string | null;
          tiktok_profile?: string | null;
          youtube_profile?: string | null;
          is_featured?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          removal_type?: string | null;
        };
      };
      coffees: {
        Row: {
          id: string;
          roaster_id: string;
          coffee_name: string;
          process_method: string | null;
          roast_level: string | null;
          coffee_description: string | null;
          coffee_type: string | null;
          acidity_level: string | null;
          is_caffeinated: boolean | null;
          price: number | null;
          bag_size: string | null;
          is_available: boolean | null;
          image_url: string | null;
          slug: string | null;
          product_url: string | null;
          flavor_tags: string[] | null;
          certification_types: string[] | null;
          origin: string[] | null;
          bean_variety: string[] | null;
          grind_options: string[] | null;
          brewing_methods: string[] | null;
          created_at: string | null;
          updated_at: string | null;
          removal_type: string | null;
          flavor_embedding: unknown | null; // Vector type
        };
        Insert: {
          id?: string;
          roaster_id: string;
          coffee_name: string;
          process_method?: string | null;
          roast_level?: string | null;
          coffee_description?: string | null;
          coffee_type?: string | null;
          acidity_level?: string | null;
          is_caffeinated?: boolean | null;
          price?: number | null;
          bag_size?: string | null;
          is_available?: boolean | null;
          image_url?: string | null;
          slug?: string | null;
          product_url?: string | null;
          flavor_tags?: string[] | null;
          certification_types?: string[] | null;
          origin?: string[] | null;
          bean_variety?: string[] | null;
          grind_options?: string[] | null;
          brewing_methods?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
          removal_type?: string | null;
          flavor_embedding?: unknown | null; // Vector type
        };
        Update: {
          id?: string;
          roaster_id?: string;
          coffee_name?: string;
          process_method?: string | null;
          roast_level?: string | null;
          coffee_description?: string | null;
          coffee_type?: string | null;
          acidity_level?: string | null;
          is_caffeinated?: boolean | null;
          price?: number | null;
          bag_size?: string | null;
          is_available?: boolean | null;
          image_url?: string | null;
          slug?: string | null;
          product_url?: string | null;
          flavor_tags?: string[] | null;
          certification_types?: string[] | null;
          origin?: string[] | null;
          bean_variety?: string[] | null;
          grind_options?: string[] | null;
          brewing_methods?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
          removal_type?: string | null;
          flavor_embedding?: unknown | null; // Vector type
        };
      };
      api_keys: {
        Row: {
          id: string;
          key_hash: string;
          name: string;
          permissions: string[] | null;
          rate_limit: number | null;
          created_at: string | null;
          updated_at: string | null;
          expires_at: string | null;
          last_used_at: string | null;
          created_by: string | null;
          is_active: boolean | null;
        };
        Insert: {
          id?: string;
          key_hash: string;
          name: string;
          permissions?: string[] | null;
          rate_limit?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          expires_at?: string | null;
          last_used_at?: string | null;
          created_by?: string | null;
          is_active?: boolean | null;
        };
        Update: {
          id?: string;
          key_hash?: string;
          name?: string;
          permissions?: string[] | null;
          rate_limit?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          expires_at?: string | null;
          last_used_at?: string | null;
          created_by?: string | null;
          is_active?: boolean | null;
        };
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [key: string]: {
        [key: string]: string;
      };
    };
  };
}

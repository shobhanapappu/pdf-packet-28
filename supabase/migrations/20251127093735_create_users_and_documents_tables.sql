/*
  # Create Users and Documents Tables

  1. New Tables
    - `users` - Admin user credentials (simple password storage, no RLS)
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `password_hash` (text)
      - `created_at` (timestamp)
    - `documents` - PDF document metadata and storage references
      - `id` (uuid, primary key)
      - `name` (text) - Display name of document
      - `description` (text) - Document description
      - `filename` (text) - Original filename
      - `size` (bigint) - File size in bytes
      - `type` (text) - Document type (TDS, ESR, MSDS, etc.)
      - `required` (boolean) - Whether document is required
      - `products` (text array) - Associated product types
      - `product_type` (text) - Category: structural-floor or underlayment
      - `file_path` (text) - Path in Supabase Storage
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - No RLS enabled (simple admin-only access)
    - Password stored as hash (bcrypt will be used in frontend)

  3. Notes
    - Admin user: admin@gmail.com with password VCFGJYHASG#@#422
    - Documents stored in 'documents' bucket in Supabase Storage
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  filename text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  required boolean DEFAULT false,
  products text[] DEFAULT '{}',
  product_type text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_product_type ON documents(product_type);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

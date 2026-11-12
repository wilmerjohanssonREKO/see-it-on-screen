-- Local PostgreSQL test double for the Supabase schemas used by this repository.
-- Run only in the disposable database created by scripts/test-db.sh.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;
ALTER DATABASE reko_test SET search_path = public, extensions;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at timestamptz,
  encrypted_password text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
   nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb,
   jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), '')))
$$;
GRANT USAGE ON SCHEMA auth, storage, extensions TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false,
 file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text,
 name text, owner uuid, metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1]
$$;
GRANT ALL ON storage.objects TO authenticated, service_role;
GRANT ALL ON storage.buckets TO service_role;

-- Match the broad historical Supabase defaults, so new hardening is exercised.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;

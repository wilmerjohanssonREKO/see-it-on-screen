-- Seed test data: Create 5 example substitutes with approved status

-- First, we need to create auth users for seeding (this is a workaround for local testing)
-- In production, use Supabase auth admin API instead

-- For demo purposes, insert test substitutes directly with test UUIDs
-- These would need proper auth.users in production

INSERT INTO public.profiles (
  id,
  full_name,
  email,
  phone,
  school_name,
  graduation_year,
  subjects,
  availability,
  background_status,
  approved,
  created_at
) VALUES
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Anna Matematik',
    'anna.matematik@example.com',
    '070-1111111',
    'Gymnasieskolan Test',
    2022,
    '{"Matematik","Fysik"}',
    'Mån–fre förmiddagar',
    'approved',
    true,
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    'Bob Svenska',
    'bob.svenska@example.com',
    '070-2222222',
    'Gymnasieskolan Test',
    2021,
    '{"Svenska","Historia"}',
    'Alla dagar utom ons',
    'approved',
    true,
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    'Cecilia Engelska',
    'cecilia.engelska@example.com',
    '070-3333333',
    'Gymnasieskolan Test',
    2023,
    '{"Engelska","Moderna språk"}',
    'Flexibel',
    'approved',
    true,
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    'David Biologi',
    'david.biologi@example.com',
    '070-4444444',
    'Gymnasieskolan Test',
    2020,
    '{"Biologi","Naturkunskap"}',
    'Mån, tis, tor, fre',
    'approved',
    true,
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000005'::uuid,
    'Eva Kemi',
    'eva.kemi@example.com',
    '070-5555555',
    'Gymnasieskolan Test',
    2022,
    '{"Kemi","Miljövetenskap"}',
    'Efter kl 12:00 alla dagar',
    'approved',
    true,
    now()
  )
ON CONFLICT DO NOTHING;

-- Create corresponding user_roles for test substitutes
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'substitute'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'substitute'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'substitute'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'substitute'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'substitute')
ON CONFLICT DO NOTHING;

-- Note: For auth.users, you'll need to:
-- 1. Create them via Supabase dashboard or auth API
-- 2. Or use direct INSERT with auth.users if DB is local/dev

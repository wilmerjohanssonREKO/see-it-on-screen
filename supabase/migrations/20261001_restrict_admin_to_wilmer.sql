-- Restrict administrative access to the REKO UF owner account.
-- Admin authentication still uses Supabase Auth; the email is not a password or secret.

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing integer;
  requester_email text;
BEGIN
  requester_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR requester_email <> 'wilmer.johansson@donnergymnasiet.se' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO existing FROM public.user_roles WHERE role = 'admin';
  IF existing > 0 THEN RETURN false; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

-- Remove any accidental admin roles from other accounts. This does not delete users or profiles.
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id <> (
    SELECT id FROM auth.users
    WHERE lower(email) = 'wilmer.johansson@donnergymnasiet.se'
    LIMIT 1
  );

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

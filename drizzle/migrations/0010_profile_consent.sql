ALTER TABLE public.profiles ADD COLUMN consent_at timestamptz;
COMMENT ON COLUMN public.profiles.consent_at IS 'Tidpunkt då användaren godkände att REKO UF lagrar och behandlar personuppgifter (profil, adress/position, CV, händelselogg). NULL = ej godkänt ännu.';

CREATE OR REPLACE FUNCTION public.set_profile_consent()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET consent_at = now()
  WHERE id = auth.uid() AND consent_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.set_profile_consent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_consent() TO authenticated;
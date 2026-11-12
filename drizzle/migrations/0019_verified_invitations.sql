-- Personal invitations replace public shared school-code registration.
-- Existing school_members and school_codes remain untouched for history.
CREATE TABLE public.school_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND length(email) <= 255 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  member_type text NOT NULL CHECK (member_type IN ('school','teacher')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz
);
ALTER TABLE public.school_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,school_id,email,member_type,created_at,expires_at,accepted_at,revoked_at) ON public.school_invitations TO authenticated;
GRANT ALL ON public.school_invitations TO service_role;
CREATE POLICY school_invitations_admin_read ON public.school_invitations FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX school_invitations_school_created_idx ON public.school_invitations (school_id,created_at DESC);
CREATE UNIQUE INDEX school_invitations_one_pending_idx ON public.school_invitations(school_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_school_invitation(p_school_id uuid,p_email text,p_member_type text,p_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin kan bjuda in'; END IF;
 IF p_member_type NOT IN ('school','teacher') OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Ogiltig inbjudan'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=p_school_id) THEN RAISE EXCEPTION 'Skolan finns inte'; END IF;
 -- Replacing an invite invalidates the previous link; no existing memberships change.
 UPDATE public.school_invitations SET revoked_at=now() WHERE school_id=p_school_id AND email=lower(btrim(p_email)) AND accepted_at IS NULL AND revoked_at IS NULL;
 INSERT INTO public.school_invitations(school_id,email,member_type,token_hash,created_by)
 VALUES(p_school_id,lower(btrim(p_email)),p_member_type,p_token_hash,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.revoke_school_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT COALESCE(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 UPDATE public.school_invitations SET revoked_at=now() WHERE id=p_invitation_id AND accepted_at IS NULL;
END $$;
CREATE OR REPLACE FUNCTION public.accept_school_invitation(p_token text,p_full_name text,p_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inv public.school_invitations; v_email text; v_confirmed timestamptz; v_test boolean; v_profile_test boolean; v_existing public.school_members;
BEGIN
 IF auth.uid() IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Inbjudan är ogiltig eller har gått ut'; END IF;
 SELECT email,email_confirmed_at INTO v_email,v_confirmed FROM auth.users WHERE id=auth.uid();
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND COALESCE(length(encrypted_password),0)>0) THEN RAISE EXCEPTION 'Välj ett lösenord innan du accepterar inbjudan'; END IF;
 IF v_confirmed IS NULL THEN RAISE EXCEPTION 'Bekräfta din e-postadress först'; END IF;
 SELECT * INTO v_inv FROM public.school_invitations WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR v_inv.revoked_at IS NOT NULL OR v_inv.accepted_at IS NOT NULL OR v_inv.expires_at<=now() THEN RAISE EXCEPTION 'Inbjudan är ogiltig eller har gått ut'; END IF;
 IF lower(v_email)<>v_inv.email THEN RAISE EXCEPTION 'Logga in med e-postadressen som fick inbjudan'; END IF;
 SELECT is_test INTO v_profile_test FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT is_test INTO v_test FROM public.schools WHERE id=v_inv.school_id FOR SHARE;
 IF v_profile_test IS NULL OR v_test IS NULL OR v_profile_test IS DISTINCT FROM v_test THEN RAISE EXCEPTION 'Kontots testläge stämmer inte med skolan. Kontakta REKO.'; END IF;
 SELECT * INTO v_existing FROM public.school_members WHERE user_id=auth.uid();
 IF FOUND AND (v_existing.school_id<>v_inv.school_id OR v_existing.member_type<>v_inv.member_type) THEN RAISE EXCEPTION 'Kontot är redan kopplat till en annan skolroll'; END IF;
 IF NOT FOUND AND (EXISTS(SELECT 1 FROM public.assignments WHERE assigned_substitute_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.assignment_declines WHERE substitute_id=auth.uid())) THEN RAISE EXCEPTION 'Kontot har vikariehistorik. Använd ett separat skolkonto.'; END IF;
 IF COALESCE(length(btrim(p_full_name)),0) NOT BETWEEN 1 AND 120 OR COALESCE(p_phone,'') !~ '^[+0-9 ()-]{5,40}$' OR length(regexp_replace(p_phone,'[^0-9]','','g'))<5 THEN RAISE EXCEPTION 'Fyll i namn och giltigt telefonnummer'; END IF;
 INSERT INTO public.school_members(user_id,school_id,member_type) VALUES(auth.uid(),v_inv.school_id,v_inv.member_type) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.profiles SET full_name=btrim(p_full_name),phone=btrim(p_phone),email=v_email,school_name=(SELECT name FROM public.schools WHERE id=v_inv.school_id) WHERE id=auth.uid();
 DELETE FROM public.user_roles WHERE user_id=auth.uid() AND role='substitute';
 UPDATE public.school_invitations SET accepted_at=now(),accepted_by=auth.uid() WHERE id=v_inv.id;
 RETURN v_inv.school_id;
END $$;
REVOKE ALL ON FUNCTION public.create_school_invitation(uuid,text,text,text),public.revoke_school_invitation(uuid),public.accept_school_invitation(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_school_invitation(uuid,text,text,text),public.revoke_school_invitation(uuid),public.accept_school_invitation(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.inspect_school_invitation(p_token text)
RETURNS TABLE(school_name text,member_type text,has_password boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Inbjudan är ogiltig eller har gått ut'; END IF;
 RETURN QUERY SELECT s.name,i.member_type,COALESCE(length(u.encrypted_password),0)>0
 FROM public.school_invitations i JOIN public.schools s ON s.id=i.school_id
 JOIN auth.users u ON u.id=auth.uid() AND lower(u.email)=i.email AND u.email_confirmed_at IS NOT NULL
 JOIN public.profiles p ON p.id=u.id AND p.is_test=s.is_test
 WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Inbjudan är ogiltig, använd, utgången eller avsedd för en annan e-postadress'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.inspect_school_invitation(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.inspect_school_invitation(text) TO authenticated;

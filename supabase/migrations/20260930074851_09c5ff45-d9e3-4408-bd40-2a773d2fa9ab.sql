
CREATE TYPE public.app_role AS ENUM ('admin','substitute');
CREATE TYPE public.background_status AS ENUM ('pending','approved','needs_renewal');
CREATE TYPE public.assignment_status AS ENUM ('open','filled','expired');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  school_name text,
  graduation_year integer,
  subjects text[] NOT NULL DEFAULT '{}',
  availability text,
  background_status public.background_status NOT NULL DEFAULT 'pending',
  background_file_path text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject text NOT NULL,
  assignment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  description text,
  compensation text,
  status public.assignment_status NOT NULL DEFAULT 'open',
  assigned_substitute_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, substitute_id)
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.school_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL,
  contact_person text NOT NULL,
  contact_email text,
  contact_phone text,
  description text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.school_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_requests TO authenticated;
GRANT ALL ON public.school_requests TO service_role;
ALTER TABLE public.school_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substitute_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "schools_admin_all" ON public.schools FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "schools_select_authenticated" ON public.schools FOR SELECT TO authenticated USING (true);

CREATE POLICY "assignments_admin_all" ON public.assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "assignments_select_notified" ON public.assignments FOR SELECT TO authenticated
  USING (
    assigned_substitute_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.assignment_id = assignments.id AND n.substitute_id = auth.uid())
  );

CREATE POLICY "notifications_select_own_or_admin" ON public.notifications FOR SELECT TO authenticated
  USING (substitute_id = auth.uid() OR public.is_admin());

CREATE POLICY "school_requests_insert_anyone" ON public.school_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "school_requests_admin_all" ON public.school_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "ratings_select_authenticated" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings_admin_write" ON public.ratings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Prevent substitutes from approving themselves
CREATE OR REPLACE FUNCTION public.protect_profile_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.approved := OLD.approved;
    NEW.background_status := OLD.background_status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_profile_approval_trg BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_approval();

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'substitute')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- First user can become admin
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO existing FROM public.user_roles WHERE role = 'admin';
  IF existing > 0 THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Publish an assignment: match substitutes and create notifications
CREATE OR REPLACE FUNCTION public.publish_assignment(p_assignment_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_subject text; v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Endast admin kan publicera'; END IF;
  SELECT subject INTO v_subject FROM public.assignments WHERE id = p_assignment_id;
  IF v_subject IS NULL THEN RAISE EXCEPTION 'Uppdraget finns inte'; END IF;

  INSERT INTO public.notifications (assignment_id, substitute_id)
  SELECT p_assignment_id, p.id
  FROM public.profiles p
  WHERE p.approved = true
    AND p.background_status = 'approved'
    AND v_subject = ANY (p.subjects)
  ON CONFLICT DO NOTHING;

  UPDATE public.assignments SET published_at = COALESCE(published_at, now()) WHERE id = p_assignment_id;
  SELECT count(*) INTO v_count FROM public.notifications WHERE assignment_id = p_assignment_id;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.publish_assignment(uuid) TO authenticated;

-- First-come-first-served claim
CREATE OR REPLACE FUNCTION public.claim_assignment(p_assignment_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer; v_ok boolean;
BEGIN
  SELECT (approved AND background_status = 'approved') INTO v_ok FROM public.profiles WHERE id = auth.uid();
  IF v_ok IS NOT TRUE THEN RETURN 'not_approved'; END IF;

  UPDATE public.assignments
  SET status = 'filled', assigned_substitute_id = auth.uid(), assigned_at = now()
  WHERE id = p_assignment_id AND status = 'open';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 1 THEN RETURN 'claimed'; ELSE RETURN 'already_filled'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_assignment(uuid) TO authenticated;

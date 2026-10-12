ALTER TABLE public.school_members ADD COLUMN IF NOT EXISTS member_type text NOT NULL DEFAULT 'school';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE TABLE public.school_codes (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  salt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.school_codes TO service_role;
ALTER TABLE public.school_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.teacher_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.teacher_code_attempts TO service_role;
ALTER TABLE public.teacher_code_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX teacher_code_attempts_created_idx ON public.teacher_code_attempts (created_at);

CREATE OR REPLACE FUNCTION public.set_assignment_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_assignment_created_by() FROM PUBLIC, anon;
CREATE TRIGGER set_assignment_created_by_trg BEFORE INSERT ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.set_assignment_created_by();

CREATE OR REPLACE FUNCTION public.protect_assignment_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  NEW.school_id := CASE WHEN public.is_admin() THEN NEW.school_id ELSE OLD.school_id END;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_assignment_created_by() FROM PUBLIC, anon;
CREATE TRIGGER protect_assignment_created_by_trg BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.protect_assignment_created_by();
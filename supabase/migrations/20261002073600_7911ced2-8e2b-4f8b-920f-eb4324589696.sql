CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'substitute',
  category text NOT NULL DEFAULT 'allmant',
  message text NOT NULL,
  score integer CHECK (score BETWEEN 1 AND 5),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_insert_own" ON public.feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "feedback_select_own_or_admin" ON public.feedback FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR is_admin());
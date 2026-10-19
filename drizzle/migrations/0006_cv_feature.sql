ALTER TABLE public.profiles
  ADD COLUMN cv_file_path text,
  ADD COLUMN cv_consent_at timestamptz;

COMMENT ON COLUMN public.profiles.cv_file_path IS 'Path in private storage bucket cvs. Personal data: only the owner, admin, and schools/teachers whose assignments the substitute is notified about or assigned to may read it (via signed URLs). Consent required.';
COMMENT ON COLUMN public.profiles.cv_consent_at IS 'Timestamp of the substitute consent that schools they apply to may read their CV.';

CREATE POLICY cv_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cv_owner_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cv_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY cv_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);
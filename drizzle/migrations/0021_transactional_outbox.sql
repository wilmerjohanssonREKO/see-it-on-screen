-- Reliable sends are committed with the booking, never requested by a browser.
ALTER TABLE public.assignments ADD COLUMN notification_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.assignments ADD COLUMN history_completed boolean NOT NULL DEFAULT false;

CREATE TABLE public.email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
 version integer NOT NULL,
 school_id uuid NOT NULL,
 substitute_id uuid,
 recipient_kind text NOT NULL CHECK(recipient_kind IN ('school','substitute')),
 recipient text NOT NULL,
 template text NOT NULL,
 payload jsonb NOT NULL,
 test_snapshot boolean NOT NULL,
 idempotency_key text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','retry','sent','captured','suppressed','cancelled','failed')),
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 lock_token uuid,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz
);
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.email_outbox TO service_role;
CREATE INDEX email_outbox_due_idx ON public.email_outbox(available_at,created_at) WHERE status IN ('pending','retry','sending');
CREATE INDEX email_outbox_assignment_idx ON public.email_outbox(assignment_id,version);
ALTER TABLE public.sandbox_emails ADD COLUMN outbox_id uuid UNIQUE REFERENCES public.email_outbox(id) ON DELETE SET NULL;

CREATE FUNCTION public.enqueue_booking_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sub uuid; v_school public.schools; v_profile public.profiles; v_cancel boolean; v_details jsonb; v_version integer;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'filled' OR NEW.assigned_substitute_id IS NULL THEN RETURN NEW; END IF;
   v_sub:=NEW.assigned_substitute_id; v_cancel:=false;
 ELSE
   IF NEW.status='filled' AND NEW.assigned_substitute_id IS NOT NULL
      AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.assigned_substitute_id IS DISTINCT FROM NEW.assigned_substitute_id) THEN
     v_sub:=NEW.assigned_substitute_id; v_cancel:=false;
   ELSIF OLD.status='filled' AND OLD.assigned_substitute_id IS NOT NULL
      AND (NEW.status<>'filled' OR NEW.assigned_substitute_id IS DISTINCT FROM OLD.assigned_substitute_id)
      AND ((OLD.assignment_date+OLD.end_time) AT TIME ZONE 'Europe/Stockholm')>now() THEN
     v_sub:=OLD.assigned_substitute_id; v_cancel:=true;
   ELSE RETURN NEW; END IF;
 END IF;
 IF NOT v_cancel AND ((NEW.assignment_date+NEW.end_time) AT TIME ZONE 'Europe/Stockholm')<=now() THEN RETURN NEW; END IF;
 SELECT * INTO v_school FROM public.schools WHERE id=NEW.school_id;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_sub;
 -- Missing relationships must fail the booking transaction rather than lose its notification.
 IF v_school.id IS NULL OR v_profile.id IS NULL OR NOT public.same_sandbox(v_sub,NEW.school_id) THEN
   RAISE EXCEPTION 'Kunde inte köa bokningsbeskedet: kontona saknas eller har olika testläge';
 END IF;
 v_version:=NEW.notification_version+1;
 UPDATE public.assignments SET notification_version=v_version WHERE id=NEW.id;
 v_details:=jsonb_build_object('schoolName',v_school.name,'subject',NEW.subject,
   'date',NEW.assignment_date,'startTime',to_char(NEW.start_time,'HH24:MI'),'endTime',to_char(NEW.end_time,'HH24:MI'));
 INSERT INTO public.email_outbox(assignment_id,version,school_id,substitute_id,recipient_kind,recipient,template,payload,test_snapshot,idempotency_key)
 VALUES
 (NEW.id,v_version,NEW.school_id,v_sub,'substitute',coalesce(v_profile.email,''),
   CASE WHEN v_cancel THEN 'uppdrag-avbokat' ELSE 'uppdrag-tilldelat' END,
   v_details || jsonb_build_object('name',v_profile.full_name),v_school.is_test OR v_profile.is_test,
   NEW.id::text||':'||v_version::text||':substitute'),
 (NEW.id,v_version,NEW.school_id,v_sub,'school',coalesce(v_school.email,''),
   CASE WHEN v_cancel THEN 'uppdrag-avbokat' ELSE 'vikarie-tilldelad' END,
   v_details || jsonb_build_object('substituteName',v_profile.full_name),v_school.is_test OR v_profile.is_test,
   NEW.id::text||':'||v_version::text||':school');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_booking_email() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assignments_enqueue_email AFTER INSERT OR UPDATE OF status,assigned_substitute_id ON public.assignments
 FOR EACH ROW EXECUTE FUNCTION public.enqueue_booking_email();

CREATE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 20)
RETURNS SETOF public.email_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.email_outbox SET status='failed',last_error='lease_expired',locked_at=NULL,lock_token=NULL
 WHERE status='sending' AND locked_at<now()-interval '10 minutes' AND attempts>=8;
 RETURN QUERY WITH due AS (
  SELECT id FROM public.email_outbox
  WHERE ((status IN ('pending','retry') AND available_at<=now())
      OR (status='sending' AND locked_at<now()-interval '10 minutes')) AND attempts<8
  ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(p_limit,1),20)
 )
 UPDATE public.email_outbox e SET status='sending',attempts=e.attempts+1,locked_at=now(),lock_token=gen_random_uuid()
 FROM due WHERE e.id=due.id RETURNING e.*;
END $$;
CREATE FUNCTION public.finish_email_outbox(p_id uuid,p_lock uuid,p_status text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_updated integer;
BEGIN
 IF p_status NOT IN ('sent','captured','suppressed','cancelled','retry') THEN RAISE EXCEPTION 'Ogiltig utskicksstatus'; END IF;
 UPDATE public.email_outbox SET
 status=CASE WHEN p_status='retry' AND attempts>=8 THEN 'failed' ELSE p_status END,
 last_error=left(p_error,100),
 available_at=CASE WHEN p_status='retry' THEN now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::integer)) ELSE available_at END,
 delivered_at=CASE WHEN p_status IN ('sent','captured') THEN now() ELSE delivered_at END,
 locked_at=NULL,lock_token=NULL
 WHERE id=p_id AND lock_token=p_lock AND status='sending';
 GET DIAGNOSTICS v_updated=ROW_COUNT; RETURN v_updated=1;
END $$;
REVOKE ALL ON FUNCTION public.claim_email_outbox(integer),public.finish_email_outbox(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(integer),public.finish_email_outbox(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.admin_email_outbox(p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,assignment_id uuid,template text,recipient_kind text,status text,attempts integer,last_error text,created_at timestamptz,available_at timestamptz,test_snapshot boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 RETURN QUERY SELECT e.id,e.assignment_id,e.template,e.recipient_kind,e.status,e.attempts,e.last_error,e.created_at,e.available_at,e.test_snapshot
 FROM public.email_outbox e ORDER BY e.created_at DESC LIMIT 50 OFFSET greatest(p_offset,0);
END $$;
CREATE FUNCTION public.admin_retry_email(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Endast admin'; END IF;
 UPDATE public.email_outbox SET status='retry',attempts=0,available_at=now(),last_error=NULL,locked_at=NULL,lock_token=NULL
 WHERE id=p_id AND status IN ('failed','retry');
END $$;
REVOKE ALL ON FUNCTION public.admin_email_outbox(integer),public.admin_retry_email(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_email_outbox(integer),public.admin_retry_email(uuid) TO authenticated;

-- A deletion is resumable across Storage/Auth boundaries. Historical work stays filled.
CREATE TABLE public.account_deletion_jobs (
 user_id uuid PRIMARY KEY,
 requested_by uuid,
 stage text NOT NULL DEFAULT 'prepared' CHECK(stage IN ('prepared','files_removed','data_removed','completed')),
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.account_deletion_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.assignment_completed(p_assignment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.assignments a WHERE a.id=p_assignment_id AND a.status='filled'
   AND (a.history_completed OR (a.assigned_substitute_id IS NOT NULL AND ((a.assignment_date+a.end_time) AT TIME ZONE 'Europe/Stockholm')<now())))
$$;

CREATE FUNCTION public.admin_prepare_user_deletion(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(public.is_admin(),false) OR p_user_id=auth.uid() THEN RAISE EXCEPTION 'Kontot får inte tas bort'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id) THEN RETURN; END IF;
 -- School membership is not deleted while that school's bookings still depend on it.
 IF EXISTS(SELECT 1 FROM public.school_members m JOIN public.assignments a ON a.school_id=m.school_id
   WHERE m.user_id=p_user_id AND a.status IN ('open','filled')
   AND ((a.assignment_date+a.end_time) AT TIME ZONE 'Europe/Stockholm')>now()) THEN
   RAISE EXCEPTION 'Hantera skolans kommande uppdrag innan kontot tas bort';
 END IF;
 INSERT INTO public.account_deletion_jobs(user_id,requested_by) VALUES(p_user_id,auth.uid());
 UPDATE public.profiles SET deactivated_at=now() WHERE id=p_user_id;
 -- Cancel future work; never republish old work or silently assign another substitute.
 UPDATE public.assignments SET status='expired',cancelled_at=now(),assigned_substitute_id=NULL,assigned_at=NULL
 WHERE assigned_substitute_id=p_user_id AND ((assignment_date+end_time) AT TIME ZONE 'Europe/Stockholm')>now();
 UPDATE public.assignments SET history_completed=(status='filled'),assigned_substitute_id=NULL
 WHERE assigned_substitute_id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_prepare_user_deletion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_prepare_user_deletion(uuid) TO authenticated;

CREATE FUNCTION public.finalize_user_deletion_data(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.account_deletion_jobs WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'Borttagning har inte förberetts'; END IF;
 DELETE FROM public.notifications WHERE substitute_id=p_user_id;
 DELETE FROM public.assignment_declines WHERE substitute_id=p_user_id;
 DELETE FROM public.assignment_applications WHERE substitute_id=p_user_id;
 DELETE FROM public.ratings WHERE substitute_id=p_user_id;
 DELETE FROM public.school_ratings WHERE substitute_id=p_user_id;
 DELETE FROM public.feedback WHERE user_id=p_user_id;
 DELETE FROM public.teacher_code_attempts WHERE lower(email)=(SELECT lower(email) FROM public.profiles WHERE id=p_user_id);
 DELETE FROM public.school_invitations WHERE accepted_by=p_user_id OR email=(SELECT lower(email) FROM public.profiles WHERE id=p_user_id);
 UPDATE public.cancellation_requests SET reason='Kontot har raderats' WHERE requester_id=p_user_id;
 DELETE FROM public.cancellation_requests WHERE requester_id=p_user_id;
 UPDATE public.cancellation_requests SET resolved_by=NULL WHERE resolved_by=p_user_id;
 DELETE FROM public.school_members WHERE user_id=p_user_id;
 DELETE FROM public.user_roles WHERE user_id=p_user_id;
 -- Erase delivery details rather than retain a deleted user's address in queue payloads.
 UPDATE public.email_outbox SET status=CASE WHEN recipient_kind='substitute' THEN 'cancelled' ELSE status END,
   recipient=CASE WHEN recipient_kind='substitute' THEN '' ELSE recipient END,
   payload=payload-'name'-'substituteName',substitute_id=NULL
 WHERE substitute_id=p_user_id;
 DELETE FROM public.profiles WHERE id=p_user_id;
 UPDATE public.account_deletion_jobs SET stage='data_removed',last_error=NULL,updated_at=now() WHERE user_id=p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.finalize_user_deletion_data(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_user_deletion_data(uuid) TO service_role;

CREATE FUNCTION public.capture_email_outbox(p_id uuid,p_lock uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job public.email_outbox;
BEGIN
 SELECT * INTO v_job FROM public.email_outbox WHERE id=p_id AND lock_token=p_lock AND status='sending' FOR UPDATE;
 IF v_job.id IS NULL THEN RETURN false; END IF;
 INSERT INTO public.sandbox_emails(template,recipient,assignment_id,data,outbox_id)
 VALUES(v_job.template,v_job.recipient,v_job.assignment_id,v_job.payload,v_job.id) ON CONFLICT(outbox_id) DO NOTHING;
 PERFORM public.finish_email_outbox(p_id,p_lock,'captured',NULL);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.capture_email_outbox(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_email_outbox(uuid,uuid) TO service_role;

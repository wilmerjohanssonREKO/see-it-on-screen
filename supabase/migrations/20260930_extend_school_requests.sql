-- Extend school_requests with subject and date fields
ALTER TABLE public.school_requests
ADD COLUMN subject text,
ADD COLUMN preferred_date date,
ADD COLUMN request_status text NOT NULL DEFAULT 'new';

-- Add index for faster queries
CREATE INDEX idx_school_requests_status ON public.school_requests(request_status);

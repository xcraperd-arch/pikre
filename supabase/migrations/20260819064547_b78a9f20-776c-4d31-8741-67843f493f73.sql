TRUNCATE TABLE public.twin_documents, public.twin_agent_reports, public.twin_snapshots, public.twin_reviews, public.website_twins RESTART IDENTITY CASCADE;
DELETE FROM public.pikr_logs;
UPDATE public.profiles SET analyses_this_month = 0, usage_reset_at = date_trunc('month', now()) + interval '1 month';
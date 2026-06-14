
-- Twins: one canonical row per host
CREATE TABLE public.website_twins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL UNIQUE,
  canonical_url text NOT NULL,
  title text,
  description text,
  category text,
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  tech_stack jsonb NOT NULL DEFAULT '{}'::jsonb,
  trust jsonb NOT NULL DEFAULT '{}'::jsonb,
  markdown text,
  word_count integer NOT NULL DEFAULT 0,
  analyses_count integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX website_twins_last_seen_idx ON public.website_twins (last_seen DESC);
CREATE INDEX website_twins_category_idx ON public.website_twins (category);

GRANT SELECT ON public.website_twins TO anon, authenticated;
GRANT ALL ON public.website_twins TO service_role;
ALTER TABLE public.website_twins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Twins are public-readable" ON public.website_twins FOR SELECT USING (true);

-- Snapshots: every analysis run is appended
CREATE TABLE public.twin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  markdown text,
  summary text,
  structural_hash text,
  word_count integer NOT NULL DEFAULT 0,
  diff_summary text
);
CREATE INDEX twin_snapshots_twin_idx ON public.twin_snapshots (twin_id, captured_at DESC);

GRANT SELECT ON public.twin_snapshots TO anon, authenticated;
GRANT ALL ON public.twin_snapshots TO service_role;
ALTER TABLE public.twin_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Snapshots are public-readable" ON public.twin_snapshots FOR SELECT USING (true);

-- Agent reports
CREATE TABLE public.twin_agent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  agent text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX twin_agent_reports_twin_idx ON public.twin_agent_reports (twin_id, created_at DESC);
CREATE UNIQUE INDEX twin_agent_reports_unique ON public.twin_agent_reports (twin_id, agent);

GRANT SELECT ON public.twin_agent_reports TO anon, authenticated;
GRANT ALL ON public.twin_agent_reports TO service_role;
ALTER TABLE public.twin_agent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent reports are public-readable" ON public.twin_agent_reports FOR SELECT USING (true);

-- Documents (chunks for RAG; keyword search for now)
CREATE TABLE public.twin_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX twin_documents_twin_idx ON public.twin_documents (twin_id, chunk_index);
CREATE INDEX twin_documents_fts_idx ON public.twin_documents USING gin (to_tsvector('english', content));

GRANT SELECT ON public.twin_documents TO anon, authenticated;
GRANT ALL ON public.twin_documents TO service_role;
ALTER TABLE public.twin_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Twin documents are public-readable" ON public.twin_documents FOR SELECT USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER website_twins_set_updated_at BEFORE UPDATE ON public.website_twins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

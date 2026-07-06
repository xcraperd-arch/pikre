
-- =========================================
-- PIKR AI: Auth, ownership, moats migration
-- =========================================

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pikr_plan AS ENUM ('free', 'pro', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  plan public.pikr_plan NOT NULL DEFAULT 'free',
  analyses_this_month integer NOT NULL DEFAULT 0,
  usage_reset_at timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles self read" ON public.profiles;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 3) user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles self read" ON public.user_roles;
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- 4) Trigger: auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Add ownership/visibility to existing tables
ALTER TABLE public.website_twins
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.twin_comparisons
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.twin_debates
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Replace public-read policies with owner OR is_public
DROP POLICY IF EXISTS "Twins are public-readable" ON public.website_twins;
CREATE POLICY "twins read" ON public.website_twins FOR SELECT
  USING (is_public = true OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Comparisons are public-readable" ON public.twin_comparisons;
CREATE POLICY "comparisons read" ON public.twin_comparisons FOR SELECT
  USING (is_public = true OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Debates are public-readable" ON public.twin_debates;
CREATE POLICY "debates read" ON public.twin_debates FOR SELECT
  USING (is_public = true OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()));

-- Snapshots + agent reports + documents follow their parent twin visibility
DROP POLICY IF EXISTS "Snapshots are public-readable" ON public.twin_snapshots;
CREATE POLICY "snapshots read" ON public.twin_snapshots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.website_twins t WHERE t.id = twin_snapshots.twin_id
          AND (t.is_public = true OR t.owner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Agent reports are public-readable" ON public.twin_agent_reports;
CREATE POLICY "reports read" ON public.twin_agent_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.website_twins t WHERE t.id = twin_agent_reports.twin_id
          AND (t.is_public = true OR t.owner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Twin documents are public-readable" ON public.twin_documents;
CREATE POLICY "docs read" ON public.twin_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.website_twins t WHERE t.id = twin_documents.twin_id
          AND (t.is_public = true OR t.owner_id = auth.uid()))
);

-- 6) twin_reviews (mined real reviews)
CREATE TABLE IF NOT EXISTS public.twin_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_url text,
  author text,
  rating numeric,
  title text,
  body text,
  posted_at timestamptz,
  sentiment text,
  red_flag_tags text[] NOT NULL DEFAULT '{}',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_twin_reviews_twin ON public.twin_reviews(twin_id);
GRANT SELECT ON public.twin_reviews TO authenticated, anon;
GRANT ALL ON public.twin_reviews TO service_role;
ALTER TABLE public.twin_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews read" ON public.twin_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.website_twins t WHERE t.id = twin_reviews.twin_id
          AND (t.is_public = true OR t.owner_id = auth.uid()))
);

-- 7) twin_entities + relations (Trust Graph)
CREATE TABLE IF NOT EXISTS public.twin_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  value text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_twin_entities_twin ON public.twin_entities(twin_id);
CREATE INDEX IF NOT EXISTS idx_twin_entities_name ON public.twin_entities(lower(name));
GRANT SELECT ON public.twin_entities TO authenticated, anon;
GRANT ALL ON public.twin_entities TO service_role;
ALTER TABLE public.twin_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entities read" ON public.twin_entities FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.website_twins t WHERE t.id = twin_entities.twin_id
          AND (t.is_public = true OR t.owner_id = auth.uid()))
);

-- 8) Watchlist + alerts
CREATE TABLE IF NOT EXISTS public.twin_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'daily',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, twin_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twin_watchlist TO authenticated;
GRANT ALL ON public.twin_watchlist TO service_role;
ALTER TABLE public.twin_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist own" ON public.twin_watchlist FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.twin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twin_id uuid NOT NULL REFERENCES public.website_twins(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.twin_alerts(user_id, read_at);
GRANT SELECT, UPDATE, DELETE ON public.twin_alerts TO authenticated;
GRANT ALL ON public.twin_alerts TO service_role;
ALTER TABLE public.twin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts own read" ON public.twin_alerts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alerts own update" ON public.twin_alerts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alerts own delete" ON public.twin_alerts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 9) api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keys own" ON public.api_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10) pikr_logs
CREATE TABLE IF NOT EXISTS public.pikr_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  level text NOT NULL DEFAULT 'info',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pikr_logs_created ON public.pikr_logs(created_at DESC);
GRANT SELECT ON public.pikr_logs TO authenticated;
GRANT ALL ON public.pikr_logs TO service_role;
ALTER TABLE public.pikr_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs admin read" ON public.pikr_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 11) Updated-at trigger reuse
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sources (file / pasted text ingestion)
create table if not exists public.pikr_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  kind text not null default 'file',
  name text not null,
  mime text,
  size_bytes integer not null default 0,
  content text not null default '',
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  category text,
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pikr_sources to authenticated;
grant all on public.pikr_sources to service_role;
alter table public.pikr_sources enable row level security;
create policy "own sources" on public.pikr_sources for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.pikr_source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.pikr_sources(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
grant all on public.pikr_source_chunks to service_role;
alter table public.pikr_source_chunks enable row level security;

create or replace function public.match_source_chunks(
  p_source_id uuid, p_query vector(1536), p_match_count int default 6
) returns table (content text, similarity float)
language sql stable security definer set search_path = public as $$
  select c.content, 1 - (c.embedding <=> p_query) as similarity
  from public.pikr_source_chunks c
  where c.source_id = p_source_id and c.embedding is not null
  order by c.embedding <=> p_query
  limit p_match_count;
$$;
revoke execute on function public.match_source_chunks(uuid, vector, int) from public, anon, authenticated;
grant execute on function public.match_source_chunks(uuid, vector, int) to service_role;

-- API factory
create table if not exists public.pikr_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default 'default',
  key_prefix text not null,
  key_hash text not null,
  calls integer not null default 0,
  revoked boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pikr_api_keys to authenticated;
grant all on public.pikr_api_keys to service_role;
alter table public.pikr_api_keys enable row level security;
create policy "own api keys" on public.pikr_api_keys for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.pikr_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  twin_id uuid references public.website_twins(id) on delete cascade,
  source_id uuid references public.pikr_sources(id) on delete cascade,
  fields jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  calls integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pikr_endpoints to authenticated;
grant all on public.pikr_endpoints to service_role;
alter table public.pikr_endpoints enable row level security;
create policy "own endpoints" on public.pikr_endpoints for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Personalization
create table if not exists public.pikr_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  interests jsonb not null default '[]'::jsonb,
  industry text,
  role text,
  default_lenses jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pikr_preferences to authenticated;
grant all on public.pikr_preferences to service_role;
alter table public.pikr_preferences enable row level security;
create policy "own prefs" on public.pikr_preferences for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.pikr_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  twin_id uuid not null references public.website_twins(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, twin_id)
);
grant select, insert, update, delete on public.pikr_bookmarks to authenticated;
grant all on public.pikr_bookmarks to service_role;
alter table public.pikr_bookmarks enable row level security;
create policy "own bookmarks" on public.pikr_bookmarks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
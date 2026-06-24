
-- 1. pgvector for embeddings
create extension if not exists vector;

-- 2. Extend website_twins with screenshots, products, scores
alter table public.website_twins
  add column if not exists screenshot_url text,
  add column if not exists mobile_screenshot_url text,
  add column if not exists products jsonb not null default '[]'::jsonb,
  add column if not exists scores jsonb not null default '{}'::jsonb,
  add column if not exists xray jsonb not null default '{}'::jsonb;

-- 3. Embeddings on twin_documents (1536 dims = openai text-embedding-3-small)
alter table public.twin_documents
  add column if not exists embedding vector(1536);

create index if not exists twin_documents_embedding_idx
  on public.twin_documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists twin_documents_twin_idx
  on public.twin_documents (twin_id);

-- 4. Vector similarity RPC
create or replace function public.match_twin_documents(
  p_twin_id uuid,
  p_embedding vector(1536),
  p_match_count int default 6
)
returns table (id uuid, content text, chunk_index int, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select id, content, chunk_index,
         1 - (embedding <=> p_embedding) as similarity
  from public.twin_documents
  where twin_id = p_twin_id and embedding is not null
  order by embedding <=> p_embedding
  limit p_match_count;
$$;

grant execute on function public.match_twin_documents(uuid, vector, int) to anon, authenticated, service_role;

-- 5. Debates (dual-agent)
create table if not exists public.twin_debates (
  id uuid primary key default gen_random_uuid(),
  twin_id uuid not null references public.website_twins(id) on delete cascade,
  topic text not null,
  side_a jsonb not null default '{}'::jsonb,
  side_b jsonb not null default '{}'::jsonb,
  verdict jsonb not null default '{}'::jsonb,
  consensus_score int,
  created_at timestamptz not null default now()
);

grant select on public.twin_debates to anon, authenticated;
grant all on public.twin_debates to service_role;

alter table public.twin_debates enable row level security;

create policy "Debates are public-readable" on public.twin_debates
  for select to public using (true);

create index if not exists twin_debates_twin_idx on public.twin_debates(twin_id, created_at desc);

-- 6. Comparisons (multi-link)
create table if not exists public.twin_comparisons (
  id uuid primary key default gen_random_uuid(),
  twin_ids uuid[] not null,
  urls text[] not null,
  title text,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select on public.twin_comparisons to anon, authenticated;
grant all on public.twin_comparisons to service_role;

alter table public.twin_comparisons enable row level security;

create policy "Comparisons are public-readable" on public.twin_comparisons
  for select to public using (true);

create index if not exists twin_comparisons_created_idx on public.twin_comparisons(created_at desc);

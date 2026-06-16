
-- Ensure pgvector available (already installed in project)
create extension if not exists vector;

-- ─── P6: AI Knowledge tables ─────────────────────────────────────────────────

create table if not exists public.school_ai_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  resource_id uuid references public.school_resources(id) on delete cascade,
  title text,
  status text not null default 'queued' check (status in ('queued','parsed','embedded','failed')),
  page_count int default 0,
  total_tokens int default 0,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_school_ai_documents_school on public.school_ai_documents(school_id);
create index if not exists idx_school_ai_documents_resource on public.school_ai_documents(resource_id);

grant select, insert, update, delete on public.school_ai_documents to authenticated;
grant all on public.school_ai_documents to service_role;
alter table public.school_ai_documents enable row level security;

drop policy if exists "members read school ai docs" on public.school_ai_documents;
create policy "members read school ai docs" on public.school_ai_documents
  for select to authenticated
  using (public.is_school_member(school_id));

drop policy if exists "teachers insert school ai docs" on public.school_ai_documents;
create policy "teachers insert school ai docs" on public.school_ai_documents
  for insert to authenticated
  with check (
    public.is_school_member(school_id, 'school_teacher'::app_role)
    or public.is_school_member(school_id, 'school_admin'::app_role)
  );

drop policy if exists "teachers update school ai docs" on public.school_ai_documents;
create policy "teachers update school ai docs" on public.school_ai_documents
  for update to authenticated
  using (
    public.is_school_member(school_id, 'school_teacher'::app_role)
    or public.is_school_member(school_id, 'school_admin'::app_role)
  );

drop policy if exists "teachers delete school ai docs" on public.school_ai_documents;
create policy "teachers delete school ai docs" on public.school_ai_documents
  for delete to authenticated
  using (
    public.is_school_member(school_id, 'school_admin'::app_role)
  );

-- Chunks (vector store)
create table if not exists public.school_ai_chunks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  document_id uuid not null references public.school_ai_documents(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.school_subjects(id) on delete set null,
  ord int not null default 0,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_school_ai_chunks_school on public.school_ai_chunks(school_id);
create index if not exists idx_school_ai_chunks_doc on public.school_ai_chunks(document_id);
-- HNSW vector index for cosine similarity
do $$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='idx_school_ai_chunks_embedding'
  ) then
    execute 'create index idx_school_ai_chunks_embedding on public.school_ai_chunks using hnsw (embedding vector_cosine_ops)';
  end if;
end$$;

grant select on public.school_ai_chunks to authenticated;
grant all on public.school_ai_chunks to service_role;
alter table public.school_ai_chunks enable row level security;

drop policy if exists "members read school ai chunks" on public.school_ai_chunks;
create policy "members read school ai chunks" on public.school_ai_chunks
  for select to authenticated
  using (public.is_school_member(school_id));

-- ─── Per-school AI usage ─────────────────────────────────────────────────────

create table if not exists public.school_ai_usage_daily (
  school_id uuid not null references public.schools(id) on delete cascade,
  usage_date date not null default current_date,
  bucket text not null default 'misc',
  requests int not null default 0,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, usage_date, bucket)
);
grant select on public.school_ai_usage_daily to authenticated;
grant all on public.school_ai_usage_daily to service_role;
alter table public.school_ai_usage_daily enable row level security;

drop policy if exists "members read school ai usage" on public.school_ai_usage_daily;
create policy "members read school ai usage" on public.school_ai_usage_daily
  for select to authenticated
  using (
    public.is_school_member(school_id, 'school_admin'::app_role)
    or public.is_school_member(school_id, 'school_teacher'::app_role)
  );

create or replace function public.increment_school_ai_usage(
  _school_id uuid,
  _bucket text,
  _tokens_in int default 0,
  _tokens_out int default 0
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.school_ai_usage_daily(school_id, usage_date, bucket, requests, tokens_in, tokens_out)
  values (_school_id, current_date, coalesce(_bucket,'misc'), 1, coalesce(_tokens_in,0), coalesce(_tokens_out,0))
  on conflict (school_id, usage_date, bucket) do update
    set requests = school_ai_usage_daily.requests + 1,
        tokens_in = school_ai_usage_daily.tokens_in + coalesce(_tokens_in,0),
        tokens_out = school_ai_usage_daily.tokens_out + coalesce(_tokens_out,0),
        updated_at = now();
end$$;

create or replace function public.check_school_ai_quota(_school_id uuid)
returns table(allowed boolean, used int, "limit" int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _limit int;
  _used int;
begin
  select coalesce(s.ai_quota_daily, 0) into _limit from public.schools s where s.id = _school_id;
  select coalesce(sum(requests),0)::int into _used
    from public.school_ai_usage_daily
    where school_id = _school_id and usage_date = current_date;
  return query select (_limit = 0 or _used < _limit), _used, _limit;
end$$;

-- ─── Vector search RPC (filtered by tenant) ─────────────────────────────────

create or replace function public.match_school_chunks(
  _school_id uuid,
  _query_embedding vector(1536),
  _match_count int default 8,
  _class_id uuid default null
)
returns table(
  id uuid,
  document_id uuid,
  content text,
  class_id uuid,
  subject_id uuid,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.class_id,
    c.subject_id,
    c.metadata,
    1 - (c.embedding <=> _query_embedding) as similarity
  from public.school_ai_chunks c
  where c.school_id = _school_id
    and c.embedding is not null
    and (_class_id is null or c.class_id is null or c.class_id = _class_id)
  order by c.embedding <=> _query_embedding
  limit greatest(1, least(_match_count, 50));
$$;

-- ─── ai_response_cache tenant scoping ───────────────────────────────────────

alter table public.ai_response_cache
  add column if not exists school_id uuid references public.schools(id) on delete cascade;
create index if not exists idx_ai_response_cache_school on public.ai_response_cache(school_id);

-- ─── P7: School analytics daily rollup ──────────────────────────────────────

create table if not exists public.school_analytics_daily (
  school_id uuid not null references public.schools(id) on delete cascade,
  day date not null default current_date,
  active_users int not null default 0,
  lessons int not null default 0,
  assignments_created int not null default 0,
  submissions int not null default 0,
  graded_submissions int not null default 0,
  quiz_attempts int not null default 0,
  ai_requests int not null default 0,
  storage_mb numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, day)
);
grant select on public.school_analytics_daily to authenticated;
grant all on public.school_analytics_daily to service_role;
alter table public.school_analytics_daily enable row level security;

drop policy if exists "staff read school analytics" on public.school_analytics_daily;
create policy "staff read school analytics" on public.school_analytics_daily
  for select to authenticated
  using (
    public.is_school_member(school_id, 'school_admin'::app_role)
    or public.is_school_member(school_id, 'school_teacher'::app_role)
    or public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Storage usage helper
create or replace function public.school_storage_used_mb(_school_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(round(sum(size_bytes)::numeric / (1024*1024), 2), 0)
  from public.school_resources
  where school_id = _school_id;
$$;

-- Rebuild today's analytics row for a single school
create or replace function public.rebuild_school_analytics_today(_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _day date := current_date;
  _active int;
  _assigned int;
  _subs int;
  _graded int;
  _quizzes int;
  _ai int;
  _storage numeric;
begin
  select count(distinct user_id) into _active
    from public.study_activity sa
    join public.school_memberships sm on sm.user_id = sa.user_id
    where sm.school_id = _school_id and sa.created_at::date = _day;

  select count(*) into _assigned from public.assignments
    where school_id = _school_id and created_at::date = _day;

  select count(*) into _subs from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.school_id = _school_id and s.submitted_at::date = _day;

  select count(*) into _graded from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where a.school_id = _school_id and s.graded_at::date = _day;

  select count(*) into _quizzes from public.school_quiz_attempts sqa
    join public.quizzes q on q.id = sqa.quiz_id
    where q.school_id = _school_id and sqa.started_at::date = _day;

  select coalesce(sum(requests),0)::int into _ai
    from public.school_ai_usage_daily
    where school_id = _school_id and usage_date = _day;

  select public.school_storage_used_mb(_school_id) into _storage;

  insert into public.school_analytics_daily(
    school_id, day, active_users, assignments_created, submissions,
    graded_submissions, quiz_attempts, ai_requests, storage_mb, updated_at
  ) values (
    _school_id, _day, coalesce(_active,0), coalesce(_assigned,0), coalesce(_subs,0),
    coalesce(_graded,0), coalesce(_quizzes,0), coalesce(_ai,0), coalesce(_storage,0), now()
  )
  on conflict (school_id, day) do update set
    active_users = excluded.active_users,
    assignments_created = excluded.assignments_created,
    submissions = excluded.submissions,
    graded_submissions = excluded.graded_submissions,
    quiz_attempts = excluded.quiz_attempts,
    ai_requests = excluded.ai_requests,
    storage_mb = excluded.storage_mb,
    updated_at = now();
end$$;

-- updated_at triggers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname='trg_school_ai_documents_updated_at') then
    create trigger trg_school_ai_documents_updated_at
      before update on public.school_ai_documents
      for each row execute function public.update_updated_at_column();
  end if;
end$$;

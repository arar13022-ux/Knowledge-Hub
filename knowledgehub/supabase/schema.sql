-- =====================================================================
-- KnowledgeHub — Supabase / Postgres schema
-- Run in order. Designed for Supabase (auth.users already exists).
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 1. Roles & Profiles
-- ---------------------------------------------------------------------

create type user_role as enum ('admin', 'team_lead', 'agent');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'agent',
  team text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table access_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text
);

create table profile_access_groups (
  profile_id uuid references profiles(id) on delete cascade,
  access_group_id uuid references access_groups(id) on delete cascade,
  primary key (profile_id, access_group_id)
);

-- Helper: does the current user have a given role (or higher)?
create or replace function auth_role() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select auth_role() = 'admin'
$$;

create or replace function is_lead_or_admin() returns boolean
language sql stable as $$
  select auth_role() in ('admin', 'team_lead')
$$;

-- ---------------------------------------------------------------------
-- 2. Knowledge base: categories, keywords, articles, versions
-- ---------------------------------------------------------------------

create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  parent_id uuid references categories(id),
  created_at timestamptz not null default now()
);

create table keywords (
  id uuid primary key default uuid_generate_v4(),
  term text not null unique,
  priority smallint not null default 1 -- weight in matching
);

create type article_status as enum ('draft', 'pending_review', 'published', 'archived');

create table articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null,
  summary text,
  category_id uuid references categories(id),
  access_group_id uuid references access_groups(id),
  status article_status not null default 'draft',
  owner_id uuid references profiles(id),
  approved_by uuid references profiles(id),
  review_due_at date,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index articles_search_idx on articles using gin (search_vector);
create index articles_title_trgm_idx on articles using gin (title gin_trgm_ops);

create or replace function articles_search_vector_trigger() returns trigger
language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.body,'')), 'C');
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_articles_search
before insert or update on articles
for each row execute function articles_search_vector_trigger();

create table article_keywords (
  article_id uuid references articles(id) on delete cascade,
  keyword_id uuid references keywords(id) on delete cascade,
  primary key (article_id, keyword_id)
);

create table article_versions (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade,
  version_number int not null,
  title text not null,
  body text not null,
  edited_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Questions, matching, answers
-- ---------------------------------------------------------------------

create type question_status as enum ('auto_answered', 'queued', 'answered', 'duplicate');

create table questions (
  id uuid primary key default uuid_generate_v4(),
  asked_by uuid references profiles(id),
  raw_text text not null,
  normalized_text text not null,
  category_id uuid references categories(id),
  status question_status not null default 'queued',
  duplicate_of uuid references questions(id),
  source text not null default 'app', -- 'app' | 'google_form'
  created_at timestamptz not null default now()
);

create index questions_normalized_trgm_idx on questions using gin (normalized_text gin_trgm_ops);

create table question_matches (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid references questions(id) on delete cascade,
  article_id uuid references articles(id) on delete cascade,
  score numeric not null,
  matched_on text -- 'keyword' | 'fulltext'
);

create type answer_status as enum ('draft', 'approved', 'published');

create table answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid references questions(id) on delete cascade,
  body text not null,
  source_article_id uuid references articles(id),
  authored_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  status answer_status not null default 'draft',
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- ---------------------------------------------------------------------
-- 4. Feedback, notifications, audit log
-- ---------------------------------------------------------------------

create type feedback_type as enum ('helpful', 'not_helpful', 'outdated');

create table feedback (
  id uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade,
  answer_id uuid references answers(id) on delete cascade,
  submitted_by uuid references profiles(id),
  type feedback_type not null,
  note text,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 5. Row Level Security
-- =====================================================================

alter table profiles enable row level security;
alter table access_groups enable row level security;
alter table profile_access_groups enable row level security;
alter table categories enable row level security;
alter table keywords enable row level security;
alter table articles enable row level security;
alter table article_keywords enable row level security;
alter table article_versions enable row level security;
alter table questions enable row level security;
alter table question_matches enable row level security;
alter table answers enable row level security;
alter table feedback enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

-- Profiles: everyone can read their own; admins read all.
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles for insert with check (is_admin());

-- Access groups: readable by all authenticated users, writable by admin only.
create policy access_groups_read on access_groups for select using (auth.uid() is not null);
create policy access_groups_admin_write on access_groups for all using (is_admin());

-- Categories & keywords: read by all, write by lead/admin.
create policy categories_read on categories for select using (auth.uid() is not null);
create policy categories_write on categories for all using (is_lead_or_admin());
create policy keywords_read on keywords for select using (auth.uid() is not null);
create policy keywords_write on keywords for all using (is_lead_or_admin());

-- Articles: published articles visible to members of the access group;
-- drafts/pending visible only to owner + lead/admin of that group.
create policy articles_read_published on articles for select using (
  status = 'published'
  and (
    access_group_id is null
    or exists (
      select 1 from profile_access_groups pag
      where pag.profile_id = auth.uid() and pag.access_group_id = articles.access_group_id
    )
    or is_admin()
  )
);
create policy articles_read_own_drafts on articles for select using (
  owner_id = auth.uid() or is_lead_or_admin()
);
create policy articles_write on articles for insert with check (is_lead_or_admin());
create policy articles_update on articles for update using (
  owner_id = auth.uid() or is_admin()
);
create policy articles_publish on articles for update using (is_admin()) with check (status = 'published');

create policy article_keywords_read on article_keywords for select using (auth.uid() is not null);
create policy article_keywords_write on article_keywords for all using (is_lead_or_admin());

create policy article_versions_read on article_versions for select using (
  exists (select 1 from articles a where a.id = article_id and (a.owner_id = auth.uid() or is_lead_or_admin()))
);
create policy article_versions_write on article_versions for insert with check (is_lead_or_admin());

-- Questions: agents see their own; leads/admins see their team's queue.
create policy questions_read_own on questions for select using (asked_by = auth.uid());
create policy questions_read_queue on questions for select using (is_lead_or_admin());
create policy questions_insert on questions for insert with check (asked_by = auth.uid());
create policy questions_update_queue on questions for update using (is_lead_or_admin());

create policy question_matches_read on question_matches for select using (
  exists (select 1 from questions q where q.id = question_id and (q.asked_by = auth.uid() or is_lead_or_admin()))
);

-- Answers: draft visible to authors/leads/admins; published visible to the asker too.
create policy answers_read on answers for select using (
  is_lead_or_admin()
  or (
    status = 'published'
    and exists (select 1 from questions q where q.id = question_id and q.asked_by = auth.uid())
  )
);
create policy answers_write on answers for insert with check (is_lead_or_admin());
create policy answers_update on answers for update using (is_lead_or_admin());

-- Feedback: any authenticated user can submit; leads/admins can read all,
-- users can read their own.
create policy feedback_insert on feedback for insert with check (submitted_by = auth.uid());
create policy feedback_read on feedback for select using (
  submitted_by = auth.uid() or is_lead_or_admin()
);

-- Notifications: only the recipient can read/update their own.
create policy notifications_read on notifications for select using (recipient_id = auth.uid());
create policy notifications_update on notifications for update using (recipient_id = auth.uid());

-- Audit log: admin only.
create policy audit_log_admin_read on audit_log for select using (is_admin());

-- =====================================================================
-- 6. Matching function (deterministic, explainable — no external AI)
-- =====================================================================

create or replace function match_question(p_question_text text)
returns table(article_id uuid, score numeric, matched_on text)
language plpgsql stable as $$
declare
  v_normalized text := lower(regexp_replace(p_question_text, '[^a-zA-Z0-9 ]', '', 'g'));
begin
  return query
  -- Keyword-weighted matches
  select a.id, sum(k.priority)::numeric as score, 'keyword'::text
  from articles a
  join article_keywords ak on ak.article_id = a.id
  join keywords k on k.id = ak.keyword_id
  where a.status = 'published'
    and v_normalized ilike '%' || k.term || '%'
  group by a.id

  union all

  -- Full-text fallback
  select a.id, ts_rank(a.search_vector, plainto_tsquery('english', p_question_text))::numeric * 10, 'fulltext'::text
  from articles a
  where a.status = 'published'
    and a.search_vector @@ plainto_tsquery('english', p_question_text)

  order by score desc
  limit 5;
end;
$$;

-- Duplicate detection: trigram similarity against recent questions.
create or replace function find_duplicate_question(p_normalized text)
returns uuid
language sql stable as $$
  select id from questions
  where similarity(normalized_text, p_normalized) > 0.85
    and created_at > now() - interval '90 days'
  order by similarity(normalized_text, p_normalized) desc
  limit 1
$$;

-- =====================================================================
-- 7. Analytics views
-- =====================================================================

create view v_unanswered_questions as
select q.id, q.raw_text, q.category_id, q.created_at,
       extract(epoch from (now() - q.created_at)) / 3600 as hours_open
from questions q
where q.status = 'queued';

create view v_aging_articles as
select a.id, a.title, a.review_due_at, a.owner_id,
       coalesce(fb.helpful, 0) as helpful_count,
       coalesce(fb.not_helpful, 0) as not_helpful_count
from articles a
left join (
  select article_id,
         count(*) filter (where type = 'helpful') as helpful,
         count(*) filter (where type = 'not_helpful') as not_helpful
  from feedback group by article_id
) fb on fb.article_id = a.id
where a.status = 'published'
  and (a.review_due_at is null or a.review_due_at <= current_date + interval '30 days');

create view v_duplicate_clusters as
select duplicate_of as canonical_question_id, count(*) as duplicate_count
from questions
where duplicate_of is not null
group by duplicate_of
order by duplicate_count desc;

create view v_feedback_health as
select article_id,
       count(*) filter (where type = 'helpful') as helpful,
       count(*) filter (where type = 'not_helpful') as not_helpful,
       count(*) filter (where type = 'outdated') as outdated_reports
from feedback
group by article_id;

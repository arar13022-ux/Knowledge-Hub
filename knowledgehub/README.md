# KnowledgeHub

Internal knowledge management platform for retail operations. See
`docs/ARCHITECTURE.md` for the full spec, data model, matching pipeline, and
roadmap.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (creates tables, RLS
   policies, matching functions, and analytics views).
3. Copy `.env.example` to `.env.local` and fill in your project URL and anon
   key.
4. `npm install`
5. `npm run dev`

## Seeding your first admin

New sign-ups default to the `agent` role via the `profiles` table's default.
Promote your first user to admin directly in the Supabase SQL editor:

```sql
update profiles set role = 'admin' where id = '<your-auth-user-id>';
```

## Project layout

```
src/
  context/      Auth + theme providers
  lib/          Supabase client, matching pipeline helpers
  pages/        Route-level views (KB, Ask, Queue, Analytics, Admin)
  components/   Shared UI (Layout/nav)
  types/        Shared TypeScript types mirroring the DB schema
supabase/
  schema.sql    Full DDL, RLS policies, matching functions, analytics views
docs/
  ARCHITECTURE.md   Full product + technical spec, MVP scope, roadmap
```

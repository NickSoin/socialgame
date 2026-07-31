# NextHit staging database

This Supabase project composes the production schema from `apps/database` with
the staging-only schema in `supabase/schemas/staging.sql`. It has independent
local ports, migration history, credentials, and remote project linkage.

Never link this directory to the production Supabase project. Production
migrations continue to be managed only from `apps/database`.

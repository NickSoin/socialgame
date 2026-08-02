BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

SELECT has_table('public', 'staging_user_roles', 'staging user roles table exists');
SELECT has_table('public', 'staging_role_audit_log', 'append-only role audit exists');
SELECT has_table('public', 'simulations', 'simulation aggregate exists');
SELECT has_table('public', 'simulation_score_entries', 'score inspector inputs are stored');

SELECT throws_ok(
  $$SELECT 'root'::public.staging_user_role$$,
  '22P02', NULL,
  'root cannot be represented in the database role enum'
);

INSERT INTO public.staging_user_roles(user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'user');
SELECT is(
  (SELECT role::text FROM public.staging_user_roles WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  'user',
  'an external universal account can receive the default user role'
);

INSERT INTO public.staging_pending_role_assignments(email, role)
VALUES ('designer@test.local', 'game_designer');
INSERT INTO public.staging_user_roles(user_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', 'game_designer');
UPDATE public.staging_pending_role_assignments
SET status = 'claimed',
    claimed_by = '22222222-2222-2222-2222-222222222222',
    claimed_at = now()
WHERE email = 'designer@test.local';
SELECT is(
  (SELECT role::text FROM public.staging_user_roles WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  'game_designer',
  'an external universal account can receive game designer access'
);
SELECT is(
  (SELECT status::text FROM public.staging_pending_role_assignments WHERE email = 'designer@test.local'),
  'claimed',
  'pending assignment supports an external universal account ID'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT throws_ok(
  $$SELECT count(*) FROM public.staging_user_roles$$,
  '42501', NULL,
  'authenticated users cannot read staging role rows directly'
);
SELECT throws_ok(
  $$INSERT INTO public.simulations(name, simulation_time, random_seed, created_by)
    VALUES ('blocked', now(), 1, '11111111-1111-1111-1111-111111111111')$$,
  '42501', NULL,
  'authenticated users cannot create simulations directly'
);
RESET ROLE;

INSERT INTO public.staging_role_audit_log(action, target_email)
VALUES ('access_denied', 'ordinary@test.local');
SELECT throws_ok(
  $$UPDATE public.staging_role_audit_log SET target_email = 'changed@test.local'$$,
  '42501', NULL,
  'role audit rows cannot be updated'
);
SELECT throws_ok(
  $$DELETE FROM public.staging_role_audit_log$$,
  '42501', NULL,
  'role audit rows cannot be deleted'
);

SELECT is(
  private.staging_canonical_points(90, 60, 100),
  30::numeric,
  'canonical points reward improvement over the leave-one-out crowd'
);
SELECT is(
  private.staging_canonical_points(60, 60, 100),
  0::numeric,
  'matching the crowd earns zero relative points'
);
SELECT is(
  private.staging_canonical_points(20, 60, 100),
  -40::numeric,
  'underperforming the crowd earns negative points'
);

INSERT INTO public.simulations(id, name, simulation_time, random_seed, created_by)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Simulation A', '2026-07-01 00:00:00+00', 1, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Simulation B', '2026-07-01 00:00:00+00', 2, '11111111-1111-1111-1111-111111111111');
INSERT INTO public.simulation_games(simulation_id, name)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Game A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Game B');
DELETE FROM public.simulations WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT is(
  (SELECT count(*) FROM public.simulation_games WHERE simulation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting one simulation cascades only its scoped entities'
);
SELECT is(
  (SELECT count(*) FROM public.simulation_games WHERE simulation_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1::bigint,
  'another simulation remains isolated after reset or deletion'
);

SELECT * FROM finish();
ROLLBACK;

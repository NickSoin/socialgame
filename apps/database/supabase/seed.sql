-- Local-only demo accounts. Password for every account: Password123!
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'admin@steamforecast.local',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Alyx Resolver"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'gordon@steamforecast.local',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Gordon Forecaster"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'chell@steamforecast.local',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Chell Predicts"}',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  seeded_user.id::text,
  seeded_user.id,
  jsonb_build_object(
    'sub', seeded_user.id::text,
    'email', seeded_user.email,
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
FROM auth.users AS seeded_user
WHERE seeded_user.id IN (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

UPDATE public.profiles
SET
  username = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN 'alyx_resolver'
    WHEN '20000000-0000-4000-8000-000000000002' THEN 'gordon_forecast'
    WHEN '30000000-0000-4000-8000-000000000003' THEN 'chell_predicts'
  END,
  display_name = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN 'Alyx Resolver'
    WHEN '20000000-0000-4000-8000-000000000002' THEN 'Gordon Forecaster'
    WHEN '30000000-0000-4000-8000-000000000003' THEN 'Chell Predicts'
  END,
  bio = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN 'Local market resolver and Steam data curator.'
    WHEN '20000000-0000-4000-8000-000000000002' THEN 'Predicting player-count milestones one crowbar at a time.'
    WHEN '30000000-0000-4000-8000-000000000003' THEN 'Indie launches, review scores, and co-op trends.'
  END,
  avatar_id = CASE id
    WHEN '10000000-0000-4000-8000-000000000001' THEN 'neon_purple'::public.avatar_id
    WHEN '20000000-0000-4000-8000-000000000002' THEN 'steam_blue'::public.avatar_id
    WHEN '30000000-0000-4000-8000-000000000003' THEN 'pixel_green'::public.avatar_id
  END
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
);

INSERT INTO private.admin_users (user_id)
VALUES ('10000000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.markets (
  id,
  slug,
  steam_app_id,
  steam_title,
  question,
  description,
  category,
  yes_price_bps,
  closes_at,
  header_image_url
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'counter-strike-2-peak-18m-before-2027',
    730,
    'Counter-Strike 2',
    'Will Counter-Strike 2 exceed 1.8 million concurrent Steam players before 2027?',
    'Resolves YES if the public Steam concurrent-player record for app 730 exceeds 1,800,000 before the market closes.',
    'Player count',
    6200,
    date_trunc('year', now()) + interval '1 year',
    'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg'
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'stardew-valley-900k-english-reviews',
    413150,
    'Stardew Valley',
    'Will Stardew Valley reach 900,000 English-language Steam reviews before 2027?',
    'Resolves YES if the Steam store page for app 413150 shows at least 900,000 English reviews before the market closes.',
    'Reviews',
    4700,
    date_trunc('year', now()) + interval '1 year',
    'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg'
  ),
  (
    'a3000000-0000-4000-8000-000000000003',
    'hades-2-overwhelmingly-positive-autumn-sale',
    1145350,
    'Hades II',
    'Will Hades II have Overwhelmingly Positive recent Steam reviews at the 2026 Autumn Sale close?',
    'Resolves from the recent-review label shown on the Steam store page for app 1145350 at market close.',
    'Review score',
    7100,
    now() + interval '120 days',
    'https://cdn.akamai.steamstatic.com/steam/apps/1145350/header.jpg'
  ),
  (
    'a4000000-0000-4000-8000-000000000004',
    'cyberpunk-2077-winter-sale-50k-peak',
    1091500,
    'Cyberpunk 2077',
    'Will Cyberpunk 2077 exceed 50,000 concurrent Steam players during the 2026 Winter Sale?',
    'Resolves YES if app 1091500 records a concurrent-player peak above 50,000 during the sale window.',
    'Player count',
    5400,
    now() + interval '180 days',
    'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.forecast_targets (
  id,
  market_id,
  key,
  label,
  unit,
  min_value,
  max_value,
  step,
  display_order,
  status,
  closes_at,
  resolved_value,
  resolved_at
)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'peak_ccu', 'Next 30 days peak CCU', 'players', 0, 3000000, 1000, 1, 'open', now() + interval '30 days', NULL, NULL),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'year_end_reviews', 'Reviews by year end', 'reviews', 0, 20000000, 1000, 2, 'open', date_trunc('year', now()) + interval '1 year', NULL, NULL),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'winter_sale_price', 'Winter Sale price in US', 'usd', 0, 100, 0.01, 3, 'open', now() + interval '150 days', NULL, NULL),
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'peak_ccu', 'Next 30 days peak CCU', 'players', 0, 1000000, 1000, 1, 'open', now() + interval '30 days', NULL, NULL),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'year_end_reviews', 'Reviews by year end', 'reviews', 0, 3000000, 1000, 2, 'open', date_trunc('year', now()) + interval '1 year', NULL, NULL),
  ('b2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000002', 'winter_sale_price', 'Winter Sale price in US', 'usd', 0, 100, 0.01, 3, 'open', now() + interval '150 days', NULL, NULL),
  ('b3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'sale_peak_ccu', 'Autumn Sale peak CCU', 'players', 0, 1000000, 1000, 1, 'open', now() + interval '120 days', NULL, NULL),
  ('b3000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003', 'year_end_reviews', 'Reviews by year end', 'reviews', 0, 3000000, 1000, 2, 'open', date_trunc('year', now()) + interval '1 year', NULL, NULL),
  ('b3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000003', 'winter_sale_price', 'Winter Sale price in US', 'usd', 0, 100, 0.01, 3, 'open', now() + interval '150 days', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000004', 'sale_peak_ccu', 'Winter Sale peak CCU', 'players', 0, 1000000, 1000, 1, 'open', now() + interval '180 days', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000004', 'year_end_reviews', 'Reviews by year end', 'reviews', 0, 3000000, 1000, 2, 'open', date_trunc('year', now()) + interval '1 year', NULL, NULL),
  ('b4000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000004', 'winter_sale_price', 'Winter Sale price in US', 'usd', 0, 100, 0.01, 3, 'open', now() + interval '150 days', NULL, NULL),
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'resolved_peak_checkpoint', 'Resolved peak checkpoint', 'players', 0, 3000000, 1000, 99, 'resolved', now() - interval '1 day', 1350000, now() - interval '4 hours'),
  ('c2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'resolved_review_checkpoint', 'Resolved review checkpoint', 'reviews', 0, 3000000, 1000, 99, 'resolved', now() - interval '4 days', 910000, now() - interval '3 days'),
  ('c3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000003', 'resolved_score_checkpoint', 'Resolved score checkpoint', 'score', 0, 100, 1, 99, 'resolved', now() - interval '21 days', 82, now() - interval '20 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.numeric_predictions (target_id, user_id, value, created_at, updated_at)
VALUES
  ('b1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1430000, now(), now()),
  ('b1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 1475000, now(), now()),
  ('b1000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 1390000, now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 9250000, now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 9700000, now(), now()),
  ('b1000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 9010000, now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 0, now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 0, now(), now()),
  ('b1000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 0, now(), now()),
  ('b2000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 185000, now(), now()),
  ('b2000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 172000, now(), now()),
  ('b2000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 198000, now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 980000, now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1025000, now(), now()),
  ('b2000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 995000, now(), now()),
  ('b2000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 7.49, now(), now()),
  ('b2000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 9.99, now(), now()),
  ('b2000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 8.49, now(), now()),
  ('b3000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 110000, now(), now()),
  ('b3000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 125000, now(), now()),
  ('b3000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 98000, now(), now()),
  ('b3000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 160000, now(), now()),
  ('b3000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 178000, now(), now()),
  ('b3000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 151000, now(), now()),
  ('b3000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 24.99, now(), now()),
  ('b3000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 27.99, now(), now()),
  ('b3000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 29.99, now(), now()),
  ('b4000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 88000, now(), now()),
  ('b4000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 96000, now(), now()),
  ('b4000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 91000, now(), now()),
  ('b4000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 800000, now(), now()),
  ('b4000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 835000, now(), now()),
  ('b4000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 790000, now(), now()),
  ('b4000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 19.99, now(), now()),
  ('b4000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 24.99, now(), now()),
  ('b4000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 22.49, now(), now()),
  ('c1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1355000, now() - interval '1 day', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 1420000, now() - interval '1 day', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 1300000, now() - interval '1 day', now() - interval '1 day'),
  ('c2000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 870000, now() - interval '4 days', now() - interval '4 days'),
  ('c2000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 910000, now() - interval '4 days', now() - interval '4 days'),
  ('c2000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 900000, now() - interval '4 days', now() - interval '4 days'),
  ('c3000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 75, now() - interval '21 days', now() - interval '21 days'),
  ('c3000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 72, now() - interval '21 days', now() - interval '21 days'),
  ('c3000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 82, now() - interval '21 days', now() - interval '21 days')
ON CONFLICT (user_id, target_id) DO UPDATE
SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;

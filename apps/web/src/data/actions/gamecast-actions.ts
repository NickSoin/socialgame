'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authActionClient } from '@/lib/safe-action';
import { createSupabaseClient } from '@/supabase-clients/server';
import { AVATARS } from '@/lib/gamecast';
import { STEAM_BET_TARGET_KEYS } from '@/lib/steam-bets';
import { getSteamPopularUpcoming } from '@/data/steam-popular-upcoming';

const outcomeSchema = z.enum(['yes', 'no']);

export const placeSteamBetAction = authActionClient
  .schema(
    z.object({
      steamAppId: z.number().int().positive(),
      targetKey: z.enum(STEAM_BET_TARGET_KEYS),
      value: z.number().finite().min(0).max(100_000_000),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const games = await getSteamPopularUpcoming();
    const game = games.find((candidate) => candidate.appId === parsedInput.steamAppId);
    if (!game) throw new Error('This game is no longer open for predictions.');

    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
      .from('steam_bets')
      .insert({
        steam_app_id: parsedInput.steamAppId,
        target_key: parsedInput.targetKey,
        user_id: ctx.userId,
        value: parsedInput.value,
        game_name: game.name,
        release_date: game.releaseDate,
        release_label: game.releaseLabel,
        image_url: game.imageUrl,
      })
      .select('steam_app_id,target_key,value')
      .single();

    if (error?.code === '23505') {
      throw new Error('This prediction is already locked.');
    }
    if (error) throw new Error(error.message);

    revalidatePath('/');
    revalidatePath('/trending');
    revalidatePath('/involved');
    return data;
  });

export const saveForecastAction = authActionClient
  .schema(
    z.object({
      targetId: z.string().uuid(),
      marketSlug: z.string().min(1),
      value: z.number().finite().min(0).max(100_000_000),
    }),
  )
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc('upsert_numeric_prediction', {
      p_target_id: parsedInput.targetId,
      p_value: parsedInput.value,
    });

    if (error) throw new Error(error.message);

    revalidatePath('/');
    revalidatePath(`/event/${parsedInput.marketSlug}`);
    revalidatePath('/profile', 'layout');
    return data;
  });

export const placePredictionAction = authActionClient
  .schema(
    z.object({
      marketId: z.string().uuid(),
      marketSlug: z.string().min(1),
      outcome: outcomeSchema,
      stake: z.number().int().min(1).max(100_000),
    }),
  )
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc('place_prediction', {
      p_market_id: parsedInput.marketId,
      p_outcome: parsedInput.outcome,
      p_stake: parsedInput.stake,
    });

    if (error) throw new Error(error.message);

    revalidatePath(`/event/${parsedInput.marketSlug}`);
    revalidatePath('/dashboard');
    revalidatePath('/leaderboards');
    return data;
  });

const allowedAvatarIds = AVATARS.map((avatar) => avatar.id) as [
  (typeof AVATARS)[number]['id'],
  ...(typeof AVATARS)[number]['id'][],
];

export const updateProfileAction = authActionClient
  .schema(
    z.object({
      username: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(24)
        .regex(/^[a-z0-9_]+$/),
      displayName: z.string().trim().min(1).max(48),
      bio: z.string().trim().max(240),
      avatarId: z.enum(allowedAvatarIds),
      website: z.union([z.literal(''), z.string().url().max(200)]),
      steam: z.union([z.literal(''), z.string().url().max(200)]),
      twitch: z.union([z.literal(''), z.string().url().max(200)]),
    }),
  )
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient();
    const links = Object.fromEntries(
      Object.entries({
        website: parsedInput.website,
        steam: parsedInput.steam,
        twitch: parsedInput.twitch,
      }).filter(([, value]) => value),
    );

    const { data, error } = await supabase.rpc('update_own_profile', {
      p_username: parsedInput.username,
      p_display_name: parsedInput.displayName,
      p_bio: parsedInput.bio,
      p_avatar_id: parsedInput.avatarId,
      p_links: links,
    });

    if (error) throw new Error(error.message);

    revalidatePath('/settings/profile');
    revalidatePath(`/profile/${parsedInput.username}`);
    revalidatePath('/leaderboards');
    return data;
  });

export const resolveMarketAction = authActionClient
  .schema(
    z.object({
      marketId: z.string().uuid(),
      marketSlug: z.string().min(1),
      outcome: outcomeSchema,
    }),
  )
  .action(async ({ parsedInput }) => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.rpc('resolve_market', {
      p_market_id: parsedInput.marketId,
      p_outcome: parsedInput.outcome,
    });

    if (error) throw new Error(error.message);

    revalidatePath('/');
    revalidatePath('/dashboard');
    revalidatePath('/admin/markets');
    revalidatePath(`/event/${parsedInput.marketSlug}`);
    revalidatePath('/leaderboards');
    return data;
  });

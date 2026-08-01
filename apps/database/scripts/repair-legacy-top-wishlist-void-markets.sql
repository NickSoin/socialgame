with repairable as (
  select market.id, market.steam_app_id, market.metric_type, game.release_date
  from public.steam_forecast_markets as market
  join public.steam_games as game
    on game.steam_app_id = market.steam_app_id
  where market.status = 'void'
    and market.void_reason = 'Game left the TopWishlisted catalog'
    and game.lifecycle_status = 'released'
    and game.release_date is not null
    and game.release_date <= current_date
), repaired as (
  update public.steam_forecast_markets as market
  set
    status = 'locked',
    lock_at = private.steam_metric_lock_at(repairable.release_date),
    resolve_after = private.steam_metric_resolve_after(
      repairable.metric_type,
      repairable.release_date
    ),
    source_release_date = repairable.release_date,
    void_reason = null,
    voided_at = null,
    resolution_last_error = null,
    resolution_next_retry_at = null,
    updated_at = now()
  from repairable
  where market.id = repairable.id
  returning market.steam_app_id, market.metric_type, market.resolve_after
)
select
  count(*) as repaired_market_count,
  count(*) filter (where resolve_after <= now()) as due_now_count,
  count(*) filter (where resolve_after > now()) as waiting_count
from repaired;

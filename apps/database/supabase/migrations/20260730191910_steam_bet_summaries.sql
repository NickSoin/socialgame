set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_steam_bet_summaries()
 RETURNS TABLE(steam_app_id bigint, target_key text, average_value numeric, prediction_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    bet.steam_app_id,
    bet.target_key,
    avg(bet.value) AS average_value,
    count(*) AS prediction_count
  FROM public.steam_bets AS bet
  GROUP BY bet.steam_app_id, bet.target_key
  ORDER BY bet.steam_app_id, bet.target_key;
$function$
;



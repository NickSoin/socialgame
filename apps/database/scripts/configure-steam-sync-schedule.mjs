const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

if (!accessToken || !projectRef) {
  throw new Error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF before running this script.");
}

const jobs = [
  ["sync-steam-catalog-every-2-hours", "7 */2 * * *", "sync-steam-catalog"],
  ["sync-steam-popular-every-2-hours", "17 */2 * * *", "sync-steam-popular"],
  ["sync-steam-details-every-10-minutes", "2,12,22,32,42,52 * * * *", "sync-steam-details"],
];
const databaseJobs = [
  ["steam-market-cycle-every-5-minutes", "*/5 * * * *", "SELECT public.process_steam_market_cycle()"],
  [
    "steam-market-daily-snapshot",
    "0 0 * * *",
    "SELECT public.create_steam_market_snapshots(date_trunc('day', now()))",
  ],
];
const managedJobNames = [
  "sync-steam-wishlist-catalog",
  "sync-steam-details-every-2-hours",
  "sync-steam-details-hourly",
  ...jobs.map(([name]) => name),
  ...databaseJobs.map(([name]) => name),
];

const invokeFunctionSql = (functionName) => `SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'next_hit_market_project_url') || '/functions/v1/${functionName}',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'next_hit_market_publishable_key')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 180000
)`;

await runQuery(`
  SELECT cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = ANY (ARRAY[${managedJobNames.map(sqlString).join(", ")}]);
`);

for (const [name, schedule, functionName] of jobs) {
  await runQuery(`SELECT cron.schedule(
    ${sqlString(name)},
    ${sqlString(schedule)},
    ${sqlString(invokeFunctionSql(functionName))}
  );`);
}

for (const [name, schedule, query] of databaseJobs) {
  await runQuery(`SELECT cron.schedule(
    ${sqlString(name)},
    ${sqlString(schedule)},
    ${sqlString(query)}
  );`);
}

const configured = await runQuery(`
  SELECT jobname, schedule
  FROM cron.job
  WHERE jobname = ANY (ARRAY[${[...jobs, ...databaseJobs].map(([name]) => sqlString(name)).join(", ")}])
  ORDER BY schedule;
`);
console.log(JSON.stringify(configured, null, 2));

async function runQuery(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `Supabase Management API ${response.status}`);
  return payload;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

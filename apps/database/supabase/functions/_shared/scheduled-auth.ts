export function authorizeScheduledRequest(request: Request) {
  const expected = Deno.env.get("STEAM_SYNC_CRON_SECRET");
  if (!expected || expected.length < 32) {
    return Response.json({ error: "Scheduled function authentication is not configured" }, { status: 500 });
  }

  const provided = request.headers.get("x-steam-sync-secret") ?? "";
  if (!constantTimeEqual(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

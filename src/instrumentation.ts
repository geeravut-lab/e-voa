// Next.js calls this for every error thrown while rendering a page, a route or a server action. We keep a scrubbed copy for /admin/errors.
export async function onRequestError(error: Error & { digest?: string }, request: { path: string; method: string }, context: { routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("@/lib/errorlog");
  await logError({ route: `${request.method} ${context.routePath || request.path}`.split("?")[0], kind: context.routeType, message: error.message || String(error), digest: error.digest });
}

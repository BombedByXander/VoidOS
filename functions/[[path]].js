const DEFAULT_UPSTREAM = "https://lunaar.org";

function versionResponse(env) {
  const build =
    env.CF_PAGES_COMMIT_SHA ||
    env.CF_PAGES_DEPLOYMENT_ID ||
    env.CF_PAGES_BRANCH ||
    "cloudflare-pages";

  return Response.json({ version: "10.0", build: `10.0-${build}` }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === "/api/version") {
    return versionResponse(env);
  }

  const upstream = new URL(env.UPSTREAM_URL || DEFAULT_UPSTREAM);
  upstream.pathname = requestUrl.pathname;
  upstream.search = requestUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("x-forwarded-host", requestUrl.host);

  return fetch(new Request(upstream, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  }));
}

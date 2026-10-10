function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function addConfiguredOrigin(origins: Set<string>, value: string | null | undefined) {
  if (!value) return;
  try {
    origins.add(new URL(value).origin);
  } catch {
    // Invalid optional deployment configuration must not weaken the check.
  }
}

/**
 * Validate browser mutation requests against the public host seen by the
 * reverse proxy. On Cloud Run, request.url can contain a different service
 * hostname from the Host header used by the browser.
 */
export function hasTrustedRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  addConfiguredOrigin(allowedOrigins, process.env.APP_URL);

  const host = firstHeaderValue(request.headers.get("host"));
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? `${forwardedProtocol}:`
    : requestUrl.protocol;

  if (host) addConfiguredOrigin(allowedOrigins, `${protocol}//${host}`);

  return allowedOrigins.has(normalizedOrigin);
}

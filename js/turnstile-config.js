export function resolveTurnstileSiteKey(siteKey, { development = false, hostname = "" } = {}) {
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  return development && loopback ? "" : siteKey || "";
}

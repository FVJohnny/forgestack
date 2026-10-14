/**
 * The single rule for the path prefix a service is served under on the main
 * origin (Caddy's `handle_path <prefix>/*` strips it before proxying, so the
 * service itself still serves /api/v1 internally):
 *
 *   - `service-<N>`  → `/svc<N>`   (service-3 → /svc3, matching /svc1, /svc2)
 *   - any other name → `/svc<name without dashes>` (billing → /svcbilling,
 *                                                 user-profile → /svcuserprofile)
 *
 * Every place the generators need the prefix (the Caddy route, the
 * PROXY_BASE_PATH env value, the printed URLs) goes through this helper, so
 * they can never disagree. infra/caddy/Caddyfile documents the same rule.
 */
function servicePathPrefix(name) {
  const numbered = /^service-(\d+)$/.exec(name);
  if (numbered) {
    return `/svc${numbered[1]}`;
  }
  return `/svc${name.replace(/-/g, '')}`;
}

module.exports = { servicePathPrefix };

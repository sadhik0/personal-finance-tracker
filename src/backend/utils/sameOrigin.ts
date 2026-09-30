import { NextResponse } from "next/server";

const blockedResponse = () =>
  NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const isMutating = (req: Request) => MUTATING.has(req.method.toUpperCase());

/** The origin this request was addressed to, as the browser sees it. */
function ownOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host.split(",")[0].trim()}`;
}

/** Optional extra exact origins, comma separated (e.g. a custom domain). */
function extraOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/**
 * CSRF guard for state-changing requests. The browser's Origin header must
 * match this site's origin EXACTLY (scheme + host + port). No wildcards.
 *  - No Origin header: fall back to the Referer's origin.
 *  - Neither: accept only if the browser says Sec-Fetch-Site is same-origin.
 * Returns a 403 response to send, or null when the request is fine.
 */
export function requireSameOrigin(req: Request): NextResponse | null {
  if (!isMutating(req)) return null;
  const allowed = new Set([ownOrigin(req), ...extraOrigins()]);

  let claimed = req.headers.get("origin");
  if (!claimed || claimed === "null") {
    const ref = req.headers.get("referer");
    claimed = null;
    if (ref) {
      try {
        claimed = new URL(ref).origin;
      } catch {
        claimed = null;
      }
    }
  }
  if (claimed) return allowed.has(claimed) ? null : blockedResponse();
  return req.headers.get("sec-fetch-site") === "same-origin" ? null : blockedResponse();
}

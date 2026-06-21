import { requireAuth, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { validateApiKey } from "./apiKeys.js";

/**
 * Resolve a userId from EITHER an API key (header `x-api-key`, or
 * `Authorization: Bearer cvk_…`) OR a Clerk session, and set it on
 * `req.codevideoUserId`. Additive: when no API key is present this behaves
 * exactly like the legacy `requireAuth()` + `getAuth()` path, so the studio
 * (Clerk session) flow is unchanged.
 */
export async function authClerkOrApiKey(req: Request, res: Response, next: NextFunction) {
  const headerKey = req.header("x-api-key");
  const authHeader = req.header("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const rawKey = headerKey || (bearer.startsWith("cvk_") ? bearer : "");

  if (rawKey) {
    const userId = await validateApiKey(rawKey);
    if (!userId) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    (req as any).codevideoUserId = userId;
    return next();
  }

  // No API key at all and no session credential → clean 401 (API clients expect
  // a status code, not Clerk's redirect-to-sign-in). The studio always sends an
  // Authorization header, so this only catches programmatic callers with no auth.
  if (!authHeader) {
    return res
      .status(401)
      .json({ error: "Authentication required: send an API key via the x-api-key header, or sign in." });
  }

  // Has a session credential → Clerk validates it (requireAuth handles failure)
  return requireAuth()(req, res, () => {
    const { userId } = getAuth(req);
    if (!userId) {
      if (!res.headersSent) res.status(401).json({ error: "User not authenticated" });
      return;
    }
    (req as any).codevideoUserId = userId;
    next();
  });
}

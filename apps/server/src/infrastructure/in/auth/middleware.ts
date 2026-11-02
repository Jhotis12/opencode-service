import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { UserRecord } from "../../../domain/entities.ts";
import type { Store } from "../../../application/ports/store.ts";
import type { SessionCodec } from "./session.ts";
import { apiError } from "@platform/shared";

export const SESSION_COOKIE = "platform_session";

export type AuthVariables = { user: UserRecord };

export function readUser(c: Context, store: Store, codec: SessionCodec): UserRecord | undefined {
  const session = codec.verify(getCookie(c, SESSION_COOKIE));
  if (!session) return undefined;
  return store.users.findById(session.userId);
}

const PASSWORD_CHANGE_ALLOWLIST = new Set([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
]);

export function authMiddleware(store: Store, codec: SessionCodec): MiddlewareHandler {
  return async (c, next) => {
    const user = readUser(c, store, codec);
    if (!user) {
      return c.json(apiError("UNAUTHORIZED", "authentication required"), 401);
    }
    c.set("user", user);
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWLIST.has(c.req.path)) {
      return c.json(apiError("PASSWORD_CHANGE_REQUIRED", "change the initial password before continuing"), 403);
    }
    await next();
  };
}

/** Session lookup without the password gate, for routes that must run pre-rotation. */
export function sessionMiddleware(store: Store, codec: SessionCodec): MiddlewareHandler {
  return async (c, next) => {
    const user = readUser(c, store, codec);
    if (!user) return c.json(apiError("UNAUTHORIZED", "authentication required"), 401);
    c.set("user", user);
    await next();
  };
}

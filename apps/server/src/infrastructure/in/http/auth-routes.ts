import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { apiError, type User } from "@platform/shared";
import type { Store } from "../../../application/ports/store.ts";
import type { PasswordHasher } from "../../../application/ports/security.ts";
import {
  ChangePasswordUseCase,
  InvalidCredentialsError,
  LoginUseCase,
  PasswordPolicyError,
} from "../../../application/use-cases/auth.ts";
import { RateLimiter } from "../auth/rate-limiter.ts";
import { SESSION_COOKIE, authMiddleware, readUser, type AuthVariables } from "../auth/middleware.ts";
import type { SessionCodec } from "../auth/session.ts";

export interface AuthRouteDeps {
  store: Store;
  hasher: PasswordHasher;
  codec: SessionCodec;
  secureCookies?: boolean;
  loginLimiter?: RateLimiter;
}

function toUser(user: { id: string; username: string; mustChangePassword: boolean; createdAt: string }): User {
  return {
    id: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

export function createAuthRoutes(deps: AuthRouteDeps): Hono<{ Variables: AuthVariables }> {
  const app = new Hono<{ Variables: AuthVariables }>();
  const login = new LoginUseCase(deps.store, deps.hasher);
  const changePassword = new ChangePasswordUseCase(deps.store, deps.hasher);
  const limiter = deps.loginLimiter ?? new RateLimiter(10, 15 * 60 * 1000);

  app.post("/login", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!limiter.allow(ip)) {
      return c.json(apiError("RATE_LIMITED", "too many login attempts, try again later"), 429);
    }
    let body: { username?: string; password?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("VALIDATION_ERROR", "invalid json body"), 422);
    }
    if (!body.username || !body.password) {
      return c.json(apiError("VALIDATION_ERROR", "username and password are required"), 422);
    }
    try {
      const user = await login.execute(body.username, body.password);
      const token = deps.codec.sign(user.id);
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: deps.secureCookies ?? false,
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return c.json({ user: toUser(user), mustChangePassword: user.mustChangePassword });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return c.json(apiError("INVALID_CREDENTIALS", "invalid username or password"), 401);
      }
      throw error;
    }
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  // Public session probe: returns 200 with a null user so the SPA can boot without a 401 noise.
  app.get("/me", (c) => {
    const user = readUser(c, deps.store, deps.codec);
    return c.json({ user: user ? toUser(user) : null, mustChangePassword: user?.mustChangePassword ?? false });
  });

  app.use("/change-password", authMiddleware(deps.store, deps.codec));
  app.post("/change-password", async (c) => {
    let body: { currentPassword?: string; newPassword?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("VALIDATION_ERROR", "invalid json body"), 422);
    }
    if (!body.currentPassword || !body.newPassword) {
      return c.json(apiError("VALIDATION_ERROR", "currentPassword and newPassword are required"), 422);
    }
    try {
      const user = await changePassword.execute(c.get("user").id, body.currentPassword, body.newPassword);
      return c.json({ user: toUser(user), mustChangePassword: false });
    } catch (error) {
      if (error instanceof PasswordPolicyError) {
        return c.json(apiError("WEAK_PASSWORD", error.message), 422);
      }
      if (error instanceof InvalidCredentialsError) {
        return c.json(apiError("INVALID_CREDENTIALS", "current password is incorrect"), 401);
      }
      throw error;
    }
  });

  return app;
}

import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { BunPasswordHasher } from "../src/infrastructure/out/security/bun-password-hasher.ts";
import { SessionCodec } from "../src/infrastructure/in/auth/session.ts";
import { createAuthRoutes } from "../src/infrastructure/in/http/auth-routes.ts";
import { authMiddleware } from "../src/infrastructure/in/auth/middleware.ts";
import { RateLimiter } from "../src/infrastructure/in/auth/rate-limiter.ts";

const DEFAULT_PASSWORD = "admin123!";
const STRONG_PASSWORD = "plataforma-segura-2026";

async function buildApp() {
  const store = new SqliteStore(":memory:");
  const hasher = new BunPasswordHasher();
  const codec = new SessionCodec("test-secret");
  store.users.create({
    id: "u1",
    username: "admin",
    passwordHash: await hasher.hash(DEFAULT_PASSWORD),
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  });
  const app = new Hono();
  app.route("/api/auth", createAuthRoutes({ store, hasher, codec, loginLimiter: new RateLimiter(10, 60_000) }));
  app.use("/api/private/*", authMiddleware(store, codec));
  app.get("/api/private/ping", (c) => c.json({ ok: true }));
  return { app, store, codec };
}

async function login(app: Hono, password = DEFAULT_PASSWORD) {
  return app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password }),
  });
}

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("auth routes", () => {
  let app: Hono;
  let store: SqliteStore;

  beforeEach(async () => {
    ({ app, store } = await buildApp());
  });

  it("rejects requests without a session", async () => {
    const response = await app.request("/api/private/ping");
    expect(response.status).toBe(401);
  });

  it("rejects invalid credentials", async () => {
    const response = await login(app, "incorrecta");
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("INVALID_CREDENTIALS");
  });

  it("logs in and blocks protected routes until the password rotates", async () => {
    const response = await login(app);
    expect(response.status).toBe(200);
    expect((await response.json()).mustChangePassword).toBe(true);
    const cookie = cookieFrom(response);

    const blocked = await app.request("/api/private/ping", { headers: { cookie } });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("rotates the password and unlocks protected routes", async () => {
    const cookie = cookieFrom(await login(app));
    const weak = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: "corta" }),
    });
    expect(weak.status).toBe(422);

    const changed = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: STRONG_PASSWORD }),
    });
    expect(changed.status).toBe(200);
    expect(store.users.findByUsername("admin")!.mustChangePassword).toBe(false);

    const allowed = await app.request("/api/private/ping", { headers: { cookie } });
    expect(allowed.status).toBe(200);
  });

  it("rejects rotation with a wrong current password", async () => {
    const cookie = cookieFrom(await login(app));
    const response = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "no-es-la-clave", newPassword: STRONG_PASSWORD }),
    });
    expect(response.status).toBe(401);
  });

  it("rate limits repeated login attempts", async () => {
    for (let i = 0; i < 10; i += 1) await login(app, "incorrecta");
    const blocked = await login(app, "incorrecta");
    expect(blocked.status).toBe(429);
  });

  it("clears the session on logout", async () => {
    const cookie = cookieFrom(await login(app));
    const logout = await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("platform_session=");
  });

  it("rejects expired or forged tokens", async () => {
    const codec = new SessionCodec("test-secret");
    const forged = `${codec.sign("u1")}x`;
    const response = await app.request("/api/private/ping", { headers: { cookie: `platform_session=${forged}` } });
    expect(response.status).toBe(401);
  });
});

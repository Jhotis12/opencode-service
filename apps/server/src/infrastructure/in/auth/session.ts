import { createHmac, timingSafeEqual } from "node:crypto";

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export class SessionCodec {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds = 7 * 24 * 60 * 60,
  ) {}

  sign(userId: string, now = Date.now()): string {
    const payload: SessionPayload = {
      sub: userId,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + this.ttlSeconds,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.signature(body);
    return `${body}.${signature}`;
  }

  verify(token: string | undefined, now = Date.now()): { userId: string } | undefined {
    if (!token) return undefined;
    const [body, signature] = token.split(".");
    if (!body || !signature) return undefined;
    const expected = this.signature(body);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
      if (!payload.sub || payload.exp * 1000 <= now) return undefined;
      return { userId: payload.sub };
    } catch {
      return undefined;
    }
  }

  private signature(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}

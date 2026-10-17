import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify, argon2id } from "argon2";
import {
  Router,
  type CookieOptions,
  type Request,
  type RequestHandler,
} from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "../../lib/errors.js";
import { parse } from "../../lib/validation.js";

export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const cookieName = (production: boolean) =>
  production ? "__Host-salary_session" : "salary_session";
export const cookieOptions = (production: boolean): CookieOptions => ({
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
});
const loginBody = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
function cookieToken(req: Request, name: string) {
  const values = (req.headers.cookie ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;
  const token = values[0]!.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export function authModule(
  db: PrismaClient,
  origin: string,
  production: boolean,
) {
  const router = Router();
  router.use((req, _res, next) => {
    parse(z.strictObject({}), req.query, 400);
    next();
  });
  const name = cookieName(production);
  const options = cookieOptions(production);
  // Same verification cost for unknown email; generated once, never a valid user credential.
  const dummyHash = hash(randomBytes(32), { type: argon2id });
  const attempts = new Map<string, { count: number; expires: number }>();
  const originCheck: RequestHandler = (req, _res, next) => {
    if (req.get("origin") !== origin)
      throw new ApiError(
        403,
        "ORIGIN_REJECTED",
        "Request origin is not allowed",
      );
    next();
  };
  const jsonOnly: RequestHandler = (req, _res, next) => {
    if (!req.is("application/json"))
      throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json");
    next();
  };
  const requireSession: RequestHandler = async (req, _res, next) => {
    const token = cookieToken(req, name);
    if (!token)
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    const session = await db.session.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!session || session.expiresAt <= req.now)
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    req.auth = {
      sessionId: session.id,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      user: session.user,
    };
    next();
  };
  const csrfCheck: RequestHandler = (req, _res, next) => {
    const token = req.get("x-csrf-token") ?? "";
    if (
      !req.auth ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(req.auth.csrfToken))
    ) {
      throw new ApiError(403, "CSRF_REJECTED", "Invalid CSRF token");
    }
    next();
  };
  const mutations: RequestHandler = (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    originCheck(req, res, (error) => {
      if (error) return next(error);
      csrfCheck(req, res, (error) => {
        if (error) return next(error);
        jsonOnly(req, res, next);
      });
    });
  };

  router.post("/login", originCheck, jsonOnly, async (req, res) => {
    const input = parse(loginBody, req.body);
    const now = req.now.getTime();
    for (const [ip, state] of attempts)
      if (state.expires <= now) attempts.delete(ip);
    const ip = req.ip ?? "unknown";
    let state = attempts.get(ip);
    if (!state) {
      if (attempts.size >= 10000) {
        res.set("Retry-After", "900");
        throw new ApiError(429, "LOGIN_RATE_LIMITED", "Try again later");
      }
      state = { count: 0, expires: now + 15 * 60_000 };
      attempts.set(ip, state);
    }
    if (state.count >= 5) {
      res.set(
        "Retry-After",
        String(Math.max(1, Math.ceil((state.expires - now) / 1000))),
      );
      throw new ApiError(429, "LOGIN_RATE_LIMITED", "Try again later");
    }
    // Reserve before awaiting password verification so concurrent failures cannot bypass the cap.
    state.count++;
    const user = await db.user.findUnique({ where: { email: input.email } });
    const valid = await verify(
      user?.passwordHash ?? (await dummyHash),
      input.password,
    );
    if (!user || !valid)
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    state.count--;
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(now + 8 * 60 * 60_000);
    const oldToken = cookieToken(req, name);
    await db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { expiresAt: { lte: req.now } } });
      if (oldToken)
        await tx.session.deleteMany({
          where: { tokenHash: tokenHash(oldToken) },
        });
      await tx.session.create({
        data: {
          tokenHash: tokenHash(token),
          csrfToken,
          userId: user.id,
          expiresAt,
          createdAt: req.now,
        },
      });
    });
    res.cookie(name, token, { ...options, maxAge: 8 * 60 * 60_000 });
    res.json({
      data: { user: { id: user.id, email: user.email }, csrfToken, expiresAt },
    });
  });
  router.get("/session", requireSession, (req, res) => {
    const { user, csrfToken, expiresAt } = req.auth!;
    res.json({ data: { user, csrfToken, expiresAt } });
  });
  router.get("/csrf", requireSession, (req, res) =>
    res.json({ data: { csrfToken: req.auth!.csrfToken } }),
  );
  router.post("/logout", requireSession, mutations, (req, res, next) => {
    parse(z.strictObject({}), req.body);
    db.session
      .deleteMany({ where: { id: req.auth!.sessionId } })
      .then(() => {
        res.clearCookie(name, options).status(204).end();
      })
      .catch(next);
  });
  return { router, requireSession, mutations };
}

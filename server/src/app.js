import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { pool, query, transaction } from "./db.js";
import { hashPassword, newToken, safeEqual, tokenHash, verifyPassword } from "./security.js";

const app = express();
const googleClient = new OAuth2Client();
const SESSION_COOKIE = "dukaan_session";
const CSRF_COOKIE = "dukaan_csrf";
const SESSION_DAYS = 14;
const origins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",").map((value) => value.trim()).filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters");
}

app.disable("x-powered-by");
app.set("trust proxy", isProduction ? 1 : false);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  maxAge: 600,
}));
app.use(express.json({ limit: "5mb", strict: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again later." },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(10).max(128);
const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

function cookieValue(req, name) {
  const entry = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

function requireCsrf(req, res, next) {
  const cookie = cookieValue(req, CSRF_COOKIE);
  const header = req.get("X-CSRF-Token") || "";
  if (!cookie || !safeEqual(cookie, header)) {
    return res.status(403).json({ error: "CSRF validation failed. Refresh and try again." });
  }
  return next();
}

async function requireAuth(req, res, next) {
  try {
    const token = cookieValue(req, SESSION_COOKIE);
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const result = await query(
      `SELECT s.id, s.user_id, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash(token)]
    );
    if (!result.rowCount) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    req.user = result.rows[0];
    req.sessionId = result.rows[0].id;
    return next();
  } catch (error) {
    return next(error);
  }
}

async function createSession(userId, res) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash(token), expiresAt]
  );
  setSessionCookie(res, token, expiresAt);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "dukaan-ledger-api" }));

app.get("/api/auth/csrf", (_req, res) => {
  const token = newToken(24);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
  res.set("Cache-Control", "no-store");
  return res.json({ csrfToken: token });
});

app.post("/api/auth/register", authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a name, valid email and password (at least 10 characters)." });
    const { name, email, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    const result = await query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, name, email",
      [name, email, passwordHash]
    );
    if (!result.rowCount) return res.status(409).json({ error: "An account with this email already exists." });
    await createSession(result.rows[0].id, res);
    return res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/login", authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid email and password." });
    const result = await query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [parsed.data.email]
    );
    const user = result.rows[0];
    // Perform a dummy scrypt verification for unknown users to reduce account enumeration timing differences.
    const valid = user
      ? await verifyPassword(parsed.data.password, user.password_hash)
      : await verifyPassword(parsed.data.password, "scrypt:00000000000000000000000000000000:" + "0".repeat(128));
    if (!user || !valid) return res.status(401).json({ error: "Email or password is incorrect." });
    await createSession(user.id, res);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/google", authLimiter, requireCsrf, async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: "Google sign-in has not been configured yet." });
    }
    const credential = z.string().min(20).max(10000).safeParse(req.body?.credential);
    if (!credential.success) return res.status(400).json({ error: "A valid Google credential is required." });
    const ticket = await googleClient.verifyIdToken({
      idToken: credential.data,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: "Google did not provide a verified email address." });
    }
    const user = await transaction(async (client) => {
      const linked = await client.query(
        `SELECT u.id, u.name, u.email FROM oauth_accounts a
         JOIN users u ON u.id = a.user_id
         WHERE a.provider = 'google' AND a.provider_subject = $1`,
        [payload.sub]
      );
      if (linked.rowCount) return linked.rows[0];
      const email = payload.email.toLowerCase();
      const created = await client.query(
        `INSERT INTO users (name, email, email_verified_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (email) DO UPDATE
         SET email_verified_at = COALESCE(users.email_verified_at, NOW())
         RETURNING id, name, email`,
        [payload.name || email.split("@")[0], email]
      );
      const account = created.rows[0];
      await client.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_subject)
         VALUES ($1, 'google', $2)
         ON CONFLICT (provider, provider_subject) DO NOTHING`,
        [account.id, payload.sub]
      );
      return account;
    });
    await createSession(user.id, res);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    if (error?.name === "Error" || error?.message?.includes("Token used too early")) {
      return res.status(401).json({ error: "Google sign-in could not be verified." });
    }
    return next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireCsrf, requireAuth, async (req, res, next) => {
  try {
    await query("DELETE FROM sessions WHERE id = $1", [req.sessionId]);
    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

// One private JSON document per account is the first cloud-sync milestone.
// Every query is scoped to the authenticated user id; clients cannot choose an owner id.
app.get("/api/data", apiLimiter, requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT data, revision, updated_at FROM shop_data WHERE user_id = $1",
      [req.user.id]
    );
    res.set("Cache-Control", "no-store");
    return res.json(result.rowCount
      ? { data: result.rows[0].data, revision: result.rows[0].revision, updatedAt: result.rows[0].updated_at }
      : { data: null, revision: 0, updatedAt: null });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/data", apiLimiter, requireCsrf, requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({
      data: z.record(z.string(), z.unknown()),
      revision: z.number().int().nonnegative(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid shop data payload." });
    const result = await query(
      `INSERT INTO shop_data (user_id, data, revision, updated_at)
       VALUES ($1, $2::jsonb, 1, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET data = EXCLUDED.data, revision = shop_data.revision + 1, updated_at = NOW()
       WHERE shop_data.revision = $3
       RETURNING revision, updated_at`,
      [req.user.id, JSON.stringify(parsed.data.data), parsed.data.revision]
    );
    if (!result.rowCount) {
      return res.status(409).json({ error: "Shop data changed in another session. Reload before saving." });
    }
    return res.json({ revision: result.rows[0].revision, updatedAt: result.rows[0].updated_at });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  // Avoid returning database details, SQL, tokens, or stack traces to clients.
  console.error("API request failed:", error?.message || "Unknown error");
  if (res.headersSent) return;
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;

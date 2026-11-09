import * as oidc from "oidc-provider";
import express from "express";
import { query } from "./db.js";
import { safeEqual, tokenHash, newToken } from "./security.js";
import PostgresOidcAdapter from "./oidc-adapter.js";

const SESSION_COOKIE = "dukaan_session";
const OIDC_CSRF_COOKIE = "dukaan_oidc_csrf";
const isProduction = process.env.NODE_ENV === "production";

function readCookie(req, name) {
  const item = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

async function currentUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const result = await query(
    `SELECT u.id, u.name, u.email
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash(token)]
  );
  return result.rows[0] || null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export async function mountOidc(app) {
  const issuer = (process.env.OIDC_ISSUER_URL || "http://localhost:4000/oidc").replace(/\/$/, "");
  const frontendUrl = (process.env.OIDC_FRONTEND_URL || (process.env.FRONTEND_ORIGINS || "http://localhost:5173").split(",")[0]).replace(/\/$/, "");
  const cookieSecret = process.env.OIDC_COOKIE_SECRET;
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error("OIDC_COOKIE_SECRET must contain at least 32 characters");
  }

  let clients = [];
  try {
    clients = JSON.parse(process.env.OIDC_CLIENTS || "[]");
    if (!Array.isArray(clients)) throw new Error("OIDC_CLIENTS must be a JSON array");
  } catch {
    throw new Error("OIDC_CLIENTS must be valid JSON containing an array of registered clients");
  }

  const provider = new oidc.Provider(issuer, {
    findById: async (_ctx, id) => {
      const result = await query("SELECT id, name, email, email_verified_at FROM users WHERE id = $1", [id]);
      const account = result.rows[0];
      if (!account) return undefined;
      return {
        accountId: account.id,
        async claims(_use, scope) {
          const claims = { sub: account.id };
          if (scope.includes("profile")) claims.name = account.name;
          if (scope.includes("email")) {
            claims.email = account.email;
            claims.email_verified = Boolean(account.email_verified_at);
          }
          return claims;
        },
      };
    },
    scopes: ["openid", "profile", "email"],
    responseTypes: ["code"],
    claims: {
      openid: ["sub"],
      profile: ["name"],
      email: ["email", "email_verified"],
    },
    features: {
      devInteractions: { enabled: false },
      registration: { enabled: false },
      pkce: { supportedMethods: ["S256"] },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },
    cookies: {
      keys: [cookieSecret],
      short: { sameSite: isProduction ? "none" : "lax", secure: isProduction },
      long: { sameSite: isProduction ? "none" : "lax", secure: isProduction },
    },
    interactionUrl: (_ctx, interaction) => `${issuer}/interaction/${interaction.uid}`,
    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60,
      IdToken: 60 * 60,
      RefreshToken: 60 * 60 * 24 * 30,
    },
  });

  provider.use(async (ctx, next) => {
    if (ctx.path === "/auth" && ctx.method === "POST") {
      ctx.status = 405;
      ctx.body = { error: "invalid_request", error_description: "Use the GET authorization endpoint with PKCE S256." };
      return;
    }
    if (ctx.method === "GET" && ctx.path === "/auth" && String(ctx.query.response_type || "").split(" ").includes("code")) {
      if (!ctx.query.code_challenge || ctx.query.code_challenge_method !== "S256") {
        ctx.status = 400;
        ctx.body = { error: "invalid_request", error_description: "Authorization Code flow requires PKCE with S256." };
        return;
      }
    }
    await next();
  });
  await provider.initialize({ clients, adapter: PostgresOidcAdapter });
  provider.proxy = isProduction;
  app.use("/oidc/interaction", express.urlencoded({ extended: false, limit: "10kb" }));

  app.get("/oidc/interaction/:uid", async (req, res, next) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const user = await currentUser(req);
      if (!user) {
        const returnTo = `${issuer}/interaction/${encodeURIComponent(req.params.uid)}`;
        return res.redirect(302, `${frontendUrl}/?returnTo=${encodeURIComponent(returnTo)}`);
      }

      if (details.prompt.name === "login") {
        return provider.interactionFinished(req, res, {
          login: { account: user.id, remember: true, ts: Math.floor(Date.now() / 1000) },
        });
      }

      if (details.prompt.name === "consent") {
        const csrf = newToken(24);
        res.cookie(OIDC_CSRF_COOKIE, csrf, {
          httpOnly: false,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
          path: "/oidc/interaction",
        });
        const requestedScopes = String(details.params.scope || "openid").split(" ").filter(Boolean);
        const clientName = details.params.client_id;
        return res.status(200).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize application · Dukaan Ledger</title>
<style>
body{font:15px system-ui,sans-serif;background:#f4f6f2;color:#192720;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px}
main{max-width:440px;width:100%;box-sizing:border-box;background:#fff;border:1px solid #e4e9e2;border-radius:18px;padding:30px;box-shadow:0 16px 50px #14291d18}
.brand{font-weight:800;color:#1e4635;margin-bottom:28px}h1{font-size:25px;margin:0 0 10px}p{color:#5e7065;line-height:1.55}ul{padding-left:22px;line-height:2;color:#31483b}
button{width:100%;height:46px;border:0;border-radius:9px;background:#1e4635;color:white;font-weight:700;cursor:pointer;margin-top:10px}
button.secondary{background:#fff;color:#31483b;border:1px solid #dce5dc}
small{display:block;color:#7a8b80;margin-top:17px}
</style></head><body><main>
<div class="brand">द &nbsp; Dukaan Ledger</div>
<h1>Allow this app to sign you in?</h1>
<p><strong>${escapeHtml(clientName)}</strong> is requesting access to your Dukaan Ledger account.</p>
<p>It is requesting these details:</p><ul>${requestedScopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join("")}</ul>
<p>Signed in as <strong>${escapeHtml(user.email)}</strong>.</p>
<form method="post" action="/oidc/interaction/${encodeURIComponent(req.params.uid)}/confirm">
<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<button type="submit">Approve access</button>
</form>
<form method="post" action="/oidc/interaction/${encodeURIComponent(req.params.uid)}/deny">
<input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
<button class="secondary" type="submit">Cancel</button>
</form>
<small>You can revoke this application's access later. Only approve apps you recognize.</small>
</main></body></html>`);
      }

      return provider.interactionFinished(req, res, {});
    } catch (error) {
      return next(error);
    }
  });

  app.post("/oidc/interaction/:uid/confirm", async (req, res, next) => {
      try {
        const cookie = readCookie(req, OIDC_CSRF_COOKIE);
        if (!cookie || !safeEqual(cookie, String(req.body?.csrf || ""))) {
          return res.status(403).send("Request validation failed. Please restart sign-in.");
        }
        const user = await currentUser(req);
        if (!user) return res.status(401).send("Please sign in to Dukaan Ledger first.");
        const details = await provider.interactionDetails(req, res);
        if (details.prompt.name !== "consent") return res.status(400).send("This authorization request is no longer active.");
        const existingGrant = details.params.grantId
          ? await provider.Grant.find(details.params.grantId)
          : undefined;
        const grant = existingGrant || new provider.Grant(user.id, details.params.client_id);
        grant.addOIDCScope(details.params.scope || "openid");
        if (details.params.claims) grant.addOIDCClaims(details.params.claims);
        const grantId = await grant.save();
        return provider.interactionFinished(req, res, { consent: { grantId } });
      } catch (error) {
        return next(error);
      }
  });

  app.post("/oidc/interaction/:uid/deny", async (req, res, next) => {
      try {
        const cookie = readCookie(req, OIDC_CSRF_COOKIE);
        if (!cookie || !safeEqual(cookie, String(req.body?.csrf || ""))) {
          return res.status(403).send("Request validation failed. Please restart sign-in.");
        }
        const user = await currentUser(req);
        if (!user) return res.status(401).send("Please sign in to Dukaan Ledger first.");
        return provider.interactionFinished(req, res, {
          error: "access_denied",
          error_description: "The account owner cancelled the authorization request.",
        });
      } catch (error) {
        return next(error);
      }
  });

  app.use("/oidc", provider.callback);
  return provider;
}


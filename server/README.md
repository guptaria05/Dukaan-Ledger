# Dukaan Ledger API — authentication foundation

This service is the first backend milestone. It provides email/password accounts, Google Identity Services credential verification, opaque server-side sessions, CSRF protection, and an account-scoped cloud-data document API.

## Requirements

- Node.js 20.19+.
- PostgreSQL 14+.
- A Google OAuth 2.0 Web client ID for Google sign-in.

## Local setup

1. Create a PostgreSQL database.
2. Run `psql "$DATABASE_URL" -f server/schema.sql` from the repository root (or run `psql -f schema.sql` inside this directory).
3. Copy `.env.example` to `.env` and set the database URL, a random 32+ character session secret, and Google client ID.
4. Run `npm install --prefix server`.
5. Run `npm run dev --prefix server`.

The API listens on port 4000 by default. Configure the Vite frontend to call this API through its configured API base URL; frontend integration is a subsequent milestone.

## Endpoints

- `GET /health`
- `GET /api/auth/csrf` — returns a CSRF token and sets its same-site cookie.
- `POST /api/auth/register` — `{ name, email, password }`.
- `POST /api/auth/login` — `{ email, password }`.
- `POST /api/auth/google` — `{ credential }` from Google Identity Services.
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/data` and `PUT /api/data` — private account-scoped JSON document with optimistic revision checks.

For mutating requests, fetch the CSRF token first and send it in `X-CSRF-Token`. Send requests with credentials enabled. Session cookies are HttpOnly, SameSite=Lax, and Secure in production.

## Important deployment settings

Set `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `FRONTEND_ORIGINS`, `NODE_ENV=production`, and `PORT` in the backend host's secret/environment settings. Keep the database private. Do not commit real environment files or OAuth secrets.

## Current scope and next milestones

This foundation is not yet the complete SSO release. The next milestones are the frontend login/account experience and migration of existing browser data, followed by a standards-based OpenID Connect issuer for relying-party applications. Do not advertise OIDC SSO as available until that issuer and its authorization-code/PKCE flow have been implemented and tested.

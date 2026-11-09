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

For mutating requests, fetch the CSRF token first and send it in `X-CSRF-Token`. Send requests with credentials enabled. Session cookies are HttpOnly; they use SameSite=Lax locally and SameSite=None; Secure in production so a separately hosted frontend can call the API. Modern browsers may restrict third-party cookies, so production should use a frontend and API on the same site (for example, app.example.com and api.example.com).

## OpenID Connect client registration

Set `OIDC_ISSUER_URL` to the exact public issuer URL (for example `https://api.example.com/oidc`). Set `OIDC_FRONTEND_URL` to the deployed frontend and `OIDC_COOKIE_SECRET` to a separate random secret. Configure `OIDC_CLIENTS` as a JSON array. A public SPA/native client should use `token_endpoint_auth_method: "none"`, `response_types: ["code"]`, `grant_types: ["authorization_code"]`, an exact `redirect_uris` list, and PKCE S256. Confidential server-side clients should use a supported client authentication method and keep their secret server-side. Never use implicit or password grants.

Example public client (replace the ID and callback with the actual application values):

```json
[{"client_id":"example-app","redirect_uris":["https://app.example.com/auth/callback"],"response_types":["code"],"grant_types":["authorization_code"],"token_endpoint_auth_method":"none"}]
```

## Important deployment settings

Set `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `FRONTEND_ORIGINS`, `NODE_ENV=production`, and `PORT` in the backend host's secret/environment settings. Keep the database private. Do not commit real environment files or OAuth secrets.

## Current scope and next milestones

This foundation is not yet the complete SSO release. The next milestones are account recovery, account settings, full end-to-end testing, and deployment configuration. Existing browser data import is explicit and leaves the legacy copy in place. Do not use this as a production identity service until the issuer has been tested against a real relying-party client, its public issuer URL and client registrations are configured, and deployment secrets are set.

# Web architecture

Dukaan Ledger is a single-page React application built with Vite and TypeScript.

- UI and business workflows: src/App.tsx.
- Responsive styling: src/styles.css.
- Entry point: src/main.tsx.
- Persistence: account-namespaced browser cache plus an authenticated PostgreSQL JSON document API. The legacy localStorage document is offered for import into the first account.
- Authentication: Express API with scrypt password hashes, Google Identity Services token verification, HMAC-digested opaque sessions, HttpOnly cookies, CSRF token validation and per-account data ownership.
- The account sync layer uses optimistic revisions and surfaces conflicts instead of silently overwriting a newer remote document.
- Currency: integer paise, displayed as Indian rupees.
- Sales store a sale-time cost snapshot; a transaction may use a selling price that differs from the product catalogue's default price.
- Stock purchase records include product, vendor, quantity, unit cost, date and total.
- Revenue chart aggregation supports monthly, daily and hourly groupings.
- Deployment output: Vite dist directory.

Data is currently browser-local and single-device. A production deployment still requires a configured private PostgreSQL database, HTTPS, Google OAuth client configuration, backup/restore procedures, account recovery, audit history and end-to-end security testing. OpenID Connect issuer support is planned separately.

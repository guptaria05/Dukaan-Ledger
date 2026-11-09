# Web architecture

Dukaan Ledger is a single-page React application built with Vite and TypeScript.

- UI: React application in src/App.tsx.
- Styling: responsive CSS in src/styles.css.
- Entry point: src/main.tsx.
- Persistence: browser localStorage, namespaced under dukaan-ledger-web-v1.
- Currency: integer paise, displayed as Indian rupees.
- Deployment output: Vite dist directory.

The current implementation is browser-local and single-device. A future hosted version should add authenticated APIs, a relational database, server-side validation, backups, audit history and role-based access before enabling shared shop accounts.

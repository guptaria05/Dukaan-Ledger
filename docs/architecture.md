# Web architecture

Dukaan Ledger is a single-page React application built with Vite and TypeScript.

- UI and business workflows: src/App.tsx.
- Responsive styling: src/styles.css.
- Entry point: src/main.tsx.
- Persistence: browser localStorage, namespaced under dukaan-ledger-web-v1.
- Currency: integer paise, displayed as Indian rupees.
- Sales store a sale-time cost snapshot; a transaction may use a selling price that differs from the product catalogue's default price.
- Stock purchase records include product, vendor, quantity, unit cost, date and total.
- Revenue chart aggregation supports monthly, daily and hourly groupings.
- Deployment output: Vite dist directory.

Data is currently browser-local and single-device. A production deployment should add authenticated APIs, a relational database, server-side validation, backups, audit history and role-based access before enabling shared shop accounts.

# Dukaan Ledger — Web

Dukaan Ledger is a responsive shop-management website built with React, TypeScript and Vite.

## Current features
- Revenue dashboard with Today, Month-to-date and Year-to-date totals.
- Revenue charts with Year (month-wise), Month (day-wise) and Day (hour-wise) views.
- Product inventory with user-defined categories, cost price, default selling price and low-stock thresholds.
- Sale-level selling-price override while using the inventory cost price for profit calculations.
- Stock additions, opening stock, dated stock movement history and monthly added-unit totals.
- Weekly stock review CSV and overall inventory CSV downloads.
- Customer-wise item breakdown, quantities, sales, payments and outstanding credit.
- Customer creation dates and last-month new-customer list/export.
- Vendor directory and vendor-linked purchase register with quantities and costs.
- Seasonal plans with month ranges and linked products (for example, Diwali inventory).
- Expense tracking and estimated net-profit reporting.
- Responsive desktop and mobile-browser layout.

## Authentication and account backend (in progress)

The `server/` directory contains the first backend milestone: email/password registration and login, Google credential verification, secure server-side sessions, CSRF protection, and per-account cloud-data storage. See [`server/README.md`](server/README.md) for setup and API details. The React login/account interface and browser-data migration are being added next. The OpenID Connect SSO issuer is a separate follow-up milestone and is not available yet.

## Run locally
Requirements: Node.js 20.19+ or 22.12+ and npm.

    npm install
    npm run dev

Open the local URL printed by Vite, usually http://localhost:5173.

## Production build

    npm run typecheck
    npm run build
    npm run preview

The production website is generated in the dist directory and can be deployed to Vercel, Netlify or another static host.

## Data storage and privacy
This milestone stores records in localStorage in the current browser on the current device. It does not yet include user accounts, cloud sync, multi-device access or server-side backups. Clearing browser data or switching devices can make records unavailable. Add export/import and authenticated cloud persistence before relying on this as the only record system for a real shop.

## Financial notes
Amounts are stored as integer paise. Each sale snapshots the product cost at the time of sale. The inventory's default selling price can be overridden on an individual sale without changing the catalogue price. Credit sales require a customer, and stock cannot be sold below zero.

# Dukaan Ledger — Web

Dukaan Ledger is now a responsive website for managing a small retail shop. The previous Expo / React Native application has been replaced by a React + Vite + TypeScript web application.

## Features
- Dashboard with daily sales, gross profit, stock investment and customer dues.
- Product inventory and low-stock alerts.
- Stock purchases with weighted-average cost updates.
- Sales recording with automatic stock deduction and sale-time cost snapshots.
- Customer accounts, credit balances and payment collection.
- Expense tracking and monthly revenue, cost and estimated net-profit reporting.
- Responsive desktop and mobile-browser layout.

## Run locally
Requirements: Node.js 20.19+ or 22.12+ and npm.

    npm install
    npm run dev

Open the local URL printed by Vite, usually http://localhost:5173.

## Production build

    npm run typecheck
    npm run build
    npm run preview

The production website is generated in the dist directory and can be deployed to Vercel, Netlify or any static hosting provider.

## Data storage and privacy
This milestone stores records in localStorage in the current browser on the current device. It does not yet include accounts, cloud sync, multi-device access or server-side backups. Clearing browser data or switching devices can make records unavailable. Export/import and authenticated cloud persistence should be implemented before relying on this as the only record system for a real shop.

## Financial notes
Amounts are stored as integer paise. Sales preserve the product cost at the time of sale. Credit sales require a customer, and stock cannot be sold below zero.

The repository keeps its existing Git history, but its application source has been replaced with the web implementation.
